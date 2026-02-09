import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// ═══════════════════════════════════════════════════
// SECURITY: Transaction mutations are internalMutation (defense-in-depth).
// They are only callable from other Convex functions (httpActions in http.ts),
// NOT from the browser or external ConvexHttpClient.
// The HTTP routes in http.ts validate API keys before calling these.
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// Create Transaction (from seller SDK webhook)
// ═══════════════════════════════════════════════════

export const create = internalMutation({
  args: {
    txHash: v.optional(v.string()),
    agentAddress: v.string(),
    agentId: v.optional(v.id("agents")),
    sellerId: v.optional(v.id("sellers")),
    endpointId: v.optional(v.id("endpoints")),
    endpointPath: v.string(),
    method: v.string(),
    amount: v.number(),
    currency: v.optional(v.string()),
    chain: v.union(v.literal("base"), v.literal("solana")),
    status: v.union(
      v.literal("pending"),
      v.literal("settled"),
      v.literal("failed"),
      v.literal("refunded")
    ),
    responseStatus: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    requestedAt: v.number(),
    settledAt: v.optional(v.number()),
    blockNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("transactions", {
      ...args,
      currency: args.currency ?? "USDC",
    });
    return id;
  },
});

// ═══════════════════════════════════════════════════
// Batch Create (for webhook efficiency)
// ═══════════════════════════════════════════════════

export const createBatch = internalMutation({
  args: {
    transactions: v.array(
      v.object({
        txHash: v.optional(v.string()),
        agentAddress: v.string(),
        endpointPath: v.string(),
        method: v.string(),
        amount: v.number(),
        chain: v.union(v.literal("base"), v.literal("solana")),
        status: v.union(
          v.literal("pending"),
          v.literal("settled"),
          v.literal("failed"),
          v.literal("refunded")
        ),
        latencyMs: v.optional(v.number()),
        requestedAt: v.number(),
      })
    ),
    sellerId: v.optional(v.id("sellers")),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const tx of args.transactions) {
      const id = await ctx.db.insert("transactions", {
        ...tx,
        sellerId: args.sellerId,
        currency: "USDC",
      });
      ids.push(id);
    }
    return { created: ids.length };
  },
});

// ═══════════════════════════════════════════════════
// Update Status
// ═══════════════════════════════════════════════════

export const updateStatus = internalMutation({
  args: {
    id: v.id("transactions"),
    status: v.union(
      v.literal("settled"),
      v.literal("failed"),
      v.literal("refunded")
    ),
    txHash: v.optional(v.string()),
    settledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      txHash: args.txHash,
      settledAt: args.settledAt ?? Date.now(),
    });
  },
});

// ═══════════════════════════════════════════════════
// List Transactions
// ═══════════════════════════════════════════════════

export const list = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
    chain: v.optional(v.string()),
    agentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("transactions").order("desc");

    if (args.status) {
      q = ctx.db
        .query("transactions")
        .withIndex("by_status", (q) => q.eq("status", args.status as "pending" | "settled" | "failed" | "refunded"))
        .order("desc");
    }

    const transactions = await q.take(args.limit ?? 100);

    // Filter in memory for additional conditions
    let filtered = transactions;
    if (args.chain) {
      filtered = filtered.filter((t) => t.chain === args.chain);
    }
    if (args.agentId) {
      filtered = filtered.filter((t) => t.agentId === args.agentId);
    }

    return filtered;
  },
});

// ═══════════════════════════════════════════════════
// Get by Agent
// ═══════════════════════════════════════════════════

export const getByAgent = query({
  args: {
    agentAddress: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_agent", (q) => q.eq("agentAddress", args.agentAddress))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// ═══════════════════════════════════════════════════
// Get by Seller
// ═══════════════════════════════════════════════════

export const getBySeller = query({
  args: {
    sellerId: v.id("sellers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.sellerId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});
