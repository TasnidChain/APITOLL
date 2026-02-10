import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAuth, requireAdmin } from "./helpers";

// Create Referral Code

export const createReferral = mutation({
  args: {
    referrerSellerId: v.optional(v.id("sellers")),
    referrerWallet: v.string(),
    referralCode: v.string(),
    commissionBps: v.optional(v.number()), // default 50 = 0.5%
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    // Check for duplicate referral code
    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_code", (q) => q.eq("referralCode", args.referralCode))
      .first();

    if (existing) {
      throw new Error(`Referral code "${args.referralCode}" already exists`);
    }

    const id = await ctx.db.insert("referrals", {
      referrerSellerId: args.referrerSellerId,
      referrerWallet: args.referrerWallet,
      referralCode: args.referralCode,
      referredTransactions: 0,
      totalVolume: 0,
      totalCommission: 0,
      commissionBps: args.commissionBps ?? 50, // 0.5% default
      isActive: true,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });

    return id;
  },
});

// Track Referral Event (called on each referred tx)

// internalMutation — only called from httpActions after tx validation
export const trackReferralEvent = internalMutation({
  args: {
    referralCode: v.string(),
    transactionId: v.id("transactions"),
    volume: v.number(),
    chain: v.union(v.literal("base"), v.literal("solana")),
  },
  handler: async (ctx, args) => {
    // Look up the referral
    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_code", (q) => q.eq("referralCode", args.referralCode))
      .first();

    if (!referral || !referral.isActive) {
      return { tracked: false, reason: "Invalid or inactive referral code" };
    }

    // Check expiration
    if (referral.expiresAt && Date.now() > referral.expiresAt) {
      return { tracked: false, reason: "Referral code expired" };
    }

    // Calculate commission
    const commission = (args.volume * referral.commissionBps) / 10_000;

    // Create the referral event
    const eventId = await ctx.db.insert("referralEvents", {
      referralId: referral._id,
      transactionId: args.transactionId,
      volume: args.volume,
      commission,
      chain: args.chain,
      createdAt: Date.now(),
    });

    // Update the referral totals
    await ctx.db.patch(referral._id, {
      referredTransactions: referral.referredTransactions + 1,
      totalVolume: referral.totalVolume + args.volume,
      totalCommission: referral.totalCommission + commission,
    });

    return { tracked: true, commission, eventId };
  },
});

// Get Referral by Code

export const getByCode = query({
  args: { referralCode: v.string() },
  handler: async (ctx, args) => {
    // Require authentication to look up referral data
    await requireAuth(ctx);
    return await ctx.db
      .query("referrals")
      .withIndex("by_code", (q) => q.eq("referralCode", args.referralCode))
      .first();
  },
});

// Get Referral Stats for Seller

export const getByWallet = query({
  args: { referrerWallet: v.string() },
  handler: async (ctx, args) => {
    // Require authentication
    await requireAuth(ctx);
    return await ctx.db
      .query("referrals")
      .withIndex("by_wallet", (q) => q.eq("referrerWallet", args.referrerWallet))
      .collect();
  },
});

export const getBySeller = query({
  args: { sellerId: v.id("sellers") },
  handler: async (ctx, args) => {
    // Require authentication
    await requireAuth(ctx);
    return await ctx.db
      .query("referrals")
      .withIndex("by_seller", (q) => q.eq("referrerSellerId", args.sellerId))
      .collect();
  },
});

// Get Referral Events for a Referral

export const getEvents = query({
  args: {
    referralId: v.id("referrals"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Require authentication
    await requireAuth(ctx);
    return await ctx.db
      .query("referralEvents")
      .withIndex("by_referral", (q) => q.eq("referralId", args.referralId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// Deactivate Referral

export const deactivate = mutation({
  args: { referralId: v.id("referrals") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await ctx.db.patch(args.referralId, { isActive: false });
  },
});

// Platform-wide Referral Stats

export const platformStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const referrals = await ctx.db.query("referrals").collect();
    const active = referrals.filter((r) => r.isActive);

    return {
      totalReferrals: referrals.length,
      activeReferrals: active.length,
      totalVolume: referrals.reduce((sum, r) => sum + r.totalVolume, 0),
      totalCommissions: referrals.reduce((sum, r) => sum + r.totalCommission, 0),
      totalTransactions: referrals.reduce((sum, r) => sum + r.referredTransactions, 0),
    };
  },
});
