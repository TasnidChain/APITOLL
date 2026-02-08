import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Auth helper: require a logged-in Clerk user
async function requireAuth(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

// ─── Secure API Key Generation ───────────────────────────────────

function generateSecureKey(prefix: string): string {
  // Use crypto.getRandomValues for 32 bytes of entropy
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

// ═══════════════════════════════════════════════════
// Create Organization
// ═══════════════════════════════════════════════════

export const create = mutation({
  args: {
    name: v.string(),
    billingWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate name
    const name = args.name.trim();
    if (name.length < 2 || name.length > 100) {
      throw new Error("Organization name must be 2-100 characters");
    }

    // Generate secure API key (32 bytes = 64 hex chars)
    const apiKey = generateSecureKey("org");

    const id = await ctx.db.insert("organizations", {
      name,
      billingWallet: args.billingWallet,
      plan: "free",
      apiKey,
      createdAt: Date.now(),
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
// List Organizations (with pagination)
// ═══════════════════════════════════════════════════

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .order("desc")
      .take(args.limit ?? 50);
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
    await requireAuth(ctx);
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
    await requireAuth(ctx);
    await ctx.db.patch(args.id, { billingWallet: args.billingWallet });
  },
});

// ═══════════════════════════════════════════════════
// Regenerate API Key (secure)
// ═══════════════════════════════════════════════════

export const regenerateApiKey = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const newApiKey = generateSecureKey("org");
    await ctx.db.patch(args.id, { apiKey: newApiKey });
    return newApiKey;
  },
});
