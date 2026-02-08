import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ═══════════════════════════════════════════════════
// Record Gossip Event (called by /api/gossip endpoint)
// ═══════════════════════════════════════════════════

export const recordGossip = mutation({
  args: {
    agentId: v.string(),
    endpoint: v.string(),
    host: v.string(),
    chain: v.union(v.literal("base"), v.literal("solana")),
    amount: v.number(),
    latencyMs: v.number(),
    mutationTriggered: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Record the raw event
    await ctx.db.insert("gossipEvents", {
      agentId: args.agentId,
      endpoint: args.endpoint,
      chain: args.chain,
      amount: args.amount,
      latencyMs: args.latencyMs,
      mutationTriggered: args.mutationTriggered,
      createdAt: now,
    });

    // Upsert the aggregated gossip entry
    const key = `${args.host}${new URL(args.endpoint).pathname}`;
    const existing = await ctx.db
      .query("gossip")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", key))
      .first();

    if (existing) {
      const newDiscoveries = existing.discoveries + 1;
      const newVolume = existing.totalVolume + args.amount;
      const newLatencyAvg =
        (existing.avgLatencyMs * existing.discoveries + args.latencyMs) /
        newDiscoveries;

      // Check if this is a new unique agent
      const agentEvents = await ctx.db
        .query("gossipEvents")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
        .filter((q) => q.eq(q.field("endpoint"), args.endpoint))
        .first();
      const isNewAgent = !agentEvents || agentEvents.createdAt === now;

      const newUniqueAgents = isNewAgent
        ? existing.uniqueAgents + 1
        : existing.uniqueAgents;

      const newChains = existing.chains.includes(args.chain)
        ? existing.chains
        : [...existing.chains, args.chain];

      const newMutations = args.mutationTriggered
        ? existing.mutations + 1
        : existing.mutations;

      // Calculate trending score
      const ageHours = Math.max((now - existing.firstSeen) / 3600000, 0.1);
      const velocity = (newDiscoveries / ageHours) * 200;
      const recency = Math.pow(0.5, ageHours / 24);
      const score = Math.round(
        (newDiscoveries * 10 +
          newUniqueAgents * 50 +
          newMutations * 100 +
          velocity) *
          recency
      );

      await ctx.db.patch(existing._id, {
        discoveries: newDiscoveries,
        uniqueAgents: newUniqueAgents,
        totalVolume: newVolume,
        avgLatencyMs: Math.round(newLatencyAvg),
        chains: newChains,
        mutations: newMutations,
        trendingScore: score,
        lastSeen: now,
      });

      return { trending_score: score, is_new_agent: isNewAgent };
    } else {
      // First time seeing this endpoint
      const score = 260; // base: 10 + 50 (agent) + 200 (velocity)
      await ctx.db.insert("gossip", {
        endpoint: key,
        host: args.host,
        discoveries: 1,
        uniqueAgents: 1,
        totalVolume: args.amount,
        avgLatencyMs: args.latencyMs,
        chains: [args.chain],
        mutations: args.mutationTriggered ? 1 : 0,
        trendingScore: score,
        firstSeen: now,
        lastSeen: now,
      });

      return { trending_score: score, is_new_agent: true };
    }
  },
});

// ═══════════════════════════════════════════════════
// Get Trending APIs
// ═══════════════════════════════════════════════════

export const getTrending = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    // Get top trending, sorted by score descending
    const trending = await ctx.db
      .query("gossip")
      .withIndex("by_trending")
      .order("desc")
      .take(limit);

    return trending;
  },
});

// ═══════════════════════════════════════════════════
// Get Network Stats (for dashboard)
// ═══════════════════════════════════════════════════

export const getNetworkStats = query({
  args: {},
  handler: async (ctx) => {
    const allGossip = await ctx.db.query("gossip").collect();

    const oneHourAgo = Date.now() - 3600000;
    const oneDayAgo = Date.now() - 86400000;

    const activeLastHour = allGossip.filter(
      (g) => g.lastSeen > oneHourAgo
    ).length;
    const activeLastDay = allGossip.filter(
      (g) => g.lastSeen > oneDayAgo
    ).length;

    const totalDiscoveries = allGossip.reduce(
      (sum, g) => sum + g.discoveries,
      0
    );
    const totalVolume = allGossip.reduce((sum, g) => sum + g.totalVolume, 0);
    const totalUniqueAgents = allGossip.reduce(
      (sum, g) => sum + g.uniqueAgents,
      0
    );
    const totalMutations = allGossip.reduce((sum, g) => sum + g.mutations, 0);

    return {
      total_tools_tracked: allGossip.length,
      active_tools_1h: activeLastHour,
      active_tools_24h: activeLastDay,
      total_discoveries: totalDiscoveries,
      total_volume_usdc: Math.round(totalVolume * 10000) / 10000,
      total_unique_agents: totalUniqueAgents,
      total_mutations: totalMutations,
    };
  },
});

// ═══════════════════════════════════════════════════
// Get Recent Gossip Events (live feed)
// ═══════════════════════════════════════════════════

export const getRecentEvents = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gossipEvents")
      .withIndex("by_created")
      .order("desc")
      .take(args.limit ?? 50);
  },
});
