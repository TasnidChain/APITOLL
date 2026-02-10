import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireOrgAccess } from "./helpers";

// ═══════════════════════════════════════════════════
// Toggle Favorite (add/remove bookmark)
// ═══════════════════════════════════════════════════

export const toggle = mutation({
  args: {
    toolId: v.id("tools"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId);

    const tool = await ctx.db.get(args.toolId);
    if (!tool) throw new Error("Tool not found");

    const existing = await ctx.db
      .query("toolFavorites")
      .withIndex("by_tool_org", (q) =>
        q.eq("toolId", args.toolId).eq("orgId", args.orgId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { favorited: false };
    }

    await ctx.db.insert("toolFavorites", {
      toolId: args.toolId,
      orgId: args.orgId,
      createdAt: Date.now(),
    });

    return { favorited: true };
  },
});

// ═══════════════════════════════════════════════════
// List Favorites for an Org
// ═══════════════════════════════════════════════════

export const listByOrg = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId);

    const favorites = await ctx.db
      .query("toolFavorites")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Enrich with tool data
    const enriched = await Promise.all(
      favorites.map(async (fav) => {
        const tool = await ctx.db.get(fav.toolId);
        return tool
          ? {
              _id: fav._id,
              toolId: fav.toolId,
              tool: {
                name: tool.name,
                slug: tool.slug,
                description: tool.description,
                price: tool.price,
                category: tool.category,
                rating: tool.rating,
                isActive: tool.isActive,
                isVerified: tool.isVerified,
              },
              createdAt: fav.createdAt,
            }
          : null;
      })
    );

    return enriched.filter(Boolean);
  },
});

// ═══════════════════════════════════════════════════
// Check if Favorited
// ═══════════════════════════════════════════════════

export const isFavorited = query({
  args: {
    toolId: v.id("tools"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("toolFavorites")
      .withIndex("by_tool_org", (q) =>
        q.eq("toolId", args.toolId).eq("orgId", args.orgId)
      )
      .first();

    return !!existing;
  },
});

// ═══════════════════════════════════════════════════
// Internal: Toggle (from HTTP API)
// ═══════════════════════════════════════════════════

export const internalToggle = internalMutation({
  args: {
    toolId: v.id("tools"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const tool = await ctx.db.get(args.toolId);
    if (!tool) throw new Error("Tool not found");

    const existing = await ctx.db
      .query("toolFavorites")
      .withIndex("by_tool_org", (q) =>
        q.eq("toolId", args.toolId).eq("orgId", args.orgId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { favorited: false };
    }

    await ctx.db.insert("toolFavorites", {
      toolId: args.toolId,
      orgId: args.orgId,
      createdAt: Date.now(),
    });

    return { favorited: true };
  },
});

// ═══════════════════════════════════════════════════
// Internal: List (from HTTP API)
// ═══════════════════════════════════════════════════

export const internalListByOrg = internalQuery({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const favorites = await ctx.db
      .query("toolFavorites")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const enriched = await Promise.all(
      favorites.map(async (fav) => {
        const tool = await ctx.db.get(fav.toolId);
        return tool
          ? {
              toolId: fav.toolId,
              name: tool.name,
              slug: tool.slug,
              description: tool.description,
              price: tool.price,
              category: tool.category,
              rating: tool.rating,
            }
          : null;
      })
    );

    return enriched.filter(Boolean);
  },
});
