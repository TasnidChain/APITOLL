import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// DB-Backed Rate Limiter for Convex HTTP Actions
//
// Since Convex httpActions are stateless (V8 isolates),
// we use the rateLimits table for persistence.

/**
 * Check + increment a rate limit counter.
 * Returns { allowed, remaining, retryAfterMs }.
 *
 * windowMs: sliding window in milliseconds (e.g., 60_000 for 1 min)
 * maxRequests: max requests allowed per window
 * key: unique identifier (e.g., "signup:<ip>" or "gossip:<agentId>")
 */
export const checkRateLimit = internalMutation({
  args: {
    key: v.string(),
    windowMs: v.number(),
    maxRequests: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowStart = now - args.windowMs;

    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      // If the existing window has expired, reset it
      if (existing.windowStart < windowStart) {
        await ctx.db.patch(existing._id, {
          count: 1,
          windowStart: now,
        });
        return {
          allowed: true,
          remaining: args.maxRequests - 1,
          retryAfterMs: 0,
        };
      }

      // Window is still active — check limit
      if (existing.count >= args.maxRequests) {
        const retryAfterMs = existing.windowStart + args.windowMs - now;
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(0, retryAfterMs),
        };
      }

      // Increment counter
      await ctx.db.patch(existing._id, {
        count: existing.count + 1,
      });
      return {
        allowed: true,
        remaining: args.maxRequests - existing.count - 1,
        retryAfterMs: 0,
      };
    }

    // First request in this window — create record
    await ctx.db.insert("rateLimits", {
      key: args.key,
      count: 1,
      windowStart: now,
    });

    return {
      allowed: true,
      remaining: args.maxRequests - 1,
      retryAfterMs: 0,
    };
  },
});

/**
 * Cleanup expired rate limit records.
 * Should be called periodically (e.g., via cron) to avoid unbounded growth.
 */
export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 300_000; // 5 minutes ago
    const expired = await ctx.db
      .query("rateLimits")
      .withIndex("by_window", (q) => q.lt("windowStart", cutoff))
      .take(500);

    let deleted = 0;
    for (const record of expired) {
      await ctx.db.delete(record._id);
      deleted++;
    }

    return { deleted };
  },
});

/**
 * Get current rate limit status without incrementing (read-only).
 */
export const getRateLimitStatus = internalQuery({
  args: {
    key: v.string(),
    windowMs: v.number(),
    maxRequests: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowStart = now - args.windowMs;

    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!existing || existing.windowStart < windowStart) {
      return { count: 0, remaining: args.maxRequests, limited: false };
    }

    return {
      count: existing.count,
      remaining: Math.max(0, args.maxRequests - existing.count),
      limited: existing.count >= args.maxRequests,
    };
  },
});
