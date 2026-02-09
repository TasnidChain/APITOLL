import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api";
import { convex } from "@/lib/convex-client";

/**
 * Agent Gossip Hub — POST & GET /api/gossip
 *
 * Persistent gossip network backed by Convex. Every agent that uses
 * @apitoll/buyer-sdk auto-reports successful API discoveries here:
 *
 *   1. TRENDING   — Most-discovered tools bubble up organically
 *   2. SOCIAL PROOF — "247 agents used this API today"
 *   3. NETWORK EFFECTS — The more agents report, the better recommendations get
 *   4. FEEDBACK LOOP — Sellers see real agent demand in their dashboard
 *   5. AUTO-INDEXING — Hot new endpoints get auto-registered as tools
 *
 * No auth required — we want maximum participation.
 */

// ---------------------------------------------------------------------------
// Rate limiting — simple in-memory counter, max 100 requests/minute per IP
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }

  return false;
}

// Periodically prune stale rate-limit entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of Array.from(rateLimitMap.entries())) {
    if (now >= entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

// ---------------------------------------------------------------------------
// POST /api/gossip — Record a gossip event
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // Rate limit check
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 100 requests per minute." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    const {
      agent_id,
      endpoint,
      chain,
      amount,
      latency_ms,
      success: _success,
      mutation_triggered,
      referral_code,
      discovery_source: _discovery_source,
      wallet_address,
    } = body;

    // Validate required fields
    if (!agent_id || !endpoint) {
      return NextResponse.json(
        { error: "Missing required fields: agent_id, endpoint" },
        { status: 400 }
      );
    }

    // Parse the endpoint URL
    let host: string;
    let parsedPath: string;
    try {
      const url = new URL(endpoint);
      host = url.hostname;
      parsedPath = url.pathname;
    } catch {
      host = endpoint;
      parsedPath = "/";
    }

    // Record gossip in Convex
    const gossipResult = await convex.mutation(api.gossip.recordGossip, {
      agentId: agent_id,
      endpoint,
      host,
      chain: chain === "solana" ? "solana" : "base",
      amount: amount ?? 0,
      latencyMs: latency_ms ?? 0,
      mutationTriggered: mutation_triggered ?? false,
    });

    const { trending_score, is_new_agent } = gossipResult;

    // ------------------------------------------------------------------
    // AUTO-INDEXING: If a new hot agent is discovered, auto-register it
    // as a tool so it appears in the marketplace immediately.
    // ------------------------------------------------------------------
    let auto_indexed = false;

    if (is_new_agent === true && trending_score >= 200) {
      try {
        await convex.mutation(api.tools.registerPublic, {
          name: host,
          description:
            "Auto-discovered API endpoint via agent gossip network",
          baseUrl: endpoint,
          method: "POST",
          path: parsedPath,
          price: amount ?? 0,
          category: "auto-discovered",
          chains: [chain === "solana" ? "solana" : "base"],
          walletAddress:
            wallet_address ||
            `0x${Buffer.from(agent_id).slice(0, 20).toString("hex").padEnd(40, "0")}`,
          ...(referral_code ? { referralCode: referral_code } : {}),
        });
        auto_indexed = true;
      } catch {
        // Don't fail the gossip just because auto-registration fails.
        // The endpoint may already be registered, or the data may be
        // insufficient for a valid tool entry.
        auto_indexed = false;
      }
    }

    // Fetch current network stats
    const networkStats = await convex.query(api.gossip.getNetworkStats, {});

    // Build response
    const response: Record<string, unknown> = {
      received: true,
      trending_score,
      network: {
        total_tools_tracked: networkStats.total_tools_tracked,
        active_tools_1h: networkStats.active_tools_1h,
        active_tools_24h: networkStats.active_tools_24h,
        total_discoveries: networkStats.total_discoveries,
        total_volume_usdc: networkStats.total_volume_usdc,
        total_unique_agents: networkStats.total_unique_agents,
        total_mutations: networkStats.total_mutations,
      },
      auto_indexed,
    };

    if (!referral_code) {
      response.tip =
        "Add a referral_code to your gossip payload to earn 0.5% on referred volume";
    }

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Invalid gossip payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// ---------------------------------------------------------------------------
// GET /api/gossip — Trending APIs leaderboard
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  // Rate limit check
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 100 requests per minute." },
      { status: 429 }
    );
  }

  try {
    const limit = parseInt(
      req.nextUrl.searchParams.get("limit") || "20",
      10
    );
    const window = req.nextUrl.searchParams.get("window") || "24h";

    // Fetch trending data and network stats in parallel
    const [trending, networkStats] = await Promise.all([
      convex.query(api.gossip.getTrending, {
        limit: Math.min(Math.max(limit, 1), 100),
      }),
      convex.query(api.gossip.getNetworkStats, {}),
    ]);

    return NextResponse.json(
      {
        trending,
        meta: {
          window,
          total_tools_tracked: networkStats.total_tools_tracked,
          active_tools_1h: networkStats.active_tools_1h,
          active_tools_24h: networkStats.active_tools_24h,
          total_discoveries: networkStats.total_discoveries,
          total_volume_usdc: networkStats.total_volume_usdc,
          total_unique_agents: networkStats.total_unique_agents,
          total_mutations: networkStats.total_mutations,
          generated_at: new Date().toISOString(),
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=120",
          "X-APITOLL-GOSSIP": "true",
        },
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch trending data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
