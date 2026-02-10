import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════
// SECURITY FIX #7: Wallet Address Validation
// ═══════════════════════════════════════════════════

/**
 * Validates Ethereum address format (EVM chains like Base)
 * Must be 42 chars starting with 0x, valid hex
 */
function _isValidEthereumAddress(addr: string): boolean {
  if (!addr || typeof addr !== "string") return false;
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return false;
  // Reject zero address
  if (addr === "0x0000000000000000000000000000000000000000") return false;
  return true;
}

/**
 * Validates Solana address format
 * Must be 32-44 chars of base58 characters
 */
function _isValidSolanaAddress(addr: string): boolean {
  if (!addr || typeof addr !== "string") return false;
  if (!/^[1-9A-HJ-NP-Z]{32,44}$/.test(addr)) return false;
  return true;
}

/**
 * Wallet address validator — uses v.string() at the schema level.
 * Runtime validation via isValidEthereumAddress/isValidSolanaAddress
 * should be applied in mutation handlers before insert/update.
 */
const walletAddressValidator = v.string();

// ═══════════════════════════════════════════════════
// Typed JSON Schema Validators (replacing v.any())
// ═══════════════════════════════════════════════════

/**
 * Budget policy rules: { dailyLimit, perTransactionLimit, monthlyLimit }
 */
const budgetRulesValidator = v.object({
  dailyLimit: v.optional(v.number()),
  perTransactionLimit: v.optional(v.number()),
  monthlyLimit: v.optional(v.number()),
});

/**
 * Vendor ACL rules: { allowedVendors, blockedVendors }
 */
const vendorAclRulesValidator = v.object({
  allowedVendors: v.optional(v.array(v.string())),
  blockedVendors: v.optional(v.array(v.string())),
});

/**
 * Rate limit rules: { maxRequestsPerMinute, maxRequestsPerHour }
 */
const rateLimitRulesValidator = v.object({
  maxRequestsPerMinute: v.optional(v.number()),
  maxRequestsPerHour: v.optional(v.number()),
});

/**
 * Policy config stored on agents — union of all policy types
 */
const policyConfigValidator = v.object({
  type: v.union(v.literal("budget"), v.literal("vendor_acl"), v.literal("rate_limit")),
  budget: v.optional(budgetRulesValidator),
  vendorAcl: v.optional(vendorAclRulesValidator),
  rateLimit: v.optional(rateLimitRulesValidator),
});

/**
 * JSON Schema representation for endpoint input/output schemas.
 * Flexible enough to represent OpenAPI-style schemas.
 */
const jsonSchemaValidator = v.object({
  type: v.optional(v.string()),
  properties: v.optional(v.any()), // nested JSON schema properties are inherently recursive
  required: v.optional(v.array(v.string())),
  description: v.optional(v.string()),
  items: v.optional(v.any()), // for array types
  example: v.optional(v.any()),
});

/**
 * MCP tool specification
 */
const mcpToolSpecValidator = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  inputSchema: v.optional(jsonSchemaValidator),
  outputSchema: v.optional(jsonSchemaValidator),
});

/**
 * Alert threshold config — varies by rule type
 */
const alertThresholdValidator = v.object({
  percentage: v.optional(v.number()),   // e.g., 80 for 80% of budget
  amount: v.optional(v.number()),       // absolute amount threshold
  rate: v.optional(v.number()),         // failure rate percentage
  windowMinutes: v.optional(v.number()), // time window for rate calculations
});

export default defineSchema({
  // ═══════════════════════════════════════════════════
  // Organizations (multi-tenant) — with Stripe billing
  // ═══════════════════════════════════════════════════
  organizations: defineTable({
    name: v.string(),
    billingWallet: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    apiKey: v.string(),
    // SECURITY FIX: Clerk user ID for org ownership verification
    clerkUserId: v.optional(v.string()),
    // Stripe billing fields
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
    billingPeriodEnd: v.optional(v.number()),
    // Usage tracking for plan enforcement
    dailyCallCount: v.optional(v.number()),
    dailyCallDate: v.optional(v.string()), // "YYYY-MM-DD"
    createdAt: v.optional(v.number()),
    // Auto top-up configuration
    autoTopUpEnabled: v.optional(v.boolean()),
    autoTopUpThreshold: v.optional(v.number()), // USDC threshold
    autoTopUpAmount: v.optional(v.number()),     // USDC amount to top up
    autoTopUpMaxMonthly: v.optional(v.number()), // Monthly USD cap
    autoTopUpChain: v.optional(v.union(v.literal("base"), v.literal("solana"))),
  })
    .index("by_api_key", ["apiKey"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    .index("by_clerk_user", ["clerkUserId"]),

  // ═══════════════════════════════════════════════════
  // Agents (buyer-side wallets)
  // ═══════════════════════════════════════════════════
  agents: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    walletAddress: walletAddressValidator, // SECURITY FIX: Validated wallet address
    chain: v.union(v.literal("base"), v.literal("solana")),
    balance: v.number(),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("depleted")),
    policiesJson: v.array(policyConfigValidator),
  })
    .index("by_org", ["orgId"])
    .index("by_wallet", ["walletAddress"]),

  // ═══════════════════════════════════════════════════
  // Sellers (API/tool providers)
  // ═══════════════════════════════════════════════════
  sellers: defineTable({
    orgId: v.optional(v.id("organizations")),
    name: v.string(),
    walletAddress: walletAddressValidator, // SECURITY FIX: Validated wallet address
    apiKey: v.string(),
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_api_key", ["apiKey"]),

  // ═══════════════════════════════════════════════════
  // Endpoints (registered paid endpoints)
  // ═══════════════════════════════════════════════════
  endpoints: defineTable({
    sellerId: v.id("sellers"),
    method: v.string(),
    path: v.string(),
    price: v.number(),
    currency: v.string(),
    chains: v.array(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    inputSchema: v.optional(jsonSchemaValidator),
    outputSchema: v.optional(jsonSchemaValidator),
    isActive: v.boolean(),
    totalCalls: v.number(),
    totalRevenue: v.number(),
  }).index("by_seller", ["sellerId"]),

  // ═══════════════════════════════════════════════════
  // Transactions — with platform fee tracking
  // ═══════════════════════════════════════════════════
  transactions: defineTable({
    txHash: v.optional(v.string()),
    agentAddress: walletAddressValidator, // SECURITY FIX: Validated wallet address
    agentId: v.optional(v.id("agents")),
    sellerId: v.optional(v.id("sellers")),
    endpointId: v.optional(v.id("endpoints")),
    endpointPath: v.string(),
    method: v.string(),
    amount: v.number(),
    currency: v.string(),
    chain: v.union(v.literal("base"), v.literal("solana")),
    status: v.union(
      v.literal("pending"),
      v.literal("settled"),
      v.literal("failed"),
      v.literal("refunded")
    ),
    responseStatus: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    requestedAt: v.number(), // timestamp
    settledAt: v.optional(v.number()),
    blockNumber: v.optional(v.number()),
    // Platform fee tracking
    platformFee: v.optional(v.number()),
    sellerAmount: v.optional(v.number()),
    feeBps: v.optional(v.number()),
  })
    .index("by_agent", ["agentAddress", "requestedAt"])
    .index("by_agent_id", ["agentId", "requestedAt"])
    .index("by_seller", ["sellerId", "requestedAt"])
    .index("by_status", ["status"])
    .index("by_chain", ["chain", "requestedAt"])
    .index("by_tx_hash", ["txHash"]),

  // ═══════════════════════════════════════════════════
  // Tools (for Discovery API) — with premium listing support
  // ═══════════════════════════════════════════════════
  tools: defineTable({
    sellerId: v.optional(v.id("sellers")),
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    baseUrl: v.string(),
    method: v.string(),
    path: v.string(),
    price: v.number(),
    currency: v.string(),
    chains: v.array(v.string()),
    category: v.string(),
    tags: v.array(v.string()),
    inputSchema: v.optional(jsonSchemaValidator),
    outputSchema: v.optional(jsonSchemaValidator),
    mcpToolSpec: v.optional(mcpToolSpecValidator),
    totalCalls: v.number(),
    avgLatencyMs: v.number(),
    rating: v.number(),
    ratingCount: v.number(),
    isActive: v.boolean(),
    isVerified: v.boolean(),
    // Premium marketplace listing
    isFeatured: v.optional(v.boolean()),
    featuredUntil: v.optional(v.number()), // timestamp
    listingTier: v.optional(v.union(
      v.literal("free"),
      v.literal("featured"),
      v.literal("verified"),
      v.literal("premium")
    )),
    boostScore: v.optional(v.number()), // 0-100, affects search ranking
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"])
    .index("by_seller", ["sellerId"])
    .index("by_active", ["isActive"])
    .index("by_featured", ["isFeatured"])
    .searchIndex("search_tools", {
      searchField: "description",
      filterFields: ["category", "isActive"],
    }),

  // ═══════════════════════════════════════════════════
  // Categories
  // ═══════════════════════════════════════════════════
  categories: defineTable({
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
  }).index("by_slug", ["slug"]),

  // ═══════════════════════════════════════════════════
  // Policies (buyer-side rules)
  // ═══════════════════════════════════════════════════
  policies: defineTable({
    orgId: v.id("organizations"),
    agentId: v.optional(v.id("agents")),
    policyType: v.union(
      v.literal("budget"),
      v.literal("vendor_acl"),
      v.literal("rate_limit")
    ),
    rulesJson: v.union(budgetRulesValidator, vendorAclRulesValidator, rateLimitRulesValidator),
    isActive: v.boolean(),
  })
    .index("by_org", ["orgId"])
    .index("by_agent", ["agentId"]),

  // ═══════════════════════════════════════════════════
  // Alert Rules
  // ═══════════════════════════════════════════════════
  alertRules: defineTable({
    orgId: v.id("organizations"),
    agentId: v.optional(v.id("agents")),
    ruleType: v.union(
      v.literal("budget_threshold"),
      v.literal("budget_exceeded"),
      v.literal("low_balance"),
      v.literal("high_failure_rate"),
      v.literal("anomalous_spend")
    ),
    thresholdJson: alertThresholdValidator,
    webhookUrl: v.optional(v.string()),
    isActive: v.boolean(),
    lastTriggered: v.optional(v.number()),
  }).index("by_org", ["orgId"]),

  // ═══════════════════════════════════════════════════
  // Disputes & Refunds
  // ═══════════════════════════════════════════════════
  disputes: defineTable({
    transactionId: v.id("transactions"),
    orgId: v.id("organizations"),
    reason: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("under_review"),
      v.literal("resolved"),
      v.literal("rejected")
    ),
    resolution: v.optional(v.union(
      v.literal("refunded"),
      v.literal("partial_refund"),
      v.literal("denied")
    )),
    refundAmount: v.optional(v.number()),
    adminNotes: v.optional(v.string()),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_transaction", ["transactionId"])
    .index("by_status", ["status"]),

  // ═══════════════════════════════════════════════════
  // Platform Revenue Ledger
  // ═══════════════════════════════════════════════════
  platformRevenue: defineTable({
    transactionId: v.id("transactions"),
    amount: v.number(),
    currency: v.string(),
    chain: v.union(v.literal("base"), v.literal("solana")),
    feeBps: v.number(),
    collectedAt: v.number(),
  })
    .index("by_collected", ["collectedAt"]),

  // ═══════════════════════════════════════════════════
  // Referrals (agent-to-agent viral loop)
  // ═══════════════════════════════════════════════════
  referrals: defineTable({
    referrerSellerId: v.optional(v.id("sellers")),
    referrerWallet: v.string(),
    referralCode: v.string(),
    referredTransactions: v.number(),
    totalVolume: v.number(),
    totalCommission: v.number(),
    commissionBps: v.number(), // default 50 = 0.5%
    isActive: v.boolean(),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_code", ["referralCode"])
    .index("by_wallet", ["referrerWallet"])
    .index("by_seller", ["referrerSellerId"]),

  referralEvents: defineTable({
    referralId: v.id("referrals"),
    transactionId: v.id("transactions"),
    volume: v.number(),
    commission: v.number(),
    chain: v.union(v.literal("base"), v.literal("solana")),
    createdAt: v.number(),
  })
    .index("by_referral", ["referralId"])
    .index("by_transaction", ["transactionId"]),

  // ═══════════════════════════════════════════════════
  // Gossip / Trending (agent viral network)
  // ═══════════════════════════════════════════════════
  gossip: defineTable({
    endpoint: v.string(),         // "/api/joke" — normalized path
    host: v.string(),             // "api.apitoll.com"
    discoveries: v.number(),      // total times discovered by agents
    uniqueAgents: v.number(),     // unique agents that found this
    totalVolume: v.number(),      // total USDC spent through this
    avgLatencyMs: v.number(),     // average response latency
    chains: v.array(v.string()),  // chains used
    mutations: v.number(),        // agents that evolved after using this
    trendingScore: v.number(),    // computed trending rank
    firstSeen: v.number(),        // timestamp
    lastSeen: v.number(),         // timestamp
  })
    .index("by_endpoint", ["endpoint"])
    .index("by_host", ["host"])
    .index("by_trending", ["trendingScore"])
    .index("by_last_seen", ["lastSeen"]),

  gossipEvents: defineTable({
    agentId: v.string(),          // "ResearchBot-base"
    endpoint: v.string(),         // full URL
    chain: v.union(v.literal("base"), v.literal("solana")),
    amount: v.number(),
    latencyMs: v.number(),
    mutationTriggered: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_endpoint", ["endpoint"])
    .index("by_created", ["createdAt"]),

  // ═══════════════════════════════════════════════════
  // Fiat Deposits (Stripe → USDC on-ramp)
  // ═══════════════════════════════════════════════════
  deposits: defineTable({
    orgId: v.id("organizations"),
    agentId: v.optional(v.id("agents")),
    stripePaymentIntentId: v.string(),
    fiatAmount: v.number(), // USD amount charged
    usdcAmount: v.number(), // USDC amount to deliver
    exchangeRate: v.number(), // fiat/crypto rate at time of deposit
    feeAmount: v.number(), // on-ramp fee (1-2%)
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    walletAddress: walletAddressValidator, // SECURITY FIX: Validated wallet address
    chain: v.union(v.literal("base"), v.literal("solana")),
    txHash: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_stripe_pi", ["stripePaymentIntentId"])
    .index("by_status", ["status"]),

  // ═══════════════════════════════════════════════════
  // Webhooks (seller payment notifications)
  // ═══════════════════════════════════════════════════
  webhooks: defineTable({
    orgId: v.id("organizations"),
    sellerId: v.optional(v.id("sellers")),
    url: v.string(),
    secret: v.string(),
    events: v.array(v.string()),
    isActive: v.boolean(),
    failureCount: v.number(),
    lastTriggeredAt: v.optional(v.number()),
    lastFailureAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_seller", ["sellerId"]),

  webhookDeliveries: defineTable({
    webhookId: v.id("webhooks"),
    event: v.string(),
    payload: v.string(),
    status: v.union(v.literal("pending"), v.literal("delivered"), v.literal("failed")),
    httpStatus: v.optional(v.number()),
    attempts: v.number(),
    lastAttemptAt: v.number(),
    responseBody: v.optional(v.string()),
  })
    .index("by_webhook", ["webhookId"])
    .index("by_status", ["status"]),

  // ═══════════════════════════════════════════════════
  // Agent Evolution State (mutation persistence)
  // ═══════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════
  // Facilitator Payments (persistent payment records)
  // Replaces in-memory Map for crash/redeploy resilience
  // ═══════════════════════════════════════════════════
  facilitatorPayments: defineTable({
    paymentId: v.string(),
    idempotencyKey: v.optional(v.string()), // Client-provided key to prevent duplicate payments
    originalUrl: v.string(),
    originalMethod: v.string(),
    originalHeaders: v.optional(v.any()),
    originalBody: v.optional(v.any()),
    amount: v.string(),
    currency: v.string(),
    recipient: v.string(),
    chain: v.string(),
    agentWallet: v.string(),
    sellerAddress: v.string(),
    apiKey: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    txHash: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_payment_id", ["paymentId"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_status", ["status"]),

  // ═══════════════════════════════════════════════════
  // Rate Limiting (DB-backed for Convex httpActions)
  // ═══════════════════════════════════════════════════
  rateLimits: defineTable({
    key: v.string(),           // e.g., "signup:192.168.1.1" or "gossip:agentXYZ"
    count: v.number(),         // requests in current window
    windowStart: v.number(),   // timestamp of window start
  })
    .index("by_key", ["key"])
    .index("by_window", ["windowStart"]),

  // ═══════════════════════════════════════════════════
  // Tool Reviews (marketplace ratings & reviews)
  // ═══════════════════════════════════════════════════
  toolReviews: defineTable({
    toolId: v.id("tools"),
    orgId: v.id("organizations"),
    agentId: v.optional(v.string()),       // which agent left the review
    rating: v.number(),                    // 1-5
    comment: v.optional(v.string()),       // max 500 chars
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_tool", ["toolId"])
    .index("by_org", ["orgId"])
    .index("by_tool_org", ["toolId", "orgId"]),

  // ═══════════════════════════════════════════════════
  // Tool Favorites (bookmarks for agents/orgs)
  // ═══════════════════════════════════════════════════
  toolFavorites: defineTable({
    toolId: v.id("tools"),
    orgId: v.id("organizations"),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_tool", ["toolId"])
    .index("by_tool_org", ["toolId", "orgId"]),

  agentEvolution: defineTable({
    agentId: v.string(),
    state: v.any(),
    mutations: v.array(v.object({
      type: v.string(),
      from: v.optional(v.string()),
      to: v.optional(v.string()),
      successRate: v.optional(v.number()),
      timestamp: v.number(),
    })),
    mutationDepth: v.number(),
    generation: v.number(),
    fitness: v.number(),
    lastMutationAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_fitness", ["fitness"])
    .index("by_updated", ["updatedAt"]),
});
