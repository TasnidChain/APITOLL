import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { requireOrgAccess } from "./helpers";

// Escrow / Buyer Protection
// Time-locked payment holds with auto-release

const DEFAULT_HOLD_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Hold a Payment in Escrow

export const holdPayment = internalMutation({
  args: {
    transactionId: v.optional(v.id("transactions")),
    paymentId: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    agentAddress: v.string(),
    sellerAddress: v.string(),
    chain: v.union(v.literal("base"), v.literal("solana")),
    holdWindowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const holdWindow = args.holdWindowMs ?? DEFAULT_HOLD_WINDOW_MS;

    const id = await ctx.db.insert("escrowPayments", {
      transactionId: args.transactionId,
      paymentId: args.paymentId,
      amount: args.amount,
      currency: args.currency,
      agentAddress: args.agentAddress,
      sellerAddress: args.sellerAddress,
      chain: args.chain,
      status: "held",
      holdUntil: now + holdWindow,
      createdAt: now,
    });

    return id;
  },
});

// Release Payment to Seller

export const releasePayment = internalMutation({
  args: { escrowId: v.id("escrowPayments") },
  handler: async (ctx, args) => {
    const escrow = await ctx.db.get(args.escrowId);
    if (!escrow) throw new Error("Escrow payment not found");
    if (escrow.status !== "held") {
      throw new Error(`Cannot release escrow in "${escrow.status}" status`);
    }

    await ctx.db.patch(args.escrowId, {
      status: "released",
      releasedAt: Date.now(),
    });
  },
});

// Auto-Release Expired Escrow Payments (cron)

export const autoReleaseExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get all held escrow payments
    const heldPayments = await ctx.db
      .query("escrowPayments")
      .withIndex("by_status", (q) => q.eq("status", "held"))
      .collect();

    // Release expired ones
    let released = 0;
    for (const payment of heldPayments) {
      if (payment.holdUntil <= now) {
        await ctx.db.patch(payment._id, {
          status: "released",
          releasedAt: now,
        });
        released++;
      }
    }

    return { released };
  },
});

// Buyer Disputes an Escrowed Payment

export const disputeEscrow = mutation({
  args: {
    orgId: v.id("organizations"),
    escrowId: v.id("escrowPayments"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId);

    const escrow = await ctx.db.get(args.escrowId);
    if (!escrow) throw new Error("Escrow payment not found");
    if (escrow.status !== "held") {
      throw new Error(`Cannot dispute escrow in "${escrow.status}" status`);
    }

    // Must dispute before hold window expires
    if (Date.now() > escrow.holdUntil) {
      throw new Error("Escrow hold period has expired — payment was auto-released");
    }

    // Create a dispute record
    let disputeId;
    if (escrow.transactionId) {
      disputeId = await ctx.db.insert("disputes", {
        transactionId: escrow.transactionId,
        orgId: args.orgId,
        reason: args.reason,
        status: "open",
        createdAt: Date.now(),
      });
    }

    // Update escrow status
    await ctx.db.patch(args.escrowId, {
      status: "disputed",
      disputeId,
    });

    return { escrowId: args.escrowId, disputeId };
  },
});

// Refund an Escrowed Payment (admin action)

export const refundEscrow = internalMutation({
  args: { escrowId: v.id("escrowPayments") },
  handler: async (ctx, args) => {
    const escrow = await ctx.db.get(args.escrowId);
    if (!escrow) throw new Error("Escrow payment not found");
    if (escrow.status !== "disputed") {
      throw new Error(`Cannot refund escrow in "${escrow.status}" status`);
    }

    await ctx.db.patch(args.escrowId, {
      status: "refunded",
      releasedAt: Date.now(),
    });
  },
});

// Queries

export const listByOrg = query({
  args: {
    orgId: v.id("organizations"),
    status: v.optional(v.union(
      v.literal("held"),
      v.literal("released"),
      v.literal("disputed"),
      v.literal("refunded")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId);
    const limit = args.limit ?? 50;

    // Get org's agents to filter escrow payments
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const agentAddresses = new Set(agents.map((a) => a.walletAddress.toLowerCase()));

    let payments;
    if (args.status) {
      payments = await ctx.db
        .query("escrowPayments")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(200);
    } else {
      payments = await ctx.db
        .query("escrowPayments")
        .order("desc")
        .take(200);
    }

    // Filter to this org's agents
    return payments
      .filter((p) => agentAddresses.has(p.agentAddress.toLowerCase()))
      .slice(0, limit);
  },
});

export const getEscrowStats = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId);

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const agentAddresses = new Set(agents.map((a) => a.walletAddress.toLowerCase()));

    const allEscrow = await ctx.db.query("escrowPayments").collect();
    const orgEscrow = allEscrow.filter(
      (p) => agentAddresses.has(p.agentAddress.toLowerCase())
    );

    return {
      held: orgEscrow.filter((p) => p.status === "held").length,
      heldAmount: orgEscrow
        .filter((p) => p.status === "held")
        .reduce((sum, p) => sum + p.amount, 0),
      released: orgEscrow.filter((p) => p.status === "released").length,
      disputed: orgEscrow.filter((p) => p.status === "disputed").length,
      refunded: orgEscrow.filter((p) => p.status === "refunded").length,
      total: orgEscrow.length,
    };
  },
});
