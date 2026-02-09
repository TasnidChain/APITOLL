import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAuth } from "./helpers";

// ═══════════════════════════════════════════════════
// Create Deposit (Stripe → USDC on-ramp)
// ═══════════════════════════════════════════════════

const ON_RAMP_FEE_BPS = 150; // 1.5% on-ramp fee

export const create = internalMutation({
  args: {
    orgId: v.id("organizations"),
    agentId: v.optional(v.id("agents")),
    stripePaymentIntentId: v.string(),
    fiatAmount: v.number(),
    walletAddress: v.string(),
    chain: v.union(v.literal("base"), v.literal("solana")),
  },
  handler: async (ctx, args) => {
    // Calculate USDC amount after fee (USDC is pegged 1:1 to USD)
    const feeAmount = (args.fiatAmount * ON_RAMP_FEE_BPS) / 10000;
    const usdcAmount = args.fiatAmount - feeAmount;

    const id = await ctx.db.insert("deposits", {
      orgId: args.orgId,
      agentId: args.agentId,
      stripePaymentIntentId: args.stripePaymentIntentId,
      fiatAmount: args.fiatAmount,
      usdcAmount: parseFloat(usdcAmount.toFixed(6)),
      exchangeRate: 1.0, // USDC:USD peg
      feeAmount: parseFloat(feeAmount.toFixed(6)),
      status: "pending",
      walletAddress: args.walletAddress,
      chain: args.chain,
      createdAt: Date.now(),
    });

    return { id, usdcAmount, feeAmount };
  },
});

// ═══════════════════════════════════════════════════
// Update Deposit Status (internal only — called from http.ts Stripe webhook)
// ═══════════════════════════════════════════════════

export const updateStatus = internalMutation({
  args: {
    depositId: v.id("deposits"),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const update: { status: typeof args.status; txHash?: string; completedAt?: number } = { status: args.status };

    if (args.txHash) {
      update.txHash = args.txHash;
    }

    if (args.status === "completed") {
      update.completedAt = Date.now();

      // Update agent balance if linked
      const deposit = await ctx.db.get(args.depositId);
      if (deposit?.agentId) {
        const agent = await ctx.db.get(deposit.agentId) as { balance: number } | null;
        if (agent) {
          await ctx.db.patch(deposit.agentId, {
            balance: agent.balance + deposit.usdcAmount,
            status: "active" as const,
          });
        }
      }
    }

    await ctx.db.patch(args.depositId, update);
  },
});

// ═══════════════════════════════════════════════════
// Public Create Deposit (from dashboard — requires Clerk auth)
// ═══════════════════════════════════════════════════

export const createDeposit = mutation({
  args: {
    orgId: v.id("organizations"),
    agentId: v.optional(v.id("agents")),
    stripePaymentIntentId: v.string(),
    fiatAmount: v.number(),
    walletAddress: v.string(),
    chain: v.union(v.literal("base"), v.literal("solana")),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const ON_RAMP_FEE_BPS = 150; // 1.5%
    const feeAmount = (args.fiatAmount * ON_RAMP_FEE_BPS) / 10000;
    const usdcAmount = args.fiatAmount - feeAmount;

    const id = await ctx.db.insert("deposits", {
      orgId: args.orgId,
      agentId: args.agentId,
      stripePaymentIntentId: args.stripePaymentIntentId,
      fiatAmount: args.fiatAmount,
      usdcAmount: parseFloat(usdcAmount.toFixed(6)),
      exchangeRate: 1.0,
      feeAmount: parseFloat(feeAmount.toFixed(6)),
      status: "pending",
      walletAddress: args.walletAddress,
      chain: args.chain,
      createdAt: Date.now(),
    });

    return { id, usdcAmount, feeAmount };
  },
});

// ═══════════════════════════════════════════════════
// List Deposits by Org
// ═══════════════════════════════════════════════════

export const listByOrg = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deposits")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// ═══════════════════════════════════════════════════
// Get Deposit by Stripe PI
// ═══════════════════════════════════════════════════

export const getByPaymentIntent = query({
  args: { stripePaymentIntentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deposits")
      .withIndex("by_stripe_pi", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .first();
  },
});

// ═══════════════════════════════════════════════════
// Get Deposit Stats
// ═══════════════════════════════════════════════════

export const getStats = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const deposits = await ctx.db
      .query("deposits")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const completed = deposits.filter((d) => d.status === "completed");
    const totalDeposited = completed.reduce((sum, d) => sum + d.fiatAmount, 0);
    const totalUsdcReceived = completed.reduce((sum, d) => sum + d.usdcAmount, 0);
    const totalFees = completed.reduce((sum, d) => sum + d.feeAmount, 0);

    return {
      totalDeposits: deposits.length,
      completedDeposits: completed.length,
      totalDeposited,
      totalUsdcReceived,
      totalFees,
    };
  },
});
