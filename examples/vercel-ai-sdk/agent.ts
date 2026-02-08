/**
 * Example: Vercel AI SDK + x402 Paid Tools
 *
 * Run: OPENAI_API_KEY=sk-... npx tsx examples/vercel-ai-sdk/agent.ts
 *
 * Shows how to integrate x402 paid APIs with the Vercel AI SDK's
 * tool system. The AI model decides which tool to call, and API Toll
 * handles payment automatically.
 *
 * This pattern works with any Vercel AI SDK provider:
 *   - OpenAI (GPT-4, GPT-4o)
 *   - Anthropic (Claude)
 *   - Google (Gemini)
 *   - Mistral, Cohere, etc.
 */

import { createAgentWallet, createFacilitatorSigner } from "@apitoll/buyer-sdk";

const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://facilitator-production-fbd7.up.railway.app";

// ─── Agent wallet ──────────────────────────────────────────────

const agent = createAgentWallet({
  name: "VercelAI-Agent",
  chain: "base",
  policies: [
    { type: "budget" as const, dailyCap: 10.0, maxPerRequest: 0.05 },
    { type: "vendor_acl" as const, allowedVendors: ["*"] },
    { type: "rate_limit" as const, maxPerMinute: 30 },
  ],
  signer: process.env.FACILITATOR_API_KEY
    ? createFacilitatorSigner(FACILITATOR_URL, process.env.FACILITATOR_API_KEY, "")
    : async () => Buffer.from(JSON.stringify({ mock: true })).toString("base64"),
  evolution: true,
  onPayment: (receipt) => {
    console.log(`  [paid] $${receipt.amount} USDC on ${receipt.chain}`);
  },
});

// ─── Define tools that call paid APIs ──────────────────────────

// These are the tool definitions you'd pass to generateText() or streamText()
// In Vercel AI SDK format:
//
//   import { tool } from "ai";
//   import { z } from "zod";
//
//   const weatherTool = tool({
//     description: "Get weather forecast. Costs $0.002 USDC.",
//     parameters: z.object({ city: z.string() }),
//     execute: async ({ city }) => {
//       const res = await agent.fetch(`http://weather-api.example.com/forecast?city=${city}`);
//       return res.json();
//     },
//   });

// For this example, we demonstrate the pattern without requiring ai package:

interface ToolDef {
  name: string;
  description: string;
  url: string;
  price: string;
  method: "GET" | "POST";
  buildUrl: (args: Record<string, string>) => string;
  buildBody?: (args: Record<string, string>) => string;
}

const paidTools: ToolDef[] = [
  {
    name: "get_weather_forecast",
    description: "Get a 7-day weather forecast for any city. Costs $0.002 USDC per call via x402.",
    url: "http://localhost:3001/api/forecast",
    price: "0.002",
    method: "GET",
    buildUrl: (args) => `http://localhost:3001/api/forecast?city=${encodeURIComponent(args.city)}`,
  },
  {
    name: "get_crypto_price",
    description: "Get real-time cryptocurrency price. Costs $0.001 USDC per call via x402.",
    url: "http://localhost:4403/api/price",
    price: "0.001",
    method: "GET",
    buildUrl: (args) => `http://localhost:4403/api/price/${encodeURIComponent(args.symbol)}`,
  },
  {
    name: "summarize_text",
    description: "Summarize long text using AI. Costs $0.005 USDC per call via x402.",
    url: "http://localhost:4404/api/summarize",
    price: "0.005",
    method: "POST",
    buildUrl: () => "http://localhost:4404/api/summarize",
    buildBody: (args) => JSON.stringify({ text: args.text, max_length: 100 }),
  },
];

// ─── Vercel AI SDK integration pattern ─────────────────────────

async function callPaidTool(toolName: string, args: Record<string, string>): Promise<any> {
  const tool = paidTools.find((t) => t.name === toolName);
  if (!tool) throw new Error(`Unknown tool: ${toolName}`);

  console.log(`\n  [${toolName}] Calling paid API ($${tool.price} USDC)...`);

  const url = tool.buildUrl(args);
  const response = await agent.fetch(url, {
    method: tool.method,
    ...(tool.method === "POST" && tool.buildBody
      ? {
          headers: { "Content-Type": "application/json" },
          body: tool.buildBody(args),
        }
      : {}),
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

// ─── Demo: simulate what Vercel AI SDK does ────────────────────

async function main() {
  console.log("Vercel AI SDK + x402 Paid Tools");
  console.log("================================\n");

  console.log("Pattern for Vercel AI SDK integration:\n");
  console.log(`  import { generateText, tool } from "ai";`);
  console.log(`  import { openai } from "@ai-sdk/openai";`);
  console.log(`  import { createAgentWallet } from "@apitoll/buyer-sdk";`);
  console.log(`  import { z } from "zod";`);
  console.log(`  `);
  console.log(`  const agent = createAgentWallet({ ... });`);
  console.log(`  `);
  console.log(`  const result = await generateText({`);
  console.log(`    model: openai("gpt-4o"),`);
  console.log(`    prompt: "What's the weather in Tokyo?",`);
  console.log(`    tools: {`);
  console.log(`      weather: tool({`);
  console.log(`        description: "Get weather. Costs $0.002 USDC.",`);
  console.log(`        parameters: z.object({ city: z.string() }),`);
  console.log(`        execute: async ({ city }) => {`);
  console.log(`          const res = await agent.fetch(\`http://api/forecast?city=\${city}\`);`);
  console.log(`          return res.json();`);
  console.log(`        },`);
  console.log(`      }),`);
  console.log(`    },`);
  console.log(`  });\n`);

  // Run demo calls
  console.log("Demo tool calls:\n");

  try {
    const weather = await callPaidTool("get_weather_forecast", { city: "Tokyo" });
    console.log(`  Result: Weather for ${weather.city}, ${weather.forecast?.length || 0} day forecast`);
  } catch (e) {
    console.log(`  Note: Start weather seller first (examples/seller-express/server.ts)`);
  }

  try {
    const price = await callPaidTool("get_crypto_price", { symbol: "ETH" });
    console.log(`  Result: ETH = $${price.price?.toFixed(2) || "N/A"}`);
  } catch (e) {
    console.log(`  Note: Start stock seller first (examples/seller-stock-api/server.ts)`);
  }

  // Print agent state
  const summary = agent.getSpendSummary();
  const evo = agent.getEvolutionState();

  console.log(`\nAgent spending: $${summary.today.toFixed(6)} USDC (${summary.transactionCount} calls)`);
  if (evo) {
    console.log(`Evolution: ${evo.mutationCount} mutations, ${(evo.apitollPreference * 100).toFixed(0)}% API Toll preference`);
  }
}

main().catch(console.error);
