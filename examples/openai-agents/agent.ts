/**
 * Example: OpenAI Function Calling + x402 Paid Tools
 *
 * Run: OPENAI_API_KEY=sk-... npx tsx examples/openai-agents/agent.ts
 *
 * This shows how to wire x402 paid APIs into OpenAI's function calling.
 * The LLM decides which tool to call, API Toll handles the payment,
 * and the result feeds back into the conversation.
 *
 * Flow:
 *   User question → GPT-4 picks tool → agent.fetch() auto-pays → result → GPT-4 answers
 */

import { createAgentWallet, createFacilitatorSigner } from "@apitoll/buyer-sdk";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://pay.apitoll.com";

// ─── Define paid tools as OpenAI function schemas ──────────────

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get a 7-day weather forecast for a city. Costs $0.002 USDC per call.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name (e.g., 'Tokyo', 'New York')" },
        },
        required: ["city"],
      },
    },
    // API Toll metadata (not sent to OpenAI — used by our executor)
    _apitoll: {
      url: "http://localhost:3001/api/forecast",
      price: 0.002,
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_stock_price",
      description: "Get the current price of a stock or cryptocurrency. Costs $0.001 USDC per call.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Ticker symbol (e.g., 'BTC', 'AAPL', 'ETH')" },
        },
        required: ["symbol"],
      },
    },
    _apitoll: {
      url: "http://localhost:4403/api/price",
      price: 0.001,
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_sentiment",
      description: "Analyze the sentiment of text (positive/negative/neutral). Costs $0.002 USDC per call.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to analyze" },
        },
        required: ["text"],
      },
    },
    _apitoll: {
      url: "http://localhost:4404/api/sentiment",
      price: 0.002,
    },
  },
];

// ─── Agent wallet for auto-paying ──────────────────────────────

const agent = createAgentWallet({
  name: "OpenAI-Agent",
  chain: "base",
  policies: [
    { type: "budget" as const, dailyCap: 5.0, maxPerRequest: 0.05 },
    { type: "vendor_acl" as const, allowedVendors: ["*"] },
  ],
  signer: process.env.FACILITATOR_API_KEY
    ? createFacilitatorSigner(FACILITATOR_URL, process.env.FACILITATOR_API_KEY, "")
    : async () => Buffer.from(JSON.stringify({ mock: true })).toString("base64"),
  evolution: true, // Self-optimize after each call
  onPayment: (receipt) => {
    console.log(`  [payment] $${receipt.amount} USDC → ${receipt.to}`);
  },
});

// ─── Tool executor — calls paid APIs via agent wallet ──────────

async function executeTool(name: string, args: Record<string, string>): Promise<string> {
  const tool = tools.find((t) => t.function.name === name);
  if (!tool) return JSON.stringify({ error: `Unknown tool: ${name}` });

  const meta = (tool as unknown as { _apitoll: { url: string; price: number; chain: string } })._apitoll;
  let url = meta.url;

  // Build URL based on tool
  if (name === "get_weather") {
    url += `?city=${encodeURIComponent(args.city)}`;
  } else if (name === "get_stock_price") {
    url += `/${encodeURIComponent(args.symbol)}`;
  }

  console.log(`  [tool] Calling ${name}(${JSON.stringify(args)}) → ${url}`);

  try {
    const response = await agent.fetch(url, {
      method: name === "analyze_sentiment" ? "POST" : "GET",
      ...(name === "analyze_sentiment"
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: args.text }),
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

// ─── Chat loop with OpenAI ─────────────────────────────────────

async function chat(userMessage: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    // Demo mode without OpenAI
    console.log("\n[Demo mode — set OPENAI_API_KEY for real GPT-4 integration]");
    console.log(`User: ${userMessage}`);

    // Simulate tool selection
    if (userMessage.toLowerCase().includes("weather")) {
      const result = await executeTool("get_weather", { city: "Tokyo" });
      return `[Demo] Weather data: ${result}`;
    } else if (userMessage.toLowerCase().includes("price") || userMessage.toLowerCase().includes("stock")) {
      const result = await executeTool("get_stock_price", { symbol: "BTC" });
      return `[Demo] Price data: ${result}`;
    }
    return "[Demo] No matching tool for this query.";
  }

  const messages: Array<{ role: string; content: string; tool_call_id?: string; name?: string }> = [
    {
      role: "system",
      content:
        "You are a helpful assistant with access to paid API tools. " +
        "Each tool call costs a small amount of USDC. Use tools when the user asks " +
        "for real-time data like weather, stock prices, or text analysis.",
    },
    { role: "user", content: userMessage },
  ];

  // Call OpenAI
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages,
      tools: tools.map((t) => ({ type: t.type, function: t.function })),
      tool_choice: "auto",
    }),
  });

  interface OpenAIChoice {
    finish_reason: string;
    message: { content?: string; tool_calls?: { function: { name: string; arguments: string } }[] };
  }
  const data = await response.json() as { choices?: OpenAIChoice[] };
  const choice = data.choices?.[0];

  if (!choice) return "No response from OpenAI";

  // Check if GPT wants to call tools
  if (choice.finish_reason === "tool_calls" && choice.message?.tool_calls) {
    for (const toolCall of choice.message.tool_calls) {
      const { name, arguments: argsStr } = toolCall.function;
      const args = JSON.parse(argsStr);

      console.log(`  [gpt-4] Selected tool: ${name}`);
      const result = await executeTool(name, args);

      messages.push(choice.message);
      messages.push({
        role: "tool",
        content: result,
        tool_call_id: toolCall.id,
      });
    }

    // Get final answer from GPT with tool results
    const finalResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: "gpt-4", messages }),
    });

    const finalData = await finalResponse.json() as { choices?: { message?: { content?: string } }[] };
    return finalData.choices?.[0]?.message?.content || "No response";
  }

  return choice.message?.content || "No response";
}

// ─── Run ────────────────────────────────────────────────────────

async function main() {
  console.log("OpenAI Function Calling + x402 Paid Tools");
  console.log("==========================================\n");

  // Example queries
  const queries = [
    "What's the weather like in Tokyo this week?",
    "What's the current price of Bitcoin?",
  ];

  for (const query of queries) {
    console.log(`\nUser: ${query}`);
    const answer = await chat(query);
    console.log(`\nAssistant: ${answer}`);
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
