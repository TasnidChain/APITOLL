import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./helpers";

// ═══════════════════════════════════════════════════
// Shared policy rule validators (must match schema.ts)
// ═══════════════════════════════════════════════════

const budgetRulesValidator = v.object({
  dailyLimit: v.optional(v.number()),
  perTransactionLimit: v.optional(v.number()),
  monthlyLimit: v.optional(v.number()),
});

const vendorAclRulesValidator = v.object({
  allowedVendors: v.optional(v.array(v.string())),
  blockedVendors: v.optional(v.array(v.string())),
});

const rateLimitRulesValidator = v.object({
  maxRequestsPerMinute: v.optional(v.number()),
  maxRequestsPerHour: v.optional(v.number()),
});

// ═══════════════════════════════════════════════════
// Create Policy
// ═══════════════════════════════════════════════════

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    agentId: v.optional(v.id("agents")),
    policyType: v.union(
      v.literal("budget"),
      v.literal("vendor_acl"),
      v.literal("rate_limit")
    ),
    rulesJson: v.union(budgetRulesValidator, vendorAclRulesValidator, rateLimitRulesValidator),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    // Ensure org exists
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");

    // If agent-specific, ensure agent exists and belongs to org
    if (args.agentId) {
      const agent = await ctx.db.get(args.agentId);
      if (!agent) throw new Error("Agent not found");
      if (agent.orgId !== args.orgId) throw new Error("Agent does not belong to this organization");
    }

    const id = await ctx.db.insert("policies", {
      orgId: args.orgId,
      agentId: args.agentId,
      policyType: args.policyType,
      rulesJson: args.rulesJson,
      isActive: true,
    });

    return id;
  },
});

// ═══════════════════════════════════════════════════
// List Policies by Org
// ═══════════════════════════════════════════════════

export const listByOrg = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("policies")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

// ═══════════════════════════════════════════════════
// List Policies by Agent
// ═══════════════════════════════════════════════════

export const listByAgent = query({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("policies")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

// ═══════════════════════════════════════════════════
// Update Policy Rules
// ═══════════════════════════════════════════════════

export const update = mutation({
  args: {
    id: v.id("policies"),
    rulesJson: v.union(budgetRulesValidator, vendorAclRulesValidator, rateLimitRulesValidator),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const policy = await ctx.db.get(args.id);
    if (!policy) throw new Error("Policy not found");

    const update: { rulesJson: typeof args.rulesJson; isActive?: boolean } = { rulesJson: args.rulesJson };
    if (args.isActive !== undefined) {
      update.isActive = args.isActive;
    }

    await ctx.db.patch(args.id, update);
  },
});

// ═══════════════════════════════════════════════════
// Toggle Policy Active/Inactive
// ═══════════════════════════════════════════════════

export const toggleActive = mutation({
  args: {
    id: v.id("policies"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const policy = await ctx.db.get(args.id);
    if (!policy) throw new Error("Policy not found");
    await ctx.db.patch(args.id, { isActive: !policy.isActive });
  },
});

// ═══════════════════════════════════════════════════
// Delete Policy
// ═══════════════════════════════════════════════════

export const remove = mutation({
  args: {
    id: v.id("policies"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const policy = await ctx.db.get(args.id);
    if (!policy) throw new Error("Policy not found");
    await ctx.db.delete(args.id);
  },
});
