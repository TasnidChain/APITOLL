import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api";
import { convex } from "@/lib/convex-client";

/**
 * Platform Health Check — GET /api/health
 *
 * Public endpoint for agents to verify platform status before
 * making paid x402 calls. Checks:
 *   - Convex database connectivity
 *   - Facilitator service availability
 *   - Gossip network activity
 *
 * No auth required. Agents should cache for 30s.
 */

const FACILITATOR_HEALTH_URL =
  "https://facilitator-production-fbd7.up.railway.app/health";

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  const startTime = Date.now();

  // ------------------------------------------------------------------
  // 1. Check Convex database connectivity
  // ------------------------------------------------------------------
  let databaseStatus: "up" | "down" = "down";
  let databaseLatency = 0;
  let activeAgents1h = 0;
  let gossipNetworkStatus: "up" | "down" = "down";

  try {
    const dbStart = Date.now();
    const stats = await convex.query(api.gossip.getNetworkStats, {});
    databaseLatency = Date.now() - dbStart;
    databaseStatus = "up";

    activeAgents1h = stats.active_tools_1h ?? 0;
    gossipNetworkStatus =
      stats.total_tools_tracked > 0 ? "up" : "down";
  } catch {
    databaseStatus = "down";
    databaseLatency = Date.now() - startTime;
  }

  // ------------------------------------------------------------------
  // 2. Check facilitator service
  // ------------------------------------------------------------------
  let facilitatorStatus: "up" | "down" = "down";
  let facilitatorLatency = 0;

  try {
    const facStart = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(FACILITATOR_HEALTH_URL, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeout);
    facilitatorLatency = Date.now() - facStart;
    facilitatorStatus = response.ok ? "up" : "down";
  } catch {
    facilitatorStatus = "down";
    facilitatorLatency = 5000; // timed out or failed
  }

  // ------------------------------------------------------------------
  // 3. Determine overall status
  // ------------------------------------------------------------------
  const apiLatency = Date.now() - startTime;
  let overallStatus: "operational" | "degraded" | "down";

  if (databaseStatus === "down" && facilitatorStatus === "down") {
    overallStatus = "down";
  } else if (databaseStatus === "down" || facilitatorStatus === "down") {
    overallStatus = "degraded";
  } else {
    overallStatus = "operational";
  }

  // ------------------------------------------------------------------
  // 4. Build response
  // ------------------------------------------------------------------
  const responseBody = {
    status: overallStatus,
    services: {
      api: {
        status: "up" as const,
        latency_ms: apiLatency,
      },
      database: {
        status: databaseStatus,
        latency_ms: databaseLatency,
      },
      facilitator: {
        status: facilitatorStatus,
        latency_ms: facilitatorLatency,
      },
      gossip_network: {
        status: gossipNetworkStatus,
        active_agents_1h: activeAgents1h,
      },
    },
    protocol: "x402",
    chain: "base",
    uptime_url: "https://apitoll.com/api/health",
    dashboard: "https://apitoll.com/dashboard",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(responseBody, {
    status: overallStatus === "down" ? 503 : 200,
    headers: {
      "Cache-Control": "public, max-age=30, s-maxage=30",
      "X-APITOLL-STATUS": overallStatus,
    },
  });
}
