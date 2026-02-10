import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildPaymentRequirements,
  verifyPayment,
  createPaymentRequiredResponse,
  createPaymentReceipt,
} from "./payment";
import { CHAIN_CONFIG } from "./types";

const TEST_WALLET = "0x1234567890abcdef1234567890abcdef12345678";


describe("MCP buildPaymentRequirements", () => {
  it("builds requirements with correct amount conversion", () => {
    const reqs = buildPaymentRequirements("test-tool", { price: 0.005 }, TEST_WALLET);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].maxAmountRequired).toBe("5000");
    expect(reqs[0].resource).toBe("mcp://tool/test-tool");
    expect(reqs[0].payTo).toBe(TEST_WALLET);
    expect(reqs[0].scheme).toBe("exact");
  });

  it("builds for multiple chains", () => {
    const reqs = buildPaymentRequirements("tool", { price: 1 }, TEST_WALLET, ["base", "solana"]);
    expect(reqs).toHaveLength(2);
    expect(reqs[0].network).toBe(CHAIN_CONFIG.base.network);
    expect(reqs[1].network).toBe(CHAIN_CONFIG.solana.network);
  });

  it("uses correct USDC asset per chain", () => {
    const reqs = buildPaymentRequirements("tool", { price: 1 }, TEST_WALLET, ["base", "solana"]);
    expect(reqs[0].asset).toBe(CHAIN_CONFIG.base.asset);
    expect(reqs[1].asset).toBe(CHAIN_CONFIG.solana.asset);
  });

  it("includes description from config", () => {
    const reqs = buildPaymentRequirements(
      "tool",
      { price: 1, description: "Custom description" },
      TEST_WALLET
    );
    expect(reqs[0].description).toBe("Custom description");
  });

  it("falls back to default description", () => {
    const reqs = buildPaymentRequirements("my-tool", { price: 1 }, TEST_WALLET);
    expect(reqs[0].description).toBe("Payment for my-tool tool");
  });

  it("handles fractional cent prices", () => {
    const reqs = buildPaymentRequirements("tool", { price: 0.0001 }, TEST_WALLET);
    expect(reqs[0].maxAmountRequired).toBe("100");
  });
});


describe("MCP verifyPayment", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns valid on successful verification", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true, txHash: "0xabc" }),
    });

    const header = Buffer.from(
      JSON.stringify({ payload: "test", signature: "0xsig" })
    ).toString("base64");

    const result = await verifyPayment(header, [], "https://facilitator.test");
    expect(result.valid).toBe(true);
    expect(result.txHash).toBe("0xabc");
  });

  it("returns invalid on facilitator error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      text: async () => "Bad request",
    });

    const header = Buffer.from(
      JSON.stringify({ payload: "test", signature: "0xsig" })
    ).toString("base64");

    const result = await verifyPayment(header, [], "https://facilitator.test");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Facilitator error");
  });

  it("returns invalid for malformed payment header", async () => {
    const result = await verifyPayment("not-base64!!!", [], "https://facilitator.test");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid payment header format");
  });

  it("returns invalid when payload is missing signature field", async () => {
    const header = Buffer.from(
      JSON.stringify({ payload: "test" }) // no signature
    ).toString("base64");

    const result = await verifyPayment(header, [], "https://facilitator.test");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid payment header format");
  });

  it("handles network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network down"));

    const header = Buffer.from(
      JSON.stringify({ payload: "test", signature: "0xsig" })
    ).toString("base64");

    const result = await verifyPayment(header, [], "https://facilitator.test");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Network down");
  });

  it("uses default facilitator URL when not provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true }),
    });

    const header = Buffer.from(
      JSON.stringify({ payload: "test", signature: "0xsig" })
    ).toString("base64");

    await verifyPayment(header, []);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://x402.org/facilitator/verify",
      expect.any(Object)
    );
  });
});


describe("createPaymentRequiredResponse", () => {
  it("creates error response with payment info", () => {
    const reqs = buildPaymentRequirements("tool", { price: 0.005 }, TEST_WALLET);
    const response = createPaymentRequiredResponse(reqs);

    expect(response.isError).toBe(true);
    expect(response.content[0].type).toBe("text");
    expect(response.content[0].text).toContain("$0.0050");
    expect(response._meta.paymentRequired).toEqual(reqs);
  });
});


describe("createPaymentReceipt", () => {
  it("creates receipt from verification result", () => {
    const result = { valid: true, txHash: "0xdef", settledAt: new Date("2024-01-01") };
    const receipt = createPaymentReceipt(result, 0.005, "base");

    expect(receipt.txHash).toBe("0xdef");
    expect(receipt.amount).toBe(0.005);
    expect(receipt.chain).toBe("base");
    expect(receipt.settledAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("handles missing txHash", () => {
    const result = { valid: true };
    const receipt = createPaymentReceipt(result, 1, "solana");
    expect(receipt.txHash).toBe("");
  });
});
