import type { Context, Next, MiddlewareHandler } from "hono";
import {
  type SellerConfig,
  type ChainConfig,
  type SupportedChain,
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

/**
 * Hono middleware for x402 payments with platform fee support.
 *
 * Usage:
 * ```ts
 * import { Hono } from "hono";
 * import { paymentMiddleware } from "@agentcommerce/seller-sdk/hono";
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

  // Rate limiting: simple in-memory sliding window
  const rateLimitMap = new Map<string, number[]>();
  const RATE_LIMIT_WINDOW_MS = 60_000;
  const RATE_LIMIT_MAX = 120;

  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const url = new URL(c.req.url);
    const method = c.req.method;
    const path = url.pathname;

    // Apply security headers
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      c.header(header, value);
    }

    // Rate limiting by IP
    const clientIp = c.req.header("x-forwarded-for") || "unknown";
    const now = Date.now();
    const timestamps = rateLimitMap.get(clientIp) || [];
    const recentTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

    if (recentTimestamps.length >= RATE_LIMIT_MAX) {
      return c.json(
        {
          error: "Too Many Requests",
          message: "Rate limit exceeded. Try again later.",
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
        },
        429
      );
    }

    recentTimestamps.push(now);
    rateLimitMap.set(clientIp, recentTimestamps);

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
