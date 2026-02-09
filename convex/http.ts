import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";

// ─── Rate Limit Config ──────────────────────────────────────────────
// Defines rate limits per route category
const RATE_LIMITS = {
  signup: { windowMs: 3_600_000, maxRequests: 5 },      // 5 signups per hour per IP
  gossip: { windowMs: 60_000, maxRequests: 30 },         // 30 gossip events per minute per agent
  evolution: { windowMs: 60_000, maxRequests: 20 },      // 20 evolution saves per minute per agent
  publicRead: { windowMs: 60_000, maxRequests: 100 },    // 100 reads per minute per IP
  authWrite: { windowMs: 60_000, maxRequests: 30 },      // 30 writes per minute per org
} as const;

/** Extract client IP from request (Convex forwards X-Forwarded-For) */
function getClientIP(request: Request): string {
  return (
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    request.headers.get("X-Real-IP") ||
    "unknown"
  );
}

/** Rate limit check helper — returns Response if limited, null if allowed */
async function checkRateLimit(
  ctx: ActionCtx,
  key: string,
  config: { windowMs: number; maxRequests: number },
  request: Request
): Promise<Response | null> {
  const result = await ctx.runMutation(internal.rateLimit.checkRateLimit, {
    key,
    windowMs: config.windowMs,
    maxRequests: config.maxRequests,
  });

  if (!result.allowed) {
    const retryAfter = Math.ceil(result.retryAfterMs / 1000);
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded. Please try again later.",
        retryAfterSeconds: retryAfter,
      }),
      {
        status: 429,
        headers: {
          ...SECURITY_HEADERS,
          ...corsHeaders(request),
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  return null;
}

// ─── Request Body Interfaces ────────────────────────────────────────

interface TransactionInput {
  txHash?: string;
  agentAddress: string;
  endpointPath: string;
  method: string;
  amount: number | string;
  chain: string;
  status: string;
  latencyMs?: number;
  requestedAt: number | string;
}

interface TransactionWebhookBody {
  transactions: TransactionInput[];
}

interface SignupBody {
  name: string;
  billingEmail?: string;
  billingWallet?: string;
}

interface DisputeBody {
  transactionId: Id<"transactions">;
  reason: string;
}

interface DepositBody {
  fiatAmount: number;
  walletAddress: string;
  chain: string;
  agentId?: Id<"agents">;
}

interface StripeSubscriptionObject {
  id: string;
  customer: string;
  current_period_end: number;
  items?: {
    data?: Array<{
      price?: {
        id: string;
      };
    }>;
  };
}

interface StripePaymentIntentObject {
  id: string;
}

interface StripeWebhookBody {
  type: string;
  data: {
    object: StripeSubscriptionObject & StripePaymentIntentObject;
  };
}

// ─── Environment Variable Validation ─────────────────────────────────
// Fail fast if critical environment variables are missing

function validateEnvOnStartup() {
  const required = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "EXECUTOR_PRIVATE_KEY",
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(
      `API Toll: Missing required environment variables: ${missing.join(", ")}. ` +
      `Some features will be unavailable.`
    );
  }
}

validateEnvOnStartup();

const http = httpRouter();

// ─── Web Crypto Helpers ──────────────────────────────────────────────

/**
 * Compute HMAC-SHA256 using the Web Crypto API (available in Convex V8 runtime).
 * Returns a hex-encoded string.
 */
async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 * SECURITY FIX: Even on length mismatch, do full comparison to avoid length oracle.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let result = a.length ^ b.length; // non-zero if different lengths
  for (let i = 0; i < maxLen; i++) {
    result |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
  }
  return result === 0;
}

// ─── Stripe Webhook Signature Verification ───────────────────────────

/**
 * Verify a Stripe webhook signature using Web Crypto API.
 *
 * Stripe v1 signatures use HMAC-SHA256. The stripe-signature header contains:
 *   t=<timestamp>,v1=<hex-signature>[,v1=<hex-signature>...]
 *
 * The signed payload is: `<timestamp>.<body>`
 */
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
  toleranceSeconds: number = 300
): Promise<boolean> {
  const elements = sigHeader.split(",");
  const timestampStr = elements
    .find((e) => e.startsWith("t="))
    ?.slice(2);
  const signatures = elements
    .filter((e) => e.startsWith("v1="))
    .map((e) => e.slice(3));

  if (!timestampStr || signatures.length === 0) {
    return false;
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }

  // Compute expected signature
  const signedPayload = `${timestampStr}.${payload}`;
  const expectedSig = await hmacSha256Hex(secret, signedPayload);

  // Check if any of the v1 signatures match
  return signatures.some((sig) => timingSafeEqual(sig, expectedSig));
}

// ─── Helpers ──────────────────────────────────────────────────────

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);

// SECURITY FIX #8: Complete security header set for production
const SECURITY_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'",
  "Permissions-Policy": "accelerometer=(), camera=(), microphone=(), geolocation=()",
};

function corsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers.get("Origin") || "";

  // SECURITY FIX: Deny all CORS by default
  if (ALLOWED_ORIGINS.length === 0) {
    // No origins configured = deny all cross-origin requests
    return {
      "Access-Control-Allow-Origin": "",
      "Access-Control-Allow-Methods": "",
      "Access-Control-Allow-Headers": "",
    };
  }

  // Only allow whitelisted origins (never use wildcard *)
  const allowed = ALLOWED_ORIGINS.includes(origin);

  if (!allowed) {
    return {
      "Access-Control-Allow-Origin": "",
      "Access-Control-Allow-Methods": "",
      "Access-Control-Allow-Headers": "",
    };
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Seller-Key, X-API-Key, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data: unknown, status: number = 200, request?: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...SECURITY_HEADERS, ...corsHeaders(request) },
  });
}

function errorResponse(message: string, status: number, request?: Request) {
  return jsonResponse({ error: message }, status, request);
}

/** Clamp an integer query param safely */
function clampInt(value: string | null, min: number, max: number, defaultVal: number): number {
  if (!value) return defaultVal;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultVal;
  return Math.max(min, Math.min(max, parsed));
}

/** Clamp a float query param safely */
function clampFloat(value: string | null, min: number, max: number, defaultVal: number): number {
  if (!value) return defaultVal;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return defaultVal;
  return Math.max(min, Math.min(max, parsed));
}

/** SECURITY FIX #6: Standardized auth header extraction (Bearer + X-API-Key) */
function getAuthToken(request: Request): string | null {
  // Try Bearer token first (standard)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Fallback to X-API-Key for backwards compatibility
  const apiKey = request.headers.get("X-API-Key");
  if (apiKey) {
    return apiKey;
  }

  return null;
}

/** Authenticate org by API key header */
async function authenticateOrg(ctx: ActionCtx, request: Request) {
  const apiKey = getAuthToken(request);
  if (!apiKey) return null;
  return await ctx.runQuery(internal.organizations.getByApiKey, { apiKey });
}

// ═══════════════════════════════════════════════════
// Transaction Webhook (from Seller SDK) — with fee tracking
// ═══════════════════════════════════════════════════

http.route({
  path: "/webhook/transactions",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("X-Seller-Key");
    if (!apiKey) {
      return errorResponse("Missing X-Seller-Key", 401, request);
    }

    const seller = await ctx.runQuery(internal.sellers.getByApiKey, { apiKey });
    if (!seller) {
      return errorResponse("Invalid seller key", 401, request);
    }

    // SECURITY: Rate limit transaction webhooks — 30 per minute per seller
    const limited = await checkRateLimit(ctx, `txwh:${seller._id}`, RATE_LIMITS.authWrite, request);
    if (limited) return limited;

    // Validate content type
    const contentType = request.headers.get("Content-Type");
    if (!contentType?.includes("application/json")) {
      return errorResponse("Content-Type must be application/json", 415, request);
    }

    let body: TransactionWebhookBody;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400, request);
    }

    const { transactions } = body;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return errorResponse("transactions must be a non-empty array", 400, request);
    }

    if (transactions.length > 100) {
      return errorResponse("Maximum 100 transactions per batch", 400, request);
    }

    const result = await ctx.runMutation(internal.transactions.createBatch, {
      transactions: transactions.map((tx: TransactionInput) => ({
        txHash: typeof tx.txHash === "string" ? tx.txHash : undefined,
        agentAddress: String(tx.agentAddress || ""),
        endpointPath: String(tx.endpointPath || ""),
        method: String(tx.method || "GET"),
        amount: typeof tx.amount === "number" ? tx.amount : parseFloat(String(tx.amount)) || 0,
        chain: tx.chain === "solana" ? "solana" as const : "base" as const,
        status: (["pending", "settled", "failed", "refunded"].includes(tx.status) ? tx.status : "pending") as "pending" | "settled" | "failed" | "refunded",
        latencyMs: typeof tx.latencyMs === "number" ? tx.latencyMs : undefined,
        requestedAt: typeof tx.requestedAt === "number" ? tx.requestedAt : new Date(String(tx.requestedAt)).getTime() || Date.now(),
      })),
      sellerId: seller._id,
    });

    // Record platform revenue if fee data is present
    // (fee tracking handled in transactions.createBatch now)

    return jsonResponse(result, 200, request);
  }),
});

// ═══════════════════════════════════════════════════
// Self-Serve Signup — Create Organization + API Key
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/signup",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // SECURITY: Rate limit signups — 5 per hour per IP
    const ip = getClientIP(request);
    const limited = await checkRateLimit(ctx, `signup:${ip}`, RATE_LIMITS.signup, request);
    if (limited) return limited;

    const contentType = request.headers.get("Content-Type");
    if (!contentType?.includes("application/json")) {
      return errorResponse("Content-Type must be application/json", 415, request);
    }

    let body: SignupBody;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400, request);
    }

    const { name, billingEmail, billingWallet } = body;
    if (!name || typeof name !== "string" || name.length < 2 || name.length > 100) {
      return errorResponse("name is required (2-100 characters)", 400, request);
    }

    // SECURITY: Validate billingEmail format if provided
    if (billingEmail && typeof billingEmail === "string") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(billingEmail) || billingEmail.length > 254) {
        return errorResponse("Invalid email address format", 400, request);
      }
    }

    // SECURITY: Validate billingWallet if provided
    if (billingWallet && typeof billingWallet === "string") {
      if (billingWallet.length > 64 || !/^[a-zA-Z0-9]+$/.test(billingWallet)) {
        return errorResponse("Invalid wallet address format", 400, request);
      }
    }

    const result = await ctx.runMutation(internal.organizations.internalCreate, {
      name: name.trim(),
      billingWallet: billingWallet || undefined,
    });

    // Update billing email if provided
    if (billingEmail && typeof billingEmail === "string") {
      await ctx.runMutation(internal.billing.setStripeCustomer, {
        orgId: result.id,
        stripeCustomerId: "", // will be set when Stripe customer is created
        billingEmail: billingEmail.trim(),
      });
    }

    return jsonResponse(
      {
        orgId: result.id,
        apiKey: result.apiKey,
        plan: "free",
        message: "Organization created. Save your API key — it cannot be retrieved later.",
      },
      201,
      request
    );
  }),
});

// ═══════════════════════════════════════════════════
// API Key Management
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/keys/regenerate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const org = await authenticateOrg(ctx, request);
    if (!org) return errorResponse("Unauthorized", 401, request);

    const newKey = await ctx.runMutation(internal.organizations.internalRegenerateApiKey, {
      id: org._id,
    });

    return jsonResponse(
      {
        apiKey: newKey,
        message: "API key regenerated. Update your integrations with the new key.",
      },
      200,
      request
    );
  }),
});

// ═══════════════════════════════════════════════════
// Billing Summary
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/billing",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const org = await authenticateOrg(ctx, request);
    if (!org) return errorResponse("Unauthorized", 401, request);

    const billing = await ctx.runQuery(internal.billing.internalGetBillingSummary, {
      orgId: org._id,
    });

    return jsonResponse(billing, 200, request);
  }),
});

// ═══════════════════════════════════════════════════
// Discovery API - Search Tools (with premium ranking)
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/tools",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // SECURITY: Rate limit public reads — 100 per minute per IP
    const ip = getClientIP(request);
    const limited = await checkRateLimit(ctx, `read:${ip}`, RATE_LIMITS.publicRead, request);
    if (limited) return limited;

    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.slice(0, 200) ?? undefined; // SECURITY: limit query length
    const category = url.searchParams.get("category")?.slice(0, 50) ?? undefined;
    const maxPrice = clampFloat(url.searchParams.get("maxPrice"), 0, 1000, 0) || undefined;
    const chains = url.searchParams.get("chains")?.split(",").filter(Boolean).slice(0, 5); // SECURITY: limit chains
    const limit = clampInt(url.searchParams.get("limit"), 1, 100, 20);

    const tools = await ctx.runQuery(api.tools.search, {
      query,
      category,
      maxPrice: maxPrice || undefined,
      chains,
      limit,
    });

    return jsonResponse({ tools, count: tools.length }, 200, request);
  }),
});

// ═══════════════════════════════════════════════════
// Discovery API - Featured Tools (premium marketplace)
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/tools/featured",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const limit = clampInt(url.searchParams.get("limit"), 1, 50, 10);

    const tools = await ctx.runQuery(api.tools.getFeatured, { limit });

    return jsonResponse({ tools, count: tools.length }, 200, request);
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
    const chains = url.searchParams.get("chains")?.split(",").filter(Boolean);
    const limit = clampInt(url.searchParams.get("limit"), 1, 100, 50);

    const tools = await ctx.runQuery(api.tools.listAsMCP, {
      category,
      chains,
      limit,
    });

    return jsonResponse({ tools }, 200, request);
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
      return errorResponse("Tool not found", 404, request);
    }

    return jsonResponse(tool, 200, request);
  }),
});

// ═══════════════════════════════════════════════════
// Categories
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/categories",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const categories = await ctx.runQuery(api.categories.list);
    return jsonResponse({ categories }, 200, request);
  }),
});

// ═══════════════════════════════════════════════════
// Analytics - Overview (plan-gated)
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/analytics/overview",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const org = await authenticateOrg(ctx, request);
    if (!org) return errorResponse("Unauthorized", 401, request);

    const stats = await ctx.runQuery(internal.analytics.internalGetOverview, {});
    return jsonResponse(stats, 200, request);
  }),
});

// ═══════════════════════════════════════════════════
// Analytics - Daily Stats (plan-gated retention)
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/analytics/daily",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const org = await authenticateOrg(ctx, request);
    if (!org) return errorResponse("Unauthorized", 401, request);

    const url = new URL(request.url);

    // Enforce retention limits based on plan
    const retentionDays: Record<string, number> = {
      free: 7,
      pro: 90,
      enterprise: 365,
    };
    const maxDays = retentionDays[org.plan] ?? 7;
    const requestedDays = clampInt(url.searchParams.get("days"), 1, maxDays, Math.min(30, maxDays));

    const stats = await ctx.runQuery(internal.analytics.internalGetDailyStats, {
      days: requestedDays,
    });

    return jsonResponse({
      data: stats,
      plan: org.plan,
      maxRetentionDays: maxDays,
    }, 200, request);
  }),
});

// ═══════════════════════════════════════════════════
// Analytics - Premium: Spend by Chain
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/analytics/chains",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const org = await authenticateOrg(ctx, request);
    if (!org) return errorResponse("Unauthorized", 401, request);

    if (org.plan === "free") {
      return errorResponse("Premium analytics requires Pro or Enterprise plan", 403, request);
    }

    const data = await ctx.runQuery(internal.analytics.internalGetSpendByChain);
    return jsonResponse(data, 200, request);
  }),
});

// ═══════════════════════════════════════════════════
// Analytics - Premium: Top Endpoints
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/analytics/top-endpoints",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const org = await authenticateOrg(ctx, request);
    if (!org) return errorResponse("Unauthorized", 401, request);

    if (org.plan === "free") {
      return errorResponse("Premium analytics requires Pro or Enterprise plan", 403, request);
    }

    const url = new URL(request.url);
    const limit = clampInt(url.searchParams.get("limit"), 1, 50, 10);

    const data = await ctx.runQuery(internal.analytics.internalGetTopEndpoints, { limit });
    return jsonResponse({ endpoints: data }, 200, request);
  }),
});

// ═══════════════════════════════════════════════════
// Platform Revenue (admin only)
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/admin/revenue",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // SECURITY FIX: Use admin secret instead of plan-based auth.
    // Previously any enterprise org could view platform-wide revenue.
    // Now requires the ADMIN_API_SECRET env var (shared secret for admin API access).
    const adminSecret = process.env.ADMIN_API_SECRET;
    const providedSecret = request.headers.get("X-Admin-Secret");

    // SECURITY FIX: Use timing-safe comparison to prevent timing attacks
    if (!adminSecret || !providedSecret || !timingSafeEqual(adminSecret, providedSecret)) {
      return errorResponse("Admin access required", 403, request);
    }

    const overview = await ctx.runQuery(internal.platformRevenue.internalGetOverview);
    return jsonResponse(overview, 200, request);
  }),
});

// ═══════════════════════════════════════════════════
// Disputes - Create
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/disputes",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const org = await authenticateOrg(ctx, request);
    if (!org) return errorResponse("Unauthorized", 401, request);

    let body: DisputeBody;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400, request);
    }

    const { transactionId, reason } = body;
    if (!transactionId || !reason) {
      return errorResponse("transactionId and reason are required", 400, request);
    }

    try {
      const disputeId = await ctx.runMutation(internal.disputes.internalCreate, {
        transactionId,
        orgId: org._id,
        reason: String(reason).slice(0, 1000),
      });

      return jsonResponse({ disputeId, status: "open" }, 201, request);
    } catch (err) {
      // SECURITY: Only expose safe error messages, not internal details
      const safeMessages = [
        "Transaction not found",
        "Dispute already exists for this transaction",
        "Transaction does not belong to this organization",
      ];
      const message = err instanceof Error ? err.message : "";
      const isSafe = safeMessages.some((m) => message.includes(m));
      console.error("Dispute creation failed:", err);
      return errorResponse(
        isSafe ? message : "Failed to create dispute",
        400,
        request
      );
    }
  }),
});

// ═══════════════════════════════════════════════════
// Disputes - List
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/disputes",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const org = await authenticateOrg(ctx, request);
    if (!org) return errorResponse("Unauthorized", 401, request);

    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;

    const disputes = await ctx.runQuery(internal.disputes.internalListByOrg, {
      orgId: org._id,
      status,
    });

    return jsonResponse({ disputes }, 200, request);
  }),
});

// ═══════════════════════════════════════════════════
// Deposits - Create (Fiat On-Ramp)
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/deposits",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const org = await authenticateOrg(ctx, request);
    if (!org) return errorResponse("Unauthorized", 401, request);

    let body: DepositBody;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400, request);
    }

    const { fiatAmount, walletAddress, chain, agentId } = body;
    if (!fiatAmount || !walletAddress || !chain) {
      return errorResponse("fiatAmount, walletAddress, and chain are required", 400, request);
    }

    if (typeof fiatAmount !== "number" || fiatAmount < 1 || fiatAmount > 10000) {
      return errorResponse("fiatAmount must be between $1 and $10,000", 400, request);
    }

    // Create Stripe PaymentIntent via Node.js action
    let paymentIntent: { id: string; clientSecret: string };
    try {
      paymentIntent = await ctx.runAction(
        internal.nodeActions.createStripePaymentIntent,
        {
          fiatAmount,
          orgId: org._id.toString(),
          agentId: agentId || "none",
          chain: chain === "solana" ? "solana" : "base",
          walletAddress,
        }
      );
    } catch (stripeError: unknown) {
      console.error("Stripe PaymentIntent creation failed:", stripeError);
      return errorResponse("Failed to create payment. Please try again later.", 500, request);
    }

    const result = await ctx.runMutation(internal.deposits.create, {
      orgId: org._id,
      agentId: agentId || undefined,
      stripePaymentIntentId: paymentIntent.id,
      fiatAmount,
      walletAddress,
      chain: chain === "solana" ? "solana" : "base",
    });

    return jsonResponse(
      {
        depositId: result.id,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.clientSecret,
        fiatAmount,
        usdcAmount: result.usdcAmount,
        feeAmount: result.feeAmount,
        feeRate: "1.5%",
        message: "Stripe PaymentIntent created. Complete payment to receive USDC.",
      },
      201,
      request
    );
  }),
});

// ═══════════════════════════════════════════════════
// Deposits - List
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/deposits",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const org = await authenticateOrg(ctx, request);
    if (!org) return errorResponse("Unauthorized", 401, request);

    const deposits = await ctx.runQuery(api.deposits.listByOrg, {
      orgId: org._id,
    });

    return jsonResponse({ deposits }, 200, request);
  }),
});

// ═══════════════════════════════════════════════════
// Stripe Webhook (subscription events)
// ═══════════════════════════════════════════════════

http.route({
  path: "/webhook/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Verify Stripe webhook signature (CRITICAL SECURITY FIX)
    const sig = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return errorResponse("Missing Stripe webhook signature or secret", 401, request);
    }

    let bodyText: string;
    try {
      bodyText = await request.text();
    } catch {
      return errorResponse("Invalid request body", 400, request);
    }

    // Verify Stripe signature using Web Crypto API (HMAC-SHA256)
    const signatureValid = await verifyStripeSignature(bodyText, sig, webhookSecret);
    if (!signatureValid) {
      return errorResponse("Invalid Stripe webhook signature", 401, request);
    }

    let body: StripeWebhookBody;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return errorResponse("Invalid JSON body", 400, request);
    }

    const { type, data } = body;

    switch (type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = data.object;
        const customerId = subscription.customer;

        const org = await ctx.runQuery(internal.billing.getByStripeCustomer, {
          stripeCustomerId: customerId,
        });

        if (org) {
          const priceId = subscription.items?.data?.[0]?.price?.id || "";
          const plan = priceId.includes("ent")
            ? "enterprise" as const
            : priceId.includes("pro")
              ? "pro" as const
              : "free" as const;

          await ctx.runMutation(internal.billing.activateSubscription, {
            orgId: org._id,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            plan,
            billingPeriodEnd: subscription.current_period_end * 1000,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = data.object;
        const org = await ctx.runQuery(internal.billing.getByStripeCustomer, {
          stripeCustomerId: subscription.customer,
        });

        if (org) {
          await ctx.runMutation(internal.billing.cancelSubscription, {
            orgId: org._id,
          });
        }
        break;
      }

      case "payment_intent.succeeded": {
        // Handle fiat on-ramp deposits
        const pi = data.object;
        const deposit = await ctx.runQuery(api.deposits.getByPaymentIntent, {
          stripePaymentIntentId: pi.id,
        });

        if (deposit) {
          await ctx.runMutation(internal.deposits.updateStatus, {
            depositId: deposit._id,
            status: "processing",
          });

          // Transfer USDC to the user's wallet via Node.js action
          try {
            const transferResult = await ctx.runAction(
              internal.nodeActions.transferUSDC,
              {
                walletAddress: deposit.walletAddress,
                amountUSDC: deposit.usdcAmount,
              }
            );

            await ctx.runMutation(internal.deposits.updateStatus, {
              depositId: deposit._id,
              status: "completed",
              txHash: transferResult.txHash,
            });
          } catch (transferError: unknown) {
            console.error("USDC transfer failed for deposit:", deposit._id, transferError);
            await ctx.runMutation(internal.deposits.updateStatus, {
              depositId: deposit._id,
              status: "failed",
            });
          }
        }
        break;
      }
    }

    return jsonResponse({ received: true }, 200, request);
  }),
});

// ═══════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (_, request) => {
    return jsonResponse(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "2.0.0",
      },
      200,
      request
    );
  }),
});

// ═══════════════════════════════════════════════════
// Gossip — Record (agent POST, forwarded from Next.js)
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/gossip",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const contentType = request.headers.get("Content-Type");
    if (!contentType?.includes("application/json")) {
      return errorResponse("Content-Type must be application/json", 415, request);
    }

    let body: { agentId?: string; endpoint?: string; host?: string; chain?: string; amount?: number; latencyMs?: number; mutationTriggered?: boolean };
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400, request);
    }

    if (!body.agentId || !body.endpoint) {
      return errorResponse("agentId and endpoint are required", 400, request);
    }

    // SECURITY: Input validation — prevent oversized strings
    const agentId = String(body.agentId).slice(0, 128);
    const endpoint = String(body.endpoint).slice(0, 512);
    const host = String(body.host || "").slice(0, 256);

    // SECURITY: Validate endpoint looks like a URL path
    if (!/^https?:\/\/|^\//.test(endpoint)) {
      return errorResponse("endpoint must be a URL or path", 400, request);
    }

    // SECURITY: Rate limit gossip — 30 per minute per agent
    const limited = await checkRateLimit(ctx, `gossip:${agentId}`, RATE_LIMITS.gossip, request);
    if (limited) return limited;

    // SECURITY: Clamp numeric values to sane ranges
    const amount = typeof body.amount === "number" ? Math.max(0, Math.min(body.amount, 1_000_000)) : 0;
    const latencyMs = typeof body.latencyMs === "number" ? Math.max(0, Math.min(body.latencyMs, 300_000)) : 0;

    try {
      const result = await ctx.runMutation(internal.gossip.recordGossip, {
        agentId,
        endpoint,
        host,
        chain: body.chain === "solana" ? "solana" as const : "base" as const,
        amount,
        latencyMs,
        mutationTriggered: body.mutationTriggered === true,
      });

      return jsonResponse(result, 200, request);
    } catch (err) {
      // SECURITY: Don't leak internal error details
      console.error("Gossip recording failed:", err);
      return errorResponse("Failed to record gossip", 500, request);
    }
  }),
});

// ═══════════════════════════════════════════════════
// Evolution — Save State (agent POST, forwarded from Next.js)
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/evolution/save",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const contentType = request.headers.get("Content-Type");
    if (!contentType?.includes("application/json")) {
      return errorResponse("Content-Type must be application/json", 415, request);
    }

    let body: { agentId?: string; state?: unknown; mutations?: Array<{ type: string; from?: string; to?: string; successRate?: number; timestamp: number }> };
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400, request);
    }

    if (!body.agentId) {
      return errorResponse("agentId is required", 400, request);
    }

    // SECURITY: Input validation
    const agentId = String(body.agentId).slice(0, 128);

    // SECURITY: Rate limit evolution saves — 20 per minute per agent
    const limited = await checkRateLimit(ctx, `evolution:${agentId}`, RATE_LIMITS.evolution, request);
    if (limited) return limited;

    // SECURITY: Limit mutations array size to prevent DB bloat
    const mutations = Array.isArray(body.mutations)
      ? body.mutations.slice(0, 100).map((m) => ({
          type: String(m.type).slice(0, 64),
          from: m.from ? String(m.from).slice(0, 256) : undefined,
          to: m.to ? String(m.to).slice(0, 256) : undefined,
          successRate: typeof m.successRate === "number" ? Math.max(0, Math.min(m.successRate, 1)) : undefined,
          timestamp: typeof m.timestamp === "number" ? m.timestamp : Date.now(),
        }))
      : undefined;

    try {
      const result = await ctx.runMutation(internal.evolution.saveState, {
        agentId,
        state: body.state ?? undefined,
        mutations,
      });

      return jsonResponse(result, 200, request);
    } catch (err) {
      // SECURITY: Don't leak internal error details
      console.error("Evolution save failed:", err);
      return errorResponse("Failed to save evolution state", 500, request);
    }
  }),
});

// ═══════════════════════════════════════════════════
// CORS Preflight — all API routes
// ═══════════════════════════════════════════════════

http.route({
  path: "/api/*",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }),
});

http.route({
  path: "/webhook/*",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }),
});

export default http;
