import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireAuth } from "./helpers";

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
    await requireAuth(ctx);
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
    await requireAuth(ctx);
    // Get sellers that belong to this org
    const sellers = await ctx.db
      .query("sellers")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();

    // SECURITY: Strip apiKeys — never expose to frontend
    return sellers.map(({ apiKey: _apiKey, ...safe }) => safe);
  },
});

// ═══════════════════════════════════════════════════
// List Seller API Keys by Org (for API Keys page)
// ═══════════════════════════════════════════════════

export const listApiKeysByOrg = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const sellers = await ctx.db
      .query("sellers")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();
    // Return only the fields needed for the API keys page
    return sellers.map((s) => ({
      _id: s._id,
      name: s.name,
      apiKey: s.apiKey,
    }));
  },
});

// ═══════════════════════════════════════════════════
// Get by API Key
// ═══════════════════════════════════════════════════

// SECURITY: internalQuery — API key lookup should NOT be exposed to browsers.
// Used by httpActions in http.ts for seller authentication.
export const getByApiKey = internalQuery({
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
    await requireAuth(ctx);
    const seller = await ctx.db.get(args.id);
    if (!seller) return null;
    // SECURITY: Strip apiKey — never expose to frontend
    const { apiKey: _apiKey, ...safe } = seller;
    return safe;
  },
});

// ═══════════════════════════════════════════════════
// Get Seller Stats
// ═══════════════════════════════════════════════════

export const getStats = query({
  args: { id: v.id("sellers") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
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
