// ─── Chain & Network Types ──────────────────────────────────────

export type SupportedChain = "base" | "solana";

export type ChainConfig = {
  chain: SupportedChain;
  /** CAIP-2 network identifier (e.g., "eip155:8453" for Base, "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" for Solana mainnet) */
  networkId: string;
  /** RPC endpoint URL */
  rpcUrl: string;
  /** USDC contract/mint address */
  usdcAddress: string;
  /** x402 facilitator URL */
  facilitatorUrl: string;
};

export const DEFAULT_CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = {
  base: {
    chain: "base",
    networkId: "eip155:8453",
    rpcUrl: "https://mainnet.base.org",
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    facilitatorUrl: "https://x402.org/facilitator",
  },
  solana: {
    chain: "solana",
    networkId: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    rpcUrl: "https://api.mainnet-beta.solana.com",
    usdcAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    facilitatorUrl: "https://x402.org/facilitator",
  },
};

// ─── Payment Types ──────────────────────────────────────────────

export type PaymentScheme = "exact";

export interface PaymentRequirement {
  /** Scheme for payment (currently only "exact") */
  scheme: PaymentScheme;
  /** CAIP-2 network identifier */
  network: string;
  /** Maximum amount in smallest unit (e.g., USDC has 6 decimals) */
  maxAmountRequired: string;
  /** Resource description */
  description?: string;
  /** Payment recipient address */
  payTo: string;
  /** Token/asset contract address */
  asset: string;
  /** Extra metadata */
  extra?: Record<string, unknown>;
}

export interface PaymentPayload {
  /** Base64-encoded signed payment data */
  payload: string;
  /** Payment scheme used */
  scheme: PaymentScheme;
  /** CAIP-2 network */
  network: string;
}

export interface PaymentReceipt {
  /** On-chain transaction hash */
  txHash: string;
  /** Chain the payment settled on */
  chain: SupportedChain;
  /** Amount in USDC (human-readable, e.g., "0.005") */
  amount: string;
  /** Payer wallet address */
  from: string;
  /** Recipient wallet address */
  to: string;
  /** ISO timestamp */
  timestamp: string;
  /** Block number (EVM) or slot (Solana) */
  blockNumber?: number;
}

// ─── Endpoint Registration ──────────────────────────────────────

export interface EndpointConfig {
  /** Price in USDC (human-readable, e.g., "0.005") */
  price: string;
  /** Supported chains */
  chains: SupportedChain[];
  /** Human-readable description of what this endpoint does */
  description: string;
  /** USDC currency (always USDC for now) */
  currency?: "USDC";
  /** Optional JSON schema for input */
  inputSchema?: Record<string, unknown>;
  /** Optional JSON schema for output */
  outputSchema?: Record<string, unknown>;
}

export type EndpointRegistry = Record<string, EndpointConfig>;

// ─── Transaction Types ──────────────────────────────────────────

export type TransactionStatus = "pending" | "settled" | "failed" | "refunded";

export interface Transaction {
  /** Unique transaction ID (platform-generated) */
  id: string;
  /** On-chain tx hash */
  txHash: string;
  /** Agent wallet address (payer) */
  agentAddress: string;
  /** Agent ID (platform-level) */
  agentId?: string;
  /** Seller ID */
  sellerId: string;
  /** Endpoint that was called */
  endpoint: string;
  /** HTTP method */
  method: string;
  /** Amount in USDC */
  amount: string;
  /** Chain used */
  chain: SupportedChain;
  /** Current status */
  status: TransactionStatus;
  /** ISO timestamp of request */
  requestedAt: string;
  /** ISO timestamp of settlement */
  settledAt?: string;
  /** Response status code */
  responseStatus?: number;
  /** Latency in ms */
  latencyMs?: number;
}

// ─── Policy Types ───────────────────────────────────────────────

export type PolicyType = "budget" | "vendor_acl" | "rate_limit";

export interface BudgetPolicy {
  type: "budget";
  /** Max USDC per day */
  dailyCap: number;
  /** Max USDC per week */
  weeklyCap?: number;
  /** Max USDC per single request */
  maxPerRequest: number;
}

export interface VendorAclPolicy {
  type: "vendor_acl";
  /** Allowed seller IDs or "*" for all */
  allowedVendors: string[];
  /** Blocked seller IDs */
  blockedVendors?: string[];
}

export interface RateLimitPolicy {
  type: "rate_limit";
  /** Max requests per minute */
  maxPerMinute: number;
  /** Max requests per hour */
  maxPerHour?: number;
}

export type Policy = BudgetPolicy | VendorAclPolicy | RateLimitPolicy;

// ─── Agent Types ────────────────────────────────────────────────

export interface AgentConfig {
  /** Agent name */
  name: string;
  /** Primary chain */
  chain: SupportedChain;
  /** Policies to enforce */
  policies: Policy[];
  /** Optional: pre-funded wallet private key (hex or base58) */
  privateKey?: string;
  /** Optional: webhook URL for transaction notifications */
  webhookUrl?: string;
}

export interface AgentWallet {
  /** Platform agent ID */
  id: string;
  /** Agent name */
  name: string;
  /** Wallet address */
  address: string;
  /** Primary chain */
  chain: SupportedChain;
  /** Current USDC balance */
  balance: string;
  /** Active policies */
  policies: Policy[];
  /** Created timestamp */
  createdAt: string;
}

// ─── Seller Types ───────────────────────────────────────────────

export interface SellerConfig {
  /** Seller wallet address for receiving payments */
  walletAddress: string;
  /** Endpoint pricing registry */
  endpoints: EndpointRegistry;
  /** Chain configs (uses defaults if not provided) */
  chainConfigs?: Partial<Record<SupportedChain, Partial<ChainConfig>>>;
  /** Facilitator URL override */
  facilitatorUrl?: string;
  /** Webhook URL for transaction events */
  webhookUrl?: string;
  /** Platform API key for analytics reporting */
  platformApiKey?: string;
}

// ─── Analytics Types ────────────────────────────────────────────

export interface SpendSummary {
  /** Time period */
  period: "1h" | "24h" | "7d" | "30d";
  /** Total USDC spent */
  totalSpend: string;
  /** Number of transactions */
  transactionCount: number;
  /** Breakdown by chain */
  byChain: Record<SupportedChain, { spend: string; count: number }>;
  /** Breakdown by seller */
  bySeller: Record<string, { spend: string; count: number }>;
  /** Average cost per request */
  avgCostPerRequest: string;
}

// ─── Platform Events ────────────────────────────────────────────

export type EventType =
  | "transaction.created"
  | "transaction.settled"
  | "transaction.failed"
  | "budget.threshold"
  | "budget.exceeded"
  | "agent.low_balance";

export interface PlatformEvent {
  type: EventType;
  timestamp: string;
  data: Transaction | { agentId: string; message: string };
}

// ─── API Response Types ─────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
