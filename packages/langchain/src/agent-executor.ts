import { PaidTool } from './paid-tool'
import { AgentWalletConfig, ToolCallResult } from './types'

// Paid Agent Executor

/**
 * An agent executor that wraps fetch with automatic x402 payment handling.
 * Use this as a drop-in replacement for the standard LangChain agent executor.
 */
export class PaidAgentExecutor {
  private tools: Map<string, PaidTool> = new Map()
  private config: AgentWalletConfig
  private spendHistory: Array<{
    toolName: string
    amount: number
    timestamp: Date
  }> = []

  constructor(tools: PaidTool[], config: AgentWalletConfig) {
    this.config = config

    for (const tool of tools) {
      this.tools.set(tool.name, tool)
    }
  }

  /**
   * Get all tool definitions for the LLM
   */
  getTools() {
    return Array.from(this.tools.values()).map(tool => tool.toLangChain())
  }

  /**
   * Execute a tool call from the agent
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolCallResult> {
    const tool = this.tools.get(toolName)

    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found`,
      }
    }

    // Check budget before execution
    if (!this.checkBudget(tool.price)) {
      return {
        success: false,
        error: `Budget exceeded. Tool costs $${tool.price}, but daily limit reached.`,
      }
    }

    // Create a fetch wrapper that handles 402
    const paidFetch = this.createPaidFetch()

    // Execute with payment-aware fetch
    const toolWithPaidFetch = new PaidTool(
      {
        name: tool.name,
        description: tool.description,
        endpoint: tool.endpoint,
        method: tool.method,
        price: tool.price,
        chains: tool.chains,
        inputSchema: tool.inputSchema,
      },
      {
        fetch: paidFetch,
        onPayment: (name, amount, txHash) => {
          this.recordSpend(name, amount)
          this.config.onPayment?.(name, amount, txHash)
        },
      }
    )

    return toolWithPaidFetch.execute(args)
  }

  /**
   * Create a fetch function that handles x402 payments
   */
  private createPaidFetch(): typeof fetch {
    return async (input: string | URL | Request, init?: RequestInit) => {
      // First request
      let response = await fetch(input, init)

      // If 402, handle payment
      if (response.status === 402) {
        const paymentRequired = response.headers.get('X-Payment-Required')

        if (paymentRequired) {
          const requirements = JSON.parse(paymentRequired)

          // Sign the payment
          const signature = await this.config.signer(
            JSON.stringify(requirements)
          )

          // Retry with payment
          response = await fetch(input, {
            ...init,
            headers: {
              ...init?.headers,
              'X-Payment': signature,
            },
          })
        }
      }

      return response
    }
  }

  /**
   * Check if we're within budget
   */
  private checkBudget(amount: number): boolean {
    const policies = this.config.policies || []
    const budgetPolicy = policies.find(p => p.type === 'budget')

    if (!budgetPolicy) return true

    const dailyCap = budgetPolicy.dailyCap as number | undefined
    if (!dailyCap) return true

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todaySpend = this.spendHistory
      .filter(s => s.timestamp >= today)
      .reduce((sum, s) => sum + s.amount, 0)

    return todaySpend + amount <= dailyCap
  }

  /**
   * Record a spend for budget tracking
   */
  private recordSpend(toolName: string, amount: number) {
    this.spendHistory.push({
      toolName,
      amount,
      timestamp: new Date(),
    })
  }

  /**
   * Get spending summary
   */
  getSpendingSummary() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todaySpend = this.spendHistory
      .filter(s => s.timestamp >= today)
      .reduce((sum, s) => sum + s.amount, 0)

    const totalSpend = this.spendHistory.reduce((sum, s) => sum + s.amount, 0)

    const byTool = this.spendHistory.reduce((acc, s) => {
      acc[s.toolName] = (acc[s.toolName] || 0) + s.amount
      return acc
    }, {} as Record<string, number>)

    return {
      todaySpend,
      totalSpend,
      transactionCount: this.spendHistory.length,
      byTool,
    }
  }
}

// Factory Function

/**
 * Create a paid agent executor
 */
export function createPaidAgentExecutor(
  tools: PaidTool[],
  config: AgentWalletConfig
): PaidAgentExecutor {
  return new PaidAgentExecutor(tools, config)
}
