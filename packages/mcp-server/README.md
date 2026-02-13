# @apitoll/mcp-server

Monetize MCP tools with x402 micropayments. Turn any AI tool into a paid service in 5 lines of code.

Built on the [x402 HTTP Payment Protocol](https://www.x402.org/) — USDC settled instantly on Base.

## Installation

```bash
npm install @apitoll/mcp-server
```

## Quick Start

```ts
import express from "express";
import { createPaidMCPServer, toExpressRouter } from "@apitoll/mcp-server";
import { z } from "zod";

const server = createPaidMCPServer({
  walletAddress: "0xYourWallet...",
});

// Free tool
server.tool(
  "ping",
  "Health check",
  z.object({}),
  async () => "pong"
);

// Paid tool — $0.01 per call
server.paidTool(
  "analyze",
  "Analyze data with AI",
  z.object({ query: z.string() }),
  { price: 0.01, chains: ["base"] },
  async ({ query }) => ({ result: `Analysis of: ${query}` })
);

const app = express();
app.use("/mcp", toExpressRouter(server));
app.listen(3000);
```

That's it. Agents discover your tools, pay USDC, get results.

## How It Works

1. Agent calls `GET /mcp/tools` to discover available tools and pricing
2. Agent calls `POST /mcp/tools/:name` to invoke a paid tool
3. Server returns `402 Payment Required` with USDC amount and chain info
4. Agent pays via the x402 facilitator, gets a signed payment header
5. Agent retries with `X-PAYMENT` header — tool executes, agent gets results
6. You receive USDC instantly in your wallet

## API

### `createPaidMCPServer(config)`

```ts
const server = createPaidMCPServer({
  walletAddress: "0x...",         // Your USDC wallet
  defaultChain: "base",           // Default chain (base | solana)
  facilitatorUrl: "https://x402.org/facilitator",
  discoveryUrl: "https://apitoll.com/api/discover",
  sellerId: "my-tools",
  onPayment: (tool, amount, txHash) => {
    console.log(`Paid: $${amount} for ${tool}`);
  },
});
```

### `server.tool(name, description, schema, handler)`

Register a free tool:

```ts
server.tool("hello", "Say hello", z.object({ name: z.string() }), async ({ name }) => {
  return `Hello, ${name}!`;
});
```

### `server.paidTool(name, description, schema, payment, handler)`

Register a paid tool:

```ts
server.paidTool(
  "research",
  "Deep web research",
  z.object({ topic: z.string() }),
  {
    price: 0.05,                  // $0.05 USDC per call
    chains: ["base", "solana"],   // Accepted chains
    category: "research",         // For discovery
    tags: ["ai", "search"],       // For discovery
  },
  async ({ topic }) => {
    const results = await doResearch(topic);
    return results;
  }
);
```

## Framework Adapters

### Express

```ts
import { toExpressRouter } from "@apitoll/mcp-server";

app.use("/mcp", toExpressRouter(server));
```

Exposes:
- `GET  /mcp/tools` — List all tools with pricing
- `POST /mcp/tools/:name` — Call a tool (with `X-PAYMENT` header)
- `GET  /mcp/tools/:name/payment` — Get payment requirements
- `POST /mcp/rpc` — JSON-RPC 2.0 endpoint

### Hono

```ts
import { toHonoApp } from "@apitoll/mcp-server";

const handlers = toHonoApp(server);
app.get("/tools", (c) => c.json(handlers.listTools()));
app.post("/tools/:name", async (c) => {
  const result = await handlers.callTool(
    c.req.param("name"),
    await c.req.json(),
    c.req.header("x-payment")
  );
  return c.json(result);
});
```

### Stdio (Claude Desktop)

```ts
import { runStdio } from "@apitoll/mcp-server";

runStdio(server);
```

## Discovery Registration

Auto-register tools with the API Toll directory so agents can find them:

```ts
const server = createPaidMCPServer({
  walletAddress: "0x...",
  discoveryUrl: "https://apitoll.com/api/discover",
  sellerId: "my-tools",
});

// After adding tools, register them
await server.registerWithDiscovery("https://my-api.com");
```

## Part of API Toll

API Toll is the payment infrastructure for autonomous AI agents. Learn more:

- [apitoll.com](https://apitoll.com) — Dashboard & marketplace
- [`@apitoll/seller-sdk`](https://www.npmjs.com/package/@apitoll/seller-sdk) — For REST API sellers
- [`@apitoll/buyer-sdk`](https://www.npmjs.com/package/@apitoll/buyer-sdk) — For AI agent builders
- [x402 Protocol](https://www.x402.org/) — The HTTP payment standard
- [GitHub](https://github.com/TasnidChain/APITOLL)

## License

MIT
