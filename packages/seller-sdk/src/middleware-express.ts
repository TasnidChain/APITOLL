import type { Request, Response, NextFunction } from "express";
import {
  type SellerConfig,
  type EndpointConfig,
  type ChainConfig,
  type SupportedChain,
  type FeeBreakdown,
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

export interface PaymentMiddlewareOptions extends SellerConfig {}

/**
 * Express middleware that adds x402 payment requirements to protected endpoints.
 * Now supports platform fee splitting — a percentage of each payment goes to the platform.
 *
 * Usage:
 * ```ts
 * import { paymentMiddleware } from "@apitoll/seller-sdk";
 *
 * app.use(paymentMiddleware({
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
export function paymentMiddleware(options: PaymentMiddlewareOptions) {
  const {
    walletAddress,
    endpoints,
    chainConfigs: customChainConfigs,
    facilitatorUrl,
    webhookUrl,
    platformApiKey,
    platformFee,
  } = options;

  // Merge custom chain configs with defaults
  const chainConfigs: Record<SupportedChain, ChainConfig> = {
    base: { ...DEFAULT_CHAIN_CONFIGS.base, ...customChainConfigs?.base },
    solana: { ...DEFAULT_CHAIN_CONFIGS.solana, ...customChainConfigs?.solana },
  };

  // Initialize analytics reporter
  const reporter = new AnalyticsReporter({
    apiKey: platformApiKey,
    webhookUrl,
    verbose: process.env.NODE_ENV !== "production",
  });

  // Rate limiting: Redis-backed distributed rate limiting with circuit breaker
  const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
  const RATE_LIMIT_MAX = 120; // max requests per window per IP

  // Circuit breaker state for Redis failures
  let redisFailureCount = 0;
  let circuitOpen = false;
  let circuitOpenedAt = 0;
  const CIRCUIT_FAILURE_THRESHOLD = 5;   // Open circuit after 5 consecutive failures
  const CIRCUIT_RESET_MS = 30_000;       // Try again after 30 seconds

  // Redis is optional — if not available, falls through to in-memory rate limiting
  let redis: any = null;
  try {
    const Redis = require('redis');
    redis = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    });
    redis.on('error', (err: Error) => {
      console.warn('Redis connection error, using in-memory rate limiting:', err.message);
    });
  } catch {
    // Redis not installed — start with circuit open to use in-memory fallback
    circuitOpen = true;
    circuitOpenedAt = Date.now();
  }

  // In-memory fallback rate limiter (used when Redis circuit is open)
  const fallbackRateLimitMap = new Map<string, number[]>();

  function checkFallbackRateLimit(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = fallbackRateLimitMap.get(key) || [];
    const recent = timestamps.filter((t) => now - t < windowMs);
    recent.push(now);
    fallbackRateLimitMap.set(key, recent);

    // Periodic cleanup to prevent memory leaks
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
    // If circuit is open, check if enough time has passed to try again
    if (circuitOpen) {
      if (Date.now() - circuitOpenedAt > CIRCUIT_RESET_MS) {
        // Half-open: try Redis again
        circuitOpen = false;
        redisFailureCount = 0;
      } else {
        // Circuit still open — use in-memory fallback
        return checkFallbackRateLimit(key, limit, RATE_LIMIT_WINDOW_MS);
      }
    }

    try {
      if (!redis) throw new Error('Redis not available');
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
      }
      // Success — reset failure counter
      redisFailureCount = 0;
      return count <= limit;
    } catch (e) {
      console.error('Rate limit Redis error:', e);
      redisFailureCount++;

      if (redisFailureCount >= CIRCUIT_FAILURE_THRESHOLD) {
        circuitOpen = true;
        circuitOpenedAt = Date.now();
        console.warn(
          `⚠️  Redis circuit breaker OPEN after ${redisFailureCount} failures. ` +
          `Falling back to in-memory rate limiting for ${CIRCUIT_RESET_MS / 1000}s.`
        );
      }

      // Fallback to in-memory rate limiting (never fail open)
      return checkFallbackRateLimit(key, limit, RATE_LIMIT_WINDOW_MS);
    }
  }

  return async function x402PaymentMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = Date.now();

    // Apply security headers
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      res.setHeader(header, value);
    }

    // Rate limiting by IP (Redis-backed, distributed)
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const key = `ratelimit:${clientIp}:${Math.floor(Date.now() / 60000)}`;
    const allowed = await checkRateLimit(key, RATE_LIMIT_MAX);

    if (!allowed) {
      res.status(429);
      res.json({
        error: "Too Many Requests",
        message: "Rate limit exceeded. Try again later.",
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
      });
      return;
    }

    // Check if this route requires payment
    const match = findEndpointConfig(req.method, req.path, endpoints);
    if (!match) {
      // Not a paid endpoint — pass through
      return next();
    }

    const { pattern, config } = match;

    // Validate Content-Type for POST/PUT/PATCH
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      const contentType = req.headers["content-type"];
      if (contentType && !contentType.includes("application/json")) {
        res.status(415);
        res.json({
          error: "Unsupported Media Type",
          message: "Content-Type must be application/json",
        });
        return;
      }
    }

    // Check for X-PAYMENT header (client already paid)
    const paymentHeader = req.headers["x-payment"] as string | undefined;

    if (!paymentHeader) {
      // No payment provided — return 402 with payment requirements
      const requirements = buildPaymentRequirements(
        config,
        walletAddress,
        chainConfigs,
        platformFee
      );

      const feeBreakdown = getEndpointFeeBreakdown(config, platformFee);

      res.status(402);
      res.setHeader("PAYMENT-REQUIRED", encodePaymentRequired(requirements));
      res.setHeader("Content-Type", "application/json");
      res.json({
        error: "Payment Required",
        paymentRequirements: requirements,
        description: config.description,
        feeBreakdown: platformFee ? feeBreakdown : undefined,
      });
      return;
    }

    // Payment provided — verify it
    const requirements = buildPaymentRequirements(
      config,
      walletAddress,
      chainConfigs,
      platformFee
    );

    const resolvedFacilitatorUrl =
      facilitatorUrl || chainConfigs.base.facilitatorUrl;

    const verification = await verifyPayment(
      {
        paymentHeader,
        requirements,
        facilitatorUrl: resolvedFacilitatorUrl,
      },
      platformFee
    );

    if (!verification.valid) {
      await reporter.reportRejection(pattern, req.method, verification.error || "unknown");

      res.status(402);
      res.json({
        error: "Payment Invalid",
        message: verification.error,
      });
      return;
    }

    // Payment verified — attach receipt + fee info to request and continue
    (req as any).paymentReceipt = verification.receipt;
    (req as any).x402 = {
      receipt: verification.receipt,
      feeBreakdown: verification.feeBreakdown,
      endpoint: pattern,
      config,
    };

    // Intercept response to report analytics (including fee data)
    const originalEnd = res.end.bind(res);
    (res as any).end = function (chunk?: any, encoding?: any, cb?: any) {
      const latencyMs = Date.now() - startTime;

      if (verification.receipt) {
        reporter.report({
          endpoint: pattern,
          method: req.method,
          receipt: verification.receipt,
          responseStatus: res.statusCode,
          latencyMs,
          feeBreakdown: verification.feeBreakdown,
        });
      }

      if (typeof encoding === 'function') {
        return originalEnd(chunk, encoding);
      } else {
        return originalEnd(chunk, encoding, cb);
      }
    } as any;

    next();
  };
}

/**
 * Helper to access the payment receipt from a request.
 */
export function getPaymentReceipt(req: Request) {
  return (req as any).paymentReceipt || null;
}

/**
 * Helper to access full x402 context from a request (includes fee info).
 */
export function getX402Context(req: Request): {
  receipt: ReturnType<typeof getPaymentReceipt>;
  feeBreakdown?: FeeBreakdown;
  endpoint: string;
  config: EndpointConfig;
} | null {
  return (req as any).x402 || null;
}
