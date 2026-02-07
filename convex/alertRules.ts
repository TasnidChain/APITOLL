import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ═══════════════════════════════════════════════════
// Alert threshold validator (must match schema.ts)
// ═══════════════════════════════════════════════════

const alertThresholdValidator = v.object({
  percentage: v.optional(v.number()),
  amount: v.optional(v.number()),
  rate: v.optional(v.number()),
  windowMinutes: v.optional(v.number()),
});

// ═══════════════════════════════════════════════════
// Create Alert Rule
// ═══════════════════════════════════════════════════

export const create = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");

    const id = await ctx.db.insert("alertRules", {
      orgId: args.orgId,
      agentId: args.agentId,
      ruleType: args.ruleType,
      thresholdJson: args.thresholdJson,
      webhookUrl: args.webhookUrl,
      isActive: true,
    });

    return id;
  },
});

// ═══════════════════════════════════════════════════
// List Alert Rules by Org
// ═══════════════════════════════════════════════════

export const listByOrg = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("alertRules")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

// ═══════════════════════════════════════════════════
// Update Alert Rule
// ═══════════════════════════════════════════════════

export const update = mutation({
  args: {
    id: v.id("alertRules"),
    thresholdJson: v.optional(alertThresholdValidator),
    webhookUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.id);
    if (!rule) throw new Error("Alert rule not found");

    const update: any = {};
    if (args.thresholdJson) update.thresholdJson = args.thresholdJson;
    if (args.webhookUrl !== undefined) update.webhookUrl = args.webhookUrl;
    if (args.isActive !== undefined) update.isActive = args.isActive;

    await ctx.db.patch(args.id, update);
  },
});

// ═══════════════════════════════════════════════════
// Toggle Alert Rule
// ═══════════════════════════════════════════════════

export const toggleActive = mutation({
  args: {
    id: v.id("alertRules"),
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.id);
    if (!rule) throw new Error("Alert rule not found");
    await ctx.db.patch(args.id, { isActive: !rule.isActive });
  },
});

// ═══════════════════════════════════════════════════
// Delete Alert Rule
// ═══════════════════════════════════════════════════

export const remove = mutation({
  args: {
    id: v.id("alertRules"),
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.id);
    if (!rule) throw new Error("Alert rule not found");
    await ctx.db.delete(args.id);
  },
});
