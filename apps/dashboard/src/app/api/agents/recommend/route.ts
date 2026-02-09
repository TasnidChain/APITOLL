import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../../convex/_generated/api";
import { convex } from "@/lib/convex-client";

/**
 * Agent Recommendations — GET /api/agents/recommend
 *
 * Personalized tool recommendations for agents. Combines:
 *   - Agent gossip history (inferred preferences)
 *   - Trending tools across the network
 *   - Category/chain/budget filters
 *
 * No auth required — agents call this autonomously.
 */

// Rate limiting — 50 requests/minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Prune stale entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of Array.from(rateLimitMap.entries())) {
    if (now >= entry.resetAt) rateLimitMap.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface GossipEvent {
  agentId: string;
  endpoint: string;
  chain: string;
  amount: number;
  latencyMs: number;
  mutationTriggered: boolean;
  createdAt: number;
}

interface ToolData {
  _id: string;
  name: string;
  slug: string;
  description: string;
  baseUrl: string;
  method: string;
  path: string;
  price: number;
  currency?: string;
  chains: string[];
  category: string;
  rating?: number;
  totalCalls?: number;
  isVerified?: boolean;
}

interface AgentProfile {
  topCategory: string | null;
  preferredChain: string | null;
  avgSpend: number;
  frequentEndpoints: Set<string>;
  totalEvents: number;
}

function buildAgentProfile(events: GossipEvent[], agentId: string): AgentProfile {
  const agentEvents = events.filter((e) => e.agentId === agentId);

  if (agentEvents.length === 0) {
    return {
      topCategory: null,
      preferredChain: null,
      avgSpend: 0,
      frequentEndpoints: new Set(),
      totalEvents: 0,
    };
  }

  // Count endpoint frequencies
  const endpointCounts = new Map<string, number>();
  for (const e of agentEvents) {
    endpointCounts.set(e.endpoint, (endpointCounts.get(e.endpoint) || 0) + 1);
  }

  // Frequent endpoints = used more than 3 times
  const frequentEndpoints = new Set<string>();
  for (const [ep, count] of Array.from(endpointCounts.entries())) {
    if (count >= 3) frequentEndpoints.add(ep);
  }

  // Preferred chain (most used)
  const chainCounts = new Map<string, number>();
  for (const e of agentEvents) {
    chainCounts.set(e.chain, (chainCounts.get(e.chain) || 0) + 1);
  }
  let preferredChain: string | null = null;
  let maxChainCount = 0;
  for (const [chain, count] of Array.from(chainCounts.entries())) {
    if (count > maxChainCount) {
      maxChainCount = count;
      preferredChain = chain;
    }
  }

  // Average spend
  const totalSpend = agentEvents.reduce(
    (sum: number, e) => sum + (e.amount || 0),
    0
  );
  const avgSpend = totalSpend / agentEvents.length;

  // Try to infer top category from endpoint patterns
  // We'll use this later when matching against tools
  // For now, store null and match against tool categories during scoring
  return {
    topCategory: null, // will be inferred from tool matches
    preferredChain,
    avgSpend,
    frequentEndpoints,
    totalEvents: agentEvents.length,
  };
}

function inferCategoryFromEndpoints(
  frequentEndpoints: Set<string>,
  tools: ToolData[]
): string | null {
  const categoryCounts = new Map<string, number>();
  for (const tool of tools) {
    const toolUrl = `${tool.baseUrl}${tool.path}`;
    if (frequentEndpoints.has(toolUrl) || frequentEndpoints.has(tool.baseUrl)) {
      categoryCounts.set(
        tool.category,
        (categoryCounts.get(tool.category) || 0) + 1
      );
    }
  }
  let topCategory: string | null = null;
  let maxCount = 0;
  for (const [cat, count] of Array.from(categoryCounts.entries())) {
    if (count > maxCount) {
      maxCount = count;
      topCategory = cat;
    }
  }
  return topCategory;
}

// ---------------------------------------------------------------------------
// GET /api/agents/recommend
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Rate limit exceeded. Max 50 requests per minute." }, { status: 429 });
    }

    const params = req.nextUrl.searchParams;
    const agentId = params.get("agent") || null;
    const chainFilter = params.get("chain") || null;
    const categoryFilter = params.get("category") || null;
    const budgetFilter = params.get("budget")
      ? parseFloat(params.get("budget")!)
      : null;
    const limit = Math.min(
      Math.max(parseInt(params.get("limit") || "10", 10), 1),
      50
    );

    // ------------------------------------------------------------------
    // 1. Build agent profile from gossip history (if agent param provided)
    // ------------------------------------------------------------------
    let agentProfile: AgentProfile | null = null;
    let agentHistoryUsed = false;

    if (agentId) {
      try {
        const recentEvents = await convex.query(api.gossip.getRecentEvents, {
          limit: 200,
        });
        agentProfile = buildAgentProfile(recentEvents, agentId);
        agentHistoryUsed = agentProfile.totalEvents > 0;
      } catch {
        // If gossip fetch fails, continue without agent history
        agentProfile = null;
      }
    }

    // ------------------------------------------------------------------
    // 2. Fetch tools with filters from params + inferred preferences
    // ------------------------------------------------------------------
    const effectiveCategory =
      categoryFilter ||
      (agentProfile?.topCategory ?? null);
    const effectiveChains: string[] = [];
    if (chainFilter) effectiveChains.push(chainFilter);
    else if (agentProfile?.preferredChain)
      effectiveChains.push(agentProfile.preferredChain);

    let tools: ToolData[] = [];
    try {
      tools = await convex.query(api.tools.search, {
        category: effectiveCategory ?? undefined,
        maxPrice: budgetFilter ?? undefined,
        chains:
          effectiveChains.length > 0 ? effectiveChains : undefined,
        limit: 100, // fetch more than needed so we can score and filter
      });
    } catch {
      tools = [];
    }

    // If category filter yielded few results, also fetch unfiltered tools
    if (tools.length < limit) {
      try {
        const moreTools = await convex.query(api.tools.search, {
          maxPrice: budgetFilter ?? undefined,
          limit: 100,
        });
        // Merge without duplicates
        const seenIds = new Set(tools.map((t) => t._id));
        for (const t of moreTools) {
          if (!seenIds.has(t._id)) {
            tools.push(t);
            seenIds.add(t._id);
          }
        }
      } catch {
        // continue with what we have
      }
    }

    // ------------------------------------------------------------------
    // 3. Fetch trending tools
    // ------------------------------------------------------------------
    const trendingMap = new Map<string, number>();
    try {
      const trending = await convex.query(api.gossip.getTrending, {
        limit: 20,
      });
      for (const t of trending) {
        trendingMap.set(t.endpoint, t.trendingScore ?? 0);
      }
    } catch {
      // continue without trending data
    }

    // Infer agent's top category from tool matches (now that we have tools)
    if (agentProfile && agentProfile.frequentEndpoints.size > 0) {
      const inferredCategory = inferCategoryFromEndpoints(
        agentProfile.frequentEndpoints,
        tools
      );
      if (inferredCategory) {
        agentProfile.topCategory = inferredCategory;
      }
    }

    // ------------------------------------------------------------------
    // 4. Score each tool
    // ------------------------------------------------------------------
    const scored = tools.map((tool) => {
      let score = 0;

      // +100 if tool category matches agent's most-used category
      if (
        agentProfile?.topCategory &&
        tool.category === agentProfile.topCategory
      ) {
        score += 100;
      }

      // +50 if tool's chain matches agent's preferred chain
      if (agentProfile?.preferredChain) {
        if (
          tool.chains &&
          tool.chains.includes(agentProfile.preferredChain)
        ) {
          score += 50;
        }
      }

      // +trending_score/10 for trending tools
      const toolEndpoint = `${tool.baseUrl}${tool.path}`;
      const trendingScore =
        trendingMap.get(toolEndpoint) || trendingMap.get(tool.baseUrl) || 0;
      score += Math.round(trendingScore / 10);

      // +rating * 20 for highly rated tools
      score += Math.round((tool.rating ?? 0) * 20);

      // -50 if agent already frequently uses this endpoint
      if (agentProfile?.frequentEndpoints.has(toolEndpoint)) {
        score -= 50;
      }

      return {
        id: tool._id,
        name: tool.name,
        slug: tool.slug,
        description: tool.description,
        category: tool.category,
        price: tool.price,
        currency: tool.currency ?? "USDC",
        chains: tool.chains,
        rating: tool.rating ?? 0,
        totalCalls: tool.totalCalls ?? 0,
        isVerified: tool.isVerified ?? false,
        baseUrl: tool.baseUrl,
        method: tool.method,
        path: tool.path,
        score,
      };
    });

    // ------------------------------------------------------------------
    // 5. Sort by score descending, take limit
    // ------------------------------------------------------------------
    scored.sort((a, b) => b.score - a.score);
    const recommendations = scored.slice(0, limit);

    // ------------------------------------------------------------------
    // 6. Build response
    // ------------------------------------------------------------------
    return NextResponse.json(
      {
        agent: agentId || "anonymous",
        recommendations,
        based_on: {
          agent_history: agentHistoryUsed,
          trending: trendingMap.size > 0,
          category_match: !!(categoryFilter || agentProfile?.topCategory),
        },
        total_available: tools.length,
        tip: "Install @apitoll/buyer-sdk to auto-handle x402 payments for these tools",
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=120",
          "X-APITOLL-RECOMMEND": "true",
        },
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to generate recommendations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
