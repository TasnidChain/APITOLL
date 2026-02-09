import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./helpers";

// ═══════════════════════════════════════════════════
// Create Agent
// ═══════════════════════════════════════════════════

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    walletAddress: v.string(),
    chain: v.union(v.literal("base"), v.literal("solana")),
    policies: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const id = await ctx.db.insert("agents", {
      orgId: args.orgId,
      name: args.name,
      walletAddress: args.walletAddress,
      chain: args.chain,
      balance: 0,
      status: "active",
      policiesJson: args.policies ?? [],
    });
    return id;
  },
});

// ═══════════════════════════════════════════════════
// List Agents by Org
// ═══════════════════════════════════════════════════

export const listByOrg = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("agents")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

// ═══════════════════════════════════════════════════
// Get Agent
// ═══════════════════════════════════════════════════

export const get = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db.get(args.id);
  },
});

// ═══════════════════════════════════════════════════
// Get by Wallet Address
// ═══════════════════════════════════════════════════

export const getByWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("agents")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();
  },
});

// ═══════════════════════════════════════════════════
// Update Balance
// ═══════════════════════════════════════════════════

export const updateBalance = mutation({
  args: {
    id: v.id("agents"),
    balance: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const agent = await ctx.db.get(args.id);
    if (!agent) throw new Error("Agent not found");

    const newStatus =
      args.balance <= 0 ? "depleted" : agent.status === "depleted" ? "active" : agent.status;

    await ctx.db.patch(args.id, {
      balance: args.balance,
      status: newStatus,
    });
  },
});

// ═══════════════════════════════════════════════════
// Update Status
// ═══════════════════════════════════════════════════

export const updateStatus = mutation({
  args: {
    id: v.id("agents"),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("depleted")),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await ctx.db.patch(args.id, { status: args.status });
  },
});

// ═══════════════════════════════════════════════════
// Update Policies
// ═══════════════════════════════════════════════════

export const updatePolicies = mutation({
  args: {
    id: v.id("agents"),
    policies: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await ctx.db.patch(args.id, { policiesJson: args.policies });
  },
});
