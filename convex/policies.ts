import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAuth, requireOrgAccess } from "./helpers";

// Audit Logging Helper

async function logPolicyAudit(
  ctx: MutationCtx,
  data: {
    orgId: Id<"organizations">;
    policyId: Id<"policies">;
    action: "created" | "updated" | "deleted" | "toggled";
    changedBy: string;
    previousRules?: string;
    newRules?: string;
    policyType: "budget" | "vendor_acl" | "rate_limit";
  }
) {
  await ctx.db.insert("policyAuditLog", {
    orgId: data.orgId,
    policyId: data.policyId,
    action: data.action,
    changedBy: data.changedBy,
    previousRules: data.previousRules,
    newRules: data.newRules,
    policyType: data.policyType,
    timestamp: Date.now(),
  });
}

// Shared policy rule validators (must match schema.ts)

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

// Create Policy

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
    // Verify caller owns this organization
    const { identity } = await requireOrgAccess(ctx, args.orgId);

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

    // Audit log
    await logPolicyAudit(ctx, {
      orgId: args.orgId,
      policyId: id,
      action: "created",
      changedBy: identity.subject,
      newRules: JSON.stringify(args.rulesJson),
      policyType: args.policyType,
    });

    return id;
  },
});

// List Policies by Org

export const listByOrg = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // Verify caller owns this organization
    await requireOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("policies")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

// List Policies by Agent

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

// Update Policy Rules

export const update = mutation({
  args: {
    id: v.id("policies"),
    rulesJson: v.union(budgetRulesValidator, vendorAclRulesValidator, rateLimitRulesValidator),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const policy = await ctx.db.get(args.id);
    if (!policy) throw new Error("Policy not found");
    // Verify caller owns the policy's organization
    const { identity } = await requireOrgAccess(ctx, policy.orgId);

    const previousRules = JSON.stringify(policy.rulesJson);

    const update: { rulesJson: typeof args.rulesJson; isActive?: boolean } = { rulesJson: args.rulesJson };
    if (args.isActive !== undefined) {
      update.isActive = args.isActive;
    }

    await ctx.db.patch(args.id, update);

    // Audit log
    await logPolicyAudit(ctx, {
      orgId: policy.orgId,
      policyId: args.id,
      action: "updated",
      changedBy: identity.subject,
      previousRules,
      newRules: JSON.stringify(args.rulesJson),
      policyType: policy.policyType,
    });
  },
});

// Toggle Policy Active/Inactive

export const toggleActive = mutation({
  args: {
    id: v.id("policies"),
  },
  handler: async (ctx, args) => {
    const policy = await ctx.db.get(args.id);
    if (!policy) throw new Error("Policy not found");
    // Verify caller owns the policy's organization
    const { identity } = await requireOrgAccess(ctx, policy.orgId);
    await ctx.db.patch(args.id, { isActive: !policy.isActive });

    // Audit log
    await logPolicyAudit(ctx, {
      orgId: policy.orgId,
      policyId: args.id,
      action: "toggled",
      changedBy: identity.subject,
      policyType: policy.policyType,
    });
  },
});

// Delete Policy

export const remove = mutation({
  args: {
    id: v.id("policies"),
  },
  handler: async (ctx, args) => {
    const policy = await ctx.db.get(args.id);
    if (!policy) throw new Error("Policy not found");
    // Verify caller owns the policy's organization
    const { identity } = await requireOrgAccess(ctx, policy.orgId);

    // Audit log BEFORE deletion
    await logPolicyAudit(ctx, {
      orgId: policy.orgId,
      policyId: args.id,
      action: "deleted",
      changedBy: identity.subject,
      previousRules: JSON.stringify(policy.rulesJson),
      policyType: policy.policyType,
    });

    await ctx.db.delete(args.id);
  },
});

// Get Policy Audit Log

export const getAuditLog = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId);
    const limit = args.limit ?? 50;

    return await ctx.db
      .query("policyAuditLog")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(limit);
  },
});
