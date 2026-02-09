import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./helpers";

// ═══════════════════════════════════════════════════
// Create Tool (for Discovery)
// ═══════════════════════════════════════════════════

export const create = mutation({
  args: {
    sellerId: v.optional(v.id("sellers")),
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    baseUrl: v.string(),
    method: v.string(),
    path: v.string(),
    price: v.number(),
    chains: v.array(v.string()),
    category: v.string(),
    tags: v.optional(v.array(v.string())),
    inputSchema: v.optional(v.any()),
    outputSchema: v.optional(v.any()),
    mcpToolSpec: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    // Check if slug already exists
    const existing = await ctx.db
      .query("tools")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      throw new Error("Tool with this slug already exists");
    }

    const id = await ctx.db.insert("tools", {
      ...args,
      tags: args.tags ?? [],
      currency: "USDC",
      totalCalls: 0,
      avgLatencyMs: 0,
      rating: 0,
      ratingCount: 0,
      isActive: true,
      isVerified: false,
    });

    return id;
  },
});

// ═══════════════════════════════════════════════════
// Public Registration (from /api/discover/register)
// No auth required — tools start as unverified
// ═══════════════════════════════════════════════════

export const registerPublic = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    baseUrl: v.string(),
    method: v.string(),
    path: v.string(),
    price: v.number(),
    category: v.string(),
    chains: v.array(v.string()),
    walletAddress: v.string(),
    referralCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Generate slug from name
    const slug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      + "-" + Date.now().toString(36);

    // Check for duplicate base URL + path combo
    const existing = await ctx.db
      .query("tools")
      .filter((q) =>
        q.and(
          q.eq(q.field("baseUrl"), args.baseUrl),
          q.eq(q.field("path"), args.path)
        )
      )
      .first();

    if (existing) {
      return { id: existing._id, status: "already_registered", slug: existing.slug };
    }

    const id = await ctx.db.insert("tools", {
      name: args.name,
      slug,
      description: args.description,
      baseUrl: args.baseUrl,
      method: args.method,
      path: args.path,
      price: args.price,
      currency: "USDC",
      chains: args.chains,
      category: args.category,
      tags: [],
      totalCalls: 0,
      avgLatencyMs: 0,
      rating: 0,
      ratingCount: 0,
      isActive: true,
      isVerified: false, // Public registrations start unverified
    });

    return { id, status: "registered", slug };
  },
});

// ═══════════════════════════════════════════════════
// Search Tools
// ═══════════════════════════════════════════════════

export const search = query({
  args: {
    query: v.optional(v.string()),
    category: v.optional(v.string()),
    maxPrice: v.optional(v.number()),
    chains: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let tools;

    // Use search index if query provided
    if (args.query) {
      tools = await ctx.db
        .query("tools")
        .withSearchIndex("search_tools", (q) =>
          q.search("description", args.query!).eq("isActive", true)
        )
        .take(args.limit ?? 20);
    } else if (args.category) {
      tools = await ctx.db
        .query("tools")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .filter((q) => q.eq(q.field("isActive"), true))
        .take(args.limit ?? 20);
    } else {
      tools = await ctx.db
        .query("tools")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .take(args.limit ?? 20);
    }

    // Filter in memory
    let filtered = tools;

    if (args.maxPrice !== undefined) {
      filtered = filtered.filter((t) => t.price <= args.maxPrice!);
    }

    if (args.chains && args.chains.length > 0) {
      filtered = filtered.filter((t) =>
        args.chains!.some((chain) => t.chains.includes(chain))
      );
    }

    return filtered;
  },
});

// ═══════════════════════════════════════════════════
// Get by Slug
// ═══════════════════════════════════════════════════

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tools")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

// ═══════════════════════════════════════════════════
// Get Featured Tools
// ═══════════════════════════════════════════════════

export const getFeatured = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // First get premium featured tools
    const featuredTools = await ctx.db
      .query("tools")
      .withIndex("by_featured", (q) => q.eq("isFeatured", true))
      .filter((q) => q.eq(q.field("isActive"), true))
      .take(50);

    // Then get verified tools as fallback
    const verifiedTools = await ctx.db
      .query("tools")
      .filter((q) =>
        q.and(q.eq(q.field("isActive"), true), q.eq(q.field("isVerified"), true))
      )
      .take(50);

    // Merge, deduplicate, and sort by boost score + rating
    const seen = new Set<string>();
    const allTools = [...featuredTools, ...verifiedTools].filter((t) => {
      if (seen.has(t._id)) return false;
      seen.add(t._id);
      return true;
    });

    // Sort: featured first (by boost score), then verified (by rating)
    return allTools
      .sort((a, b) => {
        const aScore = (a.boostScore ?? 0) * 10 + a.rating;
        const bScore = (b.boostScore ?? 0) * 10 + b.rating;
        return bScore - aScore;
      })
      .slice(0, args.limit ?? 10);
  },
});

// ═══════════════════════════════════════════════════
// Get by Seller
// ═══════════════════════════════════════════════════

export const getBySeller = query({
  args: { sellerId: v.id("sellers") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tools")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.sellerId))
      .collect();
  },
});

// ═══════════════════════════════════════════════════
// Update Tool
// ═══════════════════════════════════════════════════

export const update = mutation({
  args: {
    id: v.id("tools"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    chains: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    inputSchema: v.optional(v.any()),
    outputSchema: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(id, filteredUpdates);
  },
});

// ═══════════════════════════════════════════════════
// Deactivate Tool
// ═══════════════════════════════════════════════════

export const deactivate = mutation({
  args: { id: v.id("tools") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await ctx.db.patch(args.id, { isActive: false });
  },
});

// ═══════════════════════════════════════════════════
// Increment Calls (called after successful usage)
// ═══════════════════════════════════════════════════

export const incrementCalls = mutation({
  args: {
    id: v.id("tools"),
    latencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    const tool = await ctx.db.get(args.id);
    if (!tool) return;

    const newTotalCalls = tool.totalCalls + 1;
    const newAvgLatency =
      (tool.avgLatencyMs * tool.totalCalls + args.latencyMs) / newTotalCalls;

    await ctx.db.patch(args.id, {
      totalCalls: newTotalCalls,
      avgLatencyMs: Math.round(newAvgLatency),
    });
  },
});

// ═══════════════════════════════════════════════════
// Get as MCP Format
// ═══════════════════════════════════════════════════

export const getAsMCP = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const tool = await ctx.db
      .query("tools")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!tool) return null;

    return {
      name: tool.slug,
      description: tool.description,
      inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
      "x-402": {
        baseUrl: tool.baseUrl,
        method: tool.method,
        path: tool.path,
        price: tool.price,
        currency: tool.currency,
        chains: tool.chains,
      },
    };
  },
});

// ═══════════════════════════════════════════════════
// List All as MCP
// ═══════════════════════════════════════════════════

export const listAsMCP = query({
  args: {
    category: v.optional(v.string()),
    chains: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let tools;

    if (args.category) {
      tools = await ctx.db
        .query("tools")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .filter((q) => q.eq(q.field("isActive"), true))
        .take(args.limit ?? 50);
    } else {
      tools = await ctx.db
        .query("tools")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .take(args.limit ?? 50);
    }

    // Filter by chains
    if (args.chains && args.chains.length > 0) {
      tools = tools.filter((t) =>
        args.chains!.some((chain) => t.chains.includes(chain))
      );
    }

    return tools.map((tool) => ({
      name: tool.slug,
      description: tool.description,
      inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
      "x-402": {
        baseUrl: tool.baseUrl,
        method: tool.method,
        path: tool.path,
        price: tool.price,
        currency: tool.currency,
        chains: tool.chains,
      },
    }));
  },
});

// ═══════════════════════════════════════════════════
// Premium Marketplace: Set Featured
// ═══════════════════════════════════════════════════

export const setFeatured = mutation({
  args: {
    id: v.id("tools"),
    isFeatured: v.boolean(),
    featuredDurationDays: v.optional(v.number()), // how long to feature
    listingTier: v.optional(v.union(
      v.literal("free"),
      v.literal("featured"),
      v.literal("verified"),
      v.literal("premium")
    )),
    boostScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const updates: {
      isFeatured: boolean;
      listingTier: "free" | "featured" | "verified" | "premium";
      boostScore: number;
      featuredUntil?: number;
    } = {
      isFeatured: args.isFeatured,
      listingTier: args.listingTier ?? (args.isFeatured ? "featured" : "free"),
      boostScore: Math.max(0, Math.min(100, args.boostScore ?? (args.isFeatured ? 50 : 0))),
    };

    if (args.isFeatured && args.featuredDurationDays) {
      updates.featuredUntil = Date.now() + args.featuredDurationDays * 24 * 60 * 60 * 1000;
    }

    if (!args.isFeatured) {
      updates.featuredUntil = undefined;
      updates.boostScore = 0;
    }

    await ctx.db.patch(args.id, updates);
  },
});

// ═══════════════════════════════════════════════════
// Premium Marketplace: Set Verified
// ═══════════════════════════════════════════════════

export const setVerified = mutation({
  args: {
    id: v.id("tools"),
    isVerified: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await ctx.db.patch(args.id, {
      isVerified: args.isVerified,
      listingTier: args.isVerified ? "verified" : "free",
    });
  },
});

// ═══════════════════════════════════════════════════
// Rate a Tool
// ═══════════════════════════════════════════════════

export const rateTool = mutation({
  args: {
    id: v.id("tools"),
    rating: v.number(), // 1-5
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const tool = await ctx.db.get(args.id);
    if (!tool) throw new Error("Tool not found");

    const newCount = tool.ratingCount + 1;
    const newRating = (tool.rating * tool.ratingCount + args.rating) / newCount;

    await ctx.db.patch(args.id, {
      rating: Math.round(newRating * 100) / 100,
      ratingCount: newCount,
    });
  },
});
