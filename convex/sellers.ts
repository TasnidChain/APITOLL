import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ═══════════════════════════════════════════════════
// Create Seller
// ═══════════════════════════════════════════════════

export const create = mutation({
  args: {
    orgId: v.optional(v.id("organizations")),
    name: v.string(),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    // Generate API key
    const apiKey = `sk_${crypto.randomUUID().replace(/-/g, "")}`;

    const id = await ctx.db.insert("sellers", {
      orgId: args.orgId,
      name: args.name,
      walletAddress: args.walletAddress,
      apiKey,
    });

    return { id, apiKey };
  },
});

// ═══════════════════════════════════════════════════
// List Sellers by Org
// ═══════════════════════════════════════════════════

export const listByOrg = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // Get sellers that belong to this org
    const sellers = await ctx.db
      .query("sellers")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();

    return sellers;
  },
});

// ═══════════════════════════════════════════════════
// Get by API Key
// ═══════════════════════════════════════════════════

export const getByApiKey = query({
  args: { apiKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sellers")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .first();
  },
});

// ═══════════════════════════════════════════════════
// Get Seller
// ═══════════════════════════════════════════════════

export const get = query({
  args: { id: v.id("sellers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ═══════════════════════════════════════════════════
// Get Seller Stats
// ═══════════════════════════════════════════════════

export const getStats = query({
  args: { id: v.id("sellers") },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.id))
      .collect();

    const totalRevenue = transactions
      .filter((t) => t.status === "settled")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalCalls = transactions.length;
    const successfulCalls = transactions.filter((t) => t.status === "settled").length;

    const endpoints = await ctx.db
      .query("endpoints")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.id))
      .collect();

    return {
      totalRevenue,
      totalCalls,
      successfulCalls,
      endpointCount: endpoints.length,
    };
  },
});
