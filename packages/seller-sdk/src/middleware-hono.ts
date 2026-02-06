import type { Context, Next, MiddlewareHandler } from "hono";
import {
  type SellerConfig,
  type ChainConfig,
  type SupportedChain,
  DEFAULT_CHAIN_CONFIGS,
  SECURITY_HEADERS,
} from "@apitoll/shared";
import {
  buildPaymentRequirements,
  encodePaymentRequired,
  verifyPayment,
  findEndpointConfig,
  getEndpointFeeBreakdown,
} from "./payment";
import { AnalyticsReporter } from "./analytics";

/**
 * Hono middleware for x402 payments with platform fee support.
 *
 * Usage:
 * ```ts
 * import { Hono } from "hono";
 * import { paymentMiddleware } from "@apitoll/seller-sdk/hono";
 *
 * const app = new Hono();
 *
 * app.use("*", paymentMiddleware({
 *   walletAddress: "0xYourWallet...",
 *   endpoints: {
 *     "GET /api/data": {
 *       price: "0.005",
 *       chains: ["base", "solana"],
 *       description: "Premium data feed",
 *     },
 *   },
 *   platformFee: {
 *     feeBps: 300, // 3%
 *     platformWalletBase: "0xPlatformWallet...",
 *   },
 * }));
 * ```
 */
export function paymentMiddleware(options: SellerConfig): MiddlewareHandler {
  const {
    walletAddress,
    endpoints,
    chainConfigs: customChainConfigs,
    facilitatorUrl,
    webhookUrl,
    platformApiKey,
    platformFee,
  } = options;

  const chainConfigs: Record<SupportedChain, ChainConfig> = {
    base: { ...DEFAULT_CHAIN_CONFIGS.base, ...customChainConfigs?.base },
    solana: { ...DEFAULT_CHAIN_CONFIGS.solana, ...customChainConfigs?.solana },
  };

  const reporter = new AnalyticsReporter({
    apiKey: platformApiKey,
    webhookUrl,
    verbose: process.env.NODE_ENV !== "production",
  });

  // Rate limiting: Redis-backed with circuit breaker fallback
  const RATE_LIMIT_WINDOW_MS = 60_000;
  const RATE_LIMIT_MAX = 120;

  let redis: any = null;
  try {
    const Redis = require('redis');
    redis = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    });
  } catch {
    console.warn('Redis not available for Hono middleware, using in-memory rate limiting');
  }

  // Circuit breaker state
  let redisFailureCount = 0;
  let circuitOpen = false;
  let circuitOpenedAt = 0;
  const CIRCUIT_FAILURE_THRESHOLD = 5;
  const CIRCUIT_RESET_MS = 30_000;

  // In-memory fallback
  const fallbackRateLimitMap = new Map<string, number[]>();

  function checkFallbackRateLimit(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = fallbackRateLimitMap.get(key) || [];
    const recent = timestamps.filter((t) => now - t < windowMs);
    recent.push(now);
    fallbackRateLimitMap.set(key, recent);

    if (fallbackRateLimitMap.size > 10_000) {
      for (const [k, v] of fallbackRateLimitMap) {
        if (v.every((t) => now - t > windowMs)) {
          fallbackRateLimitMap.delete(k);
        }
      }
    }

    return recent.length <= limit;
  }

  async function checkRateLimit(key: string, limit: number): Promise<boolean> {
    if (!redis) {
      return checkFallbackRateLimit(key, limit, RATE_LIMIT_WINDOW_MS);
    }

    if (circuitOpen) {
      if (Date.now() - circuitOpenedAt > CIRCUIT_RESET_MS) {
        circuitOpen = false;
        redisFailureCount = 0;
      } else {
        return checkFallbackRateLimit(key, limit, RATE_LIMIT_WINDOW_MS);
      }
    }

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
      }
      redisFailureCount = 0;
      return count <= limit;
    } catch (e) {
      console.error('Rate limit Redis error (Hono):', e);
      redisFailureCount++;

      if (redisFailureCount >= CIRCUIT_FAILURE_THRESHOLD) {
        circuitOpen = true;
        circuitOpenedAt = Date.now();
        console.warn(
          `⚠️  Redis circuit breaker OPEN (Hono). Falling back to in-memory rate limiting.`
        );
      }

      return checkFallbackRateLimit(key, limit, RATE_LIMIT_WINDOW_MS);
    }
  }

  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const url = new URL(c.req.url);
    const method = c.req.method;
    const path = url.pathname;

    // Apply security headers
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      c.header(header, value);
    }

    // Rate limiting by IP (Redis-backed with circuit breaker)
    const clientIp = c.req.header("x-forwarded-for") || "unknown";
    const key = `ratelimit:${clientIp}:${Math.floor(Date.now() / 60000)}`;
    const allowed = await checkRateLimit(key, RATE_LIMIT_MAX);

    if (!allowed) {
      return c.json(
        {
          error: "Too Many Requests",
          message: "Rate limit exceeded. Try again later.",
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
        },
        429
      );
    }

    // Check if this route requires payment
    const match = findEndpointConfig(method, path, endpoints);
    if (!match) {
      return next();
    }

    const { pattern, config } = match;

    // Validate Content-Type for mutation methods
    if (["POST", "PUT", "PATCH"].includes(method)) {
      const contentType = c.req.header("content-type");
      if (contentType && !contentType.includes("application/json")) {
        return c.json(
          { error: "Unsupported Media Type", message: "Content-Type must be application/json" },
          415
        );
      }
    }

    const paymentHeader = c.req.header("x-payment");

    if (!paymentHeader) {
      const requirements = buildPaymentRequirements(config, walletAddress, chainConfigs, platformFee);
      const feeBreakdown = getEndpointFeeBreakdown(config, platformFee);

      return c.json(
        {
          error: "Payment Required",
          paymentRequirements: requirements,
          description: config.description,
          feeBreakdown: platformFee ? feeBreakdown : undefined,
        },
        402,
        {
          "PAYMENT-REQUIRED": encodePaymentRequired(requirements),
        }
      );
    }

    // Verify payment
    const requirements = buildPaymentRequirements(config, walletAddress, chainConfigs, platformFee);
    const resolvedFacilitatorUrl = facilitatorUrl || chainConfigs.base.facilitatorUrl;

    const verification = await verifyPayment(
      {
        paymentHeader,
        requirements,
        facilitatorUrl: resolvedFacilitatorUrl,
      },
      platformFee
    );

    if (!verification.valid) {
      await reporter.reportRejection(pattern, method, verification.error || "unknown");
      return c.json(
        { error: "Payment Invalid", message: verification.error },
        402
      );
    }

    // Attach receipt + fee info to context
    c.set("paymentReceipt", verification.receipt);
    c.set("x402", {
      receipt: verification.receipt,
      feeBreakdown: verification.feeBreakdown,
      endpoint: pattern,
      config,
    });

    await next();

    // Report after response (including fee data)
    const latencyMs = Date.now() - startTime;
    if (verification.receipt) {
      reporter.report({
        endpoint: pattern,
        method,
        receipt: verification.receipt,
        responseStatus: c.res.status,
        latencyMs,
        feeBreakdown: verification.feeBreakdown,
      });
    }
  };
}
