import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";

// Reputation Tiers

const TIERS = [
  { name: "Elite" as const, minScore: 600, discount: 25, priority: true, escrow: true },
  { name: "Trusted" as const, minScore: 300, discount: 10, priority: true, escrow: false },
  { name: "Active" as const, minScore: 100, discount: 0, priority: false, escrow: false },
  { name: "New" as const, minScore: 0, discount: 0, priority: false, escrow: false },
];

function getTier(score: number) {
  return TIERS.find((t) => score >= t.minScore) ?? TIERS[TIERS.length - 1];
}

function getNextTier(score: number) {
  const current = getTier(score);
  const idx = TIERS.indexOf(current);
  return idx > 0 ? TIERS[idx - 1] : null;
}

// Calculate Reputation Score for an Agent

export const getScore = query({
  args: {
    agentId: v.optional(v.string()),
    walletAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.agentId && !args.walletAddress) {
      return null;
    }

    const identifier = args.agentId || args.walletAddress || "unknown";

    // Query gossip events for this agent
    let events;
    if (args.agentId) {
      events = await ctx.db
        .query("gossipEvents")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId!))
        .collect();
    } else {
      // Wallet-based: search through recent events
      const allRecent = await ctx.db
        .query("gossipEvents")
        .withIndex("by_created")
        .order("desc")
        .take(1000);
      events = allRecent.filter(
        (e) => e.agentId.toLowerCase().includes((args.walletAddress ?? "").toLowerCase())
      );
    }

    const txCount = events.length;
    const totalVolume = events.reduce((sum, e) => sum + e.amount, 0);
    const endpoints = new Set(events.map((e) => e.endpoint));
    const uniqueEndpoints = endpoints.size;
    const mutations = events.filter((e) => e.mutationTriggered).length;
    const chains = new Set(events.map((e) => e.chain));

    // Score calculation (0-1000 range)
    // Volume factor (40%): $1 = 10 points, max 400
    const volumeScore = Math.min(totalVolume * 10 * 0.4, 400);
    // Transaction count (25%): 1 tx = 5 points, max 250
    const txScore = Math.min(txCount * 5 * 0.25, 250);
    // Endpoint diversity (20%): 1 endpoint = 20 points, max 200
    const diversityScore = Math.min(uniqueEndpoints * 20 * 0.2, 200);
    // Mutation activity (10%): 1 mutation = 10 points, max 100
    const mutationScore = Math.min(mutations * 10 * 0.1, 100);
    // Base (5%): 50 if any activity
    const baseScore = txCount > 0 ? 50 : 0;

    const score = Math.round(volumeScore + txScore + diversityScore + mutationScore + baseScore);
    const finalScore = Math.max(score, txCount > 0 ? 100 : 0); // Active tier minimum

    const tier = getTier(finalScore);
    const nextTierInfo = getNextTier(finalScore);

    // Get evolution state if available
    let evolutionData = null;
    if (args.agentId) {
      const evo = await ctx.db
        .query("agentEvolution")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId!))
        .first();
      if (evo) {
        evolutionData = {
          generation: evo.generation,
          fitness: evo.fitness,
          mutationDepth: evo.mutationDepth,
          totalMutations: evo.mutations.length,
        };
      }
    }

    return {
      identifier,
      score: finalScore,
      tier: tier.name,
      benefits: {
        feeDiscountPct: tier.discount,
        priorityRouting: tier.priority,
        escrowAccess: tier.escrow,
        mutationEligible: finalScore >= 30,
      },
      activity: {
        totalTransactions: txCount,
        totalVolumeUsdc: Math.round(totalVolume * 10000) / 10000,
        uniqueEndpoints,
        mutations,
        chains: Array.from(chains),
      },
      evolution: evolutionData,
      nextTier: nextTierInfo
        ? {
            name: nextTierInfo.name,
            minScore: nextTierInfo.minScore,
            pointsNeeded: nextTierInfo.minScore - finalScore,
          }
        : null,
    };
  },
});

// Batch Reputation (for leaderboard enrichment)

export const getBatchScores = internalQuery({
  args: {
    agentIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const results: Record<string, { score: number; tier: string }> = {};

    for (const agentId of args.agentIds.slice(0, 50)) {
      const events = await ctx.db
        .query("gossipEvents")
        .withIndex("by_agent", (q) => q.eq("agentId", agentId))
        .collect();

      const txCount = events.length;
      const totalVolume = events.reduce((sum, e) => sum + e.amount, 0);
      const endpoints = new Set(events.map((e) => e.endpoint));
      const mutations = events.filter((e) => e.mutationTriggered).length;

      const volumeScore = Math.min(totalVolume * 10 * 0.4, 400);
      const txScore = Math.min(txCount * 5 * 0.25, 250);
      const diversityScore = Math.min(endpoints.size * 20 * 0.2, 200);
      const mutationScore = Math.min(mutations * 10 * 0.1, 100);
      const baseScore = txCount > 0 ? 50 : 0;

      const score = Math.max(
        Math.round(volumeScore + txScore + diversityScore + mutationScore + baseScore),
        txCount > 0 ? 100 : 0
      );

      results[agentId] = { score, tier: getTier(score).name };
    }

    return results;
  },
});

// Combined Leaderboard (gossip + evolution + reputation)

export const getCombinedLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    // Get all gossip events
    const allEvents = await ctx.db.query("gossipEvents").collect();

    // Aggregate per agent
    const agentMap = new Map<
      string,
      {
        txCount: number;
        totalSpent: number;
        mutations: number;
        endpoints: Set<string>;
        chains: Set<string>;
        lastActive: number;
      }
    >();

    for (const e of allEvents) {
      const entry = agentMap.get(e.agentId) ?? {
        txCount: 0,
        totalSpent: 0,
        mutations: 0,
        endpoints: new Set<string>(),
        chains: new Set<string>(),
        lastActive: 0,
      };
      entry.txCount++;
      entry.totalSpent += e.amount;
      if (e.mutationTriggered) entry.mutations++;
      entry.endpoints.add(e.endpoint);
      entry.chains.add(e.chain);
      entry.lastActive = Math.max(entry.lastActive, e.createdAt);
      agentMap.set(e.agentId, entry);
    }

    // Enrich with evolution data
    const leaderboard = await Promise.all(
      Array.from(agentMap.entries()).map(async ([agentId, data]) => {
        // Reputation score
        const volumeScore = Math.min(data.totalSpent * 10 * 0.4, 400);
        const txScore = Math.min(data.txCount * 5 * 0.25, 250);
        const diversityScore = Math.min(data.endpoints.size * 20 * 0.2, 200);
        const mutationScore = Math.min(data.mutations * 10 * 0.1, 100);
        const baseScore = data.txCount > 0 ? 50 : 0;
        const reputationScore = Math.max(
          Math.round(volumeScore + txScore + diversityScore + mutationScore + baseScore),
          data.txCount > 0 ? 100 : 0
        );

        // Evolution data
        const evo = await ctx.db
          .query("agentEvolution")
          .withIndex("by_agent", (q) => q.eq("agentId", agentId))
          .first();

        // Combined score: reputation + evolution bonus
        const evoBonus = evo
          ? evo.fitness * 10 + evo.mutationDepth * 5 + evo.generation * 2
          : 0;
        const combinedScore = reputationScore + Math.min(evoBonus, 200);

        return {
          agentId,
          combinedScore,
          reputation: {
            score: reputationScore,
            tier: getTier(reputationScore).name,
          },
          activity: {
            transactions: data.txCount,
            totalSpent: Math.round(data.totalSpent * 10000) / 10000,
            mutations: data.mutations,
            uniqueEndpoints: data.endpoints.size,
            chains: Array.from(data.chains),
          },
          evolution: evo
            ? {
                generation: evo.generation,
                fitness: evo.fitness,
                mutationDepth: evo.mutationDepth,
              }
            : null,
          lastActive: data.lastActive,
        };
      })
    );

    return leaderboard
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit);
  },
});
