import { PaidToolConfig, ToolCallResult } from './types'

// Paid Tool Class (LangChain Compatible)

/**
 * A LangChain-compatible tool that handles x402 payments automatically.
 *
 * Works with:
 * - LangChain agents
 * - CrewAI agents
 * - Any framework that uses the standard tool interface
 */
export class PaidTool {
  name: string
  description: string
  endpoint: string
  method: 'GET' | 'POST'
  price: number
  chains: ('base' | 'solana')[]
  inputSchema?: Record<string, unknown>

  private fetchFn: typeof fetch
  private onPayment?: (toolName: string, amount: number, txHash: string) => void

  constructor(
    config: PaidToolConfig,
    options?: {
      fetch?: typeof fetch
      onPayment?: (toolName: string, amount: number, txHash: string) => void
    }
  ) {
    this.name = config.name
    this.description = config.description
    this.endpoint = config.endpoint
    this.method = config.method || 'POST'
    this.price = config.price
    this.chains = config.chains || ['base']
    this.inputSchema = config.inputSchema
    this.fetchFn = options?.fetch || fetch
    this.onPayment = options?.onPayment
  }

  /**
   * Get LangChain tool definition
   */
  toLangChain() {
    return {
      name: this.name,
      description: `${this.description} (Cost: $${this.price} per call)`,
      schema: this.inputSchema || {
        type: 'object',
        properties: {},
      },
    }
  }

  /**
   * Execute the tool (called by agent)
   */
  async call(input: Record<string, unknown>): Promise<string> {
    const result = await this.execute(input)

    if (!result.success) {
      return `Error: ${result.error}`
    }

    if (result.payment) {
      return JSON.stringify({
        result: result.result,
        payment: {
          amount: `$${result.payment.amount}`,
          chain: result.payment.chain,
        },
      })
    }

    return JSON.stringify(result.result)
  }

  /**
   * Execute with full result details
   */
  async execute(input: Record<string, unknown>): Promise<ToolCallResult> {
    try {
      const url = this.method === 'GET'
        ? `${this.endpoint}?${new URLSearchParams(input as Record<string, string>)}`
        : this.endpoint

      const response = await this.fetchFn(url, {
        method: this.method,
        headers: { 'Content-Type': 'application/json' },
        body: this.method === 'POST' ? JSON.stringify(input) : undefined,
      })

      // Check for payment receipt in response
      const paymentReceipt = response.headers.get('X-Payment-Receipt')
      let payment: ToolCallResult['payment']

      if (paymentReceipt) {
        try {
          const receipt = JSON.parse(paymentReceipt)
          // Validate receipt shape before trusting it — header comes from untrusted server
          if (
            receipt &&
            typeof receipt === 'object' &&
            typeof receipt.amount === 'number' &&
            typeof receipt.txHash === 'string' &&
            typeof receipt.chain === 'string'
          ) {
            payment = {
              amount: receipt.amount,
              txHash: receipt.txHash,
              chain: receipt.chain,
            }
            this.onPayment?.(this.name, receipt.amount, receipt.txHash)
          }
        } catch { /* malformed receipt header — ignore */ }
      }

      if (!response.ok) {
        const error = await response.text()
        return { success: false, error }
      }

      const result = await response.json()

      return {
        success: true,
        result,
        payment,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

// Factory Functions

/**
 * Create a paid tool from config
 */
export function createPaidTool(
  config: PaidToolConfig,
  options?: {
    fetch?: typeof fetch
    onPayment?: (toolName: string, amount: number, txHash: string) => void
  }
): PaidTool {
  return new PaidTool(config, options)
}

/**
 * Create multiple paid tools from Discovery API results
 */
export function createToolsFromDiscovery(
  tools: Array<{
    name: string
    description: string
    'x-402': {
      baseUrl: string
      method: string
      path: string
      price: number
      chains: string[]
    }
    inputSchema?: Record<string, unknown>
  }>,
  options?: {
    fetch?: typeof fetch
    onPayment?: (toolName: string, amount: number, txHash: string) => void
  }
): PaidTool[] {
  return tools.map(tool => new PaidTool({
    name: tool.name,
    description: tool.description,
    endpoint: `${tool['x-402'].baseUrl}${tool['x-402'].path}`,
    method: tool['x-402'].method as 'GET' | 'POST',
    price: tool['x-402'].price,
    chains: tool['x-402'].chains as ('base' | 'solana')[],
    inputSchema: tool.inputSchema,
  }, options))
}
