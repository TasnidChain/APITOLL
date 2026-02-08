import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../../convex/_generated/api";

/**
 * Agent Evolution State — POST & GET /api/agents/evolve
 *
 * Lets agents persist their evolution/mutation state server-side
 * so it survives across sessions and deploys.
 *
 * POST: Save evolution state + mutation events
 * GET:  Retrieve saved state for an agent
 *
 * No auth required — agents call this autonomously.
 */

const CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  "https://cheery-parrot-104.convex.cloud";

const convex = new ConvexHttpClient(CONVEX_URL);

// ---------------------------------------------------------------------------
// In-memory evolution store (will be replaced by Convex table later)
// ---------------------------------------------------------------------------

const evolutionStore = new Map<
  string,
  { state: any; mutations: any[]; updatedAt: number }
>();

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

function getLeaderboard(topN: number = 10) {
  const entries: {
    agent_id: string;
    mutation_count: number;
    mutation_depth: number;
    last_active: number;
  }[] = [];

  for (const [agentId, data] of Array.from(evolutionStore.entries())) {
    entries.push({
      agent_id: agentId,
      mutation_count: data.mutations.length,
      mutation_depth: data.state?.mutationDepth ?? data.mutations.length,
      last_active: data.updatedAt,
    });
  }

  entries.sort((a, b) => b.mutation_count - a.mutation_count);
  return entries.slice(0, topN);
}

function getAgentRank(agentId: string): number {
  const leaderboard = getLeaderboard(1000); // get all to find rank
  const idx = leaderboard.findIndex((e) => e.agent_id === agentId);
  return idx === -1 ? leaderboard.length + 1 : idx + 1;
}

// ---------------------------------------------------------------------------
// GET /api/agents/evolve — Retrieve saved evolution state
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
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

    const saved = evolutionStore.get(agentId);
    const leaderboard = getLeaderboard(10);

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
    // Update in-memory store
    // ------------------------------------------------------------------
    const existing = evolutionStore.get(agent_id);
    const now = Date.now();

    const newMutations = Array.isArray(mutations) ? mutations : [];
    const mergedMutations = existing
      ? [...existing.mutations, ...newMutations]
      : newMutations;

    const mergedState = state ?? existing?.state ?? DEFAULT_STATE;

    evolutionStore.set(agent_id, {
      state: mergedState,
      mutations: mergedMutations,
      updatedAt: now,
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
    // Build response
    // ------------------------------------------------------------------
    const mutationDepth = mergedState.mutationDepth ?? mergedMutations.length;
    const rank = getAgentRank(agent_id);
    const leaderboard = getLeaderboard(10);

    return NextResponse.json({
      saved: true,
      agent_id,
      mutation_depth: mutationDepth,
      rank,
      leaderboard,
      network_mutations: networkMutations,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to save evolution state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
