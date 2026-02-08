import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { reputationCache } from "../cache";

const router = Router();

const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "https://cheery-parrot-104.convex.cloud";
const convex = new ConvexHttpClient(CONVEX_URL);

// Function references by string name — avoids importing convex/_generated/api
// which would pull all Convex source files into the seller-api TypeScript compilation
const gossipGetAgentProfile = makeFunctionReference<"query">("gossip:getAgentProfile");
const gossipGetTrending = makeFunctionReference<"query">("gossip:getTrending");
const gossipGetNetworkStats = makeFunctionReference<"query">("gossip:getNetworkStats");

const CACHE_TTL = 120_000; // 2 minutes

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// Trust score: 0-100 based on activity
function computeTrustScore(profile: any): number {
  if (!profile) return 0;

  let score = 50; // Base score

  // +1 per unique endpoint (max +15)
  score += Math.min(profile.uniqueEndpoints || 0, 15);

  // +0.1 per transaction (max +15)
  score += Math.min(Math.round((profile.totalTransactions || 0) * 0.1), 15);

  // +10 if active in last 24h
  const oneDayAgo = Date.now() - 86_400_000;
  if (profile.lastActive && profile.lastActive > oneDayAgo) {
    score += 10;
  }

  // +5 per active day (max +10)
  score += Math.min((profile.activeDays || 0) * 5, 10);

  // -10 if mutation rate is suspiciously high (>50%)
  if (profile.mutationRate && profile.mutationRate > 0.5) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function getTier(score: number): string {
  if (score >= 80) return "elite";
  if (score >= 60) return "trusted";
  if (score >= 40) return "active";
  if (score >= 20) return "new";
  return "unknown";
}

// GET /api/reputation/agent/:agentId
router.get("/api/reputation/agent/:agentId", async (req: Request, res: Response) => {
  const { agentId } = req.params;
  if (!agentId) {
    return res.status(400).json({ error: "Missing agentId parameter" });
  }

  const cacheKey = `reputation:agent:${agentId}`;
  const cached = reputationCache.get<any>(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });
  }

  try {
    const profile = await convex.query(gossipGetAgentProfile, { agentId });

    if (!profile) {
      return res.json({
        agentId,
        trustScore: 0,
        tier: "unknown",
        profile: null,
        message: "No activity found for this agent",
        cached: false,
        payment: formatPayment(getX402Context(req)),
      });
    }

    const trustScore = computeTrustScore(profile);
    const tier = getTier(trustScore);

    const payload = {
      agentId,
      trustScore,
      tier,
      profile: {
        totalTransactions: profile.totalTransactions,
        totalSpent: profile.totalSpent,
        avgSpendPerTx: profile.avgSpendPerTx,
        uniqueEndpoints: profile.uniqueEndpoints,
        chains: profile.chains,
        preferredChain: profile.preferredChain,
        mutations: profile.mutations,
        mutationRate: profile.mutationRate,
        activeDays: profile.activeDays,
        firstActive: profile.firstActive,
        lastActive: profile.lastActive,
      },
      frequentEndpoints: profile.frequentEndpoints,
    };

    reputationCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Reputation service unavailable", details: (err as Error).message });
  }
});

// GET /api/reputation/trending
router.get("/api/reputation/trending", async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);
  const cacheKey = `reputation:trending:${limit}`;

  const cached = reputationCache.get<any>(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });
  }

  try {
    const [trending, networkStats] = await Promise.all([
      convex.query(gossipGetTrending, { limit }),
      convex.query(gossipGetNetworkStats, {}),
    ]);

    const payload = {
      trending: (trending || []).map((t: any) => ({
        endpoint: t.endpoint,
        host: t.host,
        discoveries: t.discoveries,
        uniqueAgents: t.uniqueAgents,
        totalVolume: t.totalVolume,
        avgLatencyMs: t.avgLatencyMs,
        trendingScore: t.trendingScore,
        chains: t.chains,
        lastSeen: t.lastSeen,
      })),
      networkStats: networkStats || {},
    };

    reputationCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Trending service unavailable", details: (err as Error).message });
  }
});

export default router;
