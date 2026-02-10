// Types for LangChain/CrewAI Integration

export interface PaidToolConfig {
  /** Tool name */
  name: string
  /** Tool description for the LLM */
  description: string
  /** API endpoint URL */
  endpoint: string
  /** HTTP method */
  method?: 'GET' | 'POST'
  /** Price per call in USD */
  price: number
  /** Supported chains */
  chains?: ('base' | 'solana')[]
  /** Input schema (JSON Schema format) */
  inputSchema?: Record<string, unknown>
}

export interface AgentWalletConfig {
  /** Agent name */
  name: string
  /** Blockchain to use */
  chain: 'base' | 'solana'
  /** Budget policies */
  policies?: Array<{
    type: 'budget' | 'vendor_acl' | 'rate_limit'
    [key: string]: unknown
  }>
  /** Signer function for payments */
  signer: (payload: string) => Promise<string>
  /** Callback on successful payment */
  onPayment?: (toolName: string, amount: number, txHash: string) => void
}

export interface ToolCallResult {
  success: boolean
  result?: unknown
  error?: string
  payment?: {
    amount: number
    txHash: string
    chain: string
  }
}

// LangChain compatible types
export interface LangChainToolInput {
  name: string
  description: string
  schema?: Record<string, unknown>
}

export interface LangChainToolCall {
  name: string
  args: Record<string, unknown>
}
