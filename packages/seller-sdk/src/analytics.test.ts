import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AnalyticsReporter } from "./analytics";
import { verifyHmacSignature } from "@apitoll/shared";
import type { PaymentReceipt } from "@apitoll/shared";

const TEST_RECEIPT: PaymentReceipt = {
  txHash: "0xabc123",
  chain: "base",
  amount: "0.005000",
  from: "0xPayer",
  to: "0xSeller",
  timestamp: new Date().toISOString(),
};

function makeReport(overrides = {}) {
  return {
    endpoint: "GET /api/data",
    method: "GET",
    receipt: TEST_RECEIPT,
    responseStatus: 200,
    latencyMs: 50,
    ...overrides,
  };
}

// ─── Tests using fake timers (batch/flush/retry) ────────────────

describe("AnalyticsReporter (batching)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({ ok: true });
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("queues transactions and flushes on interval", async () => {
    const reporter = new AnalyticsReporter({
      apiKey: "test-key",
      platformUrl: "https://test-api.com",
    });

    await reporter.report(makeReport());
    await vi.advanceTimersByTimeAsync(5000);

    const batchCall = mockFetch.mock.calls.find((c) =>
      c[0].includes("/v1/transactions/batch")
    );
    expect(batchCall).toBeDefined();
    expect(batchCall![1].headers.Authorization).toBe("Bearer test-key");

    await reporter.destroy();
  });

  it("flushes immediately when queue hits 50", async () => {
    const reporter = new AnalyticsReporter({
      apiKey: "test-key",
      platformUrl: "https://test-api.com",
    });

    for (let i = 0; i < 50; i++) {
      await reporter.report(makeReport());
    }

    const batchCall = mockFetch.mock.calls.find((c) =>
      c[0].includes("/v1/transactions/batch")
    );
    expect(batchCall).toBeDefined();

    await reporter.destroy();
  });

  it("discards queue when no API key is configured", async () => {
    const reporter = new AnalyticsReporter({
      platformUrl: "https://test-api.com",
    });

    await reporter.report(makeReport());

    const batchCalls = mockFetch.mock.calls.filter((c) =>
      c[0]?.includes?.("/v1/transactions/batch")
    );
    expect(batchCalls).toHaveLength(0);

    await reporter.destroy();
  });

  it("marks 2xx responses as settled", async () => {
    const reporter = new AnalyticsReporter({
      apiKey: "key",
      platformUrl: "https://test-api.com",
    });

    await reporter.report(makeReport({ responseStatus: 200 }));
    await vi.advanceTimersByTimeAsync(5000);

    const body = JSON.parse(mockFetch.mock.calls.find((c) =>
      c[0].includes("/v1/transactions/batch")
    )![1].body);
    expect(body.transactions[0].status).toBe("settled");

    await reporter.destroy();
  });

  it("marks 4xx/5xx responses as failed", async () => {
    const reporter = new AnalyticsReporter({
      apiKey: "key",
      platformUrl: "https://test-api.com",
    });

    await reporter.report(makeReport({ responseStatus: 500 }));
    await vi.advanceTimersByTimeAsync(5000);

    const body = JSON.parse(mockFetch.mock.calls.find((c) =>
      c[0].includes("/v1/transactions/batch")
    )![1].body);
    expect(body.transactions[0].status).toBe("failed");

    await reporter.destroy();
  });

  it("includes fee breakdown in transaction data", async () => {
    const reporter = new AnalyticsReporter({
      apiKey: "key",
      platformUrl: "https://test-api.com",
    });

    await reporter.report(makeReport({
      feeBreakdown: {
        totalAmount: "0.005000",
        sellerAmount: "0.004850",
        platformFee: "0.000150",
        feeBps: 300,
      },
    }));

    await vi.advanceTimersByTimeAsync(5000);

    const body = JSON.parse(mockFetch.mock.calls.find((c) =>
      c[0].includes("/v1/transactions/batch")
    )![1].body);

    expect(body.transactions[0].platformFee).toBe("0.000150");
    expect(body.transactions[0].sellerAmount).toBe("0.004850");
    expect(body.transactions[0].feeBps).toBe(300);

    await reporter.destroy();
  });

  it("re-queues transactions on flush failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Server down"));
    mockFetch.mockResolvedValueOnce({ ok: true });

    const reporter = new AnalyticsReporter({
      apiKey: "key",
      platformUrl: "https://test-api.com",
    });

    await reporter.report(makeReport());
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);

    const batchCalls = mockFetch.mock.calls.filter((c) =>
      c[0].includes("/v1/transactions/batch")
    );
    expect(batchCalls.length).toBeGreaterThanOrEqual(2);

    await reporter.destroy();
  });

  it("flushes remaining queue on destroy", async () => {
    const reporter = new AnalyticsReporter({
      apiKey: "key",
      platformUrl: "https://test-api.com",
    });

    await reporter.report(makeReport());
    await reporter.destroy();

    const batchCall = mockFetch.mock.calls.find((c) =>
      c[0].includes("/v1/transactions/batch")
    );
    expect(batchCall).toBeDefined();
  });

  it("clears flush timer on destroy", async () => {
    const reporter = new AnalyticsReporter({ apiKey: "key" });
    await reporter.destroy();
    await vi.advanceTimersByTimeAsync(10000);
    // No errors — timer was cleaned up
  });
});

// ─── Tests using real timers (webhook / HMAC) ───────────────────

describe("AnalyticsReporter (webhooks)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends webhook immediately when configured", async () => {
    const reporter = new AnalyticsReporter({
      webhookUrl: "https://hooks.example.com/tx",
    });

    await reporter.report(makeReport());

    // Webhook is fire-and-forget but without HMAC it's synchronous fetch call
    // Give the microtask queue a tick
    await new Promise((r) => setTimeout(r, 20));

    const webhookCall = mockFetch.mock.calls.find((c) =>
      c[0] === "https://hooks.example.com/tx"
    );
    expect(webhookCall).toBeDefined();
    const body = JSON.parse(webhookCall![1].body);
    expect(body.type).toBe("transaction.settled");
    expect(body.data.txHash).toBe("0xabc123");

    await reporter.destroy();
  });

  it("does not send webhook when not configured", async () => {
    const reporter = new AnalyticsReporter({});

    await reporter.report(makeReport());

    expect(mockFetch).not.toHaveBeenCalled();
    await reporter.destroy();
  });

  it("includes HMAC signature when webhookSecret is set", async () => {
    // Capture the webhook call via a deferred promise
    let capturedArgs: unknown[] | null = null;
    let resolveCapture: () => void;
    const captured = new Promise<void>((resolve) => { resolveCapture = resolve; });

    mockFetch.mockImplementation((...args: unknown[]) => {
      capturedArgs = args;
      resolveCapture();
      return Promise.resolve({ ok: true });
    });

    const secret = "my-webhook-secret";
    const reporter = new AnalyticsReporter({
      webhookUrl: "https://hooks.example.com/tx",
      webhookSecret: secret,
    });

    // Don't await report — it fires webhook as fire-and-forget
    reporter.report(makeReport());

    // Wait for the async webhook (HMAC computation + fetch) to complete
    await captured;

    expect(capturedArgs).not.toBeNull();
    expect(capturedArgs![0]).toBe("https://hooks.example.com/tx");

    const headers = (capturedArgs![1] as { headers: Record<string, string> }).headers;
    const signature = headers["X-Webhook-Signature"];
    expect(signature).toBeDefined();
    expect(signature).toMatch(/^[a-f0-9]{64}$/);

    // Verify the signature matches the payload
    const body = (capturedArgs![1] as { body: string }).body;
    const isValid = await verifyHmacSignature(body, secret, signature);
    expect(isValid).toBe(true);

    await reporter.destroy();
  });

  it("does not include signature header when no secret", async () => {
    const reporter = new AnalyticsReporter({
      webhookUrl: "https://hooks.example.com/tx",
    });

    await reporter.report(makeReport());
    await new Promise((r) => setTimeout(r, 20));

    const webhookCall = mockFetch.mock.calls.find((c) =>
      c[0] === "https://hooks.example.com/tx"
    );
    expect(webhookCall![1].headers["X-Webhook-Signature"]).toBeUndefined();

    await reporter.destroy();
  });

  it("swallows webhook errors without crashing", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const reporter = new AnalyticsReporter({
      webhookUrl: "https://hooks.example.com/tx",
      verbose: false,
    });

    await expect(reporter.report(makeReport())).resolves.not.toThrow();
    await reporter.destroy();
  });
});
