import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import { requireAuth } from "./helpers";

// Overview Stats (for Dashboard)

export const getOverview = query({
  args: {
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, _args) => {
    await requireAuth(ctx);
    // Get all transactions (in production, filter by org)
    const transactions = await ctx.db.query("transactions").collect();

    const settledTxs = transactions.filter((t) => t.status === "settled");
    const totalSpend = settledTxs.reduce((sum, t) => sum + t.amount, 0);

    // Today's spend
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const todaySpend = settledTxs
      .filter((t) => t.requestedAt >= todayTimestamp)
      .reduce((sum, t) => sum + t.amount, 0);

    // Avg latency
    const latencies = settledTxs
      .filter((t) => t.latencyMs !== undefined)
      .map((t) => t.latencyMs!);
    const avgLatency =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0;

    // Success rate
    const successRate =
      transactions.length > 0
        ? (settledTxs.length / transactions.length) * 100
        : 100;

    // Agent counts
    const agents = await ctx.db.query("agents").collect();
    const activeAgents = agents.filter((a) => a.status === "active").length;

    return {
      totalSpend,
      todaySpend,
      totalTransactions: transactions.length,
      avgLatency,
      successRate,
      totalAgents: agents.length,
      activeAgents,
    };
  },
});

// Daily Stats (for Charts)

export const getDailyStats = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const numDays = args.days ?? 30;
    const now = Date.now();
    const startTime = now - numDays * 24 * 60 * 60 * 1000;

    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.gte(q.field("requestedAt"), startTime))
      .collect();

    // Group by day
    const dailyMap = new Map<string, { spend: number; transactions: number }>();

    for (let i = 0; i < numDays; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      dailyMap.set(dateStr, { spend: 0, transactions: 0 });
    }

    for (const tx of transactions) {
      const date = new Date(tx.requestedAt).toISOString().split("T")[0];
      const existing = dailyMap.get(date);
      if (existing) {
        existing.transactions++;
        if (tx.status === "settled") {
          existing.spend += tx.amount;
        }
      }
    }

    // Convert to array sorted by date
    return Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        spend: stats.spend,
        transactions: stats.transactions,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});

// Spend by Chain

export const getSpendByChain = query({
  handler: async (ctx) => {
    await requireAuth(ctx);
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("status"), "settled"))
      .collect();

    const byChain: Record<string, number> = {
      base: 0,
      solana: 0,
    };

    for (const tx of transactions) {
      byChain[tx.chain] += tx.amount;
    }

    return byChain;
  },
});

// Top Endpoints

export const getTopEndpoints = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("status"), "settled"))
      .collect();

    // Group by endpoint path
    const endpointMap = new Map<
      string,
      { path: string; calls: number; revenue: number }
    >();

    for (const tx of transactions) {
      const existing = endpointMap.get(tx.endpointPath);
      if (existing) {
        existing.calls++;
        existing.revenue += tx.amount;
      } else {
        endpointMap.set(tx.endpointPath, {
          path: tx.endpointPath,
          calls: 1,
          revenue: tx.amount,
        });
      }
    }

    return Array.from(endpointMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, args.limit ?? 10);
  },
});

// INTERNAL versions — called from httpActions in http.ts
// (httpActions authenticate via org API key, not Clerk)

export const internalGetOverview = internalQuery({
  args: { orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, _args) => {
    const transactions = await ctx.db.query("transactions").collect();
    const settledTxs = transactions.filter((t) => t.status === "settled");
    const totalSpend = settledTxs.reduce((sum, t) => sum + t.amount, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    const todaySpend = settledTxs
      .filter((t) => t.requestedAt >= todayTimestamp)
      .reduce((sum, t) => sum + t.amount, 0);
    const latencies = settledTxs.filter((t) => t.latencyMs !== undefined).map((t) => t.latencyMs!);
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const successRate = transactions.length > 0 ? (settledTxs.length / transactions.length) * 100 : 100;
    const agents = await ctx.db.query("agents").collect();
    const activeAgents = agents.filter((a) => a.status === "active").length;
    return { totalSpend, todaySpend, totalTransactions: transactions.length, avgLatency, successRate, totalAgents: agents.length, activeAgents };
  },
});

export const internalGetDailyStats = internalQuery({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const numDays = args.days ?? 30;
    const now = Date.now();
    const startTime = now - numDays * 24 * 60 * 60 * 1000;
    const transactions = await ctx.db.query("transactions").filter((q) => q.gte(q.field("requestedAt"), startTime)).collect();
    const dailyMap = new Map<string, { spend: number; transactions: number }>();
    for (let i = 0; i < numDays; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      dailyMap.set(date.toISOString().split("T")[0], { spend: 0, transactions: 0 });
    }
    for (const tx of transactions) {
      const date = new Date(tx.requestedAt).toISOString().split("T")[0];
      const existing = dailyMap.get(date);
      if (existing) { existing.transactions++; if (tx.status === "settled") existing.spend += tx.amount; }
    }
    return Array.from(dailyMap.entries()).map(([date, stats]) => ({ date, spend: stats.spend, transactions: stats.transactions })).sort((a, b) => a.date.localeCompare(b.date));
  },
});

export const internalGetSpendByChain = internalQuery({
  handler: async (ctx) => {
    const transactions = await ctx.db.query("transactions").filter((q) => q.eq(q.field("status"), "settled")).collect();
    const byChain: Record<string, number> = { base: 0, solana: 0 };
    for (const tx of transactions) { byChain[tx.chain] += tx.amount; }
    return byChain;
  },
});

export const internalGetTopEndpoints = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const transactions = await ctx.db.query("transactions").filter((q) => q.eq(q.field("status"), "settled")).collect();
    const endpointMap = new Map<string, { path: string; calls: number; revenue: number }>();
    for (const tx of transactions) {
      const existing = endpointMap.get(tx.endpointPath);
      if (existing) { existing.calls++; existing.revenue += tx.amount; } else { endpointMap.set(tx.endpointPath, { path: tx.endpointPath, calls: 1, revenue: tx.amount }); }
    }
    return Array.from(endpointMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, args.limit ?? 10);
  },
});
