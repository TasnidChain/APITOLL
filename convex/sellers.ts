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
    // Generate secure API key (32 bytes of entropy)
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const apiKey = `sk_${hex}`;

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

    const settledTxs = transactions.filter((t) => t.status === "settled");
    const totalRevenue = settledTxs.reduce((sum, t) => sum + t.amount, 0);
    const totalPlatformFees = settledTxs.reduce((sum, t) => sum + (t.platformFee ?? 0), 0);
    const totalSellerRevenue = settledTxs.reduce((sum, t) => sum + (t.sellerAmount ?? t.amount), 0);

    const totalCalls = transactions.length;
    const successfulCalls = settledTxs.length;

    const endpoints = await ctx.db
      .query("endpoints")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.id))
      .collect();

    return {
      totalRevenue,
      totalSellerRevenue,
      totalPlatformFees,
      totalCalls,
      successfulCalls,
      endpointCount: endpoints.length,
    };
  },
});
