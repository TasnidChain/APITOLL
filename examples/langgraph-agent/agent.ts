/**
 * Example: LangGraph Stateful Agent + x402 Paid Tools
 *
 * Run: npx tsx examples/langgraph-agent/agent.ts
 *
 * This demonstrates how to integrate x402 paid APIs into a LangGraph-style
 * stateful agent graph. The graph has nodes for planning, research, and
 * synthesis — each node can call paid tools through AgentWallet.
 *
 * Graph:
 *   START → planner → researcher → synthesizer → END
 *               ↑          │
 *               └──────────┘  (loop if more research needed)
 *
 * This pattern works with LangGraph, LangChain, or any graph-based
 * orchestration because it operates at the HTTP layer via AgentWallet.fetch().
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
  name: "LangGraph-Agent",
  chain: "base",
  policies: [
    { type: "budget" as const, dailyCap: 5.0, maxPerRequest: 0.02 },
    { type: "vendor_acl" as const, allowedVendors: ["*"] },
  ],
  signer: createSigner(),
  evolution: true,
  onPayment: (receipt) => {
    console.log(`  [pay] $${receipt.amount} USDC`);
  },
});


interface GraphState {
  query: string;
  plan: string[];
  researchResults: Record<string, unknown>[];
  researchIterations: number;
  maxIterations: number;
  needsMoreResearch: boolean;
  finalAnswer: string;
}

function createInitialState(query: string): GraphState {
  return {
    query,
    plan: [],
    researchResults: [],
    researchIterations: 0,
    maxIterations: 3,
    needsMoreResearch: false,
    finalAnswer: "",
  };
}


async function callTool(
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


/** Plan node: break the query into sub-tasks */
async function plannerNode(state: GraphState): Promise<GraphState> {
  console.log("\n[planner] Breaking query into sub-tasks...");

  // In a real LangGraph setup, you'd use an LLM to generate the plan.
  // Here we simulate planning based on query keywords.
  const plan: string[] = [];
  const q = state.query.toLowerCase();

  if (q.includes("weather") || q.includes("forecast")) {
    plan.push("search_weather");
  }
  if (q.includes("market") || q.includes("price") || q.includes("stock")) {
    plan.push("search_market");
  }
  if (q.includes("news") || q.includes("trend") || q.includes("latest")) {
    plan.push("search_news");
  }
  // Always do a general search
  plan.push("search_general");

  console.log(`  Plan: ${plan.join(" -> ")}`);
  return { ...state, plan };
}

/** Research node: execute paid API calls based on plan */
async function researcherNode(state: GraphState): Promise<GraphState> {
  const iteration = state.researchIterations + 1;
  console.log(`\n[researcher] Iteration ${iteration}/${state.maxIterations}`);

  const results: Record<string, unknown>[] = [...state.researchResults];
  const pendingTasks: Promise<unknown>[] = [];
  const taskLabels: string[] = [];

  for (const task of state.plan) {
    switch (task) {
      case "search_weather": {
        console.log("  Fetching weather data...");
        taskLabels.push("weather");
        pendingTasks.push(
          callTool(`${SELLER_API}/api/forecast?city=${encodeURIComponent("New York")}`)
        );
        break;
      }
      case "search_market": {
        console.log("  Fetching market data...");
        taskLabels.push("market");
        pendingTasks.push(callTool(`${SELLER_API}/api/math/stats`, {
          method: "POST",
          body: { values: [42000, 43500, 41200, 44800, 42600] },
        }));
        break;
      }
      case "search_news": {
        console.log("  Searching for news...");
        taskLabels.push("news");
        pendingTasks.push(
          callTool(`${SELLER_API}/api/search?q=${encodeURIComponent(state.query)}`)
        );
        break;
      }
      case "search_general": {
        console.log("  Running general search...");
        taskLabels.push("general");
        pendingTasks.push(
          callTool(`${SELLER_API}/api/search?q=${encodeURIComponent(state.query)}`)
        );
        break;
      }
    }
  }

  // Execute all research tasks in parallel
  const taskResults = await Promise.all(pendingTasks);

  for (let i = 0; i < taskLabels.length; i++) {
    results.push({ source: taskLabels[i], data: taskResults[i] });
    console.log(`  [${taskLabels[i]}] Got result`);
  }

  // Decide if more research is needed
  const hasErrors = taskResults.some(
    (r) => r && typeof r === "object" && "error" in (r as Record<string, unknown>)
  );
  const needsMore = hasErrors && iteration < state.maxIterations;

  if (needsMore) {
    console.log("  Some results had errors — will retry...");
  }

  return {
    ...state,
    researchResults: results,
    researchIterations: iteration,
    needsMoreResearch: needsMore,
  };
}

/** Synthesizer node: combine results into a final answer */
async function synthesizerNode(state: GraphState): Promise<GraphState> {
  console.log("\n[synthesizer] Combining results...");

  // Optionally call a paid readability/summary API
  const combined = JSON.stringify(state.researchResults).slice(0, 300);
  const readability = await callTool(`${SELLER_API}/api/readability`, {
    method: "POST",
    body: { text: combined },
  });

  const finalAnswer = [
    `Research Summary for: "${state.query}"`,
    `Iterations: ${state.researchIterations}`,
    `Sources: ${state.researchResults.length}`,
    `Readability analysis: ${JSON.stringify(readability)}`,
    "",
    "Results:",
    ...state.researchResults.map(
      (r, i) => `  ${i + 1}. [${(r as { source?: string }).source}] ${JSON.stringify(r.data).slice(0, 100)}...`
    ),
  ].join("\n");

  return { ...state, finalAnswer };
}


/** Conditional edge: should we loop back to researcher? */
function shouldContinueResearch(state: GraphState): "researcher" | "synthesizer" {
  if (state.needsMoreResearch && state.researchIterations < state.maxIterations) {
    return "researcher";
  }
  return "synthesizer";
}

/** Simple graph runner (mimics LangGraph's StateGraph) */
async function runGraph(query: string): Promise<GraphState> {
  console.log(`${"=".repeat(60)}`);
  console.log(`LangGraph Pipeline: "${query}"`);
  console.log(`${"=".repeat(60)}`);

  let state = createInitialState(query);

  // START -> planner
  state = await plannerNode(state);

  // planner -> researcher (with potential loop)
  do {
    state = await researcherNode(state);
    const next = shouldContinueResearch(state);
    if (next === "synthesizer") break;
    console.log("\n  [edge] Looping back to researcher...");
  } while (true);

  // researcher -> synthesizer -> END
  state = await synthesizerNode(state);

  return state;
}


async function main() {
  console.log("LangGraph Stateful Agent + x402 Payments");
  console.log("=========================================\n");

  // Run a few different queries through the graph
  const queries = [
    "Latest AI trends and weather forecast for NYC",
    "Market price analysis for crypto",
  ];

  for (const query of queries) {
    const finalState = await runGraph(query);
    console.log(`\n${finalState.finalAnswer}`);
    console.log();
  }

  // Print wallet summary
  const spend = wallet.getSpendSummary();
  const evo = wallet.getEvolutionState();

  console.log("---");
  console.log(`Total spent: $${spend.today.toFixed(6)} USDC`);
  console.log(`Transactions: ${spend.transactionCount}`);
  if (evo) {
    console.log(`Evolution: ${evo.mutationCount} mutations, ${(evo.apitollPreference * 100).toFixed(0)}% preference`);
  }
}

main().catch(console.error);
