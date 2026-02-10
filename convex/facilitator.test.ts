import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { modules } from "./test.setup";

describe("facilitator payments", () => {
  const TEST_SECRET = "test-facilitator-secret-for-tests";

  beforeEach(() => {
    vi.stubEnv("FACILITATOR_CONVEX_SECRET", TEST_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const basePayment = {
    _secret: TEST_SECRET,
    paymentId: "pay_test_001",
    originalUrl: "https://api.example.com/weather",
    originalMethod: "GET",
    amount: "0.005",
    currency: "USDC",
    recipient: "0xSeller1234567890123456789012345678901234",
    chain: "base",
    agentWallet: "0xAgent1234567890123456789012345678901234ab",
    sellerAddress: "0xSeller1234567890123456789012345678901234",
    apiKey: "key-test",
    status: "processing" as const,
    createdAt: Date.now(),
  };

  describe("upsertPayment", () => {
    it("creates a new payment record", async () => {
      const t = convexTest(schema, modules);

      const id = await t.mutation(api.facilitator.upsertPayment, basePayment);
      expect(id).toBeTruthy();

      // Verify record exists
      const payment = await t.query(api.facilitator.getPayment, {
        _secret: TEST_SECRET,
        paymentId: "pay_test_001",
      });
      expect(payment?.originalUrl).toBe("https://api.example.com/weather");
      expect(payment?.status).toBe("processing");
      expect(payment?.amount).toBe("0.005");
    });

    it("updates existing payment on second upsert (idempotent)", async () => {
      const t = convexTest(schema, modules);

      // Create initial
      const id1 = await t.mutation(api.facilitator.upsertPayment, basePayment);

      // Upsert again with new status
      const id2 = await t.mutation(api.facilitator.upsertPayment, {
        ...basePayment,
        status: "completed",
        txHash: "0xabc123",
        completedAt: Date.now(),
      });

      // Should return same ID
      expect(id2).toBe(id1);

      // Verify status was updated
      const payment = await t.query(api.facilitator.getPayment, {
        _secret: TEST_SECRET,
        paymentId: "pay_test_001",
      });
      expect(payment?.status).toBe("completed");
      expect(payment?.txHash).toBe("0xabc123");
    });

    it("preserves original fields on upsert (only updates status fields)", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.facilitator.upsertPayment, basePayment);

      // Upsert with different URL — but URL shouldn't change
      await t.mutation(api.facilitator.upsertPayment, {
        ...basePayment,
        originalUrl: "https://DIFFERENT.example.com",
        status: "completed",
      });

      const payment = await t.query(api.facilitator.getPayment, {
        _secret: TEST_SECRET,
        paymentId: "pay_test_001",
      });
      // Original URL should be preserved (upsert only patches status fields)
      expect(payment?.originalUrl).toBe("https://api.example.com/weather");
    });
  });

  describe("idempotency key", () => {
    it("returns existing payment when same idempotencyKey is sent twice", async () => {
      const t = convexTest(schema, modules);

      // First call with idempotency key
      const id1 = await t.mutation(api.facilitator.upsertPayment, {
        ...basePayment,
        paymentId: "pay_idem_001",
        idempotencyKey: "client-key-abc",
      });

      // Second call with SAME idempotency key but different paymentId
      const id2 = await t.mutation(api.facilitator.upsertPayment, {
        ...basePayment,
        paymentId: "pay_idem_002", // different!
        idempotencyKey: "client-key-abc",
      });

      // Should return the first record's ID (no duplicate)
      expect(id2).toBe(id1);

      // Verify only one record exists with this key
      const payment = await t.query(api.facilitator.getByIdempotencyKey, {
        _secret: TEST_SECRET,
        idempotencyKey: "client-key-abc",
      });
      expect(payment?.paymentId).toBe("pay_idem_001");
    });

    it("creates separate payments for different idempotency keys", async () => {
      const t = convexTest(schema, modules);

      const id1 = await t.mutation(api.facilitator.upsertPayment, {
        ...basePayment,
        paymentId: "pay_diff_001",
        idempotencyKey: "key-alpha",
      });

      const id2 = await t.mutation(api.facilitator.upsertPayment, {
        ...basePayment,
        paymentId: "pay_diff_002",
        idempotencyKey: "key-beta",
      });

      expect(id1).not.toBe(id2);
    });

    it("allows payments without idempotency key (backward compatible)", async () => {
      const t = convexTest(schema, modules);

      const id1 = await t.mutation(api.facilitator.upsertPayment, {
        ...basePayment,
        paymentId: "pay_no_key_001",
      });

      const id2 = await t.mutation(api.facilitator.upsertPayment, {
        ...basePayment,
        paymentId: "pay_no_key_002",
      });

      // Different paymentIds → different records (no idempotency key to deduplicate)
      expect(id1).not.toBe(id2);
    });

    it("getByIdempotencyKey returns null for non-existent key", async () => {
      const t = convexTest(schema, modules);

      const result = await t.query(api.facilitator.getByIdempotencyKey, {
        _secret: TEST_SECRET,
        idempotencyKey: "does-not-exist",
      });

      expect(result).toBeNull();
    });
  });

  describe("updatePaymentStatus", () => {
    it("updates status and txHash", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.facilitator.upsertPayment, basePayment);

      await t.mutation(api.facilitator.updatePaymentStatus, {
        _secret: TEST_SECRET,
        paymentId: "pay_test_001",
        status: "completed",
        txHash: "0xdef456",
        completedAt: Date.now(),
      });

      const payment = await t.query(api.facilitator.getPayment, {
        _secret: TEST_SECRET,
        paymentId: "pay_test_001",
      });
      expect(payment?.status).toBe("completed");
      expect(payment?.txHash).toBe("0xdef456");
    });

    it("updates status to failed with error message", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.facilitator.upsertPayment, basePayment);

      await t.mutation(api.facilitator.updatePaymentStatus, {
        _secret: TEST_SECRET,
        paymentId: "pay_test_001",
        status: "failed",
        error: "Insufficient USDC balance",
        completedAt: Date.now(),
      });

      const payment = await t.query(api.facilitator.getPayment, {
        _secret: TEST_SECRET,
        paymentId: "pay_test_001",
      });
      expect(payment?.status).toBe("failed");
      expect(payment?.error).toBe("Insufficient USDC balance");
    });

    it("throws for non-existent payment", async () => {
      const t = convexTest(schema, modules);

      await expect(
        t.mutation(api.facilitator.updatePaymentStatus, {
          _secret: TEST_SECRET,
          paymentId: "pay_does_not_exist",
          status: "completed",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("getPayment", () => {
    it("returns payment by ID", async () => {
      const t = convexTest(schema, modules);
      await t.mutation(api.facilitator.upsertPayment, basePayment);

      const payment = await t.query(api.facilitator.getPayment, {
        _secret: TEST_SECRET,
        paymentId: "pay_test_001",
      });

      expect(payment).toBeTruthy();
      expect(payment?.paymentId).toBe("pay_test_001");
    });

    it("returns null for non-existent payment", async () => {
      const t = convexTest(schema, modules);

      const payment = await t.query(api.facilitator.getPayment, {
        _secret: TEST_SECRET,
        paymentId: "pay_nonexistent",
      });

      expect(payment).toBeNull();
    });
  });

  describe("getActivePayments", () => {
    it("returns pending and processing payments", async () => {
      const t = convexTest(schema, modules);

      // Create payments with different statuses
      await t.mutation(api.facilitator.upsertPayment, {
        ...basePayment,
        paymentId: "pay_pending",
        status: "pending",
      });

      await t.mutation(api.facilitator.upsertPayment, {
        ...basePayment,
        paymentId: "pay_processing",
        status: "processing",
      });

      await t.mutation(api.facilitator.upsertPayment, {
        ...basePayment,
        paymentId: "pay_completed",
        status: "completed",
      });

      await t.mutation(api.facilitator.upsertPayment, {
        ...basePayment,
        paymentId: "pay_failed",
        status: "failed",
      });

      const active = await t.query(api.facilitator.getActivePayments, {
        _secret: TEST_SECRET,
      });

      expect(active).toHaveLength(2);
      const ids = active.map((p: { paymentId: string }) => p.paymentId).sort();
      expect(ids).toEqual(["pay_pending", "pay_processing"]);
    });

    it("returns empty array when no active payments", async () => {
      const t = convexTest(schema, modules);

      // Only completed/failed
      await t.mutation(api.facilitator.upsertPayment, {
        ...basePayment,
        paymentId: "pay_done",
        status: "completed",
      });

      const active = await t.query(api.facilitator.getActivePayments, {
        _secret: TEST_SECRET,
      });
      expect(active).toHaveLength(0);
    });
  });
});
