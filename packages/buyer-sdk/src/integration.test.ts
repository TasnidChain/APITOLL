/**
 * End-to-end integration test
 *
 * Simulates the full x402 payment flow:
 *   1. Agent calls a paid endpoint
 *   2. Seller returns 402 with payment requirements
 *   3. Agent's wallet calls the signer
 *   4. Agent retries with X-PAYMENT header
 *   5. Seller responds with paid data
 *
 * No real blockchain or facilitator — all mocked at boundaries.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAgentWallet, type PaymentSigner } from "./agent-wallet";
import { PolicyEngine } from "./policy-engine";
import { APITOLLMutator } from "./mutator";
import { DEFAULT_CHAIN_CONFIGS } from "@apitoll/shared";


const SELLER_WALLET = "0xSeller1234567890abcdef1234567890abcdef";
const USDC_ADDRESS = DEFAULT_CHAIN_CONFIGS.base.usdcAddress;

function create402Response(priceSmallestUnit: string = "5000") {
  const requirements = [
    {
      scheme: "exact" as const,
      network: "eip155:8453",
      maxAmountRequired: priceSmallestUnit,
      description: "Test endpoint",
      payTo: SELLER_WALLET,
      asset: USDC_ADDRESS,
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

function create200Response(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}


describe("E2E: Full x402 Payment Flow", () => {
  const mockFetch = vi.fn();
  let signCalls: Array<{ requirements: unknown[]; chain: string }>;

  const mockSigner: PaymentSigner = async (requirements, chain) => {
    signCalls.push({ requirements, chain });
    // Simulate a real payment proof (base64-encoded JSON)
    const proof = {
      txHash: "0xabc123def456",
      paymentId: "pay_test_001",
      from: "0xAgentWallet",
      network: "eip155:8453",
    };
    return Buffer.from(JSON.stringify(proof)).toString("base64");
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    signCalls = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("completes full 402 → pay → 200 flow", async () => {
    // Step 1: First request → 402
    // Step 2: Agent pays → signed proof
    // Step 3: Retry with payment → 200
    mockFetch
      .mockResolvedValueOnce(create402Response("5000"))
      .mockResolvedValueOnce(create200Response({ result: "paid data", success: true }));

    const agent = createAgentWallet({
      name: "E2E-TestAgent",
      chain: "base",
      policies: [
        { type: "budget", dailyCap: 10.0, maxPerRequest: 1.0 },
        { type: "vendor_acl", allowedVendors: ["*"] },
      ],
      signer: mockSigner,
      disableGossip: true,
    });

    const response = await agent.fetch("https://api.example.com/api/search?q=test");
    const data = (await response.json()) as Record<string, unknown>;

    // Verify the full flow
    expect(response.status).toBe(200);
    expect(data.result).toBe("paid data");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(signCalls).toHaveLength(1);
    expect(signCalls[0].chain).toBe("base");

    // Verify payment header was sent on retry
    const retryCall = mockFetch.mock.calls[1];
    expect(retryCall[1].headers["X-PAYMENT"]).toBeDefined();

    // Verify transaction was recorded
    const txns = agent.getTransactions();
    expect(txns).toHaveLength(1);
    expect(txns[0].status).toBe("settled");
    expect(txns[0].endpoint).toContain("/api/search");
    expect(txns[0].chain).toBe("base");

    // Verify spend tracking
    const spend = agent.getSpendSummary();
    expect(spend.transactionCount).toBe(1);
    expect(spend.today).toBeGreaterThan(0);
  });

  it("enforces budget policy across multiple requests", async () => {
    // Price: 5000 smallest unit = $0.005 per request
    // Budget: maxPerRequest = $0.01, dailyCap = $0.02
    // Should allow 4 requests ($0.005 * 4 = $0.02) then reject

    const agent = createAgentWallet({
      name: "BudgetTest",
      chain: "base",
      policies: [
        { type: "budget", dailyCap: 0.02, maxPerRequest: 0.01 },
        { type: "vendor_acl", allowedVendors: ["*"] },
      ],
      signer: mockSigner,
      disableGossip: true,
    });

    // Request 1-4 should succeed
    for (let i = 0; i < 4; i++) {
      mockFetch
        .mockResolvedValueOnce(create402Response("5000"))
        .mockResolvedValueOnce(create200Response({ i }));
      const res = await agent.fetch(`https://api.example.com/data?i=${i}`);
      expect(res.status).toBe(200);
    }

    expect(agent.getSpendSummary().transactionCount).toBe(4);

    // Request 5 should be rejected by budget policy
    mockFetch.mockResolvedValueOnce(create402Response("5000"));

    await expect(
      agent.fetch("https://api.example.com/data?i=5")
    ).rejects.toThrow();
  });

  it("rejects when vendor is not in allowlist", async () => {
    mockFetch.mockResolvedValueOnce(create402Response("5000"));

    const agent = createAgentWallet({
      name: "ACLTest",
      chain: "base",
      policies: [
        { type: "vendor_acl", allowedVendors: ["trusted-api.com"] },
      ],
      signer: mockSigner,
    });

    await expect(
      agent.fetch("https://untrusted-api.com/data")
    ).rejects.toThrow("Vendor");
  });

  it("rejects when price exceeds maxPrice override", async () => {
    // Price is $0.005, maxPrice is $0.001
    mockFetch.mockResolvedValueOnce(create402Response("5000"));

    const agent = createAgentWallet({
      name: "MaxPriceTest",
      chain: "base",
      policies: [{ type: "vendor_acl", allowedVendors: ["*"] }],
      signer: mockSigner,
    });

    await expect(
      agent.fetch("https://api.example.com/data", { maxPrice: 0.001 })
    ).rejects.toThrow("exceeds max price");
  });

  it("handles non-402 responses without payment", async () => {
    mockFetch.mockResolvedValueOnce(create200Response({ free: true }));

    const agent = createAgentWallet({
      name: "FreeTest",
      chain: "base",
      policies: [{ type: "vendor_acl", allowedVendors: ["*"] }],
      signer: mockSigner,
      disableGossip: true,
    });

    const res = await agent.fetch("https://api.example.com/health");
    const data = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(data.free).toBe(true);
    expect(signCalls).toHaveLength(0); // No signing happened
    expect(agent.getTransactions()).toHaveLength(0);
  });

  it("handles signer failure gracefully", async () => {
    mockFetch.mockResolvedValueOnce(create402Response("5000"));

    const failingSigner: PaymentSigner = async () => {
      throw new Error("Wallet disconnected");
    };

    const agent = createAgentWallet({
      name: "FailSignerTest",
      chain: "base",
      policies: [{ type: "vendor_acl", allowedVendors: ["*"] }],
      signer: failingSigner,
    });

    await expect(
      agent.fetch("https://api.example.com/data")
    ).rejects.toThrow("Wallet disconnected");
  });

  it("selects correct chain from multi-chain requirements", async () => {
    const multiChainReqs = [
      {
        scheme: "exact" as const,
        network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        maxAmountRequired: "5000",
        description: "Test",
        payTo: SELLER_WALLET,
        asset: DEFAULT_CHAIN_CONFIGS.solana.usdcAddress,
      },
      {
        scheme: "exact" as const,
        network: "eip155:8453",
        maxAmountRequired: "5000",
        description: "Test",
        payTo: SELLER_WALLET,
        asset: USDC_ADDRESS,
      },
    ];
    const headerValue = Buffer.from(JSON.stringify(multiChainReqs)).toString("base64");
    const multiChain402 = new Response(
      JSON.stringify({ paymentRequirements: multiChainReqs }),
      { status: 402, headers: { "payment-required": headerValue } }
    );

    mockFetch
      .mockResolvedValueOnce(multiChain402)
      .mockResolvedValueOnce(create200Response({ chain: "base" }));

    // Agent prefers base
    const agent = createAgentWallet({
      name: "ChainSelectTest",
      chain: "base",
      policies: [{ type: "vendor_acl", allowedVendors: ["*"] }],
      signer: mockSigner,
      disableGossip: true,
    });

    await agent.fetch("https://api.example.com/data");

    // Signer should receive base requirement
    expect(signCalls[0].chain).toBe("base");
    expect(signCalls[0].requirements).toEqual([
      expect.objectContaining({ network: "eip155:8453" }),
    ]);
  });
});

describe("E2E: PolicyEngine + Mutator integration", () => {
  let txCounter = 0;

  /** Build a minimal Transaction object for recordTransaction(). */
  function makeTx(amount: string, sellerId: string): import("@apitoll/shared").Transaction {
    txCounter++;
    return {
      id: `tx_test_${txCounter}`,
      txHash: `0xhash${txCounter}`,
      agentAddress: "0xAgentWallet",
      sellerId,
      endpoint: "/api/data",
      method: "GET",
      amount,
      chain: "base",
      status: "settled",
      requestedAt: new Date().toISOString(),
    };
  }

  it("mutator evolves after successful transactions", () => {
    txCounter = 0;
    const mutator = new APITOLLMutator();
    mutator.updateReputation(0.8);

    const policyEngine = new PolicyEngine([
      { type: "budget", dailyCap: 100, maxPerRequest: 1.0 },
      { type: "vendor_acl", allowedVendors: ["*"] },
    ]);

    // Simulate 10 successful transactions
    for (let i = 0; i < 10; i++) {
      const check = policyEngine.evaluate({ amount: 0.005, sellerId: "api.example.com", endpoint: "/api/data" });
      expect(check.allowed).toBe(true);

      if (check.allowed) {
        policyEngine.recordTransaction(makeTx("0.005", "api.example.com"));
        mutator.onSuccess({
          success: true,
          latencyMs: 100 + Math.random() * 50,
          amount: 0.005,
          chain: "base",
        });
      }
    }

    // Verify evolution happened
    const state = mutator.getState();
    expect(state.apitollPreference).toBeGreaterThan(0.5);
    expect(state.mutationCount).toBeGreaterThan(0);
    expect(state.recentSuccessRate).toBe(1);

    // Verify policy engine tracked spend
    const spent = policyEngine.getSpendSummary().today;
    expect(spent).toBeCloseTo(0.05, 4);
  });

  it("policy engine blocks after budget exhausted", () => {
    txCounter = 0;
    const policyEngine = new PolicyEngine([
      { type: "budget", dailyCap: 0.01, maxPerRequest: 0.005 },
    ]);

    // First two should work
    expect(policyEngine.evaluate({ amount: 0.005, sellerId: "api.example.com", endpoint: "/api/data" }).allowed).toBe(true);
    policyEngine.recordTransaction(makeTx("0.005", "api.example.com"));

    expect(policyEngine.evaluate({ amount: 0.005, sellerId: "api.example.com", endpoint: "/api/data" }).allowed).toBe(true);
    policyEngine.recordTransaction(makeTx("0.005", "api.example.com"));

    // Third should be blocked — daily cap ($0.01) exhausted
    const check = policyEngine.evaluate({ amount: 0.005, sellerId: "api.example.com", endpoint: "/api/data" });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("daily");
  });

  it("mutator state persists across export/import", () => {
    const mutator1 = new APITOLLMutator();
    mutator1.updateReputation(0.9);

    for (let i = 0; i < 15; i++) {
      mutator1.onSuccess({ success: true, latencyMs: 80, amount: 0.005, chain: "base" });
    }

    const exported = mutator1.exportState();

    // "Restart" with a new mutator
    const mutator2 = new APITOLLMutator();
    mutator2.importState(exported);

    expect(mutator2.getState().apitollPreference).toBe(mutator1.getState().apitollPreference);
    expect(mutator2.getState().mutationCount).toBe(mutator1.getState().mutationCount);
    expect(mutator2.getState().useEscrow).toBe(mutator1.getState().useEscrow);
  });
});
