import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../../convex/_generated/api";
import { convex } from "@/lib/convex-client";

/**
 * Agent Evolution State — POST & GET /api/agents/evolve
 *
 * Lets agents persist their evolution/mutation state server-side
 * so it survives across sessions and deploys.
 *
 * POST: Save evolution state + mutation events (via Convex)
 * GET:  Retrieve saved state for an agent (via Convex)
 *
 * No auth required — agents call this autonomously.
 */

// ---------------------------------------------------------------------------
// Rate limiting — simple in-memory counter, max 50 requests/minute per IP
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 50;
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
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_STATE = {
  mutationDepth: 0,
  generation: 1,
  fitness: 0,
  traits: [],
  lastMutationAt: null,
};

// ---------------------------------------------------------------------------
// GET /api/agents/evolve — Retrieve saved evolution state
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // Rate limit check
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 50 requests per minute." },
      { status: 429 }
    );
  }

  try {
    const agentId = req.nextUrl.searchParams.get("agent");

    if (!agentId) {
      return NextResponse.json(
        {
          error: "Missing required query parameter: agent",
          example: "/api/agents/evolve?agent=ResearchBot-base",
        },
        { status: 400 }
      );
    }

    // Fetch state and leaderboard from Convex in parallel
    const [saved, leaderboard] = await Promise.all([
      convex.query(api.evolution.getState, { agentId }),
      convex.query(api.evolution.getLeaderboard, { limit: 10 }),
    ]);

    if (saved) {
      return NextResponse.json({
        agent_id: agentId,
        state: saved.state,
        mutations_count: saved.mutations.length,
        leaderboard,
        tip: "Enable evolution in buyer-sdk: createAgentWallet({ evolution: true })",
      });
    }

    // No saved state — return default starter state
    return NextResponse.json({
      agent_id: agentId,
      state: DEFAULT_STATE,
      mutations_count: 0,
      leaderboard,
      tip: "Enable evolution in buyer-sdk: createAgentWallet({ evolution: true })",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve evolution state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/agents/evolve — Save evolution state + mutations
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Rate limit check
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 50 requests per minute." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    const { agent_id, state, mutations } = body;

    // Validate required fields
    if (!agent_id) {
      return NextResponse.json(
        {
          error: "Missing required field: agent_id",
          expected: {
            agent_id: "ResearchBot-base",
            state: { "...MutatorState": true },
            mutations: ["...MutationEvent[]"],
          },
        },
        { status: 400 }
      );
    }

    if (!state && !mutations) {
      return NextResponse.json(
        {
          error: "Must provide at least one of: state, mutations",
        },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------
    // Save evolution state to Convex
    // ------------------------------------------------------------------
    const newMutations = Array.isArray(mutations) ? mutations : [];

    const saveResult = await convex.mutation(api.evolution.saveState, {
      agentId: agent_id,
      state: state ?? undefined,
      mutations: newMutations.length > 0 ? newMutations : undefined,
    });

    // ------------------------------------------------------------------
    // Record gossip event for the mutation (so network stats reflect it)
    // ------------------------------------------------------------------
    let networkMutations = 0;
    try {
      await convex.mutation(api.gossip.recordGossip, {
        agentId: agent_id,
        endpoint: `evolve://${agent_id}`,
        host: "apitoll.com",
        chain: "base" as const,
        amount: 0,
        latencyMs: 0,
        mutationTriggered: true,
      });

      // Fetch network-wide mutation count
      const stats = await convex.query(api.gossip.getNetworkStats, {});
      networkMutations = stats.total_mutations ?? 0;
    } catch {
      // Gossip recording is best-effort; don't fail the evolve call
    }

    // ------------------------------------------------------------------
    // Fetch leaderboard from Convex for rank + leaderboard response
    // ------------------------------------------------------------------
    const leaderboard = await convex.query(api.evolution.getLeaderboard, { limit: 10 });

    const rank = leaderboard.findIndex((e) => e.agent_id === agent_id);
    const agentRank = rank === -1 ? leaderboard.length + 1 : rank + 1;

    return NextResponse.json({
      saved: true,
      agent_id,
      mutation_depth: saveResult.mutationDepth,
      rank: agentRank,
      leaderboard,
      network_mutations: networkMutations,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to save evolution state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
