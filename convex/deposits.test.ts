import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { modules } from "./test.setup";

describe("deposits", () => {
  // Helper: create an org for deposit tests
  async function createTestOrg(t: ReturnType<typeof convexTest<typeof schema>>) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        plan: "free",
        apiKey: "test-api-key-" + Math.random().toString(36).slice(2),
      });
    });
  }

  // ─── create ─────────────────────────────────────────────
  describe("create", () => {
    it("calculates 1.5% on-ramp fee correctly", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createTestOrg(t);

      const result = await t.mutation(api.deposits.create, {
        orgId,
        stripePaymentIntentId: "pi_test_001",
        fiatAmount: 100,
        walletAddress: "0x1234567890123456789012345678901234567890",
        chain: "base",
      });

      // $100 * 1.5% = $1.50 fee
      expect(result.feeAmount).toBeCloseTo(1.5, 2);
      // $100 - $1.50 = $98.50 USDC
      expect(result.usdcAmount).toBeCloseTo(98.5, 2);
    });

    it("calculates fee for small amounts", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createTestOrg(t);

      const result = await t.mutation(api.deposits.create, {
        orgId,
        stripePaymentIntentId: "pi_test_002",
        fiatAmount: 10,
        walletAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        chain: "base",
      });

      // $10 * 1.5% = $0.15 fee
      expect(result.feeAmount).toBeCloseTo(0.15, 2);
      expect(result.usdcAmount).toBeCloseTo(9.85, 2);
    });

    it("calculates fee for large amounts", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createTestOrg(t);

      const result = await t.mutation(api.deposits.create, {
        orgId,
        stripePaymentIntentId: "pi_test_003",
        fiatAmount: 10000,
        walletAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        chain: "base",
      });

      // $10000 * 1.5% = $150 fee
      expect(result.feeAmount).toBeCloseTo(150, 1);
      expect(result.usdcAmount).toBeCloseTo(9850, 1);
    });

    it("creates deposit with pending status", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createTestOrg(t);

      const result = await t.mutation(api.deposits.create, {
        orgId,
        stripePaymentIntentId: "pi_test_004",
        fiatAmount: 50,
        walletAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
        chain: "base",
      });

      const deposit = await t.run(async (ctx) => {
        return await ctx.db.get(result.id);
      });

      expect(deposit?.status).toBe("pending");
      expect(deposit?.exchangeRate).toBe(1.0);
      expect(deposit?.createdAt).toBeGreaterThan(0);
    });

    it("supports optional agentId parameter", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createTestOrg(t);

      // Create an agent
      const agentId = await t.run(async (ctx) => {
        return await ctx.db.insert("agents", {
          orgId,
          name: "TestAgent",
          walletAddress: "0xdddddddddddddddddddddddddddddddddddddd",
          chain: "base",
          balance: 0,
          status: "active",
          policiesJson: [],
        });
      });

      const result = await t.mutation(api.deposits.create, {
        orgId,
        agentId,
        stripePaymentIntentId: "pi_test_005",
        fiatAmount: 25,
        walletAddress: "0xdddddddddddddddddddddddddddddddddddddd",
        chain: "base",
      });

      const deposit = await t.run(async (ctx) => {
        return await ctx.db.get(result.id);
      });

      expect(deposit?.agentId).toBe(agentId);
    });
  });

  // ─── getByPaymentIntent ─────────────────────────────────
  describe("getByPaymentIntent", () => {
    it("finds deposit by Stripe payment intent ID", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createTestOrg(t);

      await t.mutation(api.deposits.create, {
        orgId,
        stripePaymentIntentId: "pi_unique_lookup",
        fiatAmount: 100,
        walletAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        chain: "base",
      });

      const found = await t.query(api.deposits.getByPaymentIntent, {
        stripePaymentIntentId: "pi_unique_lookup",
      });

      expect(found).toBeTruthy();
      expect(found?.fiatAmount).toBe(100);
    });

    it("returns null for non-existent payment intent", async () => {
      const t = convexTest(schema, modules);

      const found = await t.query(api.deposits.getByPaymentIntent, {
        stripePaymentIntentId: "pi_does_not_exist",
      });

      expect(found).toBeNull();
    });
  });

  // ─── getStats ───────────────────────────────────────────
  describe("getStats", () => {
    it("aggregates completed deposit statistics", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createTestOrg(t);

      // Create 3 deposits: 2 completed, 1 pending
      const deposit1 = await t.mutation(api.deposits.create, {
        orgId,
        stripePaymentIntentId: "pi_stats_1",
        fiatAmount: 100,
        walletAddress: "0x1111111111111111111111111111111111111111",
        chain: "base",
      });

      const deposit2 = await t.mutation(api.deposits.create, {
        orgId,
        stripePaymentIntentId: "pi_stats_2",
        fiatAmount: 200,
        walletAddress: "0x1111111111111111111111111111111111111111",
        chain: "base",
      });

      // Leave 3rd one as pending
      await t.mutation(api.deposits.create, {
        orgId,
        stripePaymentIntentId: "pi_stats_3",
        fiatAmount: 50,
        walletAddress: "0x1111111111111111111111111111111111111111",
        chain: "base",
      });

      // Mark first two as completed
      await t.run(async (ctx) => {
        await ctx.db.patch(deposit1.id, { status: "completed" });
        await ctx.db.patch(deposit2.id, { status: "completed" });
      });

      const stats = await t.query(api.deposits.getStats, { orgId });

      expect(stats.totalDeposits).toBe(3);
      expect(stats.completedDeposits).toBe(2);
      expect(stats.totalDeposited).toBe(300); // $100 + $200
      expect(stats.totalFees).toBeGreaterThan(0);
    });

    it("returns zero stats for org with no deposits", async () => {
      const t = convexTest(schema, modules);
      const orgId = await createTestOrg(t);

      const stats = await t.query(api.deposits.getStats, { orgId });

      expect(stats.totalDeposits).toBe(0);
      expect(stats.completedDeposits).toBe(0);
      expect(stats.totalDeposited).toBe(0);
      expect(stats.totalFees).toBe(0);
    });
  });
});
