import { describe, it, expect } from "vitest";
import { PolicyEngine } from "./policy-engine";
import type { Transaction } from "@apitoll/shared";

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx_test",
    txHash: "0xabc",
    agentAddress: "0xAgent",
    sellerId: "test-seller",
    endpoint: "/api/data",
    method: "GET",
    amount: "1.000000",
    chain: "base",
    status: "settled",
    requestedAt: new Date().toISOString(),
    settledAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Policy Engine Core ─────────────────────────────────────────

describe("PolicyEngine", () => {
  describe("vendor ACL enforcement", () => {
    it("allows any vendor when wildcard ACL is set", () => {
      const engine = new PolicyEngine([
        { type: "vendor_acl", allowedVendors: ["*"] },
      ]);
      const result = engine.evaluate({ amount: 1, sellerId: "any-vendor", endpoint: "/api/test" });
      expect(result.allowed).toBe(true);
    });

    it("rejects unauthorized vendors", () => {
      const engine = new PolicyEngine([
        { type: "vendor_acl", allowedVendors: ["approved-seller"] },
      ]);
      const result = engine.evaluate({ amount: 1, sellerId: "random-seller", endpoint: "/api/test" });
      expect(result.allowed).toBe(false);
      expect(result.policyType).toBe("vendor_acl");
    });

    it("allows authorized vendors", () => {
      const engine = new PolicyEngine([
        { type: "vendor_acl", allowedVendors: ["seller-a", "seller-b"] },
      ]);
      expect(engine.evaluate({ amount: 1, sellerId: "seller-a", endpoint: "/test" }).allowed).toBe(true);
      expect(engine.evaluate({ amount: 1, sellerId: "seller-b", endpoint: "/test" }).allowed).toBe(true);
    });

    it("blocks vendors on the blocklist even with wildcard", () => {
      const engine = new PolicyEngine([
        { type: "vendor_acl", allowedVendors: ["*"], blockedVendors: ["scam-vendor"] },
      ]);
      expect(engine.evaluate({ amount: 1, sellerId: "scam-vendor", endpoint: "/test" }).allowed).toBe(false);
      expect(engine.evaluate({ amount: 1, sellerId: "legit-vendor", endpoint: "/test" }).allowed).toBe(true);
    });
  });

  describe("budget enforcement", () => {
    it("allows transactions within budget", () => {
      const engine = new PolicyEngine([
        { type: "budget", dailyCap: 50, maxPerRequest: 10 },
        { type: "vendor_acl", allowedVendors: ["*"] },
      ]);
      const result = engine.evaluate({ amount: 5, sellerId: "seller", endpoint: "/test" });
      expect(result.allowed).toBe(true);
    });

    it("rejects single transaction exceeding per-request limit", () => {
      const engine = new PolicyEngine([
        { type: "budget", dailyCap: 50, maxPerRequest: 10 },
        { type: "vendor_acl", allowedVendors: ["*"] },
      ]);
      const result = engine.evaluate({ amount: 15, sellerId: "seller", endpoint: "/test" });
      expect(result.allowed).toBe(false);
      expect(result.policyType).toBe("budget");
    });

    it("rejects when cumulative spend exceeds daily cap", () => {
      const engine = new PolicyEngine([
        { type: "budget", dailyCap: 10, maxPerRequest: 5 },
        { type: "vendor_acl", allowedVendors: ["*"] },
      ]);

      // Record past transactions for today
      engine.recordTransaction(makeTx({ amount: "8.000000" }));

      const result = engine.evaluate({ amount: 5, sellerId: "seller", endpoint: "/test" });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("daily cap");
    });

    it("allows when daily cap is not yet reached", () => {
      const engine = new PolicyEngine([
        { type: "budget", dailyCap: 20, maxPerRequest: 10 },
        { type: "vendor_acl", allowedVendors: ["*"] },
      ]);

      engine.recordTransaction(makeTx({ amount: "5.000000" }));

      const result = engine.evaluate({ amount: 10, sellerId: "seller", endpoint: "/test" });
      expect(result.allowed).toBe(true);
    });
  });

  describe("rate limiting", () => {
    it("allows requests within rate limit", () => {
      const engine = new PolicyEngine([
        { type: "rate_limit", maxPerMinute: 10 },
        { type: "vendor_acl", allowedVendors: ["*"] },
      ]);

      // Record a few requests
      engine.recordRequest("/test");
      engine.recordRequest("/test");

      const result = engine.evaluate({ amount: 1, sellerId: "seller", endpoint: "/test" });
      expect(result.allowed).toBe(true);
    });

    it("rejects when per-minute rate limit exceeded", () => {
      const engine = new PolicyEngine([
        { type: "rate_limit", maxPerMinute: 3 },
        { type: "vendor_acl", allowedVendors: ["*"] },
      ]);

      // Exceed the limit
      for (let i = 0; i < 3; i++) {
        engine.recordRequest("/test");
      }

      const result = engine.evaluate({ amount: 1, sellerId: "seller", endpoint: "/test" });
      expect(result.allowed).toBe(false);
      expect(result.policyType).toBe("rate_limit");
    });

    it("rate limits are per-endpoint", () => {
      const engine = new PolicyEngine([
        { type: "rate_limit", maxPerMinute: 2 },
        { type: "vendor_acl", allowedVendors: ["*"] },
      ]);

      engine.recordRequest("/endpoint-a");
      engine.recordRequest("/endpoint-a");

      // endpoint-a should be blocked
      expect(engine.evaluate({ amount: 1, sellerId: "s", endpoint: "/endpoint-a" }).allowed).toBe(false);
      // endpoint-b should still be allowed
      expect(engine.evaluate({ amount: 1, sellerId: "s", endpoint: "/endpoint-b" }).allowed).toBe(true);
    });
  });

  describe("combined policies", () => {
    it("evaluates all policies in order: vendor → budget → rate", () => {
      const engine = new PolicyEngine([
        { type: "vendor_acl", allowedVendors: ["approved"] },
        { type: "budget", dailyCap: 50, maxPerRequest: 10 },
        { type: "rate_limit", maxPerMinute: 60 },
      ]);

      // Vendor check fails first
      const vendorResult = engine.evaluate({ amount: 1, sellerId: "unapproved", endpoint: "/test" });
      expect(vendorResult.allowed).toBe(false);
      expect(vendorResult.policyType).toBe("vendor_acl");

      // Budget check fails second (vendor passes)
      const budgetResult = engine.evaluate({ amount: 20, sellerId: "approved", endpoint: "/test" });
      expect(budgetResult.allowed).toBe(false);
      expect(budgetResult.policyType).toBe("budget");
    });
  });

  describe("spend summary", () => {
    it("returns correct spend summary", () => {
      const engine = new PolicyEngine([
        { type: "vendor_acl", allowedVendors: ["*"] },
      ]);

      engine.recordTransaction(makeTx({ amount: "5.000000" }));
      engine.recordTransaction(makeTx({ amount: "3.500000" }));

      const summary = engine.getSpendSummary();
      expect(summary.transactionCount).toBe(2);
      expect(summary.today).toBeCloseTo(8.5, 1);
    });

    it("starts with zero spend", () => {
      const engine = new PolicyEngine([]);
      const summary = engine.getSpendSummary();
      expect(summary.today).toBe(0);
      expect(summary.thisWeek).toBe(0);
      expect(summary.transactionCount).toBe(0);
    });
  });

  describe("runtime policy updates", () => {
    it("can update policies at runtime", () => {
      const engine = new PolicyEngine([
        { type: "budget", dailyCap: 10, maxPerRequest: 5 },
        { type: "vendor_acl", allowedVendors: ["*"] },
      ]);

      // Fails with old policy
      expect(engine.evaluate({ amount: 8, sellerId: "s", endpoint: "/t" }).allowed).toBe(false);

      // Update to higher limit
      engine.updatePolicies([
        { type: "budget", dailyCap: 100, maxPerRequest: 50 },
        { type: "vendor_acl", allowedVendors: ["*"] },
      ]);

      // Passes with new policy
      expect(engine.evaluate({ amount: 8, sellerId: "s", endpoint: "/t" }).allowed).toBe(true);
    });
  });
});
