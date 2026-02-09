import { z } from 'zod'

// ═══════════════════════════════════════════════════
// Tool Configuration
// ═══════════════════════════════════════════════════

export interface PaidToolConfig {
  /** Price in USD (e.g., 0.005 = $0.005) */
  price: number
  /** Supported chains */
  chains?: ('base' | 'solana')[]
  /** Tool description for discovery */
  description?: string
  /** Category for discovery registry */
  category?: string
  /** Tags for search */
  tags?: string[]
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: z.ZodType<unknown>
  /** Payment config - if not provided, tool is free */
  payment?: PaidToolConfig
}

// ═══════════════════════════════════════════════════
// Payment Types
// ═══════════════════════════════════════════════════

export interface PaymentRequirement {
  scheme: 'exact'
  network: string
  maxAmountRequired: string
  resource: string
  description: string
  mimeType: string
  payTo: string
  maxTimeoutSeconds: number
  asset: string
  extra?: Record<string, unknown>
}

export interface PaymentHeader {
  payload: string
  signature: string
}

export interface VerificationResult {
  valid: boolean
  txHash?: string
  settledAt?: Date
  error?: string
}

// ═══════════════════════════════════════════════════
// Server Configuration
// ═══════════════════════════════════════════════════

export interface PaidMCPServerConfig {
  /** Your wallet address to receive payments */
  walletAddress: string
  /** Default chain if not specified per-tool */
  defaultChain?: 'base' | 'solana'
  /** Facilitator URL (default: Coinbase CDP) */
  facilitatorUrl?: string
  /** Discovery API URL for auto-registration */
  discoveryUrl?: string
  /** Seller ID for discovery registration */
  sellerId?: string
  /** Callback when payment is received */
  onPayment?: (toolName: string, amount: number, txHash: string) => void
  /** Callback when payment fails */
  onPaymentError?: (toolName: string, error: Error) => void
}

// ═══════════════════════════════════════════════════
// MCP Protocol Types (subset we need)
// ═══════════════════════════════════════════════════

export interface MCPToolRequest {
  method: 'tools/call'
  params: {
    name: string
    arguments: Record<string, unknown>
  }
}

export interface MCPToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
  _meta?: {
    paymentRequired?: PaymentRequirement[]
    paymentReceipt?: {
      txHash: string
      amount: number
      chain: string
    }
  }
}

// ═══════════════════════════════════════════════════
// Chain Constants
// ═══════════════════════════════════════════════════

export const CHAIN_CONFIG = {
  base: {
    network: 'eip155:8453',
    asset: 'eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    facilitator: 'https://x402.org/facilitator',
  },
  solana: {
    network: 'solana:mainnet',
    asset: 'solana:mainnet/spl:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
    facilitator: 'https://x402.org/facilitator',
  },
} as const

export type SupportedChain = keyof typeof CHAIN_CONFIG
