import { PaidTool } from './paid-tool'
import { AgentWalletConfig } from './types'

// ═══════════════════════════════════════════════════
// CrewAI Adapter
// ═══════════════════════════════════════════════════

/**
 * Convert paid tools to CrewAI tool format
 */
export function toCrewAITools(
  tools: PaidTool[],
  walletConfig: AgentWalletConfig
): CrewAITool[] {
  return tools.map(tool => new CrewAITool(tool, walletConfig))
}

/**
 * CrewAI-compatible tool wrapper
 */
export class CrewAITool {
  name: string
  description: string
  private tool: PaidTool
  private walletConfig: AgentWalletConfig

  constructor(tool: PaidTool, walletConfig: AgentWalletConfig) {
    this.tool = tool
    this.walletConfig = walletConfig
    this.name = tool.name
    this.description = `${tool.description} (Cost: $${tool.price} USDC)`
  }

  /**
   * Execute the tool (CrewAI calls this)
   */
  async run(input: string | Record<string, unknown>): Promise<string> {
    // Parse input if it's a string
    const args = typeof input === 'string'
      ? this.parseInput(input)
      : input

    // Create payment-aware fetch
    const paidFetch = this.createPaidFetch()

    const toolWithFetch = new PaidTool(
      {
        name: this.tool.name,
        description: this.tool.description,
        endpoint: this.tool.endpoint,
        method: this.tool.method,
        price: this.tool.price,
        chains: this.tool.chains,
        inputSchema: this.tool.inputSchema,
      },
      {
        fetch: paidFetch,
        onPayment: this.walletConfig.onPayment,
      }
    )

    return toolWithFetch.call(args)
  }

  private parseInput(input: string): Record<string, unknown> {
    try {
      return JSON.parse(input)
    } catch {
      // If not JSON, assume it's a single query parameter
      return { query: input }
    }
  }

  private createPaidFetch(): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
      let response = await fetch(input, init)

      if (response.status === 402) {
        const paymentRequired = response.headers.get('X-Payment-Required')

        if (paymentRequired) {
          const requirements = JSON.parse(paymentRequired)
          const signature = await this.walletConfig.signer(
            JSON.stringify(requirements)
          )

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
}

// ═══════════════════════════════════════════════════
// CrewAI Agent Factory
// ═══════════════════════════════════════════════════

/**
 * Configuration for a CrewAI agent with paid tools
 */
export interface CrewAIAgentConfig {
  role: string
  goal: string
  backstory: string
  tools: PaidTool[]
  wallet: AgentWalletConfig
  verbose?: boolean
}

/**
 * Create a CrewAI agent configuration with paid tools
 *
 * Usage:
 * ```
 * const agentConfig = createCrewAIAgent({
 *   role: "Research Assistant",
 *   goal: "Find relevant information",
 *   backstory: "Expert researcher...",
 *   tools: [weatherTool, searchTool],
 *   wallet: walletConfig,
 * })
 *
 * // Use with CrewAI
 * const agent = new Agent(agentConfig)
 * ```
 */
export function createCrewAIAgent(config: CrewAIAgentConfig) {
  const crewAITools = toCrewAITools(config.tools, config.wallet)

  return {
    role: config.role,
    goal: config.goal,
    backstory: config.backstory,
    tools: crewAITools,
    verbose: config.verbose ?? false,
    // Add budget info to agent context
    context: {
      wallet: {
        name: config.wallet.name,
        chain: config.wallet.chain,
        policies: config.wallet.policies,
      },
    },
  }
}
