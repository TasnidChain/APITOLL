import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
    const tools = await ctx.db
      .query("tools")
      .filter((q) =>
        q.and(q.eq(q.field("isActive"), true), q.eq(q.field("isVerified"), true))
      )
      .take(args.limit ?? 10);

    // Sort by rating
    return tools.sort((a, b) => b.rating - a.rating);
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
