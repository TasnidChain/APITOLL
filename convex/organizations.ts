import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireAuth, requireAdmin, requireOrgAccess } from "./helpers";


function generateSecureKey(prefix: string): string {
  // Use crypto.getRandomValues for 32 bytes of entropy
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

// Create Organization

export const create = mutation({
  args: {
    name: v.string(),
    billingWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    // Validate name
    const name = args.name.trim();
    if (name.length < 2 || name.length > 100) {
      throw new Error("Organization name must be 2-100 characters");
    }

    // Generate secure API key (32 bytes = 64 hex chars)
    const apiKey = generateSecureKey("org");

    // Store clerkUserId so org ownership can be verified
    const id = await ctx.db.insert("organizations", {
      name,
      billingWallet: args.billingWallet,
      plan: "free",
      apiKey,
      clerkUserId: identity.subject,
      createdAt: Date.now(),
    });

    return { id, apiKey };
  },
});

// Get by API Key

// internalQuery — API key lookup should NOT be exposed to browsers.
// Used by authenticateOrg() in http.ts httpActions.
export const getByApiKey = internalQuery({
  args: { apiKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .first();
  },
});

// Get Organization

export const get = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    // Verify caller owns this organization
    await requireOrgAccess(ctx, args.id);
    const org = await ctx.db.get(args.id);
    if (!org) return null;
    // Strip apiKey — never expose to frontend
    const { apiKey: _apiKey, ...safe } = org;
    return safe;
  },
});

// Get Org API Key (authenticated users only — for the API Keys page)

export const getApiKey = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    // Verify caller owns this organization before exposing API key
    await requireOrgAccess(ctx, args.id);
    const org = await ctx.db.get(args.id);
    if (!org) return null;
    return { apiKey: org.apiKey };
  },
});

// List Organizations (with pagination)

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const orgs = await ctx.db
      .query("organizations")
      .order("desc")
      .take(args.limit ?? 50);
    // Strip apiKeys — never expose to frontend
    return orgs.map(({ apiKey: _apiKey, ...safe }) => safe);
  },
});

// Update Plan

export const updatePlan = mutation({
  args: {
    id: v.id("organizations"),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { plan: args.plan });
  },
});

// Update Billing Wallet

export const updateBillingWallet = mutation({
  args: {
    id: v.id("organizations"),
    billingWallet: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify caller owns this organization
    await requireOrgAccess(ctx, args.id);
    await ctx.db.patch(args.id, { billingWallet: args.billingWallet });
  },
});

// INTERNAL version — called from httpActions in http.ts (signup endpoint)
export const internalCreate = internalMutation({
  args: {
    name: v.string(),
    billingWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (name.length < 2 || name.length > 100) {
      throw new Error("Organization name must be 2-100 characters");
    }
    const apiKey = generateSecureKey("org");
    const id = await ctx.db.insert("organizations", { name, billingWallet: args.billingWallet, plan: "free", apiKey, createdAt: Date.now() });
    return { id, apiKey };
  },
});

// Regenerate API Key (secure)

export const regenerateApiKey = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    // Verify caller owns this organization
    await requireOrgAccess(ctx, args.id);
    const newApiKey = generateSecureKey("org");
    await ctx.db.patch(args.id, { apiKey: newApiKey });
    return newApiKey;
  },
});

// INTERNAL version — called from httpActions in http.ts (which authenticate via org API key)
export const internalRegenerateApiKey = internalMutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    const newApiKey = generateSecureKey("org");
    await ctx.db.patch(args.id, { apiKey: newApiKey });
    return newApiKey;
  },
});
