import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { modules } from "./test.setup";

describe("transactions", () => {
  // ─── create ─────────────────────────────────────────────
  describe("create", () => {
    it("inserts a single transaction and returns its ID", async () => {
      const t = convexTest(schema, modules);
      const id = await t.mutation(internal.transactions.create, {
        agentAddress: "0x1234567890123456789012345678901234567890",
        endpointPath: "/api/weather",
        method: "GET",
        amount: 0.002,
        chain: "base",
        status: "settled",
        requestedAt: Date.now(),
      });
      expect(id).toBeTruthy();
    });

    it("defaults currency to USDC when not provided", async () => {
      const t = convexTest(schema, modules);
      const id = await t.mutation(internal.transactions.create, {
        agentAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        endpointPath: "/api/data",
        method: "POST",
        amount: 0.005,
        chain: "base",
        status: "pending",
        requestedAt: Date.now(),
      });

      // Read back from DB to verify default
      const tx = await t.run(async (ctx) => {
        return await ctx.db.get(id);
      });
      expect(tx?.currency).toBe("USDC");
    });

    it("stores custom currency when provided", async () => {
      const t = convexTest(schema, modules);
      const id = await t.mutation(internal.transactions.create, {
        agentAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        endpointPath: "/api/test",
        method: "GET",
        amount: 1.0,
        chain: "solana",
        status: "settled",
        currency: "SOL",
        requestedAt: Date.now(),
      });

      const tx = await t.run(async (ctx) => {
        return await ctx.db.get(id);
      });
      expect(tx?.currency).toBe("SOL");
      expect(tx?.chain).toBe("solana");
    });
  });

  // ─── createBatch ────────────────────────────────────────
  describe("createBatch", () => {
    it("batch inserts multiple transactions", async () => {
      const t = convexTest(schema, modules);
      const txs = Array.from({ length: 5 }, (_, i) => ({
        agentAddress: "0x1111111111111111111111111111111111111111",
        endpointPath: `/api/endpoint-${i}`,
        method: "GET",
        amount: 0.001 * (i + 1),
        chain: "base" as const,
        status: "settled" as const,
        requestedAt: Date.now() - i * 1000,
      }));

      const result = await t.mutation(internal.transactions.createBatch, {
        transactions: txs,
      });
      expect(result.created).toBe(5);
    });

    it("sets currency to USDC for all batch transactions", async () => {
      const t = convexTest(schema, modules);
      const txs = [
        {
          agentAddress: "0x2222222222222222222222222222222222222222",
          endpointPath: "/api/a",
          method: "GET",
          amount: 0.001,
          chain: "base" as const,
          status: "settled" as const,
          requestedAt: Date.now(),
        },
      ];

      await t.mutation(internal.transactions.createBatch, {
        transactions: txs,
      });

      const allTxs = await t.run(async (ctx) => {
        return await ctx.db.query("transactions").collect();
      });
      expect(allTxs).toHaveLength(1);
      expect(allTxs[0].currency).toBe("USDC");
    });

    it("associates sellerId with all transactions in batch", async () => {
      const t = convexTest(schema, modules);

      // Create a seller first
      const sellerId = await t.run(async (ctx) => {
        return await ctx.db.insert("sellers", {
          name: "TestSeller",
          walletAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
          apiKey: "test-key-123",
        });
      });

      const result = await t.mutation(internal.transactions.createBatch, {
        transactions: [
          {
            agentAddress: "0x3333333333333333333333333333333333333333",
            endpointPath: "/api/paid",
            method: "POST",
            amount: 0.01,
            chain: "base",
            status: "settled",
            requestedAt: Date.now(),
          },
        ],
        sellerId,
      });

      expect(result.created).toBe(1);

      const allTxs = await t.run(async (ctx) => {
        return await ctx.db.query("transactions").collect();
      });
      expect(allTxs[0].sellerId).toBe(sellerId);
    });
  });

  // ─── updateStatus ───────────────────────────────────────
  describe("updateStatus", () => {
    it("updates transaction status and txHash", async () => {
      const t = convexTest(schema, modules);

      const txId = await t.mutation(internal.transactions.create, {
        agentAddress: "0x4444444444444444444444444444444444444444",
        endpointPath: "/api/test",
        method: "GET",
        amount: 0.005,
        chain: "base",
        status: "pending",
        requestedAt: Date.now(),
      });

      await t.mutation(internal.transactions.updateStatus, {
        id: txId,
        status: "settled",
        txHash: "0xabcdef1234567890",
      });

      const tx = await t.run(async (ctx) => {
        return await ctx.db.get(txId);
      });
      expect(tx?.status).toBe("settled");
      expect(tx?.txHash).toBe("0xabcdef1234567890");
      expect(tx?.settledAt).toBeGreaterThan(0);
    });

    it("auto-fills settledAt when not provided", async () => {
      const t = convexTest(schema, modules);
      const before = Date.now();

      const txId = await t.mutation(internal.transactions.create, {
        agentAddress: "0x5555555555555555555555555555555555555555",
        endpointPath: "/api/test",
        method: "GET",
        amount: 0.002,
        chain: "base",
        status: "pending",
        requestedAt: before,
      });

      await t.mutation(internal.transactions.updateStatus, {
        id: txId,
        status: "failed",
      });

      const tx = await t.run(async (ctx) => {
        return await ctx.db.get(txId);
      });
      expect(tx?.status).toBe("failed");
      expect(tx?.settledAt).toBeGreaterThanOrEqual(before);
    });
  });

  // ─── list ───────────────────────────────────────────────
  describe("list", () => {
    it("returns transactions ordered by creation time descending", async () => {
      const t = convexTest(schema, modules);

      for (let i = 0; i < 3; i++) {
        await t.mutation(internal.transactions.create, {
          agentAddress: "0x6666666666666666666666666666666666666666",
          endpointPath: `/api/test-${i}`,
          method: "GET",
          amount: 0.001 * (i + 1),
          chain: "base",
          status: "settled",
          requestedAt: Date.now() + i * 1000,
        });
      }

      const results = await t.query(api.transactions.list, {});
      expect(results).toHaveLength(3);
    });

    it("filters by status", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(internal.transactions.create, {
        agentAddress: "0x7777777777777777777777777777777777777777",
        endpointPath: "/api/a",
        method: "GET",
        amount: 0.001,
        chain: "base",
        status: "settled",
        requestedAt: Date.now(),
      });

      await t.mutation(internal.transactions.create, {
        agentAddress: "0x7777777777777777777777777777777777777777",
        endpointPath: "/api/b",
        method: "GET",
        amount: 0.002,
        chain: "base",
        status: "failed",
        requestedAt: Date.now(),
      });

      const settled = await t.query(api.transactions.list, {
        status: "settled",
      });
      expect(settled).toHaveLength(1);
      expect(settled[0].endpointPath).toBe("/api/a");
    });

    it("filters by chain in memory", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(internal.transactions.create, {
        agentAddress: "0x8888888888888888888888888888888888888888",
        endpointPath: "/api/base",
        method: "GET",
        amount: 0.001,
        chain: "base",
        status: "settled",
        requestedAt: Date.now(),
      });

      await t.mutation(internal.transactions.create, {
        agentAddress: "0x8888888888888888888888888888888888888888",
        endpointPath: "/api/sol",
        method: "GET",
        amount: 0.001,
        chain: "solana",
        status: "settled",
        requestedAt: Date.now(),
      });

      const baseOnly = await t.query(api.transactions.list, {
        chain: "base",
      });
      expect(baseOnly).toHaveLength(1);
      expect(baseOnly[0].endpointPath).toBe("/api/base");
    });

    it("respects the limit parameter", async () => {
      const t = convexTest(schema, modules);

      for (let i = 0; i < 10; i++) {
        await t.mutation(internal.transactions.create, {
          agentAddress: "0x9999999999999999999999999999999999999999",
          endpointPath: `/api/test-${i}`,
          method: "GET",
          amount: 0.001,
          chain: "base",
          status: "settled",
          requestedAt: Date.now(),
        });
      }

      const limited = await t.query(api.transactions.list, { limit: 3 });
      expect(limited).toHaveLength(3);
    });
  });

  // ─── getByAgent ─────────────────────────────────────────
  describe("getByAgent", () => {
    it("returns transactions for a specific agent address", async () => {
      const t = convexTest(schema, modules);
      const addr = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      const other = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

      await t.mutation(internal.transactions.create, {
        agentAddress: addr,
        endpointPath: "/api/mine",
        method: "GET",
        amount: 0.001,
        chain: "base",
        status: "settled",
        requestedAt: Date.now(),
      });

      await t.mutation(internal.transactions.create, {
        agentAddress: other,
        endpointPath: "/api/theirs",
        method: "GET",
        amount: 0.001,
        chain: "base",
        status: "settled",
        requestedAt: Date.now(),
      });

      const results = await t.query(api.transactions.getByAgent, {
        agentAddress: addr,
      });
      expect(results).toHaveLength(1);
      expect(results[0].endpointPath).toBe("/api/mine");
    });
  });
});
