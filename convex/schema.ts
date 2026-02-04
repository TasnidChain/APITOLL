import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ═══════════════════════════════════════════════════
  // Organizations (multi-tenant)
  // ═══════════════════════════════════════════════════
  organizations: defineTable({
    name: v.string(),
    billingWallet: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    apiKey: v.string(),
  }).index("by_api_key", ["apiKey"]),

  // ═══════════════════════════════════════════════════
  // Agents (buyer-side wallets)
  // ═══════════════════════════════════════════════════
  agents: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    walletAddress: v.string(),
    chain: v.union(v.literal("base"), v.literal("solana")),
    balance: v.number(),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("depleted")),
    policiesJson: v.array(v.any()),
  })
    .index("by_org", ["orgId"])
    .index("by_wallet", ["walletAddress"]),

  // ═══════════════════════════════════════════════════
  // Sellers (API/tool providers)
  // ═══════════════════════════════════════════════════
  sellers: defineTable({
    orgId: v.optional(v.id("organizations")),
    name: v.string(),
    walletAddress: v.string(),
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
    inputSchema: v.optional(v.any()),
    outputSchema: v.optional(v.any()),
    isActive: v.boolean(),
    totalCalls: v.number(),
    totalRevenue: v.number(),
  }).index("by_seller", ["sellerId"]),

  // ═══════════════════════════════════════════════════
  // Transactions (the core data model)
  // ═══════════════════════════════════════════════════
  transactions: defineTable({
    txHash: v.optional(v.string()),
    agentAddress: v.string(),
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
  })
    .index("by_agent", ["agentAddress", "requestedAt"])
    .index("by_agent_id", ["agentId", "requestedAt"])
    .index("by_seller", ["sellerId", "requestedAt"])
    .index("by_status", ["status"])
    .index("by_chain", ["chain", "requestedAt"])
    .index("by_tx_hash", ["txHash"]),

  // ═══════════════════════════════════════════════════
  // Tools (for Discovery API)
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
    inputSchema: v.optional(v.any()),
    outputSchema: v.optional(v.any()),
    mcpToolSpec: v.optional(v.any()),
    totalCalls: v.number(),
    avgLatencyMs: v.number(),
    rating: v.number(),
    ratingCount: v.number(),
    isActive: v.boolean(),
    isVerified: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"])
    .index("by_seller", ["sellerId"])
    .index("by_active", ["isActive"])
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
    rulesJson: v.any(),
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
    thresholdJson: v.any(),
    webhookUrl: v.optional(v.string()),
    isActive: v.boolean(),
    lastTriggered: v.optional(v.number()),
  }).index("by_org", ["orgId"]),
});
