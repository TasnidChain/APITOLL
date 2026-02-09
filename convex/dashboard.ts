import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAuth } from "./helpers";

// ═══════════════════════════════════════════════════
// Dashboard-specific queries
// Aggregations and stats for the frontend
// ═══════════════════════════════════════════════════

/**
 * Overview stats for the main dashboard page.
 */
export const getOverviewStats = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await ctx.db.get(args.orgId);
    if (!org) return null;

    // Get all agents for this org
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const agentIds = agents.map((a) => a._id);

    // Get transactions for agents in this org (via agent_id index)
    const transactions: Doc<"transactions">[] = [];
    for (const agentId of agentIds) {
      const agentTxs = await ctx.db
        .query("transactions")
        .withIndex("by_agent_id", (q) => q.eq("agentId", agentId))
        .collect();
      transactions.push(...agentTxs);
    }

    const settledTxs = transactions.filter((t) => t.status === "settled");
    const totalSpend = settledTxs.reduce((sum, t) => sum + t.amount, 0);

    // Today's spend
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    const todaySpend = settledTxs
      .filter((t) => t.requestedAt >= todayTimestamp)
      .reduce((sum, t) => sum + t.amount, 0);

    const activeAgents = agents.filter((a) => a.status === "active").length;

    const avgLatency =
      settledTxs.length > 0
        ? Math.round(
            settledTxs.reduce((sum, t) => sum + (t.latencyMs ?? 0), 0) /
              settledTxs.length
          )
        : 0;

    const successRate =
      transactions.length > 0
        ? (settledTxs.length / transactions.length) * 100
        : 0;

    // Platform fees earned
    const totalPlatformFees = settledTxs.reduce(
      (sum, t) => sum + (t.platformFee ?? 0),
      0
    );

    return {
      totalSpend,
      todaySpend,
      totalTransactions: transactions.length,
      activeAgents,
      totalAgents: agents.length,
      avgLatency,
      successRate,
      totalPlatformFees,
      plan: org.plan,
    };
  },
});

/**
 * Daily spending data for charts (last N days).
 */
export const getDailyStats = query({
  args: {
    orgId: v.id("organizations"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const numDays = args.days ?? 30;
    const now = Date.now();
    const startTime = now - numDays * 24 * 60 * 60 * 1000;

    // Get all agents for this org
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Collect all transactions
    const transactions: Doc<"transactions">[] = [];
    for (const agent of agents) {
      const agentTxs = await ctx.db
        .query("transactions")
        .withIndex("by_agent_id", (q) => q.eq("agentId", agent._id))
        .collect();
      transactions.push(...agentTxs);
    }

    // Filter to settled + within time range
    const settled = transactions.filter(
      (t) => t.status === "settled" && t.requestedAt >= startTime
    );

    // Group by day
    const dailyMap = new Map<string, { spend: number; transactions: number }>();

    for (let i = 0; i < numDays; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      dailyMap.set(date.toISOString().split("T")[0], {
        spend: 0,
        transactions: 0,
      });
    }

    for (const tx of settled) {
      const date = new Date(tx.requestedAt).toISOString().split("T")[0];
      const existing = dailyMap.get(date);
      if (existing) {
        existing.spend += tx.amount;
        existing.transactions += 1;
      }
    }

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        spend: parseFloat(data.spend.toFixed(6)),
        transactions: data.transactions,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});

/**
 * List recent transactions for the org.
 */
export const listTransactions = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
    chain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const agentMap = new Map(agents.map((a) => [a._id, a]));

    let transactions: Doc<"transactions">[] = [];
    for (const agent of agents) {
      const agentTxs = await ctx.db
        .query("transactions")
        .withIndex("by_agent_id", (q) => q.eq("agentId", agent._id))
        .collect();
      transactions.push(...agentTxs);
    }

    // Apply filters
    if (args.status && args.status !== "all") {
      transactions = transactions.filter((t) => t.status === args.status);
    }
    if (args.chain && args.chain !== "all") {
      transactions = transactions.filter((t) => t.chain === args.chain);
    }

    // Sort by time descending
    transactions.sort((a, b) => b.requestedAt - a.requestedAt);

    // Apply limit
    const limit = args.limit ?? 100;
    transactions = transactions.slice(0, limit);

    // Enrich with seller and agent names
    const enriched = await Promise.all(
      transactions.map(async (tx) => {
        const agent = tx.agentId ? agentMap.get(tx.agentId) : undefined;
        const seller = tx.sellerId ? await ctx.db.get(tx.sellerId) : null;

        return {
          _id: tx._id,
          txHash: tx.txHash,
          agentName: agent?.name ?? "Unknown",
          sellerName: (seller && "name" in seller) ? seller.name : "Unknown",
          endpointPath: tx.endpointPath,
          method: tx.method,
          amount: tx.amount,
          chain: tx.chain,
          status: tx.status,
          latencyMs: tx.latencyMs ?? 0,
          requestedAt: tx.requestedAt,
          platformFee: tx.platformFee,
          sellerAmount: tx.sellerAmount,
        };
      })
    );

    return enriched;
  },
});

/**
 * List all agents for an org with computed stats.
 */
export const listAgents = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const enriched = await Promise.all(
      agents.map(async (agent) => {
        // Count transactions
        const txs = await ctx.db
          .query("transactions")
          .withIndex("by_agent_id", (q) => q.eq("agentId", agent._id))
          .collect();

        // Today's spend
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();
        const todaySpend = txs
          .filter(
            (t) => t.status === "settled" && t.requestedAt >= todayTimestamp
          )
          .reduce((sum, t) => sum + t.amount, 0);

        // Get budget policy
        const policies = await ctx.db
          .query("policies")
          .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
          .collect();
        const budgetPolicy = policies.find(
          (p) => p.policyType === "budget" && p.isActive
        );
        const dailyLimit = (budgetPolicy?.rulesJson as { dailyLimit?: number } | undefined)?.dailyLimit ?? 50;

        return {
          _id: agent._id,
          name: agent.name,
          walletAddress: agent.walletAddress,
          chain: agent.chain,
          balance: agent.balance,
          status: agent.status,
          dailySpend: parseFloat(todaySpend.toFixed(6)),
          dailyLimit,
          totalTransactions: txs.length,
        };
      })
    );

    return enriched;
  },
});

/**
 * List all sellers for an org with stats.
 */
export const listSellers = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const sellers = await ctx.db
      .query("sellers")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();

    const enriched = await Promise.all(
      sellers.map(async (seller) => {
        // Get endpoints
        const endpoints = await ctx.db
          .query("endpoints")
          .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
          .collect();

        // Get transaction stats
        const txs = await ctx.db
          .query("transactions")
          .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
          .collect();
        const settled = txs.filter((t) => t.status === "settled");
        const totalRevenue = settled.reduce((sum, t) => sum + t.amount, 0);
        const totalPlatformFees = settled.reduce(
          (sum, t) => sum + (t.platformFee ?? 0),
          0
        );

        return {
          _id: seller._id,
          name: seller.name,
          walletAddress: seller.walletAddress,
          totalRevenue,
          totalPlatformFees,
          totalCalls: txs.length,
          endpoints: endpoints.length,
        };
      })
    );

    return enriched;
  },
});
