import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildPaymentRequirements,
  encodePaymentRequired,
  verifyPayment,
  findEndpointConfig,
  getEndpointFeeBreakdown,
} from "./payment";
import { DEFAULT_CHAIN_CONFIGS, type EndpointConfig, type ChainConfig, type SupportedChain } from "@apitoll/shared";

const TEST_WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = DEFAULT_CHAIN_CONFIGS;

const testEndpoint: EndpointConfig = {
  price: "0.005",
  chains: ["base"],
  description: "Test data endpoint",
};

// ─── buildPaymentRequirements ───────────────────────────────────

describe("buildPaymentRequirements", () => {
  it("builds requirements for a single chain", () => {
    const reqs = buildPaymentRequirements(testEndpoint, TEST_WALLET, CHAIN_CONFIGS);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].scheme).toBe("exact");
    expect(reqs[0].network).toBe("eip155:8453");
    expect(reqs[0].maxAmountRequired).toBe("5000");
    expect(reqs[0].payTo).toBe(TEST_WALLET);
    expect(reqs[0].asset).toBe(DEFAULT_CHAIN_CONFIGS.base.usdcAddress);
  });

  it("builds requirements for multiple chains", () => {
    const multiChain: EndpointConfig = { ...testEndpoint, chains: ["base", "solana"] };
    const reqs = buildPaymentRequirements(multiChain, TEST_WALLET, CHAIN_CONFIGS);
    expect(reqs).toHaveLength(2);
    expect(reqs[0].network).toBe("eip155:8453");
    expect(reqs[1].network).toBe("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
  });

  it("includes platform fee metadata when configured", () => {
    const platformFee = {
      feeBps: 300,
      platformWalletBase: "0xPlatform",
    };
    const reqs = buildPaymentRequirements(testEndpoint, TEST_WALLET, CHAIN_CONFIGS, platformFee);
    expect(reqs[0].extra).toBeDefined();
    expect((reqs[0].extra as any).platformFee).toBeDefined();
    expect((reqs[0].extra as any).platformFee.feeBps).toBe(300);
    expect((reqs[0].extra as any).platformFee.platformWallet).toBe("0xPlatform");
  });

  it("omits platform fee metadata when feeBps is 0", () => {
    const platformFee = { feeBps: 0, platformWalletBase: "0xPlatform" };
    const reqs = buildPaymentRequirements(testEndpoint, TEST_WALLET, CHAIN_CONFIGS, platformFee);
    expect((reqs[0].extra as any).platformFee).toBeUndefined();
  });

  it("includes description from endpoint config", () => {
    const reqs = buildPaymentRequirements(testEndpoint, TEST_WALLET, CHAIN_CONFIGS);
    expect(reqs[0].description).toBe("Test data endpoint");
  });
});

// ─── encodePaymentRequired ──────────────────────────────────────

describe("encodePaymentRequired", () => {
  it("encodes requirements to base64", () => {
    const reqs = buildPaymentRequirements(testEndpoint, TEST_WALLET, CHAIN_CONFIGS);
    const encoded = encodePaymentRequired(reqs);
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
    expect(decoded).toEqual(reqs);
  });

  it("produces valid base64 string", () => {
    const reqs = buildPaymentRequirements(testEndpoint, TEST_WALLET, CHAIN_CONFIGS);
    const encoded = encodePaymentRequired(reqs);
    expect(() => Buffer.from(encoded, "base64")).not.toThrow();
  });
});

// ─── verifyPayment ──────────────────────────────────────────────

describe("verifyPayment", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns valid result on successful verification", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true, txHash: "0xabc123" }),
    });

    const requirements = buildPaymentRequirements(testEndpoint, TEST_WALLET, CHAIN_CONFIGS);
    const paymentHeader = Buffer.from(JSON.stringify({ network: "eip155:8453", from: "0xPayer" })).toString("base64");

    const result = await verifyPayment({
      paymentHeader,
      requirements,
      facilitatorUrl: "https://test-facilitator.com",
    });

    expect(result.valid).toBe(true);
    expect(result.receipt).toBeDefined();
    expect(result.receipt?.txHash).toBe("0xabc123");
    expect(result.receipt?.chain).toBe("base");
  });

  it("returns valid when facilitator returns success=true", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, transaction: { hash: "0xdef456" } }),
    });

    const requirements = buildPaymentRequirements(testEndpoint, TEST_WALLET, CHAIN_CONFIGS);
    const paymentHeader = Buffer.from(JSON.stringify({ network: "eip155:8453" })).toString("base64");

    const result = await verifyPayment({
      paymentHeader,
      requirements,
      facilitatorUrl: "https://test-facilitator.com",
    });

    expect(result.valid).toBe(true);
    expect(result.receipt?.txHash).toBe("0xdef456");
  });

  it("returns invalid on facilitator HTTP error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const requirements = buildPaymentRequirements(testEndpoint, TEST_WALLET, CHAIN_CONFIGS);
    const paymentHeader = Buffer.from(JSON.stringify({})).toString("base64");

    const result = await verifyPayment({
      paymentHeader,
      requirements,
      facilitatorUrl: "https://test-facilitator.com",
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("500");
  });

  it("returns invalid when facilitator says not valid", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ valid: false, error: "Signature mismatch" }),
    });

    const requirements = buildPaymentRequirements(testEndpoint, TEST_WALLET, CHAIN_CONFIGS);
    const paymentHeader = Buffer.from(JSON.stringify({})).toString("base64");

    const result = await verifyPayment({
      paymentHeader,
      requirements,
      facilitatorUrl: "https://test-facilitator.com",
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Signature mismatch");
  });

  it("handles network errors gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const requirements = buildPaymentRequirements(testEndpoint, TEST_WALLET, CHAIN_CONFIGS);
    const paymentHeader = Buffer.from(JSON.stringify({})).toString("base64");

    const result = await verifyPayment({
      paymentHeader,
      requirements,
      facilitatorUrl: "https://unreachable.com",
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("handles malformed payment header", async () => {
    const result = await verifyPayment({
      paymentHeader: "not-valid-base64!!!",
      requirements: [],
      facilitatorUrl: "https://test-facilitator.com",
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("calculates fee breakdown with platform fee config", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true, txHash: "0xabc" }),
    });

    const requirements = buildPaymentRequirements(testEndpoint, TEST_WALLET, CHAIN_CONFIGS);
    const paymentHeader = Buffer.from(JSON.stringify({ network: "eip155:8453" })).toString("base64");

    const result = await verifyPayment(
      {
        paymentHeader,
        requirements,
        facilitatorUrl: "https://test-facilitator.com",
      },
      { feeBps: 300, platformWalletBase: "0xPlatform" }
    );

    expect(result.valid).toBe(true);
    expect(result.feeBreakdown).toBeDefined();
    expect(result.feeBreakdown?.feeBps).toBe(300);
  });
});

// ─── findEndpointConfig ─────────────────────────────────────────

describe("findEndpointConfig", () => {
  const endpoints: Record<string, EndpointConfig> = {
    "GET /api/data": testEndpoint,
    "POST /api/inference": {
      price: "0.01",
      chains: ["base"],
      description: "AI inference",
    },
    "GET /api/users/:id": {
      price: "0.002",
      chains: ["base"],
      description: "User lookup",
    },
  };

  it("finds matching endpoint", () => {
    const match = findEndpointConfig("GET", "/api/data", endpoints);
    expect(match).not.toBeNull();
    expect(match?.pattern).toBe("GET /api/data");
    expect(match?.config.price).toBe("0.005");
  });

  it("returns null for non-matching endpoint", () => {
    const match = findEndpointConfig("GET", "/api/unknown", endpoints);
    expect(match).toBeNull();
  });

  it("matches parameterized routes", () => {
    const match = findEndpointConfig("GET", "/api/users/123", endpoints);
    expect(match).not.toBeNull();
    expect(match?.pattern).toBe("GET /api/users/:id");
  });

  it("respects HTTP method", () => {
    const match = findEndpointConfig("POST", "/api/data", endpoints);
    expect(match).toBeNull();
  });
});

// ─── getEndpointFeeBreakdown ────────────────────────────────────

describe("getEndpointFeeBreakdown", () => {
  it("returns fee breakdown with platform fee", () => {
    const result = getEndpointFeeBreakdown(testEndpoint, { feeBps: 300 });
    expect(result.totalAmount).toBe("0.005");
    expect(result.feeBps).toBe(300);
  });

  it("returns zero fees without platform fee config", () => {
    const result = getEndpointFeeBreakdown(testEndpoint);
    expect(result.platformFee).toBe("0.000000");
  });
});
