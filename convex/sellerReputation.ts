import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// ═══════════════════════════════════════════════════
// Seller Trust Tiers
// ═══════════════════════════════════════════════════

const SELLER_TIERS = [
  { name: "verified" as const, minScore: 700, badge: "green", featuredEligible: true },
  { name: "reliable" as const, minScore: 400, badge: "blue", featuredEligible: false },
  { name: "standard" as const, minScore: 200, badge: null, featuredEligible: false },
  { name: "probation" as const, minScore: 0, badge: null, featuredEligible: false },
];

type SellerTierName = (typeof SELLER_TIERS)[number]["name"];

function getSellerTier(score: number) {
  return SELLER_TIERS.find((t) => score >= t.minScore) ?? SELLER_TIERS[SELLER_TIERS.length - 1];
}

function getNextSellerTier(score: number) {
  const current = getSellerTier(score);
  const idx = SELLER_TIERS.indexOf(current);
  return idx > 0 ? SELLER_TIERS[idx - 1] : null;
}

// ═══════════════════════════════════════════════════
// Calculate Score for a Single Seller
// ═══════════════════════════════════════════════════

export const calculateScore = internalMutation({
  args: { sellerId: v.id("sellers") },
  handler: async (ctx, args) => {
    // Get all transactions for this seller
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.sellerId))
      .collect();

    const totalCalls = transactions.length;
    if (totalCalls === 0) {
      // No data — set to standard tier with base score
      const existing = await ctx.db
        .query("sellerScores")
        .withIndex("by_seller", (q) => q.eq("sellerId", args.sellerId))
        .first();

      const scoreData = {
        sellerId: args.sellerId,
        score: 100,
        tier: "standard" as SellerTierName,
        uptimePercent: 100,
        avgLatencyMs: 0,
        successRate: 100,
        totalCalls: 0,
        totalRevenue: 0,
        totalDisputes: 0,
        disputeRate: 0,
        lastCalculatedAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, scoreData);
      } else {
        await ctx.db.insert("sellerScores", scoreData);
      }
      return;
    }

    // Success rate: settled / (settled + failed)
    const settled = transactions.filter((t) => t.status === "settled").length;
    const failed = transactions.filter((t) => t.status === "failed").length;
    const successRate = (settled + failed) > 0
      ? (settled / (settled + failed)) * 100
      : 100;

    // Average latency
    const latencies = transactions
      .filter((t) => t.latencyMs != null && t.status === "settled")
      .map((t) => t.latencyMs!);
    const avgLatencyMs = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    // Total revenue
    const totalRevenue = transactions
      .filter((t) => t.status === "settled")
      .reduce((sum, t) => sum + t.amount, 0);

    // Disputes
    const disputes = await ctx.db
      .query("disputes")
      .collect();
    const sellerDisputes = disputes.filter((d) => {
      // Check if the dispute's transaction belongs to this seller
      const tx = transactions.find((t) => t._id === d.transactionId);
      return tx != null;
    });
    const totalDisputes = sellerDisputes.length;
    const disputeRate = totalCalls > 0 ? (totalDisputes / totalCalls) * 100 : 0;

    // Recency: decay based on last transaction
    const lastTx = transactions.reduce(
      (latest, t) => t.requestedAt > latest ? t.requestedAt : latest,
      0
    );
    const hoursSinceLastTx = (Date.now() - lastTx) / (1000 * 60 * 60);
    const recencyFactor = hoursSinceLastTx < 24 ? 1.0
      : hoursSinceLastTx < 168 ? 0.8 // 1 week
      : hoursSinceLastTx < 720 ? 0.5 // 30 days
      : 0.3;

    // Score calculation (0-1000)
    // Volume (30%): $1 = 5 points, max 300
    const volumeScore = Math.min(totalRevenue * 5, 300);
    // Success rate (25%): 100% = 250 points
    const successScore = (successRate / 100) * 250;
    // Latency (15%): < 100ms = 150pts, < 500ms = 100pts, > 2000ms = 0pts
    const latencyScore = avgLatencyMs <= 0 ? 75
      : avgLatencyMs < 100 ? 150
      : avgLatencyMs < 300 ? 120
      : avgLatencyMs < 500 ? 100
      : avgLatencyMs < 1000 ? 50
      : avgLatencyMs < 2000 ? 25
      : 0;
    // Dispute rate (15%): 0% = 150pts, 5%+ = 0pts
    const disputeScore = Math.max(0, 150 * (1 - (disputeRate / 5)));
    // Recency (15%): recent activity = more points
    const recencyScore = recencyFactor * 150;

    const rawScore = Math.round(
      volumeScore + successScore + latencyScore + disputeScore + recencyScore
    );
    const score = Math.min(rawScore, 1000);

    const tier = getSellerTier(score);
    const uptimePercent = successRate; // Uptime approximated by success rate

    const scoreData = {
      sellerId: args.sellerId,
      score,
      tier: tier.name,
      uptimePercent: Math.round(uptimePercent * 100) / 100,
      avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      totalCalls,
      totalRevenue: Math.round(totalRevenue * 10000) / 10000,
      totalDisputes,
      disputeRate: Math.round(disputeRate * 100) / 100,
      lastCalculatedAt: Date.now(),
    };

    // Upsert
    const existing = await ctx.db
      .query("sellerScores")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.sellerId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, scoreData);
    } else {
      await ctx.db.insert("sellerScores", scoreData);
    }
  },
});

// ═══════════════════════════════════════════════════
// Recalculate All Seller Scores (cron)
// ═══════════════════════════════════════════════════

export const recalculateAllScores = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sellers = await ctx.db.query("sellers").collect();

    // Process in batches to stay within Convex limits
    for (const seller of sellers.slice(0, 50)) {
      // Inline the calculation to avoid scheduling overhead
      const transactions = await ctx.db
        .query("transactions")
        .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
        .collect();

      const totalCalls = transactions.length;
      const settled = transactions.filter((t) => t.status === "settled").length;
      const failed = transactions.filter((t) => t.status === "failed").length;
      const successRate = (settled + failed) > 0 ? (settled / (settled + failed)) * 100 : 100;

      const latencies = transactions
        .filter((t) => t.latencyMs != null && t.status === "settled")
        .map((t) => t.latencyMs!);
      const avgLatencyMs = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

      const totalRevenue = transactions
        .filter((t) => t.status === "settled")
        .reduce((sum, t) => sum + t.amount, 0);

      const lastTx = transactions.reduce(
        (latest, t) => t.requestedAt > latest ? t.requestedAt : latest,
        0
      );
      const hoursSinceLastTx = totalCalls > 0 ? (Date.now() - lastTx) / 3_600_000 : 9999;
      const recencyFactor = hoursSinceLastTx < 24 ? 1.0
        : hoursSinceLastTx < 168 ? 0.8
        : hoursSinceLastTx < 720 ? 0.5
        : 0.3;

      const volumeScore = Math.min(totalRevenue * 5, 300);
      const successScore = (successRate / 100) * 250;
      const latencyScore = avgLatencyMs <= 0 ? 75
        : avgLatencyMs < 100 ? 150 : avgLatencyMs < 500 ? 100 : avgLatencyMs < 2000 ? 25 : 0;
      const disputeScore = 150; // Simplified for cron batch
      const recencyScore = recencyFactor * 150;

      const score = Math.min(
        Math.round(volumeScore + successScore + latencyScore + disputeScore + recencyScore),
        1000
      );
      const tier = getSellerTier(score);

      const scoreData = {
        sellerId: seller._id,
        score: totalCalls === 0 ? 100 : score,
        tier: totalCalls === 0 ? "standard" as SellerTierName : tier.name,
        uptimePercent: Math.round(successRate * 100) / 100,
        avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        totalCalls,
        totalRevenue: Math.round(totalRevenue * 10000) / 10000,
        totalDisputes: 0,
        disputeRate: 0,
        lastCalculatedAt: Date.now(),
      };

      const existing = await ctx.db
        .query("sellerScores")
        .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, scoreData);
      } else {
        await ctx.db.insert("sellerScores", scoreData);
      }
    }
  },
});

// ═══════════════════════════════════════════════════
// Public Queries
// ═══════════════════════════════════════════════════

export const getSellerScore = query({
  args: { sellerId: v.id("sellers") },
  handler: async (ctx, args) => {
    const score = await ctx.db
      .query("sellerScores")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.sellerId))
      .first();

    if (!score) {
      return {
        score: 100,
        tier: "standard",
        badge: null,
        featuredEligible: false,
        metrics: null,
        nextTier: { name: "reliable", minScore: 400, pointsNeeded: 300 },
      };
    }

    const tier = getSellerTier(score.score);
    const nextTier = getNextSellerTier(score.score);

    return {
      score: score.score,
      tier: tier.name,
      badge: tier.badge,
      featuredEligible: tier.featuredEligible,
      metrics: {
        uptimePercent: score.uptimePercent,
        avgLatencyMs: score.avgLatencyMs,
        successRate: score.successRate,
        totalCalls: score.totalCalls,
        totalRevenue: score.totalRevenue,
        totalDisputes: score.totalDisputes,
        disputeRate: score.disputeRate,
      },
      nextTier: nextTier
        ? {
            name: nextTier.name,
            minScore: nextTier.minScore,
            pointsNeeded: nextTier.minScore - score.score,
          }
        : null,
      lastCalculatedAt: score.lastCalculatedAt,
    };
  },
});

export const getSellerLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    const scores = await ctx.db
      .query("sellerScores")
      .withIndex("by_score")
      .order("desc")
      .take(limit);

    // Enrich with seller names
    return Promise.all(
      scores.map(async (s) => {
        const seller = await ctx.db.get(s.sellerId);
        return {
          sellerId: s.sellerId,
          sellerName: seller?.name ?? "Unknown",
          score: s.score,
          tier: s.tier,
          badge: getSellerTier(s.score).badge,
          metrics: {
            successRate: s.successRate,
            avgLatencyMs: s.avgLatencyMs,
            totalCalls: s.totalCalls,
            totalRevenue: s.totalRevenue,
            disputeRate: s.disputeRate,
          },
        };
      })
    );
  },
});
