import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireAuth, requireOrgAccess } from "./helpers";

// Create Deposit (Stripe → USDC on-ramp)

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

// Update Deposit Status (internal only — called from http.ts Stripe webhook)

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

// Public Create Deposit (from dashboard — requires Clerk auth)

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
    // Verify caller owns this organization
    await requireOrgAccess(ctx, args.orgId);

    // Validate fiatAmount range
    if (args.fiatAmount <= 0 || args.fiatAmount > 10000) {
      throw new Error("fiatAmount must be between $0.01 and $10,000");
    }

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

// List Deposits by Org

export const listByOrg = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify caller owns this organization
    await requireOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("deposits")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// Get Deposit by Stripe PI

export const getByPaymentIntent = query({
  args: { stripePaymentIntentId: v.string() },
  handler: async (ctx, args) => {
    // Require auth to look up deposits
    await requireAuth(ctx);
    return await ctx.db
      .query("deposits")
      .withIndex("by_stripe_pi", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .first();
  },
});

// Get Deposit Stats

export const getStats = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    // Verify caller owns this organization
    await requireOrgAccess(ctx, args.orgId);
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

// Auto Top-Up Configuration

export const setAutoTopUp = mutation({
  args: {
    orgId: v.id("organizations"),
    enabled: v.boolean(),
    thresholdUSDC: v.optional(v.number()),  // trigger when balance falls below this
    topUpAmountUSDC: v.optional(v.number()), // amount to top up
    maxMonthlyUSD: v.optional(v.number()),   // monthly cap on auto-deposits
    chain: v.optional(v.union(v.literal("base"), v.literal("solana"))),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId);

    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");

    // Validate amounts
    if (args.enabled) {
      if (!args.thresholdUSDC || args.thresholdUSDC <= 0) {
        throw new Error("Threshold must be positive when enabling auto top-up");
      }
      if (!args.topUpAmountUSDC || args.topUpAmountUSDC < 5) {
        throw new Error("Top-up amount must be at least $5");
      }
      if (args.topUpAmountUSDC > 1000) {
        throw new Error("Top-up amount must not exceed $1,000");
      }
      if (args.maxMonthlyUSD && args.maxMonthlyUSD < args.topUpAmountUSDC) {
        throw new Error("Monthly cap must be >= top-up amount");
      }
    }

    await ctx.db.patch(args.orgId, {
      autoTopUpEnabled: args.enabled,
      autoTopUpThreshold: args.thresholdUSDC ?? 1.0,
      autoTopUpAmount: args.topUpAmountUSDC ?? 25.0,
      autoTopUpMaxMonthly: args.maxMonthlyUSD ?? 500.0,
      autoTopUpChain: args.chain ?? "base",
    });

    return {
      enabled: args.enabled,
      threshold: args.thresholdUSDC ?? 1.0,
      topUpAmount: args.topUpAmountUSDC ?? 25.0,
      maxMonthly: args.maxMonthlyUSD ?? 500.0,
    };
  },
});

export const getAutoTopUp = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId);
    const org = await ctx.db.get(args.orgId);
    if (!org) return null;

    return {
      enabled: org.autoTopUpEnabled ?? false,
      threshold: org.autoTopUpThreshold ?? 1.0,
      topUpAmount: org.autoTopUpAmount ?? 25.0,
      maxMonthly: org.autoTopUpMaxMonthly ?? 500.0,
      chain: org.autoTopUpChain ?? "base",
    };
  },
});

// Internal: Check Auto Top-Up (called from HTTP payment flow)

export const checkAutoTopUp = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    if (!org) return null;
    if (!org.autoTopUpEnabled) return null;

    // Check monthly spend
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthDeposits = await ctx.db
      .query("deposits")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.gte(q.field("createdAt"), monthStart.getTime()))
      .collect();

    const monthlySpent = monthDeposits
      .filter((d) => d.status === "completed" || d.status === "processing")
      .reduce((sum, d) => sum + d.fiatAmount, 0);

    const maxMonthly = org.autoTopUpMaxMonthly ?? 500;
    const topUpAmount = org.autoTopUpAmount ?? 25;
    const threshold = org.autoTopUpThreshold ?? 1.0;
    const chain = org.autoTopUpChain ?? "base";

    if (monthlySpent + topUpAmount > maxMonthly) {
      return null; // Monthly cap reached
    }

    return {
      shouldTopUp: true,
      topUpAmount,
      threshold,
      chain,
      walletAddress: org.billingWallet ?? "",
      monthlySpent,
      monthlyRemaining: maxMonthly - monthlySpent,
    };
  },
});

// Deposit Stats by Chain

export const getStatsByChain = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId);

    const deposits = await ctx.db
      .query("deposits")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const completed = deposits.filter((d) => d.status === "completed");

    const byChain: Record<string, { count: number; totalFiat: number; totalUSDC: number }> = {};

    for (const d of completed) {
      const chain = d.chain || "base";
      if (!byChain[chain]) {
        byChain[chain] = { count: 0, totalFiat: 0, totalUSDC: 0 };
      }
      byChain[chain].count++;
      byChain[chain].totalFiat += d.fiatAmount;
      byChain[chain].totalUSDC += d.usdcAmount;
    }

    return {
      byChain,
      totalDeposits: deposits.length,
      pendingCount: deposits.filter((d) => d.status === "pending" || d.status === "processing").length,
    };
  },
});
