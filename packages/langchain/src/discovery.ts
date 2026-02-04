import { PaidTool, createToolsFromDiscovery } from './paid-tool'
import { AgentWalletConfig } from './types'

// ═══════════════════════════════════════════════════
// Discovery API Integration
// ═══════════════════════════════════════════════════

const DEFAULT_DISCOVERY_URL = 'http://localhost:3003'

/**
 * Fetch tools from the Discovery API
 */
export async function discoverTools(options: {
  discoveryUrl?: string
  query?: string
  category?: string
  maxPrice?: number
  chains?: ('base' | 'solana')[]
  limit?: number
}): Promise<PaidTool[]> {
  const url = new URL('/mcp/tools', options.discoveryUrl || DEFAULT_DISCOVERY_URL)

  if (options.query) url.searchParams.set('q', options.query)
  if (options.category) url.searchParams.set('category', options.category)
  if (options.chains) url.searchParams.set('chains', options.chains.join(','))
  if (options.limit) url.searchParams.set('limit', String(options.limit))

  const response = await fetch(url.toString())

  if (!response.ok) {
    throw new Error(`Discovery API error: ${response.statusText}`)
  }

  const { tools } = await response.json()

  // Filter by max price if specified
  const filteredTools = options.maxPrice
    ? tools.filter((t: any) => t['x-402']?.price <= options.maxPrice!)
    : tools

  return createToolsFromDiscovery(filteredTools)
}

/**
 * AI-powered tool discovery - describe what you need
 */
export async function discoverToolsForTask(
  taskDescription: string,
  options: {
    discoveryUrl?: string
    maxPrice?: number
    chains?: ('base' | 'solana')[]
    limit?: number
  } = {}
): Promise<PaidTool[]> {
  const url = options.discoveryUrl || DEFAULT_DISCOVERY_URL

  const response = await fetch(`${url}/mcp/discover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: taskDescription,
      maxPrice: options.maxPrice,
      preferredChains: options.chains,
    }),
  })

  if (!response.ok) {
    throw new Error(`Discovery API error: ${response.statusText}`)
  }

  const { recommendations } = await response.json()

  const tools = recommendations.map((r: any) => r.tool)

  // Filter by limit
  const limited = options.limit ? tools.slice(0, options.limit) : tools

  return createToolsFromDiscovery(limited)
}

// ═══════════════════════════════════════════════════
// Auto-Discover Agent
// ═══════════════════════════════════════════════════

/**
 * Create an agent that automatically discovers and uses paid tools
 *
 * Usage:
 * ```
 * const agent = await createAutoDiscoverAgent({
 *   task: "Get weather forecasts and analyze data",
 *   wallet: walletConfig,
 *   maxPricePerCall: 0.05,
 * })
 *
 * const result = await agent.run("What's the weather in NYC?")
 * ```
 */
export async function createAutoDiscoverAgent(options: {
  task: string
  wallet: AgentWalletConfig
  discoveryUrl?: string
  maxPricePerCall?: number
  maxTools?: number
}) {
  // Discover relevant tools
  const tools = await discoverToolsForTask(options.task, {
    discoveryUrl: options.discoveryUrl,
    maxPrice: options.maxPricePerCall,
    chains: [options.wallet.chain],
    limit: options.maxTools || 5,
  })

  // Create paid fetch
  const createPaidFetch = () => async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    let response = await fetch(input, init)

    if (response.status === 402) {
      const paymentRequired = response.headers.get('X-Payment-Required')

      if (paymentRequired) {
        const requirements = JSON.parse(paymentRequired)
        const signature = await options.wallet.signer(
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

  // Add payment handling to each tool
  const paidTools = tools.map(
    tool =>
      new PaidTool(
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
          fetch: createPaidFetch(),
          onPayment: options.wallet.onPayment,
        }
      )
  )

  return {
    tools: paidTools,
    getToolDefinitions: () => paidTools.map(t => t.toLangChain()),
    executeTool: async (name: string, args: Record<string, unknown>) => {
      const tool = paidTools.find(t => t.name === name)
      if (!tool) {
        throw new Error(`Tool "${name}" not found`)
      }
      return tool.execute(args)
    },
  }
}
