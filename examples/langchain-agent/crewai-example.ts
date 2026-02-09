/**
 * Example: CrewAI with Paid Tools
 *
 * This example shows how to create a CrewAI crew with agents
 * that can use paid tools via API Toll.
 */

import {
  createPaidTool,
  toCrewAITools,
  createCrewAIAgent,
} from '@apitoll/langchain'

// ═══════════════════════════════════════════════════
// Wallet Configuration
// ═══════════════════════════════════════════════════

const walletConfig = {
  name: 'CrewWallet',
  chain: 'base' as const,
  policies: [
    { type: 'budget' as const, dailyCap: 25, maxPerRequest: 0.10 },
  ],
  signer: async (payload: string) => {
    console.log('🔐 Signing payment...')
    return Buffer.from(JSON.stringify({
      payload,
      signature: 'mock_signature_' + Date.now(),
    })).toString('base64')
  },
  onPayment: (toolName: string, amount: number, _txHash: string) => {
    console.log(`💰 Paid $${amount} for ${toolName}`)
  },
}

// ═══════════════════════════════════════════════════
// Define Tools
// ═══════════════════════════════════════════════════

const tools: PaidTool[] = [
  createPaidTool({
    name: 'weather_forecast',
    description: 'Get detailed weather forecast for any city',
    endpoint: 'http://localhost:3004/mcp/tools/get_weather_detailed',
    method: 'POST',
    price: 0.005,
    chains: ['base'],
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string' },
        days: { type: 'number' },
      },
    },
  }),

  createPaidTool({
    name: 'weather_historical',
    description: 'Get historical weather data',
    endpoint: 'http://localhost:3004/mcp/tools/get_weather_historical',
    method: 'POST',
    price: 0.01,
    chains: ['base'],
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
      },
    },
  }),

  createPaidTool({
    name: 'data_analysis',
    description: 'Analyze data and generate insights',
    endpoint: 'https://api.analytics.pro/analyze',
    method: 'POST',
    price: 0.02,
    chains: ['base', 'solana'],
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'string' },
        analysisType: { type: 'string' },
      },
    },
  }),
]

// ═══════════════════════════════════════════════════
// Create Agents
// ═══════════════════════════════════════════════════

const researcherAgent = createCrewAIAgent({
  role: 'Weather Researcher',
  goal: 'Gather comprehensive weather data for locations',
  backstory: `You are an expert meteorologist with years of experience
    analyzing weather patterns. You use advanced tools to gather
    accurate weather data and forecasts.`,
  tools: tools.filter(t => t.name.includes('weather')),
  wallet: walletConfig,
  verbose: true,
})

const analystAgent = createCrewAIAgent({
  role: 'Data Analyst',
  goal: 'Analyze weather data and provide actionable insights',
  backstory: `You are a data scientist specializing in climate analysis.
    You transform raw weather data into meaningful insights and
    recommendations.`,
  tools: tools.filter(t => t.name.includes('analysis')),
  wallet: walletConfig,
  verbose: true,
})

// ═══════════════════════════════════════════════════
// Example Crew Setup
// ═══════════════════════════════════════════════════

async function main() {
  console.log('╔═══════════════════════════════════════════════════╗')
  console.log('║   CrewAI + API Toll Example                 ║')
  console.log('╚═══════════════════════════════════════════════════╝')

  console.log('\n📋 Researcher Agent Config:')
  console.log(JSON.stringify(researcherAgent, null, 2))

  console.log('\n📋 Analyst Agent Config:')
  console.log(JSON.stringify(analystAgent, null, 2))

  // Show how to use with actual CrewAI
  console.log(`
╔═══════════════════════════════════════════════════╗
║   CrewAI Integration Code                         ║
╚═══════════════════════════════════════════════════╝

from crewai import Agent, Task, Crew

# Create agents using the configs above
researcher = Agent(**researcher_config)
analyst = Agent(**analyst_config)

# Define tasks
research_task = Task(
    description="Gather weather data for New York for the past month",
    agent=researcher,
    expected_output="Comprehensive weather data report"
)

analysis_task = Task(
    description="Analyze the weather data and identify trends",
    agent=analyst,
    expected_output="Weather trend analysis with insights"
)

# Create and run the crew
crew = Crew(
    agents=[researcher, analyst],
    tasks=[research_task, analysis_task],
    verbose=True
)

result = crew.kickoff()

# Each paid tool call is automatically handled:
# 1. Tool called → 402 returned with payment requirements
# 2. Wallet signs payment
# 3. Tool retries with X-Payment header
# 4. Data returned, payment recorded
`)

  // Demonstrate tool execution
  console.log('\n🔧 Testing tool execution:')

  const crewTools = toCrewAITools(tools.slice(0, 1), walletConfig)
  const weatherTool = crewTools[0]

  console.log(`\nCalling "${weatherTool.name}"...`)

  try {
    const result = await weatherTool.run({ city: 'New York', days: 3 })
    console.log('Result:', result)
  } catch {
    console.log('(Tool endpoint not available - this is expected in demo)')
  }

  console.log('\n✅ CrewAI example complete!')
}

main().catch(console.error)
