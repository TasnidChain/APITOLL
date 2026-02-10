import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireAuth, requireAdmin, requireOrgAccess } from "./helpers";

// Create Dispute

export const create = mutation({
  args: {
    transactionId: v.id("transactions"),
    orgId: v.id("organizations"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify caller owns this org
    await requireOrgAccess(ctx, args.orgId);
    // Verify the transaction exists
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction) throw new Error("Transaction not found");

    // Verify the transaction belongs to this org's agent
    if (transaction.agentId) {
      const agent = await ctx.db.get(transaction.agentId);
      if (!agent || String(agent.orgId) !== String(args.orgId)) {
        throw new Error("Unauthorized: transaction does not belong to your organization");
      }
    }

    // Check if a dispute already exists for this transaction
    const existing = await ctx.db
      .query("disputes")
      .withIndex("by_transaction", (q) => q.eq("transactionId", args.transactionId))
      .first();

    if (existing) {
      throw new Error("A dispute already exists for this transaction");
    }

    // Only settled transactions can be disputed
    if (transaction.status !== "settled") {
      throw new Error("Only settled transactions can be disputed");
    }

    const id = await ctx.db.insert("disputes", {
      transactionId: args.transactionId,
      orgId: args.orgId,
      reason: args.reason,
      status: "open",
      createdAt: Date.now(),
    });

    return id;
  },
});

// List Disputes by Org

export const listByOrg = query({
  args: {
    orgId: v.id("organizations"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify caller owns this org
    await requireOrgAccess(ctx, args.orgId);
    let disputes;

    if (args.status) {
      disputes = await ctx.db
        .query("disputes")
        .withIndex("by_status", (q) => q.eq("status", args.status as "open" | "under_review" | "resolved" | "rejected"))
        .collect();

      // Filter by org in memory
      disputes = disputes.filter((d) => d.orgId === args.orgId);
    } else {
      disputes = await ctx.db
        .query("disputes")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
    }

    // Enrich with transaction data
    const enriched = await Promise.all(
      disputes.map(async (dispute) => {
        const transaction = await ctx.db.get(dispute.transactionId);
        return { ...dispute, transaction };
      })
    );

    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// List All Open Disputes (admin view)

export const listOpen = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const disputes = await ctx.db
      .query("disputes")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    const enriched = await Promise.all(
      disputes.map(async (dispute) => {
        const transaction = await ctx.db.get(dispute.transactionId);
        return { ...dispute, transaction };
      })
    );

    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Resolve Dispute

export const resolve = mutation({
  args: {
    disputeId: v.id("disputes"),
    resolution: v.union(
      v.literal("refunded"),
      v.literal("partial_refund"),
      v.literal("denied")
    ),
    refundAmount: v.optional(v.number()),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const dispute = await ctx.db.get(args.disputeId);
    if (!dispute) throw new Error("Dispute not found");

    if (dispute.status === "resolved" || dispute.status === "rejected") {
      throw new Error("Dispute is already resolved");
    }

    // Update dispute
    await ctx.db.patch(args.disputeId, {
      status: args.resolution === "denied" ? "rejected" : "resolved",
      resolution: args.resolution,
      refundAmount: args.refundAmount,
      adminNotes: args.adminNotes,
      resolvedAt: Date.now(),
    });

    // If refunded, update the transaction status
    if (args.resolution === "refunded" || args.resolution === "partial_refund") {
      await ctx.db.patch(dispute.transactionId, {
        status: "refunded",
      });
    }

    return { success: true };
  },
});

// Update Status (move to under_review)

export const updateStatus = mutation({
  args: {
    disputeId: v.id("disputes"),
    status: v.union(
      v.literal("under_review"),
      v.literal("open")
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.disputeId, {
      status: args.status,
    });
  },
});

// INTERNAL version — called from httpActions in http.ts (which authenticate via org API key)
export const internalListByOrg = internalQuery({
  args: { orgId: v.id("organizations"), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let disputes;
    if (args.status) {
      disputes = await ctx.db.query("disputes").withIndex("by_status", (q) => q.eq("status", args.status as "open" | "under_review" | "resolved" | "rejected")).collect();
      disputes = disputes.filter((d) => d.orgId === args.orgId);
    } else {
      disputes = await ctx.db.query("disputes").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    }
    const enriched = await Promise.all(disputes.map(async (dispute) => {
      const transaction = await ctx.db.get(dispute.transactionId);
      return { ...dispute, transaction };
    }));
    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// INTERNAL version of create — called from httpActions in http.ts
export const internalCreate = internalMutation({
  args: {
    transactionId: v.id("transactions"),
    orgId: v.id("organizations"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction) throw new Error("Transaction not found");
    const existing = await ctx.db.query("disputes").withIndex("by_transaction", (q) => q.eq("transactionId", args.transactionId)).first();
    if (existing) throw new Error("A dispute already exists for this transaction");
    if (transaction.status !== "settled") throw new Error("Only settled transactions can be disputed");
    const id = await ctx.db.insert("disputes", { transactionId: args.transactionId, orgId: args.orgId, reason: args.reason, status: "open", createdAt: Date.now() });
    return id;
  },
});
