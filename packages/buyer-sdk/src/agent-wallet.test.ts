import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAgentWallet, AgentPaymentError, PolicyViolationError } from "./agent-wallet";

const MOCK_SIGNER = vi.fn(async () => "mock-signed-payment-header");

function create402Response(price: string = "5000") {
  const requirements = [
    {
      scheme: "exact",
      network: "eip155:8453",
      maxAmountRequired: price,
      description: "Test",
      payTo: "0xSeller",
      asset: "0xUSDC",
    },
  ];
  const headerValue = Buffer.from(JSON.stringify(requirements)).toString("base64");

  return new Response(JSON.stringify({ paymentRequirements: requirements }), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "payment-required": headerValue,
    },
  });
}

describe("AgentWallet", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    MOCK_SIGNER.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes through non-402 responses", async () => {
    mockFetch.mockResolvedValue(new Response('{"data":"ok"}', { status: 200 }));

    const wallet = createAgentWallet({
      name: "TestBot",
      chain: "base",
      policies: [{ type: "vendor_acl", allowedVendors: ["*"] }],
      signer: MOCK_SIGNER,
    });

    const response = await wallet.fetch("https://api.example.com/data");
    expect(response.status).toBe(200);
    expect(MOCK_SIGNER).not.toHaveBeenCalled();
  });

  it("handles 402 with automatic payment", async () => {
    // First call: 402, second call: 200
    mockFetch
      .mockResolvedValueOnce(create402Response())
      .mockResolvedValueOnce(new Response('{"data":"paid"}', { status: 200 }));

    const wallet = createAgentWallet({
      name: "TestBot",
      chain: "base",
      policies: [{ type: "vendor_acl", allowedVendors: ["*"] }],
      signer: MOCK_SIGNER,
      disableGossip: true,
    });

    const response = await wallet.fetch("https://api.example.com/data");
    expect(response.status).toBe(200);
    expect(MOCK_SIGNER).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Second call should include X-PAYMENT header
    const secondCallInit = mockFetch.mock.calls[1][1];
    expect(secondCallInit.headers["X-PAYMENT"]).toBe("mock-signed-payment-header");
  });

  it("throws when no signer is configured", async () => {
    mockFetch.mockResolvedValueOnce(create402Response());

    const wallet = createAgentWallet({
      name: "TestBot",
      chain: "base",
      policies: [{ type: "vendor_acl", allowedVendors: ["*"] }],
    });

    await expect(wallet.fetch("https://api.example.com/data")).rejects.toThrow(
      AgentPaymentError
    );
  });

  it("throws PolicyViolationError when vendor is blocked", async () => {
    mockFetch.mockResolvedValueOnce(create402Response());

    const wallet = createAgentWallet({
      name: "TestBot",
      chain: "base",
      policies: [
        { type: "vendor_acl", allowedVendors: ["approved.com"] },
      ],
      signer: MOCK_SIGNER,
    });

    await expect(
      wallet.fetch("https://api.unapproved.com/data")
    ).rejects.toThrow(PolicyViolationError);
  });

  it("throws when price exceeds maxPrice override", async () => {
    // Price is 5000 smallest units = $0.005
    mockFetch.mockResolvedValueOnce(create402Response("5000"));

    const wallet = createAgentWallet({
      name: "TestBot",
      chain: "base",
      policies: [{ type: "vendor_acl", allowedVendors: ["*"] }],
      signer: MOCK_SIGNER,
    });

    await expect(
      wallet.fetch("https://api.example.com/data", { maxPrice: 0.001 })
    ).rejects.toThrow("exceeds max price");
  });

  it("allows when price is within maxPrice", async () => {
    mockFetch
      .mockResolvedValueOnce(create402Response("5000"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const wallet = createAgentWallet({
      name: "TestBot",
      chain: "base",
      policies: [{ type: "vendor_acl", allowedVendors: ["*"] }],
      signer: MOCK_SIGNER,
      disableGossip: true,
    });

    const response = await wallet.fetch("https://api.example.com/data", { maxPrice: 1.0 });
    expect(response.status).toBe(200);
  });

  it("records transactions after payment", async () => {
    mockFetch
      .mockResolvedValueOnce(create402Response())
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const wallet = createAgentWallet({
      name: "TestBot",
      chain: "base",
      policies: [{ type: "vendor_acl", allowedVendors: ["*"] }],
      signer: MOCK_SIGNER,
      disableGossip: true,
    });

    await wallet.fetch("https://api.example.com/data");
    const txns = wallet.getTransactions();
    expect(txns).toHaveLength(1);
    expect(txns[0].status).toBe("settled");
    expect(txns[0].chain).toBe("base");
  });

  it("skips policy check when skipPolicyCheck is true", async () => {
    mockFetch
      .mockResolvedValueOnce(create402Response())
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const wallet = createAgentWallet({
      name: "TestBot",
      chain: "base",
      policies: [
        { type: "vendor_acl", allowedVendors: ["approved.com"] }, // Would normally block
      ],
      signer: MOCK_SIGNER,
      disableGossip: true,
    });

    // Should NOT throw because skipPolicyCheck is true
    const response = await wallet.fetch("https://api.blocked.com/data", {
      skipPolicyCheck: true,
    });
    expect(response.status).toBe(200);
  });

  it("prefers matching chain requirement", async () => {
    const multiChainReqs = [
      {
        scheme: "exact",
        network: "solana:mainnet",
        maxAmountRequired: "5000",
        description: "Test",
        payTo: "0xSeller",
        asset: "solUSDC",
      },
      {
        scheme: "exact",
        network: "eip155:8453",
        maxAmountRequired: "5000",
        description: "Test",
        payTo: "0xSeller",
        asset: "0xUSDC",
      },
    ];
    const headerValue = Buffer.from(JSON.stringify(multiChainReqs)).toString("base64");
    const response402 = new Response(JSON.stringify({ paymentRequirements: multiChainReqs }), {
      status: 402,
      headers: { "payment-required": headerValue },
    });

    mockFetch
      .mockResolvedValueOnce(response402)
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const wallet = createAgentWallet({
      name: "TestBot",
      chain: "base", // prefers base
      policies: [{ type: "vendor_acl", allowedVendors: ["*"] }],
      signer: MOCK_SIGNER,
      disableGossip: true,
    });

    await wallet.fetch("https://api.example.com/data");

    // Signer should have been called with the base requirement
    expect(MOCK_SIGNER).toHaveBeenCalledWith(
      [expect.objectContaining({ network: "eip155:8453" })],
      "base"
    );
  });

  it("calls onPayment callback on successful payment", async () => {
    const onPayment = vi.fn();
    mockFetch
      .mockResolvedValueOnce(create402Response())
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const wallet = createAgentWallet({
      name: "TestBot",
      chain: "base",
      policies: [{ type: "vendor_acl", allowedVendors: ["*"] }],
      signer: MOCK_SIGNER,
      onPayment,
      disableGossip: true,
    });

    await wallet.fetch("https://api.example.com/data");
    expect(onPayment).toHaveBeenCalledOnce();
  });

  it("calls onPolicyRejection callback when policy rejects", async () => {
    const onPolicyRejection = vi.fn();
    mockFetch.mockResolvedValueOnce(create402Response());

    const wallet = createAgentWallet({
      name: "TestBot",
      chain: "base",
      policies: [{ type: "vendor_acl", allowedVendors: ["approved.com"] }],
      signer: MOCK_SIGNER,
      onPolicyRejection,
    });

    await expect(wallet.fetch("https://blocked.com/data")).rejects.toThrow();
    expect(onPolicyRejection).toHaveBeenCalledOnce();
  });

  it("tracks spend summary correctly", async () => {
    mockFetch
      .mockResolvedValueOnce(create402Response("5000"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))
      .mockResolvedValueOnce(create402Response("10000"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const wallet = createAgentWallet({
      name: "TestBot",
      chain: "base",
      policies: [{ type: "vendor_acl", allowedVendors: ["*"] }],
      signer: MOCK_SIGNER,
      disableGossip: true,
    });

    await wallet.fetch("https://api.example.com/a");
    await wallet.fetch("https://api.example.com/b");

    const summary = wallet.getSpendSummary();
    expect(summary.transactionCount).toBe(2);
    expect(summary.today).toBeGreaterThan(0);
  });
});
