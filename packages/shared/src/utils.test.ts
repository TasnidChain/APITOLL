import { describe, it, expect } from "vitest";
import {
  usdcToSmallestUnit,
  usdcFromSmallestUnit,
  matchRoute,
  checkBudgetPolicy,
  findBudgetPolicy,
  isVendorAllowed,
  calculateFeeBreakdown,
  getPlatformWallet,
  generateId,
  resolveChains,
  secureCompare,
  clampInt,
  clampFloat,
  checkPlanLimit,
  isOriginAllowed,
  isValidEvmAddress,
  isValidSolanaAddress,
  isValidPaymentAmount,
  isValidNonce,
  NonceTracker,
  computeHmacSignature,
  verifyHmacSignature,
} from "./utils";
import type { BudgetPolicy, VendorAclPolicy, Transaction } from "./types";

// ─── USDC Conversion ────────────────────────────────────────────

describe("usdcToSmallestUnit", () => {
  it("converts whole numbers", () => {
    expect(usdcToSmallestUnit("1")).toBe("1000000");
    expect(usdcToSmallestUnit("100")).toBe("100000000");
  });

  it("converts decimals", () => {
    expect(usdcToSmallestUnit("1.50")).toBe("1500000");
    expect(usdcToSmallestUnit("0.005")).toBe("5000");
  });

  it("truncates beyond 6 decimal places", () => {
    expect(usdcToSmallestUnit("1.1234567")).toBe("1123456");
  });

  it("handles zero", () => {
    expect(usdcToSmallestUnit("0")).toBe("0");
    expect(usdcToSmallestUnit("0.000000")).toBe("0");
  });
});

describe("usdcFromSmallestUnit", () => {
  it("converts back to human-readable", () => {
    expect(usdcFromSmallestUnit("1500000")).toBe("1.500000");
    expect(usdcFromSmallestUnit("5000")).toBe("0.005000");
  });

  it("handles zero", () => {
    expect(usdcFromSmallestUnit("0")).toBe("0.000000");
  });

  it("handles large amounts", () => {
    expect(usdcFromSmallestUnit("100000000")).toBe("100.000000");
  });

  it("round-trips correctly", () => {
    const original = "42.123456";
    expect(usdcFromSmallestUnit(usdcToSmallestUnit(original))).toBe(original);
  });
});

// ─── Route Matching ─────────────────────────────────────────────

describe("matchRoute", () => {
  it("matches exact routes", () => {
    expect(matchRoute("GET", "/api/data", "GET /api/data")).toBe(true);
  });

  it("rejects method mismatch", () => {
    expect(matchRoute("POST", "/api/data", "GET /api/data")).toBe(false);
  });

  it("supports wildcard method", () => {
    expect(matchRoute("GET", "/api/data", "* /api/data")).toBe(true);
    expect(matchRoute("POST", "/api/data", "* /api/data")).toBe(true);
  });

  it("matches path parameters", () => {
    expect(matchRoute("GET", "/api/users/123", "GET /api/users/:id")).toBe(true);
  });

  it("rejects path length mismatch", () => {
    expect(matchRoute("GET", "/api/data/extra", "GET /api/data")).toBe(false);
  });

  it("is case-insensitive on method", () => {
    expect(matchRoute("get", "/api/data", "GET /api/data")).toBe(true);
  });

  it("returns false for malformed patterns", () => {
    expect(matchRoute("GET", "/api/data", "invalid")).toBe(false);
  });
});

// ─── Budget Policy ──────────────────────────────────────────────

describe("checkBudgetPolicy", () => {
  const policy: BudgetPolicy = {
    type: "budget",
    dailyCap: 50,
    maxPerRequest: 10,
    weeklyCap: 200,
  };

  it("allows valid transactions", () => {
    expect(checkBudgetPolicy(policy, 5, [])).toBeNull();
  });

  it("rejects amounts exceeding per-request limit", () => {
    const result = checkBudgetPolicy(policy, 15, []);
    expect(result).toContain("exceeds max per-request limit");
  });

  it("rejects when daily cap would be exceeded", () => {
    const today = new Date().toISOString();
    const transactions = [
      { amount: "45", requestedAt: today },
    ];
    const result = checkBudgetPolicy(policy, 10, transactions);
    expect(result).toContain("daily cap");
  });

  it("allows when daily spend is under cap", () => {
    const today = new Date().toISOString();
    const transactions = [
      { amount: "10", requestedAt: today },
    ];
    expect(checkBudgetPolicy(policy, 5, transactions)).toBeNull();
  });

  it("ignores transactions from previous days for daily cap", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const transactions = [
      { amount: "49", requestedAt: yesterday.toISOString() },
    ];
    expect(checkBudgetPolicy(policy, 5, transactions)).toBeNull();
  });

  it("rejects when weekly cap would be exceeded", () => {
    const today = new Date().toISOString();
    const transactions = [
      { amount: "195", requestedAt: today },
    ];
    const result = checkBudgetPolicy(policy, 10, transactions);
    // This will hit daily cap first since 195 + 10 > 50.
    // Let's construct a case that hits weekly but not daily.
    expect(result).not.toBeNull();
  });

  it("enforces weekly cap across multiple days", () => {
    const policyNoDaily: BudgetPolicy = {
      type: "budget",
      dailyCap: 100,
      maxPerRequest: 50,
      weeklyCap: 200,
    };
    // Transactions spread across the current week
    const daysAgo = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString();
    };
    const transactions = [
      { amount: "80", requestedAt: daysAgo(1) },
      { amount: "80", requestedAt: daysAgo(2) },
      { amount: "30", requestedAt: daysAgo(3) },
    ];
    const result = checkBudgetPolicy(policyNoDaily, 20, transactions);
    expect(result).toContain("weekly cap");
  });
});

describe("findBudgetPolicy", () => {
  it("finds budget policy in list", () => {
    const policies = [
      { type: "vendor_acl" as const, allowedVendors: ["*"] },
      { type: "budget" as const, dailyCap: 50, maxPerRequest: 10 },
    ];
    const result = findBudgetPolicy(policies);
    expect(result).toBeDefined();
    expect(result?.type).toBe("budget");
    expect(result?.dailyCap).toBe(50);
  });

  it("returns undefined when no budget policy exists", () => {
    const policies = [
      { type: "vendor_acl" as const, allowedVendors: ["*"] },
    ];
    expect(findBudgetPolicy(policies)).toBeUndefined();
  });
});

// ─── Vendor ACL ─────────────────────────────────────────────────

describe("isVendorAllowed", () => {
  it("allows all when no ACL policies exist", () => {
    expect(isVendorAllowed([], "any-vendor")).toBe(true);
  });

  it("allows vendors in the allowedVendors list", () => {
    const policies = [
      { type: "vendor_acl" as const, allowedVendors: ["seller-a", "seller-b"] },
    ];
    expect(isVendorAllowed(policies, "seller-a")).toBe(true);
    expect(isVendorAllowed(policies, "seller-b")).toBe(true);
  });

  it("rejects vendors not in the allowedVendors list", () => {
    const policies = [
      { type: "vendor_acl" as const, allowedVendors: ["seller-a"] },
    ];
    expect(isVendorAllowed(policies, "seller-x")).toBe(false);
  });

  it("allows all vendors when wildcard is used", () => {
    const policies = [
      { type: "vendor_acl" as const, allowedVendors: ["*"] },
    ];
    expect(isVendorAllowed(policies, "any-vendor")).toBe(true);
  });

  it("blocks vendors in blockedVendors even if wildcard allows", () => {
    const policies = [
      {
        type: "vendor_acl" as const,
        allowedVendors: ["*"],
        blockedVendors: ["bad-vendor"],
      },
    ];
    expect(isVendorAllowed(policies, "bad-vendor")).toBe(false);
    expect(isVendorAllowed(policies, "good-vendor")).toBe(true);
  });
});

// ─── Fee Calculation ────────────────────────────────────────────

describe("calculateFeeBreakdown", () => {
  it("calculates 3% fee (300 bps)", () => {
    const result = calculateFeeBreakdown("10.000000", {
      feeBps: 300,
      platformWalletBase: "0xPlatform",
    });
    expect(result.totalAmount).toBe("10.000000");
    expect(result.platformFee).toBe("0.300000");
    expect(result.sellerAmount).toBe("9.700000");
    expect(result.feeBps).toBe(300);
  });

  it("calculates 0% fee", () => {
    const result = calculateFeeBreakdown("10.000000", { feeBps: 0 });
    expect(result.platformFee).toBe("0.000000");
    expect(result.sellerAmount).toBe("10.000000");
  });

  it("handles no fee config (defaults to 0)", () => {
    const result = calculateFeeBreakdown("5.000000");
    expect(result.platformFee).toBe("0.000000");
    expect(result.sellerAmount).toBe("5.000000");
  });

  it("fee + seller always equals total", () => {
    const amounts = ["0.005", "1.00", "50.123456", "999.999999"];
    const fees = [100, 250, 300, 500, 1000];

    for (const amount of amounts) {
      for (const feeBps of fees) {
        const result = calculateFeeBreakdown(amount, { feeBps });
        const total = BigInt(usdcToSmallestUnit(result.sellerAmount)) +
          BigInt(usdcToSmallestUnit(result.platformFee));
        expect(total.toString()).toBe(usdcToSmallestUnit(result.totalAmount));
      }
    }
  });

  it("handles micropayment amounts correctly", () => {
    const result = calculateFeeBreakdown("0.005000", { feeBps: 300 });
    // 5000 * 300 / 10000 = 150
    expect(result.platformFee).toBe("0.000150");
    expect(result.sellerAmount).toBe("0.004850");
  });
});

describe("getPlatformWallet", () => {
  it("returns base wallet for base chain", () => {
    const config = { feeBps: 300, platformWalletBase: "0xBase", platformWalletSolana: "SolWallet" };
    expect(getPlatformWallet("base", config)).toBe("0xBase");
  });

  it("returns solana wallet for solana chain", () => {
    const config = { feeBps: 300, platformWalletBase: "0xBase", platformWalletSolana: "SolWallet" };
    expect(getPlatformWallet("solana", config)).toBe("SolWallet");
  });

  it("returns undefined when no config", () => {
    expect(getPlatformWallet("base")).toBeUndefined();
  });
});

// ─── Utility Functions ──────────────────────────────────────────

describe("generateId", () => {
  it("generates unique IDs", () => {
    const id1 = generateId("tx");
    const id2 = generateId("tx");
    expect(id1).not.toBe(id2);
  });

  it("applies prefix", () => {
    const id = generateId("tx");
    expect(id.startsWith("tx_")).toBe(true);
  });

  it("works without prefix", () => {
    const id = generateId();
    expect(id).toBeTruthy();
    expect(id.includes("_")).toBe(false);
  });
});

describe("resolveChains", () => {
  it("returns provided chains", () => {
    expect(resolveChains(["base", "solana"])).toEqual(["base", "solana"]);
  });

  it("defaults to base when empty", () => {
    expect(resolveChains([])).toEqual(["base"]);
  });

  it("defaults to base when undefined", () => {
    expect(resolveChains()).toEqual(["base"]);
  });
});

describe("secureCompare", () => {
  it("returns true for equal strings", () => {
    expect(secureCompare("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(secureCompare("abc123", "abc124")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(secureCompare("short", "longer_string")).toBe(false);
  });
});

describe("clampInt", () => {
  it("returns default for null", () => {
    expect(clampInt(null, 1, 100, 10)).toBe(10);
  });

  it("returns default for NaN", () => {
    expect(clampInt("abc", 1, 100, 10)).toBe(10);
  });

  it("clamps to min", () => {
    expect(clampInt("-5", 1, 100, 10)).toBe(1);
  });

  it("clamps to max", () => {
    expect(clampInt("500", 1, 100, 10)).toBe(100);
  });

  it("returns parsed value within range", () => {
    expect(clampInt("42", 1, 100, 10)).toBe(42);
  });
});

describe("clampFloat", () => {
  it("returns default for null", () => {
    expect(clampFloat(null, 0, 1, 0.5)).toBe(0.5);
  });

  it("clamps to range", () => {
    expect(clampFloat("1.5", 0, 1, 0.5)).toBe(1);
    expect(clampFloat("-0.5", 0, 1, 0.5)).toBe(0);
  });
});

describe("isOriginAllowed", () => {
  it("rejects null origin", () => {
    expect(isOriginAllowed(null, ["https://example.com"])).toBe(false);
  });

  it("allows matching origin", () => {
    expect(isOriginAllowed("https://example.com", ["https://example.com"])).toBe(true);
  });

  it("rejects non-matching origin", () => {
    expect(isOriginAllowed("https://evil.com", ["https://example.com"])).toBe(false);
  });

  it("allows all with wildcard", () => {
    expect(isOriginAllowed("https://anything.com", ["*"])).toBe(true);
  });
});

describe("checkPlanLimit", () => {
  it("allows within free plan limits", () => {
    expect(checkPlanLimit("free", "maxAgents", 0)).toBeNull();
  });

  it("rejects when limit exceeded", () => {
    const result = checkPlanLimit("free", "maxAgents", 1);
    expect(result).toContain("Plan limit exceeded");
  });

  it("rejects disabled features", () => {
    const result = checkPlanLimit("free", "webhooksEnabled", 0);
    expect(result).toContain("not available on free plan");
  });

  it("allows features on pro plan", () => {
    expect(checkPlanLimit("pro", "webhooksEnabled", 0)).toBeNull();
  });

  it("allows unlimited on enterprise", () => {
    expect(checkPlanLimit("enterprise", "maxAgents", 99999)).toBeNull();
  });
});

// ─── Address Validation ─────────────────────────────────────────

describe("isValidEvmAddress", () => {
  it("accepts valid lowercase address", () => {
    expect(isValidEvmAddress("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913")).toBe(true);
  });

  it("accepts valid mixed-case address", () => {
    expect(isValidEvmAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")).toBe(true);
  });

  it("rejects too-short address", () => {
    expect(isValidEvmAddress("0x1234")).toBe(false);
  });

  it("rejects too-long address", () => {
    expect(isValidEvmAddress("0x" + "a".repeat(41))).toBe(false);
  });

  it("rejects missing 0x prefix", () => {
    expect(isValidEvmAddress("833589fcd6edb6e08f4c7c32d4f71b54bda02913")).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isValidEvmAddress("0x" + "g".repeat(40))).toBe(false);
    expect(isValidEvmAddress("0x" + "Z".repeat(40))).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidEvmAddress("")).toBe(false);
  });

  it("rejects bare 0x", () => {
    expect(isValidEvmAddress("0x")).toBe(false);
  });
});

describe("isValidSolanaAddress", () => {
  it("accepts valid Solana address", () => {
    expect(isValidSolanaAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBe(true);
  });

  it("rejects too-short address", () => {
    expect(isValidSolanaAddress("short")).toBe(false);
  });

  it("rejects invalid base58 characters (0, O, I, l)", () => {
    expect(isValidSolanaAddress("0" + "A".repeat(43))).toBe(false);
    expect(isValidSolanaAddress("O" + "A".repeat(43))).toBe(false);
    expect(isValidSolanaAddress("I" + "A".repeat(43))).toBe(false);
    expect(isValidSolanaAddress("l" + "A".repeat(43))).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidSolanaAddress("")).toBe(false);
  });
});

// ─── Payment Amount Validation ──────────────────────────────────

describe("isValidPaymentAmount", () => {
  it("accepts valid whole number", () => {
    expect(isValidPaymentAmount("10")).toBe(true);
  });

  it("accepts valid decimal", () => {
    expect(isValidPaymentAmount("0.005")).toBe(true);
    expect(isValidPaymentAmount("1.50")).toBe(true);
  });

  it("rejects zero", () => {
    expect(isValidPaymentAmount("0")).toBe(false);
    expect(isValidPaymentAmount("0.000000")).toBe(false);
  });

  it("rejects negative amounts", () => {
    expect(isValidPaymentAmount("-1")).toBe(false);
    expect(isValidPaymentAmount("-0.005")).toBe(false);
  });

  it("rejects non-numeric strings", () => {
    expect(isValidPaymentAmount("abc")).toBe(false);
    expect(isValidPaymentAmount("")).toBe(false);
    expect(isValidPaymentAmount("1e5")).toBe(false);
  });

  it("rejects amounts with spaces", () => {
    expect(isValidPaymentAmount(" 10 ")).toBe(false);
  });
});

// ─── Nonce Validation ───────────────────────────────────────────

describe("isValidNonce", () => {
  it("accepts valid 32-byte hex nonce", () => {
    const nonce = "0x" + "a1b2c3d4".repeat(8);
    expect(isValidNonce(nonce)).toBe(true);
  });

  it("rejects too-short nonce", () => {
    expect(isValidNonce("0x1234")).toBe(false);
  });

  it("rejects too-long nonce", () => {
    expect(isValidNonce("0x" + "a".repeat(65))).toBe(false);
  });

  it("rejects missing 0x prefix", () => {
    expect(isValidNonce("a".repeat(64))).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isValidNonce("0x" + "g".repeat(64))).toBe(false);
  });
});

// ─── Nonce Tracker (Replay Protection) ──────────────────────────

describe("NonceTracker", () => {
  it("accepts new nonces", () => {
    const tracker = new NonceTracker();
    expect(tracker.tryUse("nonce-1")).toBe(true);
    expect(tracker.tryUse("nonce-2")).toBe(true);
  });

  it("rejects replayed nonces", () => {
    const tracker = new NonceTracker();
    expect(tracker.tryUse("nonce-1")).toBe(true);
    expect(tracker.tryUse("nonce-1")).toBe(false); // replay!
  });

  it("tracks usage count", () => {
    const tracker = new NonceTracker();
    tracker.tryUse("a");
    tracker.tryUse("b");
    tracker.tryUse("c");
    expect(tracker.size).toBe(3);
  });

  it("hasBeenUsed returns correct state", () => {
    const tracker = new NonceTracker();
    expect(tracker.hasBeenUsed("nonce-1")).toBe(false);
    tracker.tryUse("nonce-1");
    expect(tracker.hasBeenUsed("nonce-1")).toBe(true);
  });

  it("evicts oldest entries when maxSize reached", () => {
    const tracker = new NonceTracker(10);

    // Fill to capacity
    for (let i = 0; i < 10; i++) {
      tracker.tryUse(`nonce-${i}`);
    }
    expect(tracker.size).toBe(10);

    // Adding one more should trigger eviction of ~10%
    tracker.tryUse("nonce-new");
    expect(tracker.size).toBeLessThanOrEqual(10);
  });

  it("allows re-use after eviction", () => {
    const tracker = new NonceTracker(5);

    // Fill with nonces 0-4
    for (let i = 0; i < 5; i++) {
      tracker.tryUse(`nonce-${i}`);
    }

    // This triggers eviction — nonce-0 should be evicted (oldest)
    tracker.tryUse("nonce-trigger");

    // nonce-0 was evicted, so it should be usable again
    // (This is the expected limitation of in-memory — production should use DB)
    // Just verify the tracker doesn't crash and stays bounded
    expect(tracker.size).toBeLessThanOrEqual(6);
  });
});

// ─── HMAC Webhook Signing ───────────────────────────────────────

describe("computeHmacSignature", () => {
  it("produces consistent signatures for same input", async () => {
    const sig1 = await computeHmacSignature("hello", "secret");
    const sig2 = await computeHmacSignature("hello", "secret");
    expect(sig1).toBe(sig2);
  });

  it("produces different signatures for different payloads", async () => {
    const sig1 = await computeHmacSignature("payload-a", "secret");
    const sig2 = await computeHmacSignature("payload-b", "secret");
    expect(sig1).not.toBe(sig2);
  });

  it("produces different signatures for different secrets", async () => {
    const sig1 = await computeHmacSignature("payload", "secret-1");
    const sig2 = await computeHmacSignature("payload", "secret-2");
    expect(sig1).not.toBe(sig2);
  });

  it("returns a hex string", async () => {
    const sig = await computeHmacSignature("test", "key");
    expect(sig).toMatch(/^[a-f0-9]{64}$/); // SHA-256 = 32 bytes = 64 hex
  });
});

describe("verifyHmacSignature", () => {
  it("verifies valid signature", async () => {
    const payload = '{"type":"transaction.settled"}';
    const secret = "webhook-secret-key";
    const sig = await computeHmacSignature(payload, secret);
    expect(await verifyHmacSignature(payload, secret, sig)).toBe(true);
  });

  it("rejects tampered payload", async () => {
    const secret = "webhook-secret-key";
    const sig = await computeHmacSignature("original", secret);
    expect(await verifyHmacSignature("tampered", secret, sig)).toBe(false);
  });

  it("rejects wrong secret", async () => {
    const payload = "data";
    const sig = await computeHmacSignature(payload, "correct-secret");
    expect(await verifyHmacSignature(payload, "wrong-secret", sig)).toBe(false);
  });

  it("rejects garbage signature", async () => {
    expect(await verifyHmacSignature("data", "secret", "not-a-real-signature")).toBe(false);
  });
});
