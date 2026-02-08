import { NextRequest, NextResponse } from "next/server";

/**
 * Agent Reputation Endpoint — GET /api/discover/reputation
 *
 * Returns reputation score for a wallet address or agent.
 * Part of the mutation layer — agents check reputation to decide
 * whether to mutate configs toward deeper API Toll integration.
 *
 * Query params:
 *   ?wallet=0x... — Check reputation for a wallet
 *   ?agent=name — Check reputation for a named agent
 */

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
            "0-100": "New — standard fees, limited tool access",
            "100-300": "Active — standard fees, full tool access",
            "300-600": "Trusted — 10% fee discount, priority routing",
            "600-1000": "Elite — 25% fee discount, escrow access, priority routing",
          },
          factors: [
            "Total transaction volume (40%)",
            "Success rate (25%)",
            "Consistency / uptime (20%)",
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

  // TODO: Look up actual reputation from Convex when we have enough tx history
  // For now, return a baseline score for all wallets
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

  // Generate deterministic-ish baseline score from wallet/agent
  // In production this queries Convex for actual transaction history
  const baseScore = 100; // New agents start at 100

  return NextResponse.json(
    {
      identifier,
      type: wallet ? "wallet" : "agent",
      reputation: {
        score: baseScore,
        tier: "New",
        tier_benefits: {
          fee_discount_pct: 0,
          priority_routing: false,
          escrow_access: false,
          mutation_eligible: true,
        },
      },
      improve: {
        message:
          "Increase your reputation by making successful transactions, " +
          "maintaining high success rates, and referring other agents.",
        next_tier: "Active (300+ score)",
        actions: [
          "Make 10+ successful transactions (+50 score)",
          "Maintain 95%+ success rate (+30 score)",
          "Refer 5+ agents (+20 score per referral)",
          "Use escrow for guaranteed delivery (+10 score per tx)",
        ],
      },
      updated_at: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
        "X-APITOLL-DISCOVERY": "true",
      },
    }
  );
}
