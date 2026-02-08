import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ═══════════════════════════════════════════════════
// Valid Webhook Events
// ═══════════════════════════════════════════════════

const VALID_EVENTS = [
  "payment.completed",
  "payment.failed",
  "dispute.opened",
  "dispute.resolved",
  "agent.depleted",
  "seller.payout",
  "tool.registered",
  "tool.updated",
] as const;

function validateEvents(events: string[]) {
  if (events.length === 0) {
    throw new Error("At least one event is required");
  }
  for (const event of events) {
    if (!VALID_EVENTS.includes(event as any)) {
      throw new Error(
        `Invalid event: "${event}". Valid events: ${VALID_EVENTS.join(", ")}`
      );
    }
  }
}

// ═══════════════════════════════════════════════════
// Generate Signing Secret
// ═══════════════════════════════════════════════════

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "whsec_" + hex;
}

// ═══════════════════════════════════════════════════
// Create Webhook
// ═══════════════════════════════════════════════════

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    sellerId: v.optional(v.id("sellers")),
    url: v.string(),
    events: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");

    if (args.sellerId) {
      const seller = await ctx.db.get(args.sellerId);
      if (!seller) throw new Error("Seller not found");
    }

    validateEvents(args.events);

    if (!args.url.startsWith("https://")) {
      throw new Error("Webhook URL must use HTTPS");
    }

    const secret = generateSecret();

    const id = await ctx.db.insert("webhooks", {
      orgId: args.orgId,
      sellerId: args.sellerId,
      url: args.url,
      secret,
      events: args.events,
      isActive: true,
      failureCount: 0,
      createdAt: Date.now(),
    });

    return { id, secret };
  },
});

// ═══════════════════════════════════════════════════
// List Webhooks by Org
// ═══════════════════════════════════════════════════

export const listByOrg = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("webhooks")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

// ═══════════════════════════════════════════════════
// Get Single Webhook
// ═══════════════════════════════════════════════════

export const get = query({
  args: {
    id: v.id("webhooks"),
  },
  handler: async (ctx, args) => {
    const webhook = await ctx.db.get(args.id);
    if (!webhook) throw new Error("Webhook not found");
    return webhook;
  },
});

// ═══════════════════════════════════════════════════
// Update Webhook
// ═══════════════════════════════════════════════════

export const update = mutation({
  args: {
    id: v.id("webhooks"),
    url: v.optional(v.string()),
    events: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const webhook = await ctx.db.get(args.id);
    if (!webhook) throw new Error("Webhook not found");

    const update: Record<string, any> = {};

    if (args.url !== undefined) {
      if (!args.url.startsWith("https://")) {
        throw new Error("Webhook URL must use HTTPS");
      }
      update.url = args.url;
    }

    if (args.events !== undefined) {
      validateEvents(args.events);
      update.events = args.events;
    }

    if (args.isActive !== undefined) {
      update.isActive = args.isActive;
      // Reset failure count when re-activating
      if (args.isActive && webhook.failureCount > 0) {
        update.failureCount = 0;
      }
    }

    await ctx.db.patch(args.id, update);
  },
});

// ═══════════════════════════════════════════════════
// Rotate Webhook Secret
// ═══════════════════════════════════════════════════

export const rotateSecret = mutation({
  args: {
    id: v.id("webhooks"),
  },
  handler: async (ctx, args) => {
    const webhook = await ctx.db.get(args.id);
    if (!webhook) throw new Error("Webhook not found");

    const secret = generateSecret();
    await ctx.db.patch(args.id, { secret });

    return secret;
  },
});

// ═══════════════════════════════════════════════════
// Remove Webhook
// ═══════════════════════════════════════════════════

export const remove = mutation({
  args: {
    id: v.id("webhooks"),
  },
  handler: async (ctx, args) => {
    const webhook = await ctx.db.get(args.id);
    if (!webhook) throw new Error("Webhook not found");

    // Delete associated deliveries
    const deliveries = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_webhook", (q) => q.eq("webhookId", args.id))
      .collect();

    for (const delivery of deliveries) {
      await ctx.db.delete(delivery._id);
    }

    await ctx.db.delete(args.id);
  },
});

// ═══════════════════════════════════════════════════
// Create Test Delivery
// ═══════════════════════════════════════════════════

export const createTestDelivery = mutation({
  args: {
    webhookId: v.id("webhooks"),
  },
  handler: async (ctx, args) => {
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) throw new Error("Webhook not found");

    const payload = JSON.stringify({
      event: "test.ping",
      timestamp: Date.now(),
      data: {
        message: "This is a test webhook delivery",
        webhookId: args.webhookId,
      },
    });

    const id = await ctx.db.insert("webhookDeliveries", {
      webhookId: args.webhookId,
      event: "test.ping",
      payload,
      status: "pending",
      attempts: 0,
      lastAttemptAt: Date.now(),
    });

    // Update webhook lastTriggeredAt
    await ctx.db.patch(args.webhookId, {
      lastTriggeredAt: Date.now(),
    });

    return id;
  },
});

// ═══════════════════════════════════════════════════
// List Deliveries for a Webhook
// ═══════════════════════════════════════════════════

export const listDeliveries = query({
  args: {
    webhookId: v.id("webhooks"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_webhook", (q) => q.eq("webhookId", args.webhookId))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

// ═══════════════════════════════════════════════════
// Get Webhook Stats for Org
// ═══════════════════════════════════════════════════

export const getStats = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const total = webhooks.length;
    const active = webhooks.filter((w) => w.isActive).length;
    const failing = webhooks.filter((w) => w.failureCount >= 3).length;

    return { total, active, failing };
  },
});
