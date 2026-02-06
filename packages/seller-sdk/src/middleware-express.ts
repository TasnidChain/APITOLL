import type { Request, Response, NextFunction } from "express";
import {
  type SellerConfig,
  type EndpointConfig,
  type ChainConfig,
  type SupportedChain,
  type FeeBreakdown,
  DEFAULT_CHAIN_CONFIGS,
  SECURITY_HEADERS,
} from "@agentcommerce/shared";
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
 * import { paymentMiddleware } from "@agentcommerce/seller-sdk";
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

  // Rate limiting: Redis-backed distributed rate limiting (SECURITY FIX)
  const Redis = require('redis');
  const redis = Redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
  });

  const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
  const RATE_LIMIT_MAX = 120; // max requests per window per IP

  async function checkRateLimit(key: string, limit: number): Promise<boolean> {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
      }
      return count <= limit;
    } catch (e) {
      console.error('Rate limit check failed:', e);
      return true; // Allow on error to prevent blocking
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
