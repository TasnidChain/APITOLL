import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { modules } from "./test.setup";

describe("admin", () => {
  const ADMIN_USER_ID = "user_admin_123";

  beforeEach(() => {
    // Set the admin user IDs env var
    vi.stubEnv("ADMIN_USER_IDS", ADMIN_USER_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("authentication", () => {
    it("rejects unauthenticated calls to getPlatformStats", async () => {
      const t = convexTest(schema, modules);

      await expect(
        t.query(api.admin.getPlatformStats, {})
      ).rejects.toThrow("Not authenticated");
    });

    it("rejects non-admin authenticated calls", async () => {
      const t = convexTest(schema, modules);
      const asNonAdmin = t.withIdentity({
        subject: "user_regular_456",
        name: "Regular User",
      });

      await expect(
        asNonAdmin.query(api.admin.getPlatformStats, {})
      ).rejects.toThrow("Not authorized");
    });

    it("allows admin user to access getPlatformStats", async () => {
      const t = convexTest(schema, modules);
      const asAdmin = t.withIdentity({
        subject: ADMIN_USER_ID,
        name: "Admin User",
      });

      const stats = await asAdmin.query(api.admin.getPlatformStats, {});
      expect(stats).toBeTruthy();
      expect(stats.orgs.total).toBe(0);
    });
  });

  describe("getPlatformStats", () => {
    it("counts organizations by plan", async () => {
      const t = convexTest(schema, modules);

      // Create orgs with different plans
      await t.run(async (ctx) => {
        await ctx.db.insert("organizations", {
          name: "FreeOrg",
          plan: "free",
          apiKey: "key-free",
        });
        await ctx.db.insert("organizations", {
          name: "ProOrg1",
          plan: "pro",
          apiKey: "key-pro1",
        });
        await ctx.db.insert("organizations", {
          name: "ProOrg2",
          plan: "pro",
          apiKey: "key-pro2",
        });
        await ctx.db.insert("organizations", {
          name: "EntOrg",
          plan: "enterprise",
          apiKey: "key-ent",
        });
      });

      const asAdmin = t.withIdentity({ subject: ADMIN_USER_ID });
      const stats = await asAdmin.query(api.admin.getPlatformStats, {});

      expect(stats.orgs.total).toBe(4);
      expect(stats.orgs.planDistribution.free).toBe(1);
      expect(stats.orgs.planDistribution.pro).toBe(2);
      expect(stats.orgs.planDistribution.enterprise).toBe(1);
    });

    it("counts agents by status", async () => {
      const t = convexTest(schema, modules);

      const orgId = await t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Org",
          plan: "enterprise",
          apiKey: "key-org",
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("agents", {
          orgId,
          name: "Active1",
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          balance: 100,
          status: "active",
          policiesJson: [],
        });
        await ctx.db.insert("agents", {
          orgId,
          name: "Paused1",
          walletAddress: "0x2222222222222222222222222222222222222222",
          chain: "base",
          balance: 50,
          status: "paused",
          policiesJson: [],
        });
        await ctx.db.insert("agents", {
          orgId,
          name: "Depleted1",
          walletAddress: "0x3333333333333333333333333333333333333333",
          chain: "base",
          balance: 0,
          status: "depleted",
          policiesJson: [],
        });
      });

      const asAdmin = t.withIdentity({ subject: ADMIN_USER_ID });
      const stats = await asAdmin.query(api.admin.getPlatformStats, {});

      expect(stats.agents.total).toBe(3);
      expect(stats.agents.active).toBe(1);
      expect(stats.agents.paused).toBe(1);
      expect(stats.agents.depleted).toBe(1);
    });

    it("aggregates transaction volume", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        await ctx.db.insert("transactions", {
          agentAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          endpointPath: "/api/test",
          method: "GET",
          amount: 0.005,
          currency: "USDC",
          chain: "base",
          status: "settled",
          requestedAt: Date.now(),
        });
        await ctx.db.insert("transactions", {
          agentAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          endpointPath: "/api/test",
          method: "GET",
          amount: 0.010,
          currency: "USDC",
          chain: "base",
          status: "settled",
          requestedAt: Date.now(),
        });
        await ctx.db.insert("transactions", {
          agentAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
          endpointPath: "/api/test",
          method: "GET",
          amount: 0.002,
          currency: "USDC",
          chain: "base",
          status: "failed",
          requestedAt: Date.now(),
        });
      });

      const asAdmin = t.withIdentity({ subject: ADMIN_USER_ID });
      const stats = await asAdmin.query(api.admin.getPlatformStats, {});

      expect(stats.transactions.total).toBe(3);
      expect(stats.transactions.settled).toBe(2);
      expect(stats.transactions.failed).toBe(1);
      expect(stats.transactions.totalVolume).toBeCloseTo(0.017, 3);
    });
  });

  describe("adminUpdatePlan", () => {
    it("rejects unauthenticated plan change", async () => {
      const t = convexTest(schema, modules);
      const orgId = await t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Org",
          plan: "free",
          apiKey: "key-1",
        });
      });

      await expect(
        t.mutation(api.admin.adminUpdatePlan, { orgId, plan: "pro" })
      ).rejects.toThrow("Not authenticated");
    });

    it("allows admin to change org plan", async () => {
      const t = convexTest(schema, modules);
      const orgId = await t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Org",
          plan: "free",
          apiKey: "key-2",
        });
      });

      const asAdmin = t.withIdentity({ subject: ADMIN_USER_ID });
      await asAdmin.mutation(api.admin.adminUpdatePlan, { orgId, plan: "pro" });

      const org = await t.run(async (ctx) => {
        return await ctx.db.get(orgId);
      });
      expect(org?.plan).toBe("pro");
    });
  });
});
