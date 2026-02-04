import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ═══════════════════════════════════════════════════
// Create Organization
// ═══════════════════════════════════════════════════

export const create = mutation({
  args: {
    name: v.string(),
    billingWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Generate API key
    const apiKey = `org_${crypto.randomUUID().replace(/-/g, "")}`;

    const id = await ctx.db.insert("organizations", {
      name: args.name,
      billingWallet: args.billingWallet,
      plan: "free",
      apiKey,
    });

    return { id, apiKey };
  },
});

// ═══════════════════════════════════════════════════
// Get by API Key
// ═══════════════════════════════════════════════════

export const getByApiKey = query({
  args: { apiKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .first();
  },
});

// ═══════════════════════════════════════════════════
// Get Organization
// ═══════════════════════════════════════════════════

export const get = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ═══════════════════════════════════════════════════
// Update Plan
// ═══════════════════════════════════════════════════

export const updatePlan = mutation({
  args: {
    id: v.id("organizations"),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { plan: args.plan });
  },
});

// ═══════════════════════════════════════════════════
// Update Billing Wallet
// ═══════════════════════════════════════════════════

export const updateBillingWallet = mutation({
  args: {
    id: v.id("organizations"),
    billingWallet: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { billingWallet: args.billingWallet });
  },
});

// ═══════════════════════════════════════════════════
// Regenerate API Key
// ═══════════════════════════════════════════════════

export const regenerateApiKey = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    const newApiKey = `org_${crypto.randomUUID().replace(/-/g, "")}`;
    await ctx.db.patch(args.id, { apiKey: newApiKey });
    return newApiKey;
  },
});
