import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { requireAdmin } from "./helpers";

// ═══════════════════════════════════════════════════
// Record Platform Revenue (from transaction fees)
// ═══════════════════════════════════════════════════

export const record = internalMutation({
  args: {
    transactionId: v.id("transactions"),
    amount: v.number(),
    currency: v.optional(v.string()),
    chain: v.union(v.literal("base"), v.literal("solana")),
    feeBps: v.number(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("platformRevenue", {
      transactionId: args.transactionId,
      amount: args.amount,
      currency: args.currency ?? "USDC",
      chain: args.chain,
      feeBps: args.feeBps,
      collectedAt: Date.now(),
    });
    return id;
  },
});

// ═══════════════════════════════════════════════════
// Get Revenue Overview
// ═══════════════════════════════════════════════════

export const getOverview = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const allRevenue = await ctx.db.query("platformRevenue").collect();

    const totalRevenue = allRevenue.reduce((sum, r) => sum + r.amount, 0);

    // Today's revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const todayRevenue = allRevenue
      .filter((r) => r.collectedAt >= todayTimestamp)
      .reduce((sum, r) => sum + r.amount, 0);

    // Last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const monthRevenue = allRevenue
      .filter((r) => r.collectedAt >= thirtyDaysAgo)
      .reduce((sum, r) => sum + r.amount, 0);

    // By chain
    const byChain = { base: 0, solana: 0 };
    for (const r of allRevenue) {
      byChain[r.chain] += r.amount;
    }

    return {
      totalRevenue,
      todayRevenue,
      monthRevenue,
      totalEntries: allRevenue.length,
      byChain,
    };
  },
});

// ═══════════════════════════════════════════════════
// Daily Revenue Stats (for charts)
// ═══════════════════════════════════════════════════

export const getDailyRevenue = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const numDays = args.days ?? 30;
    const now = Date.now();
    const startTime = now - numDays * 24 * 60 * 60 * 1000;

    const revenue = await ctx.db
      .query("platformRevenue")
      .withIndex("by_collected", (q) => q.gte("collectedAt", startTime))
      .collect();

    // Group by day
    const dailyMap = new Map<string, number>();

    for (let i = 0; i < numDays; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      dailyMap.set(date.toISOString().split("T")[0], 0);
    }

    for (const r of revenue) {
      const date = new Date(r.collectedAt).toISOString().split("T")[0];
      const existing = dailyMap.get(date) ?? 0;
      dailyMap.set(date, existing + r.amount);
    }

    return Array.from(dailyMap.entries())
      .map(([date, amount]) => ({ date, revenue: amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});

// INTERNAL version — called from httpActions in http.ts (which authenticate via org API key)
export const internalGetOverview = internalQuery({
  handler: async (ctx) => {
    const allRevenue = await ctx.db.query("platformRevenue").collect();
    const totalRevenue = allRevenue.reduce((sum, r) => sum + r.amount, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayRevenue = allRevenue.filter((r) => r.collectedAt >= today.getTime()).reduce((sum, r) => sum + r.amount, 0);
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const monthRevenue = allRevenue.filter((r) => r.collectedAt >= thirtyDaysAgo).reduce((sum, r) => sum + r.amount, 0);
    const byChain = { base: 0, solana: 0 };
    for (const r of allRevenue) { byChain[r.chain] += r.amount; }
    return { totalRevenue, todayRevenue, monthRevenue, totalEntries: allRevenue.length, byChain };
  },
});
