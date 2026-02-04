import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ═══════════════════════════════════════════════════
// Seed Default Categories
// ═══════════════════════════════════════════════════

export const seed = mutation({
  handler: async (ctx) => {
    const defaultCategories = [
      { slug: "data", name: "Data & APIs", description: "Weather, prices, news, and other data feeds", icon: "database" },
      { slug: "ai", name: "AI & ML", description: "Language models, image generation, embeddings", icon: "brain" },
      { slug: "search", name: "Search & Discovery", description: "Web search, knowledge bases, semantic search", icon: "search" },
      { slug: "compute", name: "Compute & Processing", description: "Code execution, file conversion, data processing", icon: "cpu" },
      { slug: "communication", name: "Communication", description: "Email, SMS, notifications, messaging", icon: "message-circle" },
      { slug: "finance", name: "Finance & Payments", description: "Prices, transactions, DeFi protocols", icon: "dollar-sign" },
      { slug: "storage", name: "Storage & Files", description: "File storage, IPFS, databases", icon: "hard-drive" },
      { slug: "identity", name: "Identity & Auth", description: "KYC, verification, credentials", icon: "shield" },
      { slug: "social", name: "Social & Web3", description: "Social graphs, NFTs, on-chain data", icon: "users" },
      { slug: "other", name: "Other", description: "Miscellaneous tools", icon: "box" },
    ];

    for (const cat of defaultCategories) {
      // Check if already exists
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", cat.slug))
        .first();

      if (!existing) {
        await ctx.db.insert("categories", cat);
      }
    }

    return { seeded: defaultCategories.length };
  },
});

// ═══════════════════════════════════════════════════
// List Categories
// ═══════════════════════════════════════════════════

export const list = query({
  handler: async (ctx) => {
    const categories = await ctx.db.query("categories").collect();

    // Get tool counts for each category
    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const tools = await ctx.db
          .query("tools")
          .withIndex("by_category", (q) => q.eq("category", cat.slug))
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect();

        return {
          ...cat,
          toolCount: tools.length,
        };
      })
    );

    return withCounts.sort((a, b) => b.toolCount - a.toolCount);
  },
});

// ═══════════════════════════════════════════════════
// Get Category
// ═══════════════════════════════════════════════════

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});
