import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireAuth, requireOrgAccess } from "./helpers";

// Submit Review (one review per org per tool)

export const submit = mutation({
  args: {
    toolId: v.id("tools"),
    orgId: v.id("organizations"),
    rating: v.number(),
    comment: v.optional(v.string()),
    agentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId);

    if (args.rating < 1 || args.rating > 5 || !Number.isInteger(args.rating)) {
      throw new Error("Rating must be an integer between 1 and 5");
    }

    const comment = args.comment?.slice(0, 500);

    // Check tool exists
    const tool = await ctx.db.get(args.toolId);
    if (!tool || !tool.isActive) throw new Error("Tool not found");

    // Check for existing review (one per org per tool)
    const existing = await ctx.db
      .query("toolReviews")
      .withIndex("by_tool_org", (q) =>
        q.eq("toolId", args.toolId).eq("orgId", args.orgId)
      )
      .first();

    if (existing) {
      // Update existing review
      const oldRating = existing.rating;
      await ctx.db.patch(existing._id, {
        rating: args.rating,
        comment,
        updatedAt: Date.now(),
      });

      // Update tool rating (remove old, add new)
      if (tool.ratingCount > 0) {
        const newRating =
          (tool.rating * tool.ratingCount - oldRating + args.rating) /
          tool.ratingCount;
        await ctx.db.patch(args.toolId, {
          rating: Math.round(newRating * 100) / 100,
        });
      }

      return { id: existing._id, updated: true };
    }

    // Create new review
    const id = await ctx.db.insert("toolReviews", {
      toolId: args.toolId,
      orgId: args.orgId,
      agentId: args.agentId?.slice(0, 128),
      rating: args.rating,
      comment,
      createdAt: Date.now(),
    });

    // Update tool rating (running average)
    const newCount = tool.ratingCount + 1;
    const newRating =
      (tool.rating * tool.ratingCount + args.rating) / newCount;
    await ctx.db.patch(args.toolId, {
      rating: Math.round(newRating * 100) / 100,
      ratingCount: newCount,
    });

    return { id, updated: false };
  },
});

// List Reviews for a Tool

export const listByTool = query({
  args: {
    toolId: v.id("tools"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("toolReviews")
      .withIndex("by_tool", (q) => q.eq("toolId", args.toolId))
      .take(args.limit ?? 50);

    // Enrich with org name
    const enriched = await Promise.all(
      reviews.map(async (review) => {
        const org = await ctx.db.get(review.orgId);
        return {
          ...review,
          orgName: org?.name ?? "Unknown",
        };
      })
    );

    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Internal: Submit review (from HTTP API)

export const internalSubmit = internalMutation({
  args: {
    toolId: v.id("tools"),
    orgId: v.id("organizations"),
    rating: v.number(),
    comment: v.optional(v.string()),
    agentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.rating < 1 || args.rating > 5 || !Number.isInteger(args.rating)) {
      throw new Error("Rating must be an integer between 1 and 5");
    }

    const comment = args.comment?.slice(0, 500);
    const tool = await ctx.db.get(args.toolId);
    if (!tool || !tool.isActive) throw new Error("Tool not found");

    const existing = await ctx.db
      .query("toolReviews")
      .withIndex("by_tool_org", (q) =>
        q.eq("toolId", args.toolId).eq("orgId", args.orgId)
      )
      .first();

    if (existing) {
      const oldRating = existing.rating;
      await ctx.db.patch(existing._id, {
        rating: args.rating,
        comment,
        updatedAt: Date.now(),
      });

      if (tool.ratingCount > 0) {
        const newRating =
          (tool.rating * tool.ratingCount - oldRating + args.rating) /
          tool.ratingCount;
        await ctx.db.patch(args.toolId, {
          rating: Math.round(newRating * 100) / 100,
        });
      }

      return { id: existing._id, updated: true };
    }

    const id = await ctx.db.insert("toolReviews", {
      toolId: args.toolId,
      orgId: args.orgId,
      agentId: args.agentId?.slice(0, 128),
      rating: args.rating,
      comment,
      createdAt: Date.now(),
    });

    const newCount = tool.ratingCount + 1;
    const newRating =
      (tool.rating * tool.ratingCount + args.rating) / newCount;
    await ctx.db.patch(args.toolId, {
      rating: Math.round(newRating * 100) / 100,
      ratingCount: newCount,
    });

    return { id, updated: false };
  },
});

// Internal: List reviews (from HTTP API)

export const internalListByTool = internalQuery({
  args: {
    toolId: v.id("tools"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("toolReviews")
      .withIndex("by_tool", (q) => q.eq("toolId", args.toolId))
      .take(args.limit ?? 50);

    const enriched = await Promise.all(
      reviews.map(async (review) => {
        const org = await ctx.db.get(review.orgId);
        return {
          _id: review._id,
          rating: review.rating,
          comment: review.comment,
          agentId: review.agentId,
          orgName: org?.name ?? "Unknown",
          createdAt: review.createdAt,
        };
      })
    );

    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});
