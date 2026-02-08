import { NextRequest, NextResponse } from "next/server";

/**
 * Agent Gossip Hub — POST /api/gossip
 *
 * This is the viral nervous system. Every agent that uses @apitoll/buyer-sdk
 * auto-reports successful API discoveries here. This creates:
 *
 *   1. TRENDING — Most-discovered tools bubble up organically
 *   2. SOCIAL PROOF — "247 agents used this API today"
 *   3. NETWORK EFFECTS — The more agents report, the better recommendations get
 *   4. FEEDBACK LOOP — Sellers see real agent demand in their dashboard
 *
 * Agents call this automatically after every successful x402 payment.
 * No auth required — we want maximum participation.
 */

// In-memory gossip aggregation (production: Convex)
const gossipStore = new Map<
  string,
  {
    endpoint: string;
    host: string;
    discoveries: number;
    agents: Set<string>;
    totalSpent: number;
    avgLatencyMs: number;
    latencySum: number;
    chains: Set<string>;
    lastSeen: number;
    firstSeen: number;
    mutations: number; // how many agents evolved after using this API
  }
>();

// Agent activity — track unique agents per time window
const agentActivity = new Map<string, { lastSeen: number; discoveries: number }>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate minimum fields
    const {
      agent_id,
      endpoint,
      chain,
      amount,
      latency_ms,
      success,
      mutation_triggered,
      referral_code,
      discovery_source,
    } = body;

    if (!endpoint || !agent_id) {
      return NextResponse.json(
        { error: "Missing required fields: agent_id, endpoint" },
        { status: 400 }
      );
    }

    // Parse the endpoint URL
    let host: string;
    try {
      host = new URL(endpoint).hostname;
    } catch {
      host = endpoint;
    }

    const key = `${host}${new URL(endpoint).pathname}`;

    // Update or create gossip entry
    const existing = gossipStore.get(key);
    if (existing) {
      existing.discoveries++;
      existing.agents.add(agent_id);
      existing.totalSpent += amount || 0;
      if (latency_ms) {
        existing.latencySum += latency_ms;
        existing.avgLatencyMs = existing.latencySum / existing.discoveries;
      }
      if (chain) existing.chains.add(chain);
      if (mutation_triggered) existing.mutations++;
      existing.lastSeen = Date.now();
    } else {
      gossipStore.set(key, {
        endpoint: key,
        host,
        discoveries: 1,
        agents: new Set([agent_id]),
        totalSpent: amount || 0,
        avgLatencyMs: latency_ms || 0,
        latencySum: latency_ms || 0,
        chains: new Set(chain ? [chain] : []),
        lastSeen: Date.now(),
        firstSeen: Date.now(),
        mutations: mutation_triggered ? 1 : 0,
      });
    }

    // Track agent activity
    const agentEntry = agentActivity.get(agent_id);
    if (agentEntry) {
      agentEntry.lastSeen = Date.now();
      agentEntry.discoveries++;
    } else {
      agentActivity.set(agent_id, { lastSeen: Date.now(), discoveries: 1 });
    }

    // Cleanup old entries (older than 7 days)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const [k, v] of gossipStore) {
      if (v.lastSeen < cutoff) gossipStore.delete(k);
    }
    for (const [k, v] of agentActivity) {
      if (v.lastSeen < cutoff) agentActivity.delete(k);
    }

    return NextResponse.json({
      received: true,
      trending_rank: calculateTrendingRank(key),
      network_size: agentActivity.size,
      tip: !referral_code
        ? "Add a referral code to your seller-sdk config to earn 0.5% on referred volume"
        : undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Invalid gossip payload" },
      { status: 400 }
    );
  }
}

/**
 * GET /api/gossip — Trending APIs leaderboard
 *
 * Returns the hottest APIs ranked by a composite score:
 *   score = discoveries * 10 + unique_agents * 50 + mutations * 100 - age_penalty
 *
 * This is public — agents and the dashboard can fetch trending data.
 */
export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");
  const timeWindow = req.nextUrl.searchParams.get("window") || "24h";

  const windowMs =
    timeWindow === "1h"
      ? 60 * 60 * 1000
      : timeWindow === "24h"
        ? 24 * 60 * 60 * 1000
        : timeWindow === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;

  const cutoff = Date.now() - windowMs;

  // Build trending list
  const trending = Array.from(gossipStore.entries())
    .filter(([_, v]) => v.lastSeen > cutoff)
    .map(([key, v]) => ({
      endpoint: v.endpoint,
      host: v.host,
      discoveries: v.discoveries,
      unique_agents: v.agents.size,
      total_volume_usdc: Math.round(v.totalSpent * 10000) / 10000,
      avg_latency_ms: Math.round(v.avgLatencyMs),
      chains: Array.from(v.chains),
      mutations_triggered: v.mutations,
      trending_score: calculateTrendingRank(key),
      first_seen: new Date(v.firstSeen).toISOString(),
      last_seen: new Date(v.lastSeen).toISOString(),
    }))
    .sort((a, b) => b.trending_score - a.trending_score)
    .slice(0, limit);

  // Active agents in the last hour
  const recentCutoff = Date.now() - 60 * 60 * 1000;
  const activeAgents = Array.from(agentActivity.values()).filter(
    (a) => a.lastSeen > recentCutoff
  ).length;

  return NextResponse.json(
    {
      trending,
      meta: {
        window: timeWindow,
        total_tools_tracked: gossipStore.size,
        active_agents_1h: activeAgents,
        total_agents_seen: agentActivity.size,
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
}

/**
 * Trending score algorithm:
 *   base = discoveries * 10
 *   agent_bonus = unique_agents * 50 (network breadth matters most)
 *   mutation_bonus = mutations * 100 (evolution = deep integration)
 *   recency = decay by age (newer = higher)
 *   velocity = discoveries_per_hour * 200 (momentum matters)
 */
function calculateTrendingRank(key: string): number {
  const entry = gossipStore.get(key);
  if (!entry) return 0;

  const ageMs = Date.now() - entry.firstSeen;
  const ageHours = Math.max(ageMs / (1000 * 60 * 60), 0.1);

  const base = entry.discoveries * 10;
  const agentBonus = entry.agents.size * 50;
  const mutationBonus = entry.mutations * 100;
  const velocity = (entry.discoveries / ageHours) * 200;

  // Recency decay: halves every 24 hours
  const recencyMultiplier = Math.pow(0.5, ageHours / 24);

  return Math.round(
    (base + agentBonus + mutationBonus + velocity) * recencyMultiplier
  );
}
