import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createPaidMCPServer } from "./server";

const TEST_WALLET = "0x1234567890abcdef1234567890abcdef12345678";

function createServer() {
  return createPaidMCPServer({
    walletAddress: TEST_WALLET,
    defaultChain: "base",
    facilitatorUrl: "https://test-facilitator.com",
  });
}

describe("PaidMCPServer", () => {
  describe("tool registration", () => {
    it("registers free tools", () => {
      const server = createServer();
      server.tool(
        "echo",
        "Echo input",
        z.object({ text: z.string() }),
        async (input) => input.text
      );

      const defs = server.getToolDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].name).toBe("echo");
      expect(defs[0]["x-402"]).toBeUndefined();
    });

    it("registers paid tools with x-402 metadata", () => {
      const server = createServer();
      server.paidTool(
        "analyze",
        "AI analysis",
        z.object({ data: z.string() }),
        { price: 0.01, chains: ["base"] },
        async (input) => `Analyzed: ${input.data}`
      );

      const defs = server.getToolDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0]["x-402"]).toBeDefined();
      expect(defs[0]["x-402"]!.price).toBe(0.01);
      expect(defs[0]["x-402"]!.currency).toBe("USDC");
      expect(defs[0]["x-402"]!.payTo).toBe(TEST_WALLET);
    });

    it("supports method chaining", () => {
      const server = createServer();
      const result = server
        .tool("a", "Tool A", z.object({}), async () => "a")
        .paidTool("b", "Tool B", z.object({}), { price: 0.01 }, async () => "b");

      expect(result).toBe(server);
      expect(server.getToolDefinitions()).toHaveLength(2);
    });
  });

  describe("handleToolCall", () => {
    it("executes free tool without payment", async () => {
      const server = createServer();
      server.tool(
        "echo",
        "Echo input",
        z.object({ text: z.string() }),
        async (input) => input.text
      );

      const result = await server.handleToolCall("echo", { text: "hello" });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe("hello");
    });

    it("returns error for unknown tool", async () => {
      const server = createServer();
      const result = await server.handleToolCall("nonexistent", {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("validates input schema", async () => {
      const server = createServer();
      server.tool(
        "strict",
        "Strict tool",
        z.object({ count: z.number() }),
        async (input) => `Count: ${input.count}`
      );

      const result = await server.handleToolCall("strict", { count: "not-a-number" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid input");
    });

    it("requires payment for paid tools", async () => {
      const server = createServer();
      server.paidTool(
        "premium",
        "Premium tool",
        z.object({}),
        { price: 0.01 },
        async () => "premium result"
      );

      const result = await server.handleToolCall("premium", {});
      expect(result.isError).toBe(true);
      expect(result._meta?.paymentRequired).toBeDefined();
      expect(result._meta!.paymentRequired!.length).toBeGreaterThan(0);
    });

    it("handles tool handler errors gracefully", async () => {
      const server = createServer();
      server.tool(
        "broken",
        "Broken tool",
        z.object({}),
        async () => { throw new Error("Tool crashed"); }
      );

      const result = await server.handleToolCall("broken", {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Tool crashed");
    });

    it("returns JSON stringified result for object responses", async () => {
      const server = createServer();
      server.tool(
        "json-tool",
        "JSON tool",
        z.object({}),
        async () => ({ key: "value", count: 42 })
      );

      const result = await server.handleToolCall("json-tool", {});
      const parsed = JSON.parse(result.content[0].text!);
      expect(parsed.key).toBe("value");
      expect(parsed.count).toBe(42);
    });
  });

  describe("getToolPaymentInfo", () => {
    it("returns payment info for paid tools", () => {
      const server = createServer();
      server.paidTool(
        "paid",
        "Paid tool",
        z.object({}),
        { price: 0.05, chains: ["base", "solana"] },
        async () => "ok"
      );

      const info = server.getToolPaymentInfo("paid");
      expect(info).not.toBeNull();
      expect(info!.price).toBe(0.05);
      expect(info!.currency).toBe("USDC");
      expect(info!.requirements).toHaveLength(2);
    });

    it("returns null for free tools", () => {
      const server = createServer();
      server.tool("free", "Free tool", z.object({}), async () => "ok");

      expect(server.getToolPaymentInfo("free")).toBeNull();
    });

    it("returns null for unknown tools", () => {
      const server = createServer();
      expect(server.getToolPaymentInfo("nonexistent")).toBeNull();
    });
  });
});
