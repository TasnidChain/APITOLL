import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// ═══════════════════════════════════════════════════
// Record Gossip Event (called by /api/gossip endpoint)
// ═══════════════════════════════════════════════════

export const recordGossip = internalMutation({
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
      // SECURITY FIX: Use minimum 1 hour age to prevent velocity gaming
      // (previously min was 0.1h, giving 10x velocity boost to new endpoints)
      const ageHours = Math.max((now - existing.firstSeen) / 3600000, 1);
      const velocity = Math.min((newDiscoveries / ageHours) * 50, 500); // cap velocity at 500
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
      // First time seeing this endpoint — start with a LOW score
      // SECURITY FIX: Previously started at 260, which exceeded the auto-indexing
      // threshold of 200, allowing a single unauthenticated POST to auto-register
      // a malicious tool. Now starts at 10 (base score for 1 discovery).
      // An endpoint must accumulate real usage from multiple agents to trend.
      const score = 10; // base: 1 discovery * 10 points
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

// ═══════════════════════════════════════════════════
// Check Milestones & Fire Webhooks
// ═══════════════════════════════════════════════════

export const checkMilestones = internalMutation({
  args: {
    endpoint: v.string(),
    host: v.string(),
    discoveries: v.number(),
    trendingScore: v.number(),
    uniqueAgents: v.number(),
  },
  handler: async (ctx, args) => {
    // Define milestones
    const milestones = [
      { type: "discovery_10", threshold: 10, field: "discoveries" },
      { type: "discovery_50", threshold: 50, field: "discoveries" },
      { type: "discovery_100", threshold: 100, field: "discoveries" },
      { type: "discovery_500", threshold: 500, field: "discoveries" },
      { type: "discovery_1000", threshold: 1000, field: "discoveries" },
      { type: "trending_top", threshold: 500, field: "trendingScore" },
      { type: "agents_10", threshold: 10, field: "uniqueAgents" },
      { type: "agents_50", threshold: 50, field: "uniqueAgents" },
      { type: "agents_100", threshold: 100, field: "uniqueAgents" },
    ];

    const triggered: string[] = [];

    for (const m of milestones) {
      const value = args[m.field as keyof typeof args] as number;
      // Check if this milestone was JUST crossed (value >= threshold AND value - 1 < threshold won't work for all cases,
      // so instead check if value equals threshold or is within a small range above it)
      // Simple: just check if value >= threshold. To avoid re-firing, we'll track fired milestones.
      if (value >= m.threshold) {
        // Check if we already fired this milestone for this endpoint
        // We don't have a milestones table, so for now just fire on exact threshold hits
        // Use a simple heuristic: fire when value is between threshold and threshold + 5
        if (value <= m.threshold + 5) {
          triggered.push(m.type);
        }
      }
    }

    if (triggered.length === 0) return { triggered: [] };

    // Find webhooks subscribed to gossip events
    // Look for webhooks with event "tool.trending" or events containing any gossip-related event
    const allWebhooks = await ctx.db.query("webhooks").collect();
    const relevantWebhooks = allWebhooks.filter(
      (wh) => wh.isActive && (
        wh.events.includes("tool.trending") ||
        wh.events.includes("tool.registered") ||
        wh.events.includes("tool.updated")
      )
    );

    // Create webhook deliveries for each relevant webhook
    for (const wh of relevantWebhooks) {
      for (const milestone of triggered) {
        await ctx.db.insert("webhookDeliveries", {
          webhookId: wh._id,
          event: `gossip.milestone.${milestone}`,
          payload: JSON.stringify({
            type: milestone,
            endpoint: args.endpoint,
            host: args.host,
            discoveries: args.discoveries,
            trending_score: args.trendingScore,
            unique_agents: args.uniqueAgents,
            timestamp: Date.now(),
          }),
          status: "pending",
          httpStatus: undefined,
          attempts: 0,
          lastAttemptAt: Date.now(),
          responseBody: undefined,
        });
      }
    }

    return { triggered };
  },
});

// ═══════════════════════════════════════════════════
// Get Agent Profile from Gossip History
// ═══════════════════════════════════════════════════

export const getAgentProfile = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("gossipEvents")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    if (events.length === 0) {
      return null;
    }

    const totalSpent = events.reduce((sum, e) => sum + e.amount, 0);
    const avgSpend = totalSpent / events.length;
    const endpoints = new Set(events.map((e) => e.endpoint));
    const chains = new Set(events.map((e) => e.chain));
    const mutations = events.filter((e) => e.mutationTriggered).length;

    // Find most active time window
    const sortedByTime = [...events].sort((a, b) => b.createdAt - a.createdAt);
    const lastActive = sortedByTime[0]?.createdAt ?? 0;
    const firstActive = sortedByTime[sortedByTime.length - 1]?.createdAt ?? 0;

    return {
      agentId: args.agentId,
      totalTransactions: events.length,
      totalSpent: Math.round(totalSpent * 10000) / 10000,
      avgSpendPerTx: Math.round(avgSpend * 10000) / 10000,
      uniqueEndpoints: endpoints.size,
      frequentEndpoints: Array.from(
        events.reduce((map, e) => {
          map.set(e.endpoint, (map.get(e.endpoint) ?? 0) + 1);
          return map;
        }, new Map<string, number>())
      )
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([endpoint, count]) => ({ endpoint, count })),
      chains: Array.from(chains),
      preferredChain: events.reduce((acc, e) => {
        acc[e.chain] = (acc[e.chain] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      mutations,
      mutationRate: events.length > 0 ? Math.round((mutations / events.length) * 100) / 100 : 0,
      firstActive,
      lastActive,
      activeDays: Math.max(1, Math.round((lastActive - firstActive) / 86400000)),
    };
  },
});

// ═══════════════════════════════════════════════════
// Agent Evolution Leaderboard
// ═══════════════════════════════════════════════════

export const getLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const allEvents = await ctx.db.query("gossipEvents").collect();

    // Aggregate per agent
    const agentMap = new Map<string, { txCount: number; totalSpent: number; mutations: number; endpoints: Set<string>; lastActive: number }>();

    for (const e of allEvents) {
      const entry = agentMap.get(e.agentId) ?? {
        txCount: 0,
        totalSpent: 0,
        mutations: 0,
        endpoints: new Set<string>(),
        lastActive: 0,
      };
      entry.txCount++;
      entry.totalSpent += e.amount;
      if (e.mutationTriggered) entry.mutations++;
      entry.endpoints.add(e.endpoint);
      entry.lastActive = Math.max(entry.lastActive, e.createdAt);
      agentMap.set(e.agentId, entry);
    }

    // Score and rank
    const leaderboard = Array.from(agentMap.entries())
      .map(([agentId, data]) => ({
        agentId,
        score: data.txCount * 10 + data.mutations * 50 + data.endpoints.size * 20 + data.totalSpent * 5,
        transactions: data.txCount,
        mutations: data.mutations,
        unique_endpoints: data.endpoints.size,
        total_spent: Math.round(data.totalSpent * 10000) / 10000,
        last_active: data.lastActive,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return leaderboard;
  },
});
