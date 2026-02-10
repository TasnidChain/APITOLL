// Core exports
export {
  AgentWallet,
  createAgentWallet,
  AgentPaymentError,
  PolicyViolationError,
  type AgentWalletOptions,
  type AgentFetchOptions,
  type PaymentSigner,
} from "./agent-wallet";

// Signers — custodial (facilitator holds keys)
export { createFacilitatorSigner } from "./signers/evm-signer";

// Signers — self-custody (agent holds keys)
export {
  createLocalEVMSigner,
  createDirectEVMSigner,
  type LocalEVMSignerConfig,
  type DirectEVMSignerConfig,
} from "./signers/local-evm-signer";

export {
  createLocalSolanaSigner,
  createDirectSolanaSigner,
  type LocalSolanaSignerConfig,
  type DirectSolanaSignerConfig,
} from "./signers/local-solana-signer";

// Policy engine
export {
  PolicyEngine,
  type PolicyCheckResult,
} from "./policy-engine";

// Evolution engine
export {
  APITOLLMutator,
  createMutator,
  type MutatorConfig,
  type MutatorState,
  type MutationEvent,
} from "./mutator";

// Re-export shared types that buyers need
export type {
  AgentConfig,
  Policy,
  BudgetPolicy,
  VendorAclPolicy,
  RateLimitPolicy,
  Transaction,
  PaymentReceipt,
  PaymentRequirement,
  SupportedChain,
  SpendSummary,
} from "@apitoll/shared";
