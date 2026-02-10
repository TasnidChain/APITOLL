/**
 * Example: Anthropic Claude SDK + x402 Paid Tools
 *
 * Run: ANTHROPIC_API_KEY=sk-... npx tsx examples/anthropic-claude/agent.ts
 *
 * This shows how to wire x402 paid APIs into Claude's tool_use feature.
 * Claude decides which tool to call, API Toll handles the payment,
 * and the result feeds back into the conversation.
 *
 * Flow:
 *   User question → Claude picks tool → agent.fetch() auto-pays → result → Claude answers
 */

import { createAgentWallet, createFacilitatorSigner } from "@apitoll/buyer-sdk";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://pay.apitoll.com";
const SELLER_API = process.env.SELLER_API_URL || "http://localhost:4402";


interface PaidToolDef {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
  _apitoll: { url: string; method: string; price: number };
}

const tools: PaidToolDef[] = [
  {
    name: "web_search",
    description: "Search the web for current information. Costs $0.003 USDC per query.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
    _apitoll: { url: `${SELLER_API}/api/search`, method: "GET", price: 0.003 },
  },
  {
    name: "get_weather",
    description: "Get weather forecast for any city. Costs $0.002 USDC per call.",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name (e.g., 'London', 'San Francisco')" },
      },
      required: ["city"],
    },
    _apitoll: { url: `${SELLER_API}/api/forecast`, method: "GET", price: 0.002 },
  },
  {
    name: "analyze_text",
    description: "Analyze sentiment, entities, or readability of text. Costs $0.002 USDC per call.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to analyze" },
        analysis: { type: "string", description: "Type: 'sentiment', 'entities', or 'readability'" },
      },
      required: ["text"],
    },
    _apitoll: { url: `${SELLER_API}/api/sentiment`, method: "POST", price: 0.002 },
  },
  {
    name: "convert_units",
    description: "Convert between measurement units (length, weight, temperature, etc.). Costs $0.001 USDC.",
    input_schema: {
      type: "object",
      properties: {
        value: { type: "string", description: "Numeric value to convert" },
        from: { type: "string", description: "Source unit (e.g., 'km', 'lb', 'celsius')" },
        to: { type: "string", description: "Target unit (e.g., 'miles', 'kg', 'fahrenheit')" },
      },
      required: ["value", "from", "to"],
    },
    _apitoll: { url: `${SELLER_API}/api/math/convert`, method: "GET", price: 0.001 },
  },
];


const agent = createAgentWallet({
  name: "Claude-Agent",
  chain: "base",
  policies: [
    { type: "budget" as const, dailyCap: 5.0, maxPerRequest: 0.05 },
    { type: "vendor_acl" as const, allowedVendors: ["*"] },
    { type: "rate_limit" as const, maxPerMinute: 30 },
  ],
  signer: process.env.FACILITATOR_API_KEY
    ? createFacilitatorSigner(FACILITATOR_URL, process.env.FACILITATOR_API_KEY, "")
    : async () => Buffer.from(JSON.stringify({ mock: true })).toString("base64"),
  evolution: true,
  onPayment: (receipt) => {
    console.log(`  [payment] $${receipt.amount} USDC → ${receipt.to}`);
  },
});


async function executeTool(name: string, args: Record<string, string>): Promise<string> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return JSON.stringify({ error: `Unknown tool: ${name}` });

  const meta = tool._apitoll;
  let url = meta.url;

  // Build request based on tool
  if (meta.method === "GET") {
    const params = new URLSearchParams(args);
    url += `?${params.toString()}`;
  }

  console.log(`  [tool] Calling ${name}(${JSON.stringify(args)})`);

  try {
    const response = await agent.fetch(url, {
      method: meta.method,
      ...(meta.method === "POST"
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(args),
          }
        : {}),
    });

    if (!response.ok) {
      return JSON.stringify({ error: `API returned ${response.status}` });
    }

    const data = await response.json();
    return JSON.stringify(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return JSON.stringify({ error: msg });
  }
}


interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ClaudeContentBlock[];
}

interface ClaudeContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, string>;
  tool_use_id?: string;
  content?: string;
}

async function chat(userMessage: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    // Demo mode without Anthropic API
    console.log("\n[Demo mode — set ANTHROPIC_API_KEY for real Claude integration]");
    console.log(`User: ${userMessage}`);

    // Simulate tool selection
    if (userMessage.toLowerCase().includes("weather")) {
      const result = await executeTool("get_weather", { city: "London" });
      return `[Demo] Weather: ${result}`;
    } else if (userMessage.toLowerCase().includes("search")) {
      const result = await executeTool("web_search", { query: userMessage });
      return `[Demo] Search: ${result}`;
    } else if (userMessage.toLowerCase().includes("convert")) {
      const result = await executeTool("convert_units", { value: "100", from: "km", to: "miles" });
      return `[Demo] Conversion: ${result}`;
    }
    return "[Demo] No matching tool for this query.";
  }

  const messages: ClaudeMessage[] = [
    { role: "user", content: userMessage },
  ];

  // Call Claude API
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system:
        "You are a helpful assistant with access to paid API tools. " +
        "Each tool call costs a small amount of USDC (a stablecoin). " +
        "Use tools when the user asks for real-time data, conversions, or analysis. " +
        "Be transparent about tool costs when relevant.",
      messages,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      })),
    }),
  });

  interface ClaudeResponse {
    content: ClaudeContentBlock[];
    stop_reason: string;
  }

  const data = (await response.json()) as ClaudeResponse;

  // Check if Claude wants to use tools
  const toolUseBlocks = data.content.filter((b) => b.type === "tool_use");

  if (toolUseBlocks.length > 0) {
    // Execute all tool calls
    const toolResults: ClaudeContentBlock[] = [];
    for (const toolUse of toolUseBlocks) {
      console.log(`  [claude] Selected tool: ${toolUse.name}`);
      const result = await executeTool(toolUse.name!, toolUse.input!);
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    // Send tool results back to Claude
    messages.push({ role: "assistant", content: data.content });
    messages.push({ role: "user", content: toolResults });

    const finalResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages,
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema,
        })),
      }),
    });

    const finalData = (await finalResponse.json()) as ClaudeResponse;
    const textBlock = finalData.content.find((b) => b.type === "text");
    return textBlock?.text || "No response";
  }

  // Direct text response (no tools needed)
  const textBlock = data.content.find((b) => b.type === "text");
  return textBlock?.text || "No response";
}


async function main() {
  console.log("Anthropic Claude + x402 Paid Tools");
  console.log("====================================\n");

  const queries = [
    "What's the weather like in London right now?",
    "Convert 100 kilometers to miles",
    "Search for the latest news about AI agents",
  ];

  for (const query of queries) {
    console.log(`\nUser: ${query}`);
    const answer = await chat(query);
    console.log(`\nClaude: ${answer}`);
  }

  // Print spending
  const summary = agent.getSpendSummary();
  const evo = agent.getEvolutionState();
  console.log("\n---");
  console.log(`Total spent: $${summary.today.toFixed(6)} USDC`);
  console.log(`Transactions: ${summary.transactionCount}`);
  if (evo) {
    console.log(`Evolution: ${evo.mutationCount} mutations, ${(evo.apitollPreference * 100).toFixed(0)}% preference`);
  }
}

main().catch(console.error);
