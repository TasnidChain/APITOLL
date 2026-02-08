import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ═══════════════════════════════════════════════════
// Facilitator Payment Persistence
// These functions are called by the facilitator server
// via ConvexHttpClient to persist payment records.
// ═══════════════════════════════════════════════════

/**
 * Create or update a payment record.
 * Called when a new payment is initiated or when status changes.
 */
export const upsertPayment = mutation({
  args: {
    paymentId: v.string(),
    originalUrl: v.string(),
    originalMethod: v.string(),
    originalHeaders: v.optional(v.any()),
    originalBody: v.optional(v.any()),
    amount: v.string(),
    currency: v.string(),
    recipient: v.string(),
    chain: v.string(),
    agentWallet: v.string(),
    sellerAddress: v.string(),
    apiKey: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    txHash: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if payment already exists
    const existing = await ctx.db
      .query("facilitatorPayments")
      .withIndex("by_payment_id", (q) => q.eq("paymentId", args.paymentId))
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        status: args.status,
        txHash: args.txHash,
        error: args.error,
        completedAt: args.completedAt,
      });
      return existing._id;
    }

    // Create new record
    return await ctx.db.insert("facilitatorPayments", args);
  },
});

/**
 * Update payment status (lightweight — just status fields).
 */
export const updatePaymentStatus = mutation({
  args: {
    paymentId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    txHash: v.optional(v.string()),
    error: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("facilitatorPayments")
      .withIndex("by_payment_id", (q) => q.eq("paymentId", args.paymentId))
      .first();

    if (!payment) {
      throw new Error(`Payment ${args.paymentId} not found`);
    }

    const patch: Record<string, string | number | undefined> = {
      status: args.status,
    };
    if (args.txHash !== undefined) patch.txHash = args.txHash;
    if (args.error !== undefined) patch.error = args.error;
    if (args.completedAt !== undefined) patch.completedAt = args.completedAt;

    await ctx.db.patch(payment._id, patch);
  },
});

/**
 * Get a single payment by its UUID.
 */
export const getPayment = query({
  args: { paymentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("facilitatorPayments")
      .withIndex("by_payment_id", (q) => q.eq("paymentId", args.paymentId))
      .first();
  },
});

/**
 * Get all active (pending/processing) payments.
 * Used on facilitator startup to recover in-flight payments.
 */
export const getActivePayments = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("facilitatorPayments")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const processing = await ctx.db
      .query("facilitatorPayments")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();

    return [...pending, ...processing];
  },
});
