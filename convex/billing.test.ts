import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { modules } from "./test.setup";
import { priceIdToPlan } from "./billing";

describe("billing", () => {
  // Helper: create an org with a specific plan
  async function createOrg(
    t: ReturnType<typeof convexTest>,
    plan: "free" | "pro" | "enterprise" = "free"
  ) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        plan,
        apiKey: "key-" + Math.random().toString(36).slice(2),
      });
    });
  }

  // ─── priceIdToPlan (pure function) ──────────────────────
  describe("priceIdToPlan", () => {
    it("maps pro price IDs to 'pro'", () => {
      expect(priceIdToPlan("price_pro_monthly")).toBe("pro");
      expect(priceIdToPlan("price_pro_yearly")).toBe("pro");
    });

    it("maps enterprise price IDs to 'enterprise'", () => {
      expect(priceIdToPlan("price_ent_monthly")).toBe("enterprise");
      expect(priceIdToPlan("price_ent_yearly")).toBe("enterprise");
    });

    it("defaults to 'free' for unknown price IDs", () => {
      expect(priceIdToPlan("price_unknown")).toBe("free");
      expect(priceIdToPlan("")).toBe("free");
    });
  });

  // ─── incrementUsage ─────────────────────────────────────
  describe("incrementUsage", () => {
    it("allows usage within free plan limit (1000/day)", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createOrg(t, "free");

      const result = await t.mutation(api.billing.incrementUsage, { orgId });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(999);
    });

    it("blocks usage when free plan daily limit is reached", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createOrg(t, "free");

      // Set count to 1000 (limit) for today
      const today = new Date().toISOString().split("T")[0];
      await t.run(async (ctx) => {
        await ctx.db.patch(orgId, {
          dailyCallCount: 1000,
          dailyCallDate: today,
        });
      });

      const result = await t.mutation(api.billing.incrementUsage, { orgId });
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("resets counter on new day", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createOrg(t, "free");

      // Set count to 999 for yesterday
      await t.run(async (ctx) => {
        await ctx.db.patch(orgId, {
          dailyCallCount: 999,
          dailyCallDate: "2024-01-01", // old date
        });
      });

      const result = await t.mutation(api.billing.incrementUsage, { orgId });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(999); // reset to 1000, used 1 = 999 remaining
    });

    it("pro plan has 100k daily limit", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createOrg(t, "pro");

      const result = await t.mutation(api.billing.incrementUsage, { orgId });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99999);
    });

    it("returns not allowed for non-existent org", async () => {
      const t = convexTest(schema, modules);
      // Use a fake org ID (any valid doc ID structure)
      const orgId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("organizations", {
          name: "Temp",
          plan: "free",
          apiKey: "temp",
        });
        await ctx.db.delete(id);
        return id;
      });

      const result = await t.mutation(api.billing.incrementUsage, { orgId });
      expect(result.allowed).toBe(false);
    });
  });

  // ─── checkAgentLimit ────────────────────────────────────
  describe("checkAgentLimit", () => {
    it("allows first agent on free plan", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createOrg(t, "free");

      const result = await t.query(api.billing.checkAgentLimit, { orgId });
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1);
      expect(result.current).toBe(0);
    });

    it("blocks second agent on free plan", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createOrg(t, "free");

      // Add one agent
      await t.run(async (ctx) => {
        await ctx.db.insert("agents", {
          orgId,
          name: "Agent1",
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          balance: 0,
          status: "active",
          policiesJson: [],
        });
      });

      const result = await t.query(api.billing.checkAgentLimit, { orgId });
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(1);
    });

    it("allows up to 10 agents on pro plan", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createOrg(t, "pro");

      // Add 9 agents
      for (let i = 0; i < 9; i++) {
        await t.run(async (ctx) => {
          await ctx.db.insert("agents", {
            orgId,
            name: `Agent${i}`,
            walletAddress: `0x${(i + 1).toString().padStart(40, "0")}`,
            chain: "base",
            balance: 0,
            status: "active",
            policiesJson: [],
          });
        });
      }

      const result = await t.query(api.billing.checkAgentLimit, { orgId });
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(9);
      expect(result.limit).toBe(10);
    });
  });

  // ─── checkSellerLimit ───────────────────────────────────
  describe("checkSellerLimit", () => {
    it("allows up to 2 sellers on free plan", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createOrg(t, "free");

      const result = await t.query(api.billing.checkSellerLimit, { orgId });
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(2);
    });

    it("blocks 3rd seller on free plan", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createOrg(t, "free");

      // Add 2 sellers
      for (let i = 0; i < 2; i++) {
        await t.run(async (ctx) => {
          await ctx.db.insert("sellers", {
            orgId,
            name: `Seller${i}`,
            walletAddress: `0x${(i + 1).toString().padStart(40, "a")}`,
            apiKey: `seller-key-${i}`,
          });
        });
      }

      const result = await t.query(api.billing.checkSellerLimit, { orgId });
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(2);
    });
  });

  // ─── activateSubscription ───────────────────────────────
  describe("activateSubscription", () => {
    it("updates org to pro plan with subscription details", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createOrg(t, "free");
      const periodEnd = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

      await t.mutation(api.billing.activateSubscription, {
        orgId,
        stripeSubscriptionId: "sub_test_123",
        stripePriceId: "price_pro_monthly",
        plan: "pro",
        billingPeriodEnd: periodEnd,
      });

      const org = await t.run(async (ctx) => {
        return await ctx.db.get(orgId);
      });

      expect(org?.plan).toBe("pro");
      expect(org?.stripeSubscriptionId).toBe("sub_test_123");
      expect(org?.billingPeriodEnd).toBe(periodEnd);
    });
  });

  // ─── cancelSubscription ─────────────────────────────────
  describe("cancelSubscription", () => {
    it("downgrades org to free plan and clears subscription", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createOrg(t, "pro");

      // Set subscription details
      await t.run(async (ctx) => {
        await ctx.db.patch(orgId, {
          stripeSubscriptionId: "sub_to_cancel",
          stripePriceId: "price_pro_monthly",
          billingPeriodEnd: Date.now() + 86400000,
        });
      });

      await t.mutation(api.billing.cancelSubscription, { orgId });

      const org = await t.run(async (ctx) => {
        return await ctx.db.get(orgId);
      });

      expect(org?.plan).toBe("free");
      expect(org?.stripeSubscriptionId).toBeUndefined();
      expect(org?.stripePriceId).toBeUndefined();
      expect(org?.billingPeriodEnd).toBeUndefined();
    });
  });

  // ─── getByStripeCustomer ────────────────────────────────
  describe("getByStripeCustomer", () => {
    it("finds org by Stripe customer ID", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createOrg(t, "pro");

      await t.run(async (ctx) => {
        await ctx.db.patch(orgId, {
          stripeCustomerId: "cus_test_lookup",
        });
      });

      const found = await t.query(api.billing.getByStripeCustomer, {
        stripeCustomerId: "cus_test_lookup",
      });

      expect(found).toBeTruthy();
      expect(found?._id).toBe(orgId);
    });

    it("returns null for unknown Stripe customer", async () => {
      const t = convexTest(schema, modules);

      const found = await t.query(api.billing.getByStripeCustomer, {
        stripeCustomerId: "cus_nonexistent",
      });

      expect(found).toBeNull();
    });
  });
});
