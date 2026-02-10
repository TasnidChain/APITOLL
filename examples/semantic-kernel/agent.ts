/**
 * Example: Microsoft Semantic Kernel-style Agent + x402 Paid Tools
 *
 * Run: npx tsx examples/semantic-kernel/agent.ts
 *
 * This demonstrates a Semantic Kernel-inspired pattern where plugins
 * contain functions that are automatically paid via AgentWallet.
 *
 * Architecture:
 *   Kernel → Plugin (functions) → AgentWallet.fetch() → Paid API
 *
 * In Semantic Kernel, "plugins" group related functions. Each function
 * has metadata (name, description, parameters). This example shows how
 * to create paid plugins that handle x402 payments transparently.
 *
 * This pattern works with Microsoft Semantic Kernel (Python/C#/.NET)
 * or any plugin-based framework because it operates at the HTTP layer.
 */

import { createAgentWallet, createFacilitatorSigner, type AgentWallet } from "@apitoll/buyer-sdk";

const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://pay.apitoll.com";
const SELLER_API = process.env.SELLER_API_URL || "http://localhost:4402";


function createSigner() {
  return process.env.FACILITATOR_API_KEY
    ? createFacilitatorSigner(FACILITATOR_URL, process.env.FACILITATOR_API_KEY, "")
    : async () => Buffer.from(JSON.stringify({ mock: true })).toString("base64");
}

const wallet = createAgentWallet({
  name: "SemanticKernel-Agent",
  chain: "base",
  policies: [
    { type: "budget" as const, dailyCap: 3.0, maxPerRequest: 0.01 },
    { type: "vendor_acl" as const, allowedVendors: ["*"] },
  ],
  signer: createSigner(),
  evolution: true,
  onPayment: (receipt) => {
    console.log(`  [pay] $${receipt.amount} USDC`);
  },
});


interface KernelFunctionMetadata {
  name: string;
  description: string;
  parameters: { name: string; type: string; description: string; required: boolean }[];
}

interface KernelFunction {
  metadata: KernelFunctionMetadata;
  invoke: (args: Record<string, unknown>) => Promise<unknown>;
}

interface KernelPlugin {
  name: string;
  description: string;
  functions: KernelFunction[];
}

/** Create a paid kernel function that routes through AgentWallet */
function createPaidFunction(
  meta: KernelFunctionMetadata,
  executor: (args: Record<string, unknown>, wallet: AgentWallet) => Promise<unknown>
): KernelFunction {
  return {
    metadata: meta,
    invoke: (args) => executor(args, wallet),
  };
}


const weatherPlugin: KernelPlugin = {
  name: "WeatherPlugin",
  description: "Get weather forecasts and climate data (paid via x402)",
  functions: [
    createPaidFunction(
      {
        name: "get_forecast",
        description: "Get a 7-day weather forecast for a city",
        parameters: [
          { name: "city", type: "string", description: "City name", required: true },
        ],
      },
      async (args, w) => {
        const city = args.city as string;
        console.log(`  [WeatherPlugin.get_forecast] City: ${city}`);
        const res = await w.fetch(
          `${SELLER_API}/api/forecast?city=${encodeURIComponent(city)}`
        );
        if (!res.ok) return { error: `HTTP ${res.status}` };
        return res.json();
      }
    ),
    createPaidFunction(
      {
        name: "get_uv_index",
        description: "Get the UV index for a location",
        parameters: [
          { name: "lat", type: "number", description: "Latitude", required: true },
          { name: "lon", type: "number", description: "Longitude", required: true },
        ],
      },
      async (args, w) => {
        console.log(`  [WeatherPlugin.get_uv_index] (${args.lat}, ${args.lon})`);
        const res = await w.fetch(
          `${SELLER_API}/api/geo/reverse?lat=${args.lat}&lon=${args.lon}`
        );
        if (!res.ok) return { error: `HTTP ${res.status}` };
        return res.json();
      }
    ),
  ],
};


const dataPlugin: KernelPlugin = {
  name: "DataAnalysisPlugin",
  description: "Analyze text and compute statistics (paid via x402)",
  functions: [
    createPaidFunction(
      {
        name: "analyze_sentiment",
        description: "Analyze the sentiment of text",
        parameters: [
          { name: "text", type: "string", description: "Text to analyze", required: true },
        ],
      },
      async (args, w) => {
        console.log(`  [DataPlugin.analyze_sentiment]`);
        const res = await w.fetch(`${SELLER_API}/api/sentiment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: args.text }),
        });
        if (!res.ok) return { error: `HTTP ${res.status}` };
        return res.json();
      }
    ),
    createPaidFunction(
      {
        name: "compute_stats",
        description: "Compute statistical summary of numeric data",
        parameters: [
          { name: "values", type: "number[]", description: "Array of numbers", required: true },
        ],
      },
      async (args, w) => {
        console.log(`  [DataPlugin.compute_stats]`);
        const res = await w.fetch(`${SELLER_API}/api/math/stats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: args.values }),
        });
        if (!res.ok) return { error: `HTTP ${res.status}` };
        return res.json();
      }
    ),
    createPaidFunction(
      {
        name: "extract_entities",
        description: "Extract named entities from text",
        parameters: [
          { name: "text", type: "string", description: "Text to extract entities from", required: true },
        ],
      },
      async (args, w) => {
        console.log(`  [DataPlugin.extract_entities]`);
        const res = await w.fetch(`${SELLER_API}/api/entities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: args.text }),
        });
        if (!res.ok) return { error: `HTTP ${res.status}` };
        return res.json();
      }
    ),
  ],
};


const searchPlugin: KernelPlugin = {
  name: "SearchPlugin",
  description: "Web search capabilities (paid via x402)",
  functions: [
    createPaidFunction(
      {
        name: "web_search",
        description: "Search the web for information",
        parameters: [
          { name: "query", type: "string", description: "Search query", required: true },
        ],
      },
      async (args, w) => {
        console.log(`  [SearchPlugin.web_search] "${args.query}"`);
        const res = await w.fetch(
          `${SELLER_API}/api/search?q=${encodeURIComponent(args.query as string)}`
        );
        if (!res.ok) return { error: `HTTP ${res.status}` };
        return res.json();
      }
    ),
  ],
};


class Kernel {
  private plugins: Map<string, KernelPlugin> = new Map();

  addPlugin(plugin: KernelPlugin) {
    this.plugins.set(plugin.name, plugin);
    console.log(`  Registered plugin: ${plugin.name} (${plugin.functions.length} functions)`);
  }

  listPlugins(): { plugin: string; function: string; description: string }[] {
    const result: { plugin: string; function: string; description: string }[] = [];
    for (const [name, plugin] of this.plugins) {
      for (const fn of plugin.functions) {
        result.push({
          plugin: name,
          function: fn.metadata.name,
          description: fn.metadata.description,
        });
      }
    }
    return result;
  }

  getFunction(pluginName: string, functionName: string): KernelFunction | null {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return null;
    return plugin.functions.find((f) => f.metadata.name === functionName) || null;
  }

  /** Invoke a function by plugin.function notation */
  async invoke(qualifiedName: string, args: Record<string, unknown>): Promise<unknown> {
    const [pluginName, fnName] = qualifiedName.split(".");
    const fn = this.getFunction(pluginName, fnName);
    if (!fn) throw new Error(`Function not found: ${qualifiedName}`);
    return fn.invoke(args);
  }
}


interface Plan {
  goal: string;
  steps: { qualifiedName: string; args: Record<string, unknown>; description: string }[];
}

function createPlan(goal: string): Plan {
  const g = goal.toLowerCase();
  const steps: Plan["steps"] = [];

  if (g.includes("weather") || g.includes("forecast")) {
    steps.push({
      qualifiedName: "WeatherPlugin.get_forecast",
      args: { city: "New York" },
      description: "Get weather forecast",
    });
  }

  if (g.includes("analy") || g.includes("sentiment")) {
    steps.push({
      qualifiedName: "DataAnalysisPlugin.analyze_sentiment",
      args: { text: goal },
      description: "Analyze sentiment of the request",
    });
  }

  if (g.includes("stat") || g.includes("data") || g.includes("number")) {
    steps.push({
      qualifiedName: "DataAnalysisPlugin.compute_stats",
      args: { values: [10, 25, 33, 47, 55, 62, 78, 84, 91, 99] },
      description: "Compute statistics on sample data",
    });
  }

  // Always search for context
  steps.push({
    qualifiedName: "SearchPlugin.web_search",
    args: { query: goal },
    description: "Search for additional context",
  });

  return { goal, steps };
}


async function main() {
  console.log("Semantic Kernel-style Agent + x402 Payments");
  console.log("============================================\n");

  // 1. Create kernel and register plugins
  console.log("Registering plugins:");
  const kernel = new Kernel();
  kernel.addPlugin(weatherPlugin);
  kernel.addPlugin(dataPlugin);
  kernel.addPlugin(searchPlugin);

  // 2. List all available functions
  console.log("\nAvailable functions:");
  for (const fn of kernel.listPlugins()) {
    console.log(`  ${fn.plugin}.${fn.function} — ${fn.description}`);
  }

  // 3. Execute a goal using the planner
  const goals = [
    "Get weather forecast and analyze market data statistics",
    "Search for AI agent trends and analyze sentiment",
  ];

  for (const goal of goals) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Goal: "${goal}"`);
    console.log(`${"=".repeat(60)}`);

    const plan = createPlan(goal);
    console.log(`\nPlan (${plan.steps.length} steps):`);
    plan.steps.forEach((s, i) => console.log(`  ${i + 1}. ${s.qualifiedName} — ${s.description}`));

    console.log("\nExecuting plan:");
    const results: { step: string; result: unknown }[] = [];

    for (const step of plan.steps) {
      try {
        const result = await kernel.invoke(step.qualifiedName, step.args);
        results.push({ step: step.qualifiedName, result });
        console.log(`  [done] ${step.qualifiedName}`);
      } catch (e) {
        console.log(`  [fail] ${step.qualifiedName}: ${e instanceof Error ? e.message : e}`);
      }
    }

    console.log(`\nCompleted ${results.length}/${plan.steps.length} steps`);
  }

  // 4. Print wallet summary
  const spend = wallet.getSpendSummary();
  const evo = wallet.getEvolutionState();

  console.log(`\n${"=".repeat(60)}`);
  console.log("WALLET SUMMARY");
  console.log(`${"=".repeat(60)}`);
  console.log(`Total spent: $${spend.today.toFixed(6)} USDC`);
  console.log(`Transactions: ${spend.transactionCount}`);
  if (evo) {
    console.log(`Evolution: ${evo.mutationCount} mutations, ${(evo.apitollPreference * 100).toFixed(0)}% preference`);
  }
}

main().catch(console.error);
