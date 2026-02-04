import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// ═══════════════════════════════════════════════════
// Transaction Webhook (from Seller SDK)
// ═══════════════════════════════════════════════════

http.route({
  path: "/webhook/transactions",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Get seller API key from header
    const apiKey = request.headers.get("X-Seller-Key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing X-Seller-Key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify seller
    const seller = await ctx.runQuery(api.sellers.getByApiKey, { apiKey });
    if (!seller) {
      return new Response(JSON.stringify({ error: "Invalid seller key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse body
    const body = await request.json();
    const { transactions } = body;

    if (!Array.isArray(transactions)) {
      return new Response(JSON.stringify({ error: "transactions must be array" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create transactions
    const result = await ctx.runMutation(api.transactions.createBatch, {
      transactions: transactions.map((tx: any) => ({
        txHash: tx.txHash,
        agentAddress: tx.agentAddress,
        endpointPath: tx.endpointPath,
        method: tx.method || "GET",
        amount: tx.amount,
        chain: tx.chain,
        status: tx.status,
        latencyMs: tx.latencyMs,
        requestedAt: new Date(tx.requestedAt).getTime(),
      })),
      sellerId: seller._id,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// ═══════════════════════════════════════════════════
// Discovery API - Search Tools
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/tools",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? undefined;
    const category = url.searchParams.get("category") ?? undefined;
    const maxPrice = url.searchParams.get("maxPrice");
    const chains = url.searchParams.get("chains")?.split(",");
    const limit = url.searchParams.get("limit");

    const tools = await ctx.runQuery(api.tools.search, {
      query,
      category,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      chains,
      limit: limit ? parseInt(limit) : undefined,
    });

    return new Response(JSON.stringify({ tools }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

// ═══════════════════════════════════════════════════
// Discovery API - MCP Format
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/mcp/tools",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const category = url.searchParams.get("category") ?? undefined;
    const chains = url.searchParams.get("chains")?.split(",");
    const limit = url.searchParams.get("limit");

    const tools = await ctx.runQuery(api.tools.listAsMCP, {
      category,
      chains,
      limit: limit ? parseInt(limit) : undefined,
    });

    return new Response(JSON.stringify({ tools }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

// ═══════════════════════════════════════════════════
// Discovery API - Single Tool MCP Format
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/mcp/tools/:slug",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const slug = url.pathname.split("/").pop()!;

    const tool = await ctx.runQuery(api.tools.getAsMCP, { slug });

    if (!tool) {
      return new Response(JSON.stringify({ error: "Tool not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(tool), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

// ═══════════════════════════════════════════════════
// Categories
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/categories",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const categories = await ctx.runQuery(api.categories.list);

    return new Response(JSON.stringify({ categories }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

// ═══════════════════════════════════════════════════
// Analytics - Overview
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/analytics/overview",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const stats = await ctx.runQuery(api.analytics.getOverview, {});

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

// ═══════════════════════════════════════════════════
// Analytics - Daily Stats
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/analytics/daily",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const days = url.searchParams.get("days");

    const stats = await ctx.runQuery(api.analytics.getDailyStats, {
      days: days ? parseInt(days) : undefined,
    });

    return new Response(JSON.stringify({ data: stats }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

// ═══════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }),
});

// ═══════════════════════════════════════════════════
// CORS Preflight
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/*",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Seller-Key, X-API-Key",
      },
    });
  }),
});

export default http;
