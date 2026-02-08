import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ═══════════════════════════════════════════════════
// Platform-wide Admin Queries & Mutations
// These operate across ALL orgs (no orgId parameter)
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// 1. Get Platform Stats
// ═══════════════════════════════════════════════════

export const getPlatformStats = query({
  args: {},
  handler: async (ctx) => {
    // --- Organizations ---
    const allOrgs = await ctx.db.query("organizations").collect();
    const planDistribution = { free: 0, pro: 0, enterprise: 0 };
    for (const org of allOrgs) {
      if (org.plan === "free") planDistribution.free++;
      else if (org.plan === "pro") planDistribution.pro++;
      else if (org.plan === "enterprise") planDistribution.enterprise++;
    }

    // --- Agents ---
    const allAgents = await ctx.db.query("agents").collect();
    let activeAgents = 0;
    let pausedAgents = 0;
    let depletedAgents = 0;
    for (const agent of allAgents) {
      if (agent.status === "active") activeAgents++;
      else if (agent.status === "paused") pausedAgents++;
      else if (agent.status === "depleted") depletedAgents++;
    }

    // --- Sellers ---
    const allSellers = await ctx.db.query("sellers").collect();

    // --- Transactions ---
    const allTransactions = await ctx.db.query("transactions").collect();
    let settledCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    let totalVolume = 0;
    let totalFees = 0;
    let todayCount = 0;
    let todayVolume = 0;

    const todayStart = new Date().setHours(0, 0, 0, 0);

    for (const tx of allTransactions) {
      if (tx.status === "settled") settledCount++;
      else if (tx.status === "failed") failedCount++;
      else if (tx.status === "pending") pendingCount++;

      totalVolume += tx.amount;
      totalFees += tx.platformFee ?? 0;

      if (tx.requestedAt >= todayStart) {
        todayCount++;
        todayVolume += tx.amount;
      }
    }

    // --- Tools (marketplace) ---
    const allTools = await ctx.db.query("tools").collect();
    let activeTools = 0;
    let verifiedTools = 0;
    let featuredTools = 0;
    for (const tool of allTools) {
      if (tool.isActive) activeTools++;
      if (tool.isVerified) verifiedTools++;
      if (tool.isFeatured) featuredTools++;
    }

    // --- Webhooks ---
    const allWebhooks = await ctx.db.query("webhooks").collect();
    let activeWebhooks = 0;
    let failingWebhooks = 0;
    for (const wh of allWebhooks) {
      if (wh.isActive) activeWebhooks++;
      if (wh.failureCount >= 3) failingWebhooks++;
    }

    return {
      orgs: {
        total: allOrgs.length,
        planDistribution,
      },
      agents: {
        total: allAgents.length,
        active: activeAgents,
        paused: pausedAgents,
        depleted: depletedAgents,
      },
      sellers: {
        total: allSellers.length,
      },
      transactions: {
        total: allTransactions.length,
        settled: settledCount,
        failed: failedCount,
        pending: pendingCount,
        totalVolume,
        totalFees,
        todayCount,
        todayVolume,
      },
      marketplace: {
        totalTools: allTools.length,
        activeTools,
        verifiedTools,
        featuredTools,
      },
      webhooks: {
        total: allWebhooks.length,
        active: activeWebhooks,
        failing: failingWebhooks,
      },
    };
  },
});

// ═══════════════════════════════════════════════════
// 2. List All Orgs
// ═══════════════════════════════════════════════════

export const listAllOrgs = query({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();

    const enriched = await Promise.all(
      orgs.map(async (org) => {
        const agents = await ctx.db
          .query("agents")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .collect();

        const sellers = await ctx.db
          .query("sellers")
          .filter((q) => q.eq(q.field("orgId"), org._id))
          .collect();

        return {
          ...org,
          agentCount: agents.length,
          sellerCount: sellers.length,
        };
      })
    );

    return enriched;
  },
});

// ═══════════════════════════════════════════════════
// 3. Admin Update Plan
// ═══════════════════════════════════════════════════

export const adminUpdatePlan = mutation({
  args: {
    orgId: v.id("organizations"),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orgId, { plan: args.plan });
  },
});

// ═══════════════════════════════════════════════════
// 4. Admin Update Tool
// ═══════════════════════════════════════════════════

export const adminUpdateTool = mutation({
  args: {
    toolId: v.id("tools"),
    isActive: v.optional(v.boolean()),
    isVerified: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    boostScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, boolean | number> = {};
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.isVerified !== undefined) patch.isVerified = args.isVerified;
    if (args.isFeatured !== undefined) patch.isFeatured = args.isFeatured;
    if (args.boostScore !== undefined) patch.boostScore = args.boostScore;

    await ctx.db.patch(args.toolId, patch);
  },
});

// ═══════════════════════════════════════════════════
// 5. List All Tools
// ═══════════════════════════════════════════════════

export const listAllTools = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db.query("tools").collect();

    const enriched = await Promise.all(
      tools.map(async (tool) => {
        const seller = tool.sellerId
          ? await ctx.db.get(tool.sellerId)
          : null;

        return {
          ...tool,
          sellerName: seller ? seller.name : "Unknown",
        };
      })
    );

    return enriched;
  },
});

// ═══════════════════════════════════════════════════
// 6. List All Disputes
// ═══════════════════════════════════════════════════

export const listAllDisputes = query({
  args: {},
  handler: async (ctx) => {
    const disputes = await ctx.db.query("disputes").collect();

    const enriched = await Promise.all(
      disputes.map(async (dispute) => {
        const org = await ctx.db.get(dispute.orgId);
        const transaction = await ctx.db.get(dispute.transactionId);

        return {
          ...dispute,
          orgName: org ? org.name : "Unknown",
          transaction,
        };
      })
    );

    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ═══════════════════════════════════════════════════
// 7. Resolve Dispute
// ═══════════════════════════════════════════════════

export const resolveDispute = mutation({
  args: {
    disputeId: v.id("disputes"),
    status: v.union(v.literal("resolved"), v.literal("rejected")),
    resolution: v.optional(
      v.union(
        v.literal("refunded"),
        v.literal("partial_refund"),
        v.literal("denied")
      )
    ),
    refundAmount: v.optional(v.number()),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, string | number | undefined> = {
      status: args.status,
      resolvedAt: Date.now(),
    };
    if (args.resolution !== undefined) patch.resolution = args.resolution;
    if (args.refundAmount !== undefined) patch.refundAmount = args.refundAmount;
    if (args.adminNotes !== undefined) patch.adminNotes = args.adminNotes;

    await ctx.db.patch(args.disputeId, patch);
  },
});

// ═══════════════════════════════════════════════════
// 8. Get Activity Log
// ═══════════════════════════════════════════════════

export const getActivityLog = query({
  args: {},
  handler: async (ctx) => {
    const transactions = await ctx.db
      .query("transactions")
      .order("desc")
      .take(50);

    const enriched = await Promise.all(
      transactions.map(async (tx) => {
        const agent = tx.agentId ? await ctx.db.get(tx.agentId) : null;
        const seller = tx.sellerId ? await ctx.db.get(tx.sellerId) : null;

        return {
          ...tx,
          agentName: agent ? agent.name : "Unknown",
          sellerName: seller ? seller.name : "Unknown",
        };
      })
    );

    return enriched;
  },
});
