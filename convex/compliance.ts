import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";
import { requireAdmin } from "./helpers";

// ═══════════════════════════════════════════════════
// Compliance Screening (Moat: Regulatory Foundation)
// Screens wallet addresses against sanctions lists.
// Currently a stub — real OFAC integration gated behind env var.
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// Screen a Wallet Address
// ═══════════════════════════════════════════════════

export const screenWallet = internalMutation({
  args: {
    walletAddress: v.string(),
    screeningType: v.union(v.literal("ofac_sdn"), v.literal("kyt")),
  },
  handler: async (ctx, args) => {
    // Check if already screened recently (within 24 hours)
    const existing = await ctx.db
      .query("complianceScreenings")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .order("desc")
      .first();

    if (existing && (Date.now() - existing.screenedAt) < 24 * 60 * 60 * 1000) {
      return existing;
    }

    // Stub implementation — returns "clear" for all addresses
    // Real OFAC screening would:
    // 1. Download SDN list CSV from treasury.gov
    // 2. Check wallet against known sanctioned addresses
    // 3. Return "flagged" or "blocked" for matches
    const result = "clear" as const;

    const id = await ctx.db.insert("complianceScreenings", {
      walletAddress: args.walletAddress,
      screeningType: args.screeningType,
      result,
      provider: "stub",
      details: "Default screening — OFAC integration pending",
      screenedAt: Date.now(),
    });

    return { _id: id, result, walletAddress: args.walletAddress };
  },
});

// ═══════════════════════════════════════════════════
// Check if a Wallet is Blocked
// ═══════════════════════════════════════════════════

export const isWalletBlocked = internalQuery({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("complianceScreenings")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .order("desc")
      .first();

    if (!latest) return false; // Unscreened = allowed (screening happens on registration)

    return latest.result === "blocked" || latest.result === "flagged";
  },
});

// ═══════════════════════════════════════════════════
// Admin: List All Screenings
// ═══════════════════════════════════════════════════

export const listScreenings = query({
  args: {
    limit: v.optional(v.number()),
    resultFilter: v.optional(v.union(v.literal("clear"), v.literal("flagged"), v.literal("blocked"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 100;

    if (args.resultFilter) {
      return await ctx.db
        .query("complianceScreenings")
        .withIndex("by_result", (q) => q.eq("result", args.resultFilter!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("complianceScreenings")
      .withIndex("by_screened")
      .order("desc")
      .take(limit);
  },
});

// ═══════════════════════════════════════════════════
// Admin: Manually Block a Wallet
// ═══════════════════════════════════════════════════

export const blockWallet = internalMutation({
  args: {
    walletAddress: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("complianceScreenings", {
      walletAddress: args.walletAddress,
      screeningType: "kyt",
      result: "blocked",
      provider: "admin",
      details: args.reason ?? "Manually blocked by admin",
      screenedAt: Date.now(),
    });
  },
});
