import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { timingSafeEqual } from "./helpers";

// Called by the external facilitator server (pay.apitoll.com) via ConvexHttpClient.
// Every mutation validates FACILITATOR_CONVEX_SECRET for defense-in-depth.

function validateFacilitatorSecret(secret: string | undefined) {
  const expected = process.env.FACILITATOR_CONVEX_SECRET;
  if (!expected) {
    throw new Error("FACILITATOR_CONVEX_SECRET not configured on Convex");
  }
  if (!secret) {
    throw new Error("Invalid facilitator secret");
  }
  if (!timingSafeEqual(secret, expected)) {
    throw new Error("Invalid facilitator secret");
  }
}

/**
 * Create or update a payment record.
 * Called when a new payment is initiated or when status changes.
 *
 * Supports idempotency keys: if `idempotencyKey` is provided and a payment
 * with that key already exists, returns the existing payment ID without
 * creating a duplicate. This prevents double-charges on network retries.
 */
export const upsertPayment = mutation({
  args: {
    _secret: v.string(),
    paymentId: v.string(),
    idempotencyKey: v.optional(v.string()),
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
    validateFacilitatorSecret(args._secret);
    // Strip _secret before any DB operations
    const { _secret: _, ...data } = args;

    // Idempotency key check — if caller sent the same key before, return existing payment
    if (data.idempotencyKey) {
      const existingByKey = await ctx.db
        .query("facilitatorPayments")
        .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", data.idempotencyKey))
        .first();

      if (existingByKey) {
        // Return the original payment ID — no duplicate created
        return existingByKey._id;
      }
    }

    // Check if payment already exists by paymentId
    const existing = await ctx.db
      .query("facilitatorPayments")
      .withIndex("by_payment_id", (q) => q.eq("paymentId", data.paymentId))
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        status: data.status,
        txHash: data.txHash,
        error: data.error,
        completedAt: data.completedAt,
      });
      return existing._id;
    }

    // Create new record
    return await ctx.db.insert("facilitatorPayments", data);
  },
});

/**
 * Update payment status (lightweight — just status fields).
 */
export const updatePaymentStatus = mutation({
  args: {
    _secret: v.string(),
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
    validateFacilitatorSecret(args._secret);
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
 * Look up an existing payment by client-provided idempotency key.
 * Returns the cached payment record so the facilitator can short-circuit
 * duplicate requests without hitting the blockchain.
 */
export const getByIdempotencyKey = query({
  args: { _secret: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    validateFacilitatorSecret(args._secret);
    return await ctx.db
      .query("facilitatorPayments")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();
  },
});

/**
 * Get a single payment by its UUID.
 */
export const getPayment = query({
  args: { _secret: v.string(), paymentId: v.string() },
  handler: async (ctx, args) => {
    validateFacilitatorSecret(args._secret);
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
  args: { _secret: v.string() },
  handler: async (ctx, args) => {
    validateFacilitatorSecret(args._secret);
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
