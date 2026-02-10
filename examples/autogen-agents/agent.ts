/**
 * Example: AutoGen-style Multi-Agent + x402 Paid Tools
 *
 * Run: npx tsx examples/autogen-agents/agent.ts
 *
 * This demonstrates an AutoGen-inspired multi-agent pattern where
 * multiple agents collaborate on a task, each with their own wallet,
 * budget, and tool access.
 *
 * Architecture:
 *   Coordinator → assigns sub-tasks → Researcher (web search) + Analyst (data processing)
 *   Each agent has its own AgentWallet with independent budgets & policies.
 *
 * This pattern works with Microsoft AutoGen, CrewAI, or any multi-agent framework
 * because it operates at the HTTP layer via AgentWallet.fetch().
 */

import { createAgentWallet, createFacilitatorSigner, type AgentWallet } from "@apitoll/buyer-sdk";

const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://pay.apitoll.com";
const SELLER_API = process.env.SELLER_API_URL || "http://localhost:4402";


function createSigner() {
  return process.env.FACILITATOR_API_KEY
    ? createFacilitatorSigner(FACILITATOR_URL, process.env.FACILITATOR_API_KEY, "")
    : async () => Buffer.from(JSON.stringify({ mock: true })).toString("base64");
}

// Researcher agent — high budget for web searches
const researcher = createAgentWallet({
  name: "Researcher",
  chain: "base",
  policies: [
    { type: "budget" as const, dailyCap: 2.0, maxPerRequest: 0.01 },
    { type: "vendor_acl" as const, allowedVendors: ["*"] },
  ],
  signer: createSigner(),
  evolution: true,
  onPayment: (receipt) => {
    console.log(`  [Researcher][pay] $${receipt.amount} USDC`);
  },
});

// Analyst agent — focused budget for data processing
const analyst = createAgentWallet({
  name: "Analyst",
  chain: "base",
  policies: [
    { type: "budget" as const, dailyCap: 1.0, maxPerRequest: 0.005 },
    { type: "vendor_acl" as const, allowedVendors: ["*"] },
  ],
  signer: createSigner(),
  evolution: true,
  onPayment: (receipt) => {
    console.log(`  [Analyst][pay] $${receipt.amount} USDC`);
  },
});

// Writer agent — minimal budget (mostly CPU-local work)
const writer = createAgentWallet({
  name: "Writer",
  chain: "base",
  policies: [
    { type: "budget" as const, dailyCap: 0.5, maxPerRequest: 0.003 },
    { type: "vendor_acl" as const, allowedVendors: ["*"] },
  ],
  signer: createSigner(),
  evolution: true,
  onPayment: (receipt) => {
    console.log(`  [Writer][pay] $${receipt.amount} USDC`);
  },
});


async function callTool(
  wallet: AgentWallet,
  url: string,
  opts?: { method?: string; body?: unknown }
): Promise<unknown> {
  try {
    const response = await wallet.fetch(url, {
      method: opts?.method || "GET",
      ...(opts?.body
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(opts.body) }
        : {}),
    });
    if (!response.ok) return { error: `HTTP ${response.status}` };
    return await response.json();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// Researcher tools
async function webSearch(query: string) {
  console.log(`  [Researcher] Searching: "${query}"`);
  return callTool(researcher, `${SELLER_API}/api/search?q=${encodeURIComponent(query)}`);
}

async function getWeather(city: string) {
  console.log(`  [Researcher] Weather for: ${city}`);
  return callTool(researcher, `${SELLER_API}/api/forecast?city=${encodeURIComponent(city)}`);
}

// Analyst tools
async function analyzeSentiment(text: string) {
  console.log(`  [Analyst] Analyzing sentiment...`);
  return callTool(analyst, `${SELLER_API}/api/sentiment`, {
    method: "POST",
    body: { text },
  });
}

async function extractEntities(text: string) {
  console.log(`  [Analyst] Extracting entities...`);
  return callTool(analyst, `${SELLER_API}/api/entities`, {
    method: "POST",
    body: { text },
  });
}

async function computeStats(data: number[]) {
  console.log(`  [Analyst] Computing statistics...`);
  return callTool(analyst, `${SELLER_API}/api/math/stats`, {
    method: "POST",
    body: { values: data },
  });
}

// Writer tools
async function summarize(text: string) {
  console.log(`  [Writer] Summarizing...`);
  return callTool(writer, `${SELLER_API}/api/readability`, {
    method: "POST",
    body: { text },
  });
}


interface TaskResult {
  agent: string;
  task: string;
  result: unknown;
  costUsdc: number;
}

class Coordinator {
  private results: TaskResult[] = [];

  async runResearchPipeline(topic: string): Promise<TaskResult[]> {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`Coordinator: Starting research pipeline for "${topic}"`);
    console.log(`${"═".repeat(60)}\n`);

    // Phase 1: Research (parallel)
    console.log("Phase 1: Research & Data Gathering");
    console.log("---");

    const [searchResult, weatherResult] = await Promise.all([
      webSearch(topic),
      getWeather("New York"), // contextual weather for report
    ]);

    this.results.push(
      { agent: "Researcher", task: "web_search", result: searchResult, costUsdc: 0.003 },
      { agent: "Researcher", task: "weather", result: weatherResult, costUsdc: 0.002 }
    );

    // Phase 2: Analysis (depends on research)
    console.log("\nPhase 2: Analysis & Processing");
    console.log("---");

    const searchText = JSON.stringify(searchResult);
    const [sentimentResult, entityResult, statsResult] = await Promise.all([
      analyzeSentiment(searchText.slice(0, 500)),
      extractEntities(searchText.slice(0, 500)),
      computeStats([42, 67, 33, 91, 55, 78, 12, 89, 44, 76]),
    ]);

    this.results.push(
      { agent: "Analyst", task: "sentiment", result: sentimentResult, costUsdc: 0.002 },
      { agent: "Analyst", task: "entities", result: entityResult, costUsdc: 0.002 },
      { agent: "Analyst", task: "statistics", result: statsResult, costUsdc: 0.001 }
    );

    // Phase 3: Writing (depends on analysis)
    console.log("\nPhase 3: Report Generation");
    console.log("---");

    const summary = await summarize(searchText.slice(0, 300));
    this.results.push(
      { agent: "Writer", task: "summary", result: summary, costUsdc: 0.002 }
    );

    return this.results;
  }

  printReport() {
    console.log(`\n${"═".repeat(60)}`);
    console.log("PIPELINE REPORT");
    console.log(`${"═".repeat(60)}\n`);

    // Per-agent summary
    const agents = ["Researcher", "Analyst", "Writer"] as const;
    const wallets = { Researcher: researcher, Analyst: analyst, Writer: writer };

    for (const name of agents) {
      const agentResults = this.results.filter((r) => r.agent === name);
      const spend = wallets[name].getSpendSummary();
      const evo = wallets[name].getEvolutionState();

      console.log(`${name}:`);
      console.log(`  Tasks completed: ${agentResults.length}`);
      console.log(`  Spend: $${spend.today.toFixed(6)} USDC`);
      console.log(`  Transactions: ${spend.transactionCount}`);
      if (evo) {
        console.log(`  Mutations: ${evo.mutationCount}, Preference: ${(evo.apitollPreference * 100).toFixed(0)}%`);
      }
      console.log();
    }

    // Total costs
    const totalSpend =
      researcher.getSpendSummary().today +
      analyst.getSpendSummary().today +
      writer.getSpendSummary().today;

    const totalTxns =
      researcher.getSpendSummary().transactionCount +
      analyst.getSpendSummary().transactionCount +
      writer.getSpendSummary().transactionCount;

    console.log("---");
    console.log(`Total pipeline cost: $${totalSpend.toFixed(6)} USDC`);
    console.log(`Total transactions: ${totalTxns}`);
    console.log(`Agents used: ${agents.length}`);
  }
}


async function main() {
  console.log("AutoGen-style Multi-Agent Pipeline + x402 Payments");
  console.log("===================================================\n");
  console.log("Agents: Researcher ($2/day), Analyst ($1/day), Writer ($0.50/day)");
  console.log("Each agent has independent budget, policies, and evolution.\n");

  const coordinator = new Coordinator();

  // Run a research pipeline on a topic
  await coordinator.runResearchPipeline("AI agent commerce and micropayments");

  // Print final report
  coordinator.printReport();
}

main().catch(console.error);
