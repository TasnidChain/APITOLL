/**
 * Example: Multi-Agent Swarm with Shared Budget
 *
 * Run: npx tsx examples/multi-agent-swarm/swarm.ts
 *
 * This demonstrates multiple AI agents working together, each with their
 * own wallet but sharing a budget pool. The swarm coordinates tasks and
 * each agent pays for its own API calls.
 *
 * Architecture:
 *   Coordinator → spawns agents → agents call paid APIs → report back
 *
 * This is the pattern for autonomous agent teams (CrewAI, AutoGen, etc.)
 * where each agent needs independent spending authority.
 */

import {
  createAgentWallet,
  createFacilitatorSigner,
  type AgentWallet,
} from "@apitoll/buyer-sdk";

const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://facilitator-production-fbd7.up.railway.app";
const FACILITATOR_API_KEY = process.env.FACILITATOR_API_KEY || "";

// ─── Agent Factory ──────────────────────────────────────────────

interface SwarmAgent {
  name: string;
  role: string;
  wallet: AgentWallet;
}

function createSwarmAgent(name: string, role: string, dailyBudget: number): SwarmAgent {
  const wallet = createAgentWallet({
    name,
    chain: "base",
    policies: [
      {
        type: "budget" as const,
        dailyCap: dailyBudget,
        maxPerRequest: dailyBudget * 0.1, // Max 10% of daily budget per call
      },
      {
        type: "vendor_acl" as const,
        allowedVendors: ["*"],
      },
      {
        type: "rate_limit" as const,
        maxPerMinute: 30,
      },
    ],
    signer: FACILITATOR_API_KEY
      ? createFacilitatorSigner(FACILITATOR_URL, FACILITATOR_API_KEY, "")
      : async () => {
          // Mock signer for demo
          return Buffer.from(JSON.stringify({ mock: true, agent: name })).toString("base64");
        },
    // Enable evolution — each agent self-optimizes independently
    evolution: {
      onMutation: (m) => {
        console.log(`    [${name}] evolved: ${m.type} ${m.from} → ${m.to}`);
      },
    },
    onPayment: (receipt) => {
      console.log(`    [${name}] paid $${receipt.amount} USDC (${receipt.chain})`);
    },
  });

  return { name, role, wallet };
}

// ─── Swarm Coordinator ──────────────────────────────────────────

class SwarmCoordinator {
  private agents: SwarmAgent[] = [];

  addAgent(name: string, role: string, dailyBudget: number): SwarmAgent {
    const agent = createSwarmAgent(name, role, dailyBudget);
    this.agents.push(agent);
    return agent;
  }

  async executeTask(task: string): Promise<void> {
    console.log(`\n[Coordinator] Executing task: "${task}"`);
    console.log(`[Coordinator] Deploying ${this.agents.length} agents...\n`);

    // Each agent works independently on its subtask
    const results = await Promise.allSettled(
      this.agents.map(async (agent) => {
        console.log(`  [${agent.name}] (${agent.role}) Starting...`);

        try {
          // Each agent calls the APIs it needs
          // In production, the agent would pick URLs based on its role
          const weatherUrl = "http://localhost:3001/api/forecast?city=Tokyo";
          const stockUrl = "http://localhost:4403/api/price/BTC";

          if (agent.role === "researcher") {
            const res = await agent.wallet.fetch(weatherUrl);
            return { agent: agent.name, status: res.status, role: agent.role };
          } else if (agent.role === "analyst") {
            const res = await agent.wallet.fetch(stockUrl);
            return { agent: agent.name, status: res.status, role: agent.role };
          } else {
            // Scout — tries multiple endpoints
            const res1 = await agent.wallet.fetch(weatherUrl);
            const _res2 = await agent.wallet.fetch(stockUrl);
            return { agent: agent.name, status: res1.status, role: agent.role };
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          console.log(`  [${agent.name}] Error: ${msg}`);
          return { agent: agent.name, status: "error", error: msg };
        }
      })
    );

    // Aggregate results
    console.log("\n[Coordinator] Task complete. Results:\n");
    results.forEach((result, i) => {
      const agent = this.agents[i];
      if (result.status === "fulfilled") {
        console.log(`  ${agent.name} (${agent.role}): ${JSON.stringify(result.value)}`);
      } else {
        console.log(`  ${agent.name} (${agent.role}): FAILED — ${result.reason}`);
      }
    });

    // Print aggregate spending
    console.log("\n[Coordinator] Spending report:\n");
    let totalSpend = 0;
    this.agents.forEach((agent) => {
      const summary = agent.wallet.getSpendSummary();
      const evo = agent.wallet.getEvolutionState();
      totalSpend += summary.today;
      console.log(`  ${agent.name}:`);
      console.log(`    Spent today: $${summary.today.toFixed(6)} USDC`);
      console.log(`    Transactions: ${summary.transactionCount}`);
      if (evo) {
        console.log(`    Evolution: ${evo.mutationCount} mutations, ${(evo.apitollPreference * 100).toFixed(0)}% preference`);
      }
    });
    console.log(`\n  Total swarm spend: $${totalSpend.toFixed(6)} USDC`);
  }
}

// ─── Run the swarm ──────────────────────────────────────────────

async function main() {
  console.log("Multi-Agent Swarm Example");
  console.log("========================\n");

  const swarm = new SwarmCoordinator();

  // Create specialized agents with different budgets
  swarm.addAgent("ResearchBot", "researcher", 5.0);   // $5/day for weather/data APIs
  swarm.addAgent("AnalystBot", "analyst", 10.0);       // $10/day for financial data
  swarm.addAgent("ScoutBot", "scout", 2.0);            // $2/day for discovery

  // Execute a coordinated task
  await swarm.executeTask("Analyze weather impact on crypto markets in Tokyo");

  console.log("\nNote: Start the seller examples first for live payments:");
  console.log("  Terminal 1: SELLER_WALLET=0x... npx tsx examples/seller-express/server.ts");
  console.log("  Terminal 2: SELLER_WALLET=0x... npx tsx examples/seller-stock-api/server.ts");
  console.log("  Terminal 3: npx tsx examples/multi-agent-swarm/swarm.ts\n");
}

main().catch(console.error);
