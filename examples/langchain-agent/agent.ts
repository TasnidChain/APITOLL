/**
 * Example: LangChain Agent with Paid Tools
 *
 * This example shows how to use API Toll paid tools with LangChain.
 * The agent can use paid APIs and automatically handle x402 payments.
 */

import {
  createPaidTool,
  createPaidAgentExecutor,
  discoverToolsForTask,
  createAutoDiscoverAgent,
} from '@apitoll/langchain'

// ═══════════════════════════════════════════════════
// Wallet Configuration
// ═══════════════════════════════════════════════════

const walletConfig = {
  name: 'ResearchAgent',
  chain: 'base' as const,
  policies: [
    { type: 'budget' as const, dailyCap: 10, maxPerRequest: 0.10 },
  ],
  // In production, use a real signer (e.g., ethers.js wallet)
  signer: async (payload: string) => {
    console.log('🔐 Signing payment for:', payload.slice(0, 50) + '...')
    return Buffer.from(JSON.stringify({
      payload,
      signature: 'mock_signature_' + Date.now(),
    })).toString('base64')
  },
  onPayment: (toolName: string, amount: number, txHash: string) => {
    console.log(`💰 Paid $${amount} for ${toolName} (tx: ${txHash})`)
  },
}

// ═══════════════════════════════════════════════════
// Example 1: Manual Tool Setup
// ═══════════════════════════════════════════════════

async function manualToolExample() {
  console.log('\n📦 Example 1: Manual Tool Setup\n')

  // Define tools manually
  const weatherTool = createPaidTool({
    name: 'get_weather',
    description: 'Get detailed weather forecast for a city',
    endpoint: 'http://localhost:3004/mcp/tools/get_weather_detailed',
    method: 'POST',
    price: 0.005,
    chains: ['base'],
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name' },
        days: { type: 'number', description: 'Forecast days (1-14)' },
      },
      required: ['city'],
    },
  })

  const searchTool = createPaidTool({
    name: 'web_search',
    description: 'Search the web for information',
    endpoint: 'https://api.search.pro/search',
    method: 'POST',
    price: 0.002,
    chains: ['base', 'solana'],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  })

  // Create executor
  const executor = createPaidAgentExecutor(
    [weatherTool, searchTool],
    walletConfig
  )

  // Get tools for LLM
  console.log('Available tools:')
  console.log(JSON.stringify(executor.getTools(), null, 2))

  // Execute a tool
  console.log('\nExecuting weather tool...')
  const result = await executor.executeTool('get_weather', {
    city: 'New York',
    days: 5,
  })
  console.log('Result:', result)

  // Check spending
  console.log('\nSpending summary:')
  console.log(executor.getSpendingSummary())
}

// ═══════════════════════════════════════════════════
// Example 2: Auto-Discover Tools
// ═══════════════════════════════════════════════════

async function autoDiscoverExample() {
  console.log('\n🔍 Example 2: Auto-Discover Tools\n')

  try {
    // Discover tools for a task
    const tools = await discoverToolsForTask(
      'I need to get weather data and analyze it',
      {
        discoveryUrl: 'http://localhost:3003',
        maxPrice: 0.05,
        chains: ['base'],
        limit: 5,
      }
    )

    console.log(`Found ${tools.length} relevant tools:`)
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: $${tool.price} (${tool.description})`)
    })

    // Create an auto-discover agent
    const agent = await createAutoDiscoverAgent({
      task: 'Get weather forecasts and historical data',
      wallet: walletConfig,
      discoveryUrl: 'http://localhost:3003',
      maxPricePerCall: 0.02,
      maxTools: 3,
    })

    console.log('\nAgent tools:')
    console.log(JSON.stringify(agent.getToolDefinitions(), null, 2))
  } catch {
    console.log('Discovery API not available (run apps/discovery first)')
  }
}

// ═══════════════════════════════════════════════════
// Example 3: LangChain Integration
// ═══════════════════════════════════════════════════

async function langchainIntegrationExample() {
  console.log('\n🦜 Example 3: LangChain Integration\n')

  // This is pseudocode showing how to integrate with LangChain
  console.log(`
// With LangChain:

import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { createPaidTool, createPaidAgentExecutor } from "@apitoll/langchain";

// Create paid tools
const weatherTool = createPaidTool({
  name: "get_weather",
  description: "Get weather forecast",
  endpoint: "https://api.weather.pro/forecast",
  price: 0.005,
  chains: ["base"],
});

// Create executor with wallet
const paidExecutor = createPaidAgentExecutor(
  [weatherTool],
  walletConfig
);

// Get LangChain-compatible tool definitions
const tools = paidExecutor.getTools();

// Create LangChain agent
const model = new ChatOpenAI({ model: "gpt-4" });
const agent = await createOpenAIToolsAgent({ llm: model, tools, prompt });

// When LangChain calls a tool, route through paid executor
const result = await paidExecutor.executeTool(toolName, args);
`)
}

// ═══════════════════════════════════════════════════
// Run Examples
// ═══════════════════════════════════════════════════

async function main() {
  console.log('╔═══════════════════════════════════════════════════╗')
  console.log('║   LangChain + API Toll Example              ║')
  console.log('╚═══════════════════════════════════════════════════╝')

  await manualToolExample()
  await autoDiscoverExample()
  await langchainIntegrationExample()

  console.log('\n✅ Examples complete!')
}

main().catch(console.error)
