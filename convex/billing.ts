import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { requireAuth } from "./helpers";

// ═══════════════════════════════════════════════════
// Stripe Subscription Management
//
// SECURITY: All billing mutations are internalMutation.
// They are called from:
//   1. convex/http.ts Stripe webhook handler (ctx.runMutation)
//   2. convex/http.ts signup handler (ctx.runMutation)
// NOT directly callable from browser or external ConvexHttpClient.
// ═══════════════════════════════════════════════════

/**
 * Create or update Stripe customer for an organization.
 */
export const setStripeCustomer = internalMutation({
  args: {
    orgId: v.id("organizations"),
    stripeCustomerId: v.string(),
    billingEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orgId, {
      stripeCustomerId: args.stripeCustomerId,
      billingEmail: args.billingEmail,
    });
  },
});

/**
 * Activate a subscription (called from Stripe webhook).
 */
export const activateSubscription = internalMutation({
  args: {
    orgId: v.id("organizations"),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.string(),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    billingPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orgId, {
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripePriceId: args.stripePriceId,
      plan: args.plan,
      billingPeriodEnd: args.billingPeriodEnd,
    });
  },
});

/**
 * Cancel a subscription (downgrade to free).
 */
export const cancelSubscription = internalMutation({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orgId, {
      plan: "free",
      stripeSubscriptionId: undefined,
      stripePriceId: undefined,
      billingPeriodEnd: undefined,
    });
  },
});

/**
 * Get by Stripe customer ID (for webhook handling).
 */
export const getByStripeCustomer = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_stripe_customer", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();
  },
});

/**
 * Get billing summary for an organization.
 */
export const getBillingSummary = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const org = await ctx.db.get(args.orgId);
    if (!org) return null;

    // Get today's usage
    const today = new Date().toISOString().split("T")[0];
    const dailyCalls = org.dailyCallDate === today ? (org.dailyCallCount ?? 0) : 0;

    // Count agents and sellers
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const sellers = await ctx.db
      .query("sellers")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();

    return {
      plan: org.plan,
      stripeCustomerId: org.stripeCustomerId,
      stripeSubscriptionId: org.stripeSubscriptionId,
      billingEmail: org.billingEmail,
      billingPeriodEnd: org.billingPeriodEnd,
      usage: {
        dailyCalls,
        totalAgents: agents.length,
        totalSellers: sellers.length,
      },
    };
  },
});

// INTERNAL version — called from httpActions in http.ts (which authenticate via org API key)
export const internalGetBillingSummary = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    if (!org) return null;
    const today = new Date().toISOString().split("T")[0];
    const dailyCalls = org.dailyCallDate === today ? (org.dailyCallCount ?? 0) : 0;
    const agents = await ctx.db.query("agents").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const sellers = await ctx.db.query("sellers").filter((q) => q.eq(q.field("orgId"), args.orgId)).collect();
    return { plan: org.plan, stripeCustomerId: org.stripeCustomerId, stripeSubscriptionId: org.stripeSubscriptionId, billingEmail: org.billingEmail, billingPeriodEnd: org.billingPeriodEnd, usage: { dailyCalls, totalAgents: agents.length, totalSellers: sellers.length } };
  },
});

// ═══════════════════════════════════════════════════
// Plan Enforcement
// ═══════════════════════════════════════════════════

// Plan limits (mirrored from shared types — kept in sync)
const PLAN_LIMITS = {
  free: { maxCallsPerDay: 1000, maxAgents: 1, maxSellers: 2 },
  pro: { maxCallsPerDay: 100_000, maxAgents: 10, maxSellers: 25 },
  enterprise: { maxCallsPerDay: Infinity, maxAgents: Infinity, maxSellers: Infinity },
} as const;

/**
 * Increment daily call count and check plan limits.
 * Returns { allowed: boolean, remaining: number }.
 */
export const incrementUsage = internalMutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    if (!org) return { allowed: false, remaining: 0 };

    const today = new Date().toISOString().split("T")[0];
    const currentCount = org.dailyCallDate === today ? (org.dailyCallCount ?? 0) : 0;
    const limit = PLAN_LIMITS[org.plan as keyof typeof PLAN_LIMITS]?.maxCallsPerDay ?? 1000;

    if (currentCount >= limit) {
      return { allowed: false, remaining: 0 };
    }

    await ctx.db.patch(args.orgId, {
      dailyCallCount: currentCount + 1,
      dailyCallDate: today,
    });

    return { allowed: true, remaining: limit - currentCount - 1 };
  },
});

/**
 * Check if adding an agent is within plan limits.
 */
export const checkAgentLimit = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await ctx.db.get(args.orgId);
    if (!org) return { allowed: false, limit: 0, current: 0 };

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const limit = PLAN_LIMITS[org.plan as keyof typeof PLAN_LIMITS]?.maxAgents ?? 1;

    return {
      allowed: agents.length < limit,
      limit,
      current: agents.length,
    };
  },
});

/**
 * Check if adding a seller is within plan limits.
 */
export const checkSellerLimit = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await ctx.db.get(args.orgId);
    if (!org) return { allowed: false, limit: 0, current: 0 };

    const sellers = await ctx.db
      .query("sellers")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();

    const limit = PLAN_LIMITS[org.plan as keyof typeof PLAN_LIMITS]?.maxSellers ?? 2;

    return {
      allowed: sellers.length < limit,
      limit,
      current: sellers.length,
    };
  },
});

// ═══════════════════════════════════════════════════
// Stripe Price IDs (configure via env or constants)
// ═══════════════════════════════════════════════════

export const STRIPE_PRICES = {
  pro_monthly: "price_pro_monthly",       // $49/mo
  pro_yearly: "price_pro_yearly",         // $490/yr
  enterprise_monthly: "price_ent_monthly", // $499/mo
  enterprise_yearly: "price_ent_yearly",   // $4990/yr
} as const;

/**
 * Map Stripe price ID to plan tier.
 */
export function priceIdToPlan(priceId: string): "free" | "pro" | "enterprise" {
  if (priceId.includes("pro")) return "pro";
  if (priceId.includes("ent")) return "enterprise";
  return "free";
}
