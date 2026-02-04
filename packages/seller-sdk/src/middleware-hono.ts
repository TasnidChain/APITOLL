import type { Context, Next, MiddlewareHandler } from "hono";
import {
  type SellerConfig,
  type ChainConfig,
  type SupportedChain,
  DEFAULT_CHAIN_CONFIGS,
} from "@agentcommerce/shared";
import {
  buildPaymentRequirements,
  encodePaymentRequired,
  verifyPayment,
  findEndpointConfig,
} from "./payment";
import { AnalyticsReporter } from "./analytics";

/**
 * Hono middleware for x402 payments.
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

  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const url = new URL(c.req.url);
    const method = c.req.method;
    const path = url.pathname;

    // Check if this route requires payment
    const match = findEndpointConfig(method, path, endpoints);
    if (!match) {
      return next();
    }

    const { pattern, config } = match;
    const paymentHeader = c.req.header("x-payment");

    if (!paymentHeader) {
      const requirements = buildPaymentRequirements(config, walletAddress, chainConfigs);

      return c.json(
        {
          error: "Payment Required",
          paymentRequirements: requirements,
          description: config.description,
        },
        402,
        {
          "PAYMENT-REQUIRED": encodePaymentRequired(requirements),
        }
      );
    }

    // Verify payment
    const requirements = buildPaymentRequirements(config, walletAddress, chainConfigs);
    const resolvedFacilitatorUrl = facilitatorUrl || chainConfigs.base.facilitatorUrl;

    const verification = await verifyPayment({
      paymentHeader,
      requirements,
      facilitatorUrl: resolvedFacilitatorUrl,
    });

    if (!verification.valid) {
      await reporter.reportRejection(pattern, method, verification.error || "unknown");
      return c.json(
        { error: "Payment Invalid", message: verification.error },
        402
      );
    }

    // Attach receipt to context
    c.set("paymentReceipt", verification.receipt);
    c.set("x402", { receipt: verification.receipt, endpoint: pattern, config });

    await next();

    // Report after response
    const latencyMs = Date.now() - startTime;
    if (verification.receipt) {
      reporter.report({
        endpoint: pattern,
        method,
        receipt: verification.receipt,
        responseStatus: c.res.status,
        latencyMs,
      });
    }
  };
}
