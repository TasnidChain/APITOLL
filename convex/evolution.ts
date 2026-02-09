import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// Save/update evolution state for an agent
// SECURITY: internalMutation — only callable from Convex httpActions, not from browser/external clients
export const saveState = internalMutation({
  args: {
    agentId: v.string(),
    state: v.optional(v.any()),
    mutations: v.optional(v.array(v.object({
      type: v.string(),
      from: v.optional(v.string()),
      to: v.optional(v.string()),
      successRate: v.optional(v.number()),
      timestamp: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("agentEvolution")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();

    const newMutations = args.mutations ?? [];

    if (existing) {
      const mergedMutations = [...existing.mutations, ...newMutations];
      const mergedState = args.state ?? existing.state;
      const depth = mergedState?.mutationDepth ?? mergedMutations.length;

      await ctx.db.patch(existing._id, {
        state: mergedState,
        mutations: mergedMutations,
        mutationDepth: depth,
        generation: (mergedState?.generation ?? existing.generation) || 1,
        fitness: (mergedState?.fitness ?? existing.fitness) || 0,
        lastMutationAt: newMutations.length > 0 ? now : existing.lastMutationAt,
        updatedAt: now,
      });

      return { updated: true, mutationDepth: depth, totalMutations: mergedMutations.length };
    } else {
      const state = args.state ?? { mutationDepth: 0, generation: 1, fitness: 0, traits: [] };
      const depth = state.mutationDepth ?? newMutations.length;

      await ctx.db.insert("agentEvolution", {
        agentId: args.agentId,
        state,
        mutations: newMutations,
        mutationDepth: depth,
        generation: state.generation ?? 1,
        fitness: state.fitness ?? 0,
        lastMutationAt: newMutations.length > 0 ? now : undefined,
        updatedAt: now,
      });

      return { updated: false, mutationDepth: depth, totalMutations: newMutations.length };
    }
  },
});

// Get evolution state for an agent
export const getState = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentEvolution")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();
  },
});

// Get evolution leaderboard
export const getLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const all = await ctx.db
      .query("agentEvolution")
      .withIndex("by_fitness")
      .order("desc")
      .take(limit * 2); // fetch extra for scoring

    return all
      .map((e) => ({
        agent_id: e.agentId,
        mutation_count: e.mutations.length,
        mutation_depth: e.mutationDepth,
        generation: e.generation,
        fitness: e.fitness,
        last_active: e.updatedAt,
      }))
      .sort((a, b) => b.mutation_count - a.mutation_count)
      .slice(0, limit);
  },
});
