<div align="center">

# API Toll

**The payment layer for the AI agent economy.**

Monetize APIs with USDC micropayments. Control agent spending. Settle instantly on Base.

[![CI](https://github.com/TasnidChain/APITOLL/actions/workflows/ci.yml/badge.svg)](https://github.com/TasnidChain/APITOLL/actions/workflows/ci.yml)
[![npm: seller-sdk](https://img.shields.io/npm/v/@apitoll/seller-sdk?label=seller-sdk&color=blue)](https://www.npmjs.com/package/@apitoll/seller-sdk)
[![npm: buyer-sdk](https://img.shields.io/npm/v/@apitoll/buyer-sdk?label=buyer-sdk&color=blue)](https://www.npmjs.com/package/@apitoll/buyer-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[Website](https://apitoll.com) &bull; [Documentation](#quick-start) &bull; [npm Packages](https://www.npmjs.com/org/apitoll) &bull; [Examples](./examples)

</div>

---

## What is API Toll?

API Toll lets AI agents pay for API calls using USDC stablecoins on **Base** — powered by the [x402 protocol](https://x402.org) (HTTP 402 Payment Required).

**For API sellers**: Add 3 lines of middleware to monetize any endpoint with per-request micropayments.

**For agent builders**: Give your agents a wallet with budget controls and they auto-handle payments.

```
Agent calls API  ─────►  402 Payment Required  ─────►  Agent pays USDC
                                                             │
         ◄─────  200 OK + data  ◄─────  Facilitator verifies on-chain
```

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
        price: "0.005",        // $0.005 USDC per request
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

// Paid tool — $0.01 per call
server.paidTool(
  "analyze_data",
  "AI-powered data analysis",
  z.object({ data: z.string() }),
  { price: 0.01, chains: ["base"] },
  async ({ data }) => {
    return { analysis: "..." };
  }
);
```

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@apitoll/seller-sdk`](./packages/seller-sdk) | Express & Hono middleware for API monetization | [![npm](https://img.shields.io/npm/v/@apitoll/seller-sdk?color=blue)](https://www.npmjs.com/package/@apitoll/seller-sdk) |
| [`@apitoll/buyer-sdk`](./packages/buyer-sdk) | Agent wallet with auto-402 handling and policy engine | [![npm](https://img.shields.io/npm/v/@apitoll/buyer-sdk?color=blue)](https://www.npmjs.com/package/@apitoll/buyer-sdk) |
| [`@apitoll/shared`](./packages/shared) | Shared types, USDC utilities, chain configs | [![npm](https://img.shields.io/npm/v/@apitoll/shared?color=blue)](https://www.npmjs.com/package/@apitoll/shared) |
| [`@apitoll/mcp-server`](./packages/mcp-server) | Monetize MCP tools with x402 micropayments | — |
| [`@apitoll/langchain`](./packages/langchain) | LangChain and CrewAI adapters for paid tools | — |
| [`@apitoll/facilitator`](./packages/facilitator) | x402 facilitator service with custodial wallet | — |

## How It Works

```
1. Agent requests resource          →  GET /api/data
2. Server returns 402              ←  HTTP 402 + payment requirements
3. Agent's policy engine checks    →  Budget OK? Vendor allowed? Rate limit?
4. Agent signs USDC payment        →  via facilitator or direct EIP-3009
5. Agent retries with payment      →  GET /api/data + X-PAYMENT header
6. Facilitator verifies on-chain   →  Confirms USDC transfer on Base
7. Server returns data             ←  200 OK + data
8. Transaction indexed             →  Dashboard updates in real-time
```

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
api-toll/
├── packages/
│   ├── shared/           Core types, USDC utilities, chain configs, security helpers
│   ├── seller-sdk/       Express & Hono payment middleware for API monetization
│   ├── buyer-sdk/        Agent wallet with auto-402 handling and policy enforcement
│   ├── mcp-server/       MCP server with paid tools support
│   ├── langchain/        LangChain and CrewAI adapters for paid tool execution
│   └── facilitator/      x402 facilitator service with custodial wallet
├── apps/
│   ├── dashboard/        Next.js analytics dashboard (Convex backend)
│   ├── seller-api/       Example seller API (joke endpoint)
│   └── agent-client/     Example agent that auto-pays for APIs
├── convex/               Serverless backend — schema, mutations, queries
└── examples/             Working examples for sellers, agents, MCP, LangChain
```

## Development

```bash
git clone https://github.com/TasnidChain/APITOLL.git
cd APITOLL
npm install
npm run build
npm test
```

## Built On

- [x402 Protocol](https://x402.org) — Open HTTP standard for internet-native payments
- [Base](https://base.org) — Coinbase L2 for fast, cheap USDC payments (~$0.001/tx)
- [Coinbase CDP](https://docs.cdp.coinbase.com/x402) — Facilitator and wallet infrastructure
- [Convex](https://convex.dev) — Real-time serverless backend

## License

[MIT](./LICENSE)
