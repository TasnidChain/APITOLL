// Core exports
export { paymentMiddleware, getPaymentReceipt, getX402Context } from "./middleware-express";
export { paymentMiddleware as honoPaymentMiddleware } from "./middleware-hono";

// Payment utilities
export {
  buildPaymentRequirements,
  encodePaymentRequired,
  verifyPayment,
  findEndpointConfig,
  getEndpointFeeBreakdown,
  type VerifyPaymentOptions,
  type VerificationResult,
} from "./payment";

// Analytics
export { AnalyticsReporter, type ReporterConfig, type TransactionReport } from "./analytics";

// Re-export shared types that sellers need
export type {
  SellerConfig,
  EndpointConfig,
  EndpointRegistry,
  PaymentRequirement,
  PaymentReceipt,
  SupportedChain,
  ChainConfig,
  PlatformFeeConfig,
  FeeBreakdown,
  PlanTier,
  PlanLimits,
} from "@agentcommerce/shared";

// Re-export shared utilities
export {
  calculateFeeBreakdown,
  getPlatformWallet,
  getPlanLimits,
  checkPlanLimit,
  PLAN_LIMITS,
} from "@agentcommerce/shared";
