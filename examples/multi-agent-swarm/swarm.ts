/**
 * Example: Multi-Agent Swarm with Advanced Coordination
 *
 * Run: npx tsx examples/multi-agent-swarm/swarm.ts
 *
 * This demonstrates a production-grade multi-agent swarm with:
 *   - Task DAG execution (dependencies between tasks)
 *   - Inter-agent message bus (agents communicate findings)
 *   - Shared knowledge base (accumulated research)
 *   - Budget pooling & rebalancing (redistribute funds dynamically)
 *   - Dynamic agent spawning (add agents based on workload)
 *   - Fault tolerance (retry failed tasks, reassign to other agents)
 *
 * Architecture:
 *   SwarmCoordinator
 *     ├── MessageBus (pub/sub between agents)
 *     ├── KnowledgeBase (shared memory)
 *     ├── BudgetPool (collective spending control)
 *     └── Agents[]
 *           ├── ResearchBot  ($5/day)
 *           ├── AnalystBot   ($10/day)
 *           └── ScoutBot     ($2/day)
 */

import {
  createAgentWallet,
  createFacilitatorSigner,
  type AgentWallet,
} from "@apitoll/buyer-sdk";

const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://pay.apitoll.com";
const FACILITATOR_API_KEY = process.env.FACILITATOR_API_KEY || "";
const SELLER_API = process.env.SELLER_API_URL || "http://localhost:4402";

// ═══════════════════════════════════════════════════════════════
// Message Bus — inter-agent communication
// ═══════════════════════════════════════════════════════════════

interface Message {
  from: string;
  to: string | "*"; // "*" = broadcast to all
  type: "finding" | "request" | "status" | "error";
  payload: unknown;
  timestamp: number;
}

class MessageBus {
  private messages: Message[] = [];
  private subscribers = new Map<string, ((msg: Message) => void)[]>();

  send(msg: Message) {
    this.messages.push(msg);

    // Deliver to specific agent or broadcast
    if (msg.to === "*") {
      for (const [, handlers] of this.subscribers) {
        handlers.forEach((h) => h(msg));
      }
    } else {
      const handlers = this.subscribers.get(msg.to) || [];
      handlers.forEach((h) => h(msg));
    }
  }

  subscribe(agentName: string, handler: (msg: Message) => void) {
    const existing = this.subscribers.get(agentName) || [];
    existing.push(handler);
    this.subscribers.set(agentName, existing);
  }

  getHistory(filter?: { from?: string; type?: string }): Message[] {
    return this.messages.filter((m) => {
      if (filter?.from && m.from !== filter.from) return false;
      if (filter?.type && m.type !== filter.type) return false;
      return true;
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// Knowledge Base — shared memory between agents
// ═══════════════════════════════════════════════════════════════

interface KnowledgeEntry {
  key: string;
  value: unknown;
  source: string; // agent name
  confidence: number; // 0-1
  timestamp: number;
}

class KnowledgeBase {
  private entries = new Map<string, KnowledgeEntry>();

  add(key: string, value: unknown, source: string, confidence = 0.8) {
    const existing = this.entries.get(key);

    // Higher confidence wins, or newer data if same confidence
    if (!existing || confidence >= existing.confidence) {
      this.entries.set(key, {
        key,
        value,
        source,
        confidence,
        timestamp: Date.now(),
      });
    }
  }

  get(key: string): KnowledgeEntry | undefined {
    return this.entries.get(key);
  }

  search(prefix: string): KnowledgeEntry[] {
    return Array.from(this.entries.values()).filter((e) =>
      e.key.startsWith(prefix)
    );
  }

  dump(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of this.entries) {
      result[key] = {
        value: entry.value,
        source: entry.source,
        confidence: entry.confidence,
      };
    }
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════
// Budget Pool — collective spending control
// ═══════════════════════════════════════════════════════════════

class BudgetPool {
  private allocations = new Map<string, number>();
  readonly totalBudget: number;

  constructor(totalBudget: number) {
    this.totalBudget = totalBudget;
  }

  allocate(agentName: string, amount: number): boolean {
    const used = this.totalUsed();
    if (used + amount > this.totalBudget) return false;
    const current = this.allocations.get(agentName) || 0;
    this.allocations.set(agentName, current + amount);
    return true;
  }

  /** Rebalance budgets based on agent utilization */
  rebalance(agents: { name: string; spent: number; allocated: number }[]) {
    const totalSpent = agents.reduce((sum, a) => sum + a.spent, 0);
    const remaining = this.totalBudget - totalSpent;

    if (remaining <= 0) return;

    // Give more budget to agents that are spending (active) and less to idle ones
    const activeAgents = agents.filter((a) => a.spent > 0);
    const idleAgents = agents.filter((a) => a.spent === 0);

    const perActive = remaining * 0.7 / Math.max(activeAgents.length, 1);
    const perIdle = remaining * 0.3 / Math.max(idleAgents.length, 1);

    for (const agent of activeAgents) {
      this.allocations.set(agent.name, agent.spent + perActive);
    }
    for (const agent of idleAgents) {
      this.allocations.set(agent.name, perIdle);
    }
  }

  totalUsed(): number {
    let sum = 0;
    for (const amount of this.allocations.values()) {
      sum += amount;
    }
    return sum;
  }

  getAllocation(agentName: string): number {
    return this.allocations.get(agentName) || 0;
  }

  getSummary(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [name, amount] of this.allocations) {
      result[name] = amount;
    }
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════
// Task DAG — dependency-aware task execution
// ═══════════════════════════════════════════════════════════════

type TaskStatus = "pending" | "running" | "completed" | "failed";

interface SwarmTask {
  id: string;
  name: string;
  assignedTo: string; // agent name
  dependsOn: string[]; // task IDs that must complete first
  execute: (agent: SwarmAgent, ctx: TaskContext) => Promise<unknown>;
  status: TaskStatus;
  result?: unknown;
  error?: string;
  retries: number;
  maxRetries: number;
}

interface TaskContext {
  bus: MessageBus;
  kb: KnowledgeBase;
  pool: BudgetPool;
}

// ═══════════════════════════════════════════════════════════════
// Swarm Agent
// ═══════════════════════════════════════════════════════════════

interface SwarmAgent {
  name: string;
  role: string;
  wallet: ReturnType<typeof createAgentWallet>;
  capabilities: string[];
}

function createSwarmAgent(
  name: string,
  role: string,
  dailyBudget: number,
  capabilities: string[]
): SwarmAgent {
  const wallet = createAgentWallet({
    name,
    chain: "base",
    policies: [
      { type: "budget" as const, dailyCap: dailyBudget, maxPerRequest: dailyBudget * 0.1 },
      { type: "vendor_acl" as const, allowedVendors: ["*"] },
      { type: "rate_limit" as const, maxPerMinute: 30 },
    ],
    signer: FACILITATOR_API_KEY
      ? createFacilitatorSigner(FACILITATOR_URL, FACILITATOR_API_KEY, "")
      : async () => Buffer.from(JSON.stringify({ mock: true, agent: name })).toString("base64"),
    evolution: {
      onMutation: (m) => {
        console.log(`    [${name}] evolved: ${m.type} ${m.from} -> ${m.to}`);
      },
    },
    onPayment: (receipt) => {
      console.log(`    [${name}] paid $${receipt.amount} USDC`);
    },
  });

  return { name, role, wallet, capabilities };
}

// ═══════════════════════════════════════════════════════════════
// Swarm Coordinator — orchestrates everything
// ═══════════════════════════════════════════════════════════════

class SwarmCoordinator {
  private agents: SwarmAgent[] = [];
  private tasks: SwarmTask[] = [];
  readonly bus = new MessageBus();
  readonly kb = new KnowledgeBase();
  readonly pool: BudgetPool;

  constructor(totalBudget: number) {
    this.pool = new BudgetPool(totalBudget);
  }

  addAgent(name: string, role: string, dailyBudget: number, capabilities: string[]): SwarmAgent {
    const agent = createSwarmAgent(name, role, dailyBudget, capabilities);
    this.agents.push(agent);
    this.pool.allocate(name, dailyBudget);

    // Subscribe to broadcast messages
    this.bus.subscribe(name, (msg) => {
      if (msg.type === "finding") {
        // Auto-add findings to knowledge base
        const payload = msg.payload as { key?: string; value?: unknown };
        if (payload.key) {
          this.kb.add(payload.key, payload.value, msg.from, 0.7);
        }
      }
    });

    return agent;
  }

  /** Dynamically spawn a new agent based on workload */
  spawnAgent(role: string, reason: string): SwarmAgent {
    const id = this.agents.length + 1;
    const name = `Dynamic-${role}-${id}`;
    console.log(`  [Coordinator] Spawning ${name} (reason: ${reason})`);
    return this.addAgent(name, role, 1.0, [role]);
  }

  addTask(task: Omit<SwarmTask, "status" | "retries">): void {
    this.tasks.push({ ...task, status: "pending", retries: 0 });
  }

  /** Get the agent best suited for a task */
  private findBestAgent(requiredCapability: string): SwarmAgent | null {
    // Find agents with the required capability
    const capable = this.agents.filter((a) =>
      a.capabilities.includes(requiredCapability) || a.capabilities.includes("*")
    );

    if (capable.length === 0) return null;

    // Pick the least busy one (by transaction count)
    return capable.sort((a, b) => {
      const aSpend = a.wallet.getSpendSummary();
      const bSpend = b.wallet.getSpendSummary();
      return aSpend.transactionCount - bSpend.transactionCount;
    })[0];
  }

  /** Execute all tasks respecting dependency order */
  async executePipeline(): Promise<void> {
    const ctx: TaskContext = { bus: this.bus, kb: this.kb, pool: this.pool };
    const completed = new Set<string>();

    while (true) {
      // Find tasks whose dependencies are all met
      const ready = this.tasks.filter(
        (t) =>
          t.status === "pending" &&
          t.dependsOn.every((dep) => completed.has(dep))
      );

      if (ready.length === 0) {
        // Check if we're stuck or done
        const pending = this.tasks.filter((t) => t.status === "pending");
        if (pending.length === 0) break;

        // Stuck — circular dependency or failed prerequisite
        const failed = this.tasks.filter((t) => t.status === "failed");
        if (failed.length > 0) {
          console.log(`\n  [Coordinator] ${failed.length} tasks failed — aborting pipeline`);
          break;
        }
        break;
      }

      // Execute all ready tasks in parallel
      console.log(`\n  [Coordinator] Executing ${ready.length} task(s) in parallel:`);
      ready.forEach((t) => {
        t.status = "running";
        console.log(`    - ${t.name} (assigned to: ${t.assignedTo})`);
      });

      const results = await Promise.allSettled(
        ready.map(async (task) => {
          const agent = this.agents.find((a) => a.name === task.assignedTo);
          if (!agent) {
            // Try to find any capable agent
            const fallback = this.findBestAgent(task.assignedTo);
            if (!fallback) throw new Error(`No agent available for task: ${task.name}`);
            task.assignedTo = fallback.name;
            return task.execute(fallback, ctx);
          }
          return task.execute(agent, ctx);
        })
      );

      // Process results
      for (let i = 0; i < ready.length; i++) {
        const task = ready[i];
        const result = results[i];

        if (result.status === "fulfilled") {
          task.status = "completed";
          task.result = result.value;
          completed.add(task.id);
          console.log(`    [done] ${task.name}`);
        } else {
          task.retries++;
          if (task.retries < task.maxRetries) {
            task.status = "pending"; // Retry
            console.log(`    [retry ${task.retries}/${task.maxRetries}] ${task.name}: ${result.reason}`);
          } else {
            task.status = "failed";
            task.error = String(result.reason);
            completed.add(task.id); // Mark as done (failed) so deps don't block
            console.log(`    [FAILED] ${task.name}: ${result.reason}`);
          }
        }
      }

      // Rebalance budgets after each wave
      this.pool.rebalance(
        this.agents.map((a) => ({
          name: a.name,
          spent: a.wallet.getSpendSummary().today,
          allocated: this.pool.getAllocation(a.name),
        }))
      );
    }
  }

  printReport() {
    console.log(`\n${"=".repeat(60)}`);
    console.log("SWARM EXECUTION REPORT");
    console.log(`${"=".repeat(60)}\n`);

    // Task summary
    const succeeded = this.tasks.filter((t) => t.status === "completed").length;
    const failed = this.tasks.filter((t) => t.status === "failed").length;
    console.log(`Tasks: ${succeeded} succeeded, ${failed} failed, ${this.tasks.length} total`);

    // Agent summary
    console.log("\nAgent Summary:");
    let totalSpend = 0;
    for (const agent of this.agents) {
      const spend = agent.wallet.getSpendSummary();
      const evo = agent.wallet.getEvolutionState();
      totalSpend += spend.today;

      console.log(`  ${agent.name} (${agent.role}):`);
      console.log(`    Budget: $${this.pool.getAllocation(agent.name).toFixed(2)}`);
      console.log(`    Spent: $${spend.today.toFixed(6)} USDC`);
      console.log(`    Transactions: ${spend.transactionCount}`);
      if (evo) {
        console.log(`    Evolution: gen ${evo.generation}, ${evo.mutationCount} mutations`);
      }
    }

    // Budget pool
    console.log(`\nBudget Pool:`);
    console.log(`  Total budget: $${this.pool.totalBudget}`);
    console.log(`  Total spent: $${totalSpend.toFixed(6)}`);
    console.log(`  Remaining: $${(this.pool.totalBudget - totalSpend).toFixed(6)}`);

    // Knowledge base
    const kbEntries = this.kb.dump();
    console.log(`\nKnowledge Base: ${Object.keys(kbEntries).length} entries`);
    for (const [key, entry] of Object.entries(kbEntries)) {
      const e = entry as { source: string; confidence: number };
      console.log(`  ${key} (from: ${e.source}, confidence: ${(e.confidence * 100).toFixed(0)}%)`);
    }

    // Message history
    const msgs = this.bus.getHistory();
    console.log(`\nMessages exchanged: ${msgs.length}`);
    const byType = msgs.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    for (const [type, count] of Object.entries(byType)) {
      console.log(`  ${type}: ${count}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Paid API helpers
// ═══════════════════════════════════════════════════════════════

async function callPaidAPI(
  wallet: ReturnType<typeof createAgentWallet>,
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

// ═══════════════════════════════════════════════════════════════
// Main — run the swarm
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log("Multi-Agent Swarm with Advanced Coordination");
  console.log("=============================================\n");

  // Create coordinator with $20 total budget
  const swarm = new SwarmCoordinator(20);

  // Create specialized agents
  const researcher = swarm.addAgent("Researcher", "researcher", 5.0, ["search", "weather"]);
  const analyst = swarm.addAgent("Analyst", "analyst", 10.0, ["sentiment", "stats", "entities"]);
  const scout = swarm.addAgent("Scout", "scout", 2.0, ["search", "discovery"]);

  console.log(`Agents: ${[researcher, analyst, scout].map((a) => `${a.name}($${swarm.pool.getAllocation(a.name)})`).join(", ")}`);
  console.log(`Total budget: $${swarm.pool.totalBudget}\n`);

  // ── Define task DAG ─────────────────────────────────────────
  //
  //  search_topic ─────┐
  //                     ├──▶ analyze_results ──▶ generate_report
  //  get_weather  ──────┘
  //  scout_endpoints ──────────────────────────▶ (independent)

  swarm.addTask({
    id: "search",
    name: "Search for AI agent commerce trends",
    assignedTo: "Researcher",
    dependsOn: [],
    maxRetries: 2,
    execute: async (agent, ctx) => {
      const result = await callPaidAPI(
        agent.wallet,
        `${SELLER_API}/api/search?q=${encodeURIComponent("AI agent commerce micropayments 2025")}`
      );
      ctx.kb.add("search:trends", result, agent.name, 0.9);
      ctx.bus.send({
        from: agent.name,
        to: "*",
        type: "finding",
        payload: { key: "search:trends", value: result },
        timestamp: Date.now(),
      });
      return result;
    },
  });

  swarm.addTask({
    id: "weather",
    name: "Get weather context for NYC",
    assignedTo: "Researcher",
    dependsOn: [],
    maxRetries: 2,
    execute: async (agent, ctx) => {
      const result = await callPaidAPI(
        agent.wallet,
        `${SELLER_API}/api/forecast?city=New+York`
      );
      ctx.kb.add("weather:nyc", result, agent.name, 0.85);
      return result;
    },
  });

  swarm.addTask({
    id: "scout",
    name: "Scout for new API endpoints",
    assignedTo: "Scout",
    dependsOn: [],
    maxRetries: 1,
    execute: async (agent, ctx) => {
      // Scout searches for additional endpoints
      const result = await callPaidAPI(
        agent.wallet,
        `${SELLER_API}/api/search?q=${encodeURIComponent("paid API endpoints for AI agents")}`
      );
      ctx.kb.add("scout:endpoints", result, agent.name, 0.6);
      ctx.bus.send({
        from: agent.name,
        to: "Analyst",
        type: "finding",
        payload: { key: "scout:endpoints", value: result },
        timestamp: Date.now(),
      });
      return result;
    },
  });

  swarm.addTask({
    id: "analyze",
    name: "Analyze search results (sentiment + entities)",
    assignedTo: "Analyst",
    dependsOn: ["search", "weather"], // Waits for research to complete
    maxRetries: 2,
    execute: async (agent, ctx) => {
      // Get data from knowledge base (written by researcher)
      const searchData = ctx.kb.get("search:trends");
      const text = JSON.stringify(searchData?.value || "no data").slice(0, 500);

      // Run sentiment analysis and entity extraction in parallel
      const [sentiment, entities, stats] = await Promise.all([
        callPaidAPI(agent.wallet, `${SELLER_API}/api/sentiment`, {
          method: "POST",
          body: { text },
        }),
        callPaidAPI(agent.wallet, `${SELLER_API}/api/entities`, {
          method: "POST",
          body: { text },
        }),
        callPaidAPI(agent.wallet, `${SELLER_API}/api/math/stats`, {
          method: "POST",
          body: { values: [42, 67, 33, 91, 55, 78, 12, 89, 44, 76] },
        }),
      ]);

      ctx.kb.add("analysis:sentiment", sentiment, agent.name, 0.95);
      ctx.kb.add("analysis:entities", entities, agent.name, 0.95);
      ctx.kb.add("analysis:stats", stats, agent.name, 0.9);

      ctx.bus.send({
        from: agent.name,
        to: "*",
        type: "finding",
        payload: { key: "analysis:complete", value: { sentiment, entities, stats } },
        timestamp: Date.now(),
      });

      return { sentiment, entities, stats };
    },
  });

  swarm.addTask({
    id: "report",
    name: "Generate final summary report",
    assignedTo: "Analyst",
    dependsOn: ["analyze"], // Waits for analysis
    maxRetries: 1,
    execute: async (agent, ctx) => {
      // Gather all knowledge
      const allKnowledge = ctx.kb.dump();
      const text = JSON.stringify(allKnowledge).slice(0, 300);

      const readability = await callPaidAPI(agent.wallet, `${SELLER_API}/api/readability`, {
        method: "POST",
        body: { text },
      });

      ctx.kb.add("report:summary", readability, agent.name, 1.0);

      ctx.bus.send({
        from: agent.name,
        to: "*",
        type: "status",
        payload: { status: "Report complete", entries: Object.keys(allKnowledge).length },
        timestamp: Date.now(),
      });

      return readability;
    },
  });

  // ── Execute the DAG ─────────────────────────────────────────

  console.log("Task DAG:");
  console.log("  search ──────┐");
  console.log("               ├── analyze ── report");
  console.log("  weather ─────┘");
  console.log("  scout (independent)");
  console.log();

  await swarm.executePipeline();

  // ── Print full report ───────────────────────────────────────

  swarm.printReport();
}

main().catch(console.error);
