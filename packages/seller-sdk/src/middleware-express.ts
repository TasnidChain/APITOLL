import type { Request, Response, NextFunction } from "express";
import {
  type SellerConfig,
  type EndpointConfig,
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

export interface PaymentMiddlewareOptions extends SellerConfig {}

/**
 * Express middleware that adds x402 payment requirements to protected endpoints.
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
 *     "POST /api/inference": {
 *       price: "0.05",
 *       chains: ["solana"],
 *       description: "GPU inference endpoint",
 *     },
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

  return async function x402PaymentMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = Date.now();

    // Check if this route requires payment
    const match = findEndpointConfig(req.method, req.path, endpoints);
    if (!match) {
      // Not a paid endpoint — pass through
      return next();
    }

    const { pattern, config } = match;

    // Check for X-PAYMENT header (client already paid)
    const paymentHeader =
      req.headers["x-payment"] as string | undefined;

    if (!paymentHeader) {
      // No payment provided — return 402 with payment requirements
      const requirements = buildPaymentRequirements(
        config,
        walletAddress,
        chainConfigs
      );

      res.status(402);
      res.setHeader("PAYMENT-REQUIRED", encodePaymentRequired(requirements));
      res.setHeader("Content-Type", "application/json");
      res.json({
        error: "Payment Required",
        paymentRequirements: requirements,
        description: config.description,
      });
      return;
    }

    // Payment provided — verify it
    const requirements = buildPaymentRequirements(
      config,
      walletAddress,
      chainConfigs
    );

    const resolvedFacilitatorUrl =
      facilitatorUrl || chainConfigs.base.facilitatorUrl;

    const verification = await verifyPayment({
      paymentHeader,
      requirements,
      facilitatorUrl: resolvedFacilitatorUrl,
    });

    if (!verification.valid) {
      const latencyMs = Date.now() - startTime;
      await reporter.reportRejection(pattern, req.method, verification.error || "unknown");

      res.status(402);
      res.json({
        error: "Payment Invalid",
        message: verification.error,
      });
      return;
    }

    // Payment verified — attach receipt to request and continue
    (req as any).paymentReceipt = verification.receipt;
    (req as any).x402 = {
      receipt: verification.receipt,
      endpoint: pattern,
      config,
    };

    // Intercept response to report analytics
    const originalEnd = res.end;
    res.end = function (this: Response, ...args: any[]) {
      const latencyMs = Date.now() - startTime;

      if (verification.receipt) {
        reporter.report({
          endpoint: pattern,
          method: req.method,
          receipt: verification.receipt,
          responseStatus: res.statusCode,
          latencyMs,
        });
      }

      return originalEnd.apply(this, args);
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
 * Helper to access full x402 context from a request.
 */
export function getX402Context(req: Request): {
  receipt: ReturnType<typeof getPaymentReceipt>;
  endpoint: string;
  config: EndpointConfig;
} | null {
  return (req as any).x402 || null;
}
