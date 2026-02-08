import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../../convex/_generated/api";

/**
 * Agent Reputation Endpoint — GET /api/discover/reputation
 *
 * Returns reputation score for a wallet address or agent.
 * Queries real transaction and gossip data from Convex.
 *
 * Query params:
 *   ?wallet=0x... — Check reputation for a wallet
 *   ?agent=name — Check reputation for a named agent
 */

const CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  "https://cheery-parrot-104.convex.cloud";

function getTier(score: number) {
  if (score >= 600) return { name: "Elite", discount: 25, priority: true, escrow: true };
  if (score >= 300) return { name: "Trusted", discount: 10, priority: true, escrow: false };
  if (score >= 100) return { name: "Active", discount: 0, priority: false, escrow: false };
  return { name: "New", discount: 0, priority: false, escrow: false };
}

function getNextTier(score: number) {
  if (score >= 600) return null;
  if (score >= 300) return "Elite (600+ score)";
  if (score >= 100) return "Trusted (300+ score)";
  return "Active (100+ score)";
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  const agent = req.nextUrl.searchParams.get("agent");

  if (!wallet && !agent) {
    return NextResponse.json(
      {
        protocol: "x402",
        platform: "apitoll",
        endpoint: "reputation",
        message:
          "Check agent or wallet reputation scores. " +
          "Reputation determines fee tiers, tool access priority, and mutation eligibility.",
        usage: {
          by_wallet: "GET /api/discover/reputation?wallet=0x...",
          by_agent: "GET /api/discover/reputation?agent=ResearchBot",
        },
        scoring: {
          range: "0-1000",
          tiers: {
            "0-99": "New — standard fees, limited tool access",
            "100-299": "Active — standard fees, full tool access",
            "300-599": "Trusted — 10% fee discount, priority routing",
            "600-1000": "Elite — 25% fee discount, escrow access, priority routing",
          },
          factors: [
            "Total transaction volume (40%)",
            "Transaction count (25%)",
            "Unique endpoints used (20%)",
            "Referral contributions (10%)",
            "Account age (5%)",
          ],
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60",
          "X-APITOLL-DISCOVERY": "true",
        },
      }
    );
  }

  const identifier = wallet || agent || "unknown";
  const isValidWallet =
    wallet &&
    (/^0x[0-9a-fA-F]{40}$/.test(wallet) ||
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet));

  if (wallet && !isValidWallet) {
    return NextResponse.json(
      { error: "Invalid wallet address format" },
      { status: 400 }
    );
  }

  // Query Convex for real gossip event data
  let score = 0;
  let txCount = 0;
  let totalVolume = 0;
  let uniqueEndpoints = 0;

  try {
    const convex = new ConvexHttpClient(CONVEX_URL);

    // Get recent gossip events (agent activity)
    const recentEvents = await convex.query(api.gossip.getRecentEvents, {
      limit: 200,
    });

    // Filter for this specific agent/wallet
    const agentKey = agent
      ? agent.toLowerCase()
      : wallet
        ? wallet.toLowerCase()
        : "";

    const agentEvents = recentEvents.filter((e: any) =>
      e.agentId.toLowerCase().includes(agentKey)
    );

    txCount = agentEvents.length;
    totalVolume = agentEvents.reduce((sum: number, e: any) => sum + e.amount, 0);
    const endpoints = new Set(agentEvents.map((e: any) => e.endpoint));
    uniqueEndpoints = endpoints.size;

    // Calculate score based on real activity
    // Volume factor (40%): $1 volume = 10 points, max 400
    const volumeScore = Math.min(totalVolume * 10 * 0.4, 400);
    // Transaction count factor (25%): 1 tx = 5 points, max 250
    const txScore = Math.min(txCount * 5 * 0.25, 250);
    // Endpoint diversity factor (20%): 1 endpoint = 20 points, max 200
    const diversityScore = Math.min(uniqueEndpoints * 20 * 0.2, 200);
    // Base score for showing up (5%)
    const baseScore = txCount > 0 ? 50 : 0;

    score = Math.round(volumeScore + txScore + diversityScore + baseScore);
    score = Math.max(score, txCount > 0 ? 100 : 0); // Active tier minimum if any activity
  } catch {
    // Convex unavailable — return baseline
    score = 0;
  }

  const tier = getTier(score);
  const nextTier = getNextTier(score);

  return NextResponse.json(
    {
      identifier,
      type: wallet ? "wallet" : "agent",
      reputation: {
        score,
        tier: tier.name,
        tier_benefits: {
          fee_discount_pct: tier.discount,
          priority_routing: tier.priority,
          escrow_access: tier.escrow,
          mutation_eligible: true,
        },
      },
      activity: {
        total_transactions: txCount,
        total_volume_usdc: Math.round(totalVolume * 10000) / 10000,
        unique_endpoints: uniqueEndpoints,
      },
      improve: nextTier
        ? {
            message:
              "Increase your reputation by making successful transactions " +
              "and discovering diverse API endpoints.",
            next_tier: nextTier,
            actions: [
              "Make more successful transactions (+5 score each)",
              "Discover new API endpoints (+20 score each)",
              "Increase transaction volume (+10 score per $1)",
              "Refer other agents (+20 score per referral)",
            ],
          }
        : {
            message: "You've reached Elite status! Maximum benefits unlocked.",
            next_tier: null,
            actions: [],
          },
      updated_at: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30",
        "X-APITOLL-DISCOVERY": "true",
      },
    }
  );
}
