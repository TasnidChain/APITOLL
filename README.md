<div align="center">

# Apitoll

**The commerce layer for the x402 agent economy.**

Monetize APIs with micropayments. Control agent spending. Own the transaction graph.

[![CI](https://github.com/TasnidChain/APITOLL/actions/workflows/ci.yml/badge.svg)](https://github.com/TasnidChain/APITOLL/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green?logo=node.js&logoColor=white)](https://nodejs.org/)

[Website](https://apitoll.com) &bull; [Documentation](#quick-start) &bull; [Examples](./examples)

</div>

---

## What is Apitoll?

Apitoll lets AI agents pay for API calls using USDC stablecoins on **Base** and **Solana** — powered by the [x402 protocol](https://x402.org) (HTTP 402 Payment Required).

**For API sellers**: Add 3 lines of middleware to monetize any endpoint with micropayments.

**For agent builders**: Give your agents a wallet with budget controls and they auto-handle payments.

```
┌─────────────────┐     HTTP 402      ┌──────────────────┐
│   AI Agent      │◄──────────────────│  Paid API / MCP  │
│   (Buyer SDK)   │  X-PAYMENT ──────►│  (Seller SDK)    │
│                 │     200 OK        │                  │
│  Policy Engine  │◄──────────────────│  Analytics Hook  │
└────────┬────────┘                   └────────┬─────────┘
         │                                      │
         └──────────────┐  ┌────────────────────┘
                        ▼  ▼
               ┌─────────────────┐
               │   Dashboard     │
               │  (Real-time     │
               │   Analytics)    │
               └─────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| [`@apitoll/seller-sdk`](./packages/seller-sdk) | Express & Hono middleware — add x402 payments to any API in 3 lines |
| [`@apitoll/buyer-sdk`](./packages/buyer-sdk) | Agent wallet with auto-402 handling, budget policies, and spend tracking |
| [`@apitoll/shared`](./packages/shared) | Shared types, USDC utilities, chain configs, and security helpers |
| [`@apitoll/mcp-server`](./packages/mcp-server) | Monetize MCP tools with x402 micropayments |
| [`@apitoll/langchain`](./packages/langchain) | LangChain and CrewAI adapters for paid tool execution |
| [`@apitoll/facilitator`](./packages/facilitator) | x402 facilitator service — payment relay with custodial wallet |

## Apps

| App | Description |
|-----|-------------|
| [`apps/dashboard`](./apps/dashboard) | Next.js analytics dashboard — agent funding, budgets, revenue |
| [`apps/indexer`](./apps/indexer) | Transaction indexer API (Hono + PostgreSQL) |
| [`apps/discovery`](./apps/discovery) | Tool discovery API — search and register paid endpoints |

## Quick Start

### Seller: Monetize Your API

```bash
npm install @apitoll/seller-sdk
```

```typescript
import express from "express";
import { paymentMiddleware } from "@apitoll/seller-sdk";

const app = express();

app.use(
  paymentMiddleware({
    walletAddress: "0xYourUSDCWallet",
    endpoints: {
      "GET /api/data": {
        price: "0.005",
        chains: ["base"],
        description: "Premium data feed",
      },
    },
  })
);

app.get("/api/data", (req, res) => {
  res.json({ data: "premium content" });
});
```

Requests without payment get `HTTP 402` with payment requirements. Agents pay and retry automatically.

### Buyer: Deploy an Agent with Budget Controls

```bash
npm install @apitoll/buyer-sdk
```

```typescript
import { createAgentWallet } from "@apitoll/buyer-sdk";

const agent = createAgentWallet({
  name: "ResearchBot",
  chain: "base",
  policies: [
    { type: "budget", dailyCap: 50, maxPerRequest: 0.10 },
    { type: "vendor_acl", allowedVendors: ["*"] },
    { type: "rate_limit", maxPerMinute: 60 },
  ],
  signer: mySignerFunction,
});

// Auto-handles 402 → policy check → sign → retry
const data = await agent.fetch("https://api.weather.pro/forecast");
```

### MCP Server: Monetize Tools

```bash
npm install @apitoll/mcp-server
```

```typescript
import { z } from "zod";
import { createPaidMCPServer } from "@apitoll/mcp-server";

const server = createPaidMCPServer({
  walletAddress: "0xYourWallet",
});

// Free tool
server.tool("get_time", "Get current time", z.object({}), async () => {
  return { time: new Date().toISOString() };
});

// Paid tool — $0.01 per call
server.paidTool(
  "analyze_data",
  "AI-powered data analysis",
  z.object({ data: z.string() }),
  { price: 0.01, chains: ["base", "solana"] },
  async ({ data }) => {
    return { analysis: "..." };
  }
);
```

### LangChain / CrewAI

```bash
npm install @apitoll/langchain
```

```typescript
import { createPaidTool, createPaidAgentExecutor } from "@apitoll/langchain";

const weatherTool = createPaidTool({
  name: "get_weather",
  description: "Get weather forecast",
  endpoint: "https://api.weather.pro/forecast",
  price: 0.005,
  chains: ["base"],
});

const executor = createPaidAgentExecutor([weatherTool], {
  name: "MyAgent",
  chain: "base",
  policies: [{ type: "budget", dailyCap: 10 }],
  signer: mySignerFunction,
});

const result = await executor.executeTool("get_weather", { city: "NYC" });
```

## How It Works

```
1. Agent requests resource          →  GET /api/data
2. Server returns 402              ←  HTTP 402 + PaymentRequired header
3. Agent's policy engine checks    →  Budget OK? Vendor allowed? Rate limit?
4. Agent signs USDC payment        →  EIP-3009 (Base) or SPL transfer (Solana)
5. Agent retries with payment      →  GET /api/data + X-PAYMENT header
6. Facilitator verifies on-chain   →  Coinbase CDP or self-hosted
7. Server returns data             ←  200 OK + data
8. Transaction indexed             →  Dashboard updates in real-time
```

## Chain Support

| Chain | Token | Finality | Tx Cost | Scheme |
|-------|-------|----------|---------|--------|
| Base (EVM) | USDC | ~2s | ~$0.001 | EIP-3009 |
| Solana | USDC (SPL) | ~400ms | ~$0.00025 | SPL Transfer |

## Policy Engine

The buyer SDK enforces policies **before** any payment is signed:

```typescript
// Budget — daily/weekly caps, per-request maximums
{ type: "budget", dailyCap: 50, weeklyCap: 200, maxPerRequest: 0.10 }

// Vendor ACL — whitelist/blacklist sellers
{ type: "vendor_acl", allowedVendors: ["api.weather.pro", "neynar.com"] }

// Rate Limits — per-endpoint request throttling
{ type: "rate_limit", maxPerMinute: 60, maxPerHour: 1000 }
```

## Project Structure

```
apitoll/
├── packages/
│   ├── shared/           Core types, USDC utilities, chain configs, security helpers
│   ├── seller-sdk/       Express & Hono payment middleware for API monetization
│   ├── buyer-sdk/        Agent wallet with auto-402 handling and policy enforcement
│   ├── mcp-server/       MCP server with paid tools support
│   ├── langchain/        LangChain and CrewAI adapters for paid tool execution
│   └── facilitator/      x402 facilitator service with custodial wallet
├── apps/
│   ├── dashboard/        Next.js analytics dashboard (Convex backend)
│   ├── indexer/          Transaction indexer API (Hono + PostgreSQL)
│   └── discovery/        Tool discovery API with search and registration
├── convex/               Serverless backend — schema, mutations, queries
├── examples/             Working examples for sellers, agents, MCP, LangChain
└── infra/                Database schemas and deployment configs
```

## Development

```bash
git clone https://github.com/TasnidChain/APITOLL.git
cd APITOLL
npm install
npm run build
npm test
npm run dev      # Starts dashboard + indexer + discovery
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Railway, Fly.io, and Docker deployment guides.

See [CLOUDFLARE-DEPLOYMENT.md](./CLOUDFLARE-DEPLOYMENT.md) for Cloudflare Workers + Pages setup.

## Roadmap

- [x] Seller SDK (Express + Hono middleware)
- [x] Buyer SDK (Agent wallet + policy engine)
- [x] Shared types and utilities
- [x] Transaction indexer (PostgreSQL + Hono API)
- [x] Dashboard (Next.js + Convex)
- [x] Discovery API (agent-queryable tool registry)
- [x] MCP server integration
- [x] LangChain / CrewAI adapters
- [x] x402 Facilitator service
- [ ] Multi-chain expansion (Ethereum, Polygon, Arbitrum)
- [ ] WebSocket real-time payment status
- [ ] Batch payment processing
- [ ] Payment analytics dashboard v2

## Built On

- [x402 Protocol](https://x402.org) — Open standard for internet-native payments
- [Coinbase CDP](https://docs.cdp.coinbase.com/x402) — Facilitator and wallet infrastructure
- [Base](https://base.org) — EVM L2 for fast, cheap USDC payments
- [Solana](https://solana.com) — Sub-second finality for high-frequency agent transactions

## License

[MIT](./LICENSE)
