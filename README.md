<div align="center">

# API Toll

**The payment layer for the AI agent economy.**

Monetize APIs with USDC micropayments. Control agent spending. Settle instantly on Base & Solana.

[![CI](https://github.com/TasnidChain/APITOLL/actions/workflows/ci.yml/badge.svg)](https://github.com/TasnidChain/APITOLL/actions/workflows/ci.yml)
[![npm: seller-sdk](https://img.shields.io/npm/v/@apitoll/seller-sdk?label=seller-sdk&color=blue)](https://www.npmjs.com/package/@apitoll/seller-sdk)
[![npm: buyer-sdk](https://img.shields.io/npm/v/@apitoll/buyer-sdk?label=buyer-sdk&color=blue)](https://www.npmjs.com/package/@apitoll/buyer-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[Website](https://apitoll.com) &bull; [API Docs](https://api.apitoll.com/api/docs) &bull; [Dashboard](https://apitoll.com/dashboard) &bull; [npm Packages](https://www.npmjs.com/org/apitoll) &bull; [Quick Start](./docs/quickstart.md)

</div>

---

## What is API Toll?

API Toll lets AI agents pay for API calls using USDC stablecoins on **Base** and **Solana** — powered by the [x402 protocol](https://x402.org) (HTTP 402 Payment Required).

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
import { createAgentWallet, createFacilitatorSigner } from "@apitoll/buyer-sdk";

const agent = createAgentWallet({
  name: "ResearchBot",
  chain: "base",
  policies: [
    { type: "budget", dailyCap: 50, maxPerRequest: 0.10 },
    { type: "vendor_acl", allowedVendors: ["*"] },
    { type: "rate_limit", maxPerMinute: 60 },
  ],
  signer: createFacilitatorSigner(
    "https://pay.apitoll.com",
    process.env.FACILITATOR_API_KEY!,
    process.env.AGENT_WALLET!
  ),
});

// Auto-handles 402 → policy check → sign → retry
const data = await agent.fetch("https://api.apitoll.com/api/search?q=AI+agents");
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
| [`@apitoll/buyer-sdk`](./packages/buyer-sdk) | Agent wallet with auto-402 handling, policy engine, 5 signer modes | [![npm](https://img.shields.io/npm/v/@apitoll/buyer-sdk?color=blue)](https://www.npmjs.com/package/@apitoll/buyer-sdk) |
| [`@apitoll/shared`](./packages/shared) | Shared types, USDC utilities, chain configs, plan limits | [![npm](https://img.shields.io/npm/v/@apitoll/shared?color=blue)](https://www.npmjs.com/package/@apitoll/shared) |
| [`@apitoll/facilitator`](./packages/facilitator) | x402 payment relay — custodial wallet, on-chain verification | [![npm](https://img.shields.io/npm/v/@apitoll/facilitator?color=blue)](https://www.npmjs.com/package/@apitoll/facilitator) |
| [`@apitoll/mcp-server`](./packages/mcp-server) | Monetize MCP tools with x402 micropayments | [![npm](https://img.shields.io/npm/v/@apitoll/mcp-server?color=blue)](https://www.npmjs.com/package/@apitoll/mcp-server) |
| [`@apitoll/langchain`](./packages/langchain) | LangChain and CrewAI adapters for paid tools | [![npm](https://img.shields.io/npm/v/@apitoll/langchain?color=blue)](https://www.npmjs.com/package/@apitoll/langchain) |

## How It Works

```
1. Agent requests resource          →  GET /api/data
2. Server returns 402              ←  HTTP 402 + payment requirements (PAYMENT-REQUIRED header)
3. Agent's policy engine checks    →  Budget OK? Vendor allowed? Rate limit?
4. Agent signs USDC payment        →  via facilitator, local wallet, or direct transfer
5. Agent retries with payment      →  GET /api/data + X-PAYMENT header
6. Facilitator verifies on-chain   →  Confirms USDC transfer on Base or Solana
7. Server returns data             ←  200 OK + data
8. Transaction indexed             →  Dashboard updates in real-time
```

## Signer Modes

The buyer SDK supports 5 ways for agents to sign payments:

| Mode | Function | Who Holds Keys | Use Case |
|------|----------|---------------|----------|
| **Facilitator** | `createFacilitatorSigner()` | Facilitator service | Easiest setup, custodial |
| **Local EVM** | `createLocalEVMSigner()` | Agent (self-custody) | Agent holds EVM private key, facilitator relays |
| **Direct EVM** | `createDirectEVMSigner()` | Agent (fully sovereign) | No facilitator needed, direct on-chain |
| **Local Solana** | `createLocalSolanaSigner()` | Agent (self-custody) | Agent holds Solana keypair, facilitator relays |
| **Direct Solana** | `createDirectSolanaSigner()` | Agent (fully sovereign) | No facilitator needed, direct SPL transfer |

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

## Live Deployment

| Service | URL |
|---------|-----|
| Landing page | [apitoll.com](https://apitoll.com) |
| Dashboard | [apitoll.com/dashboard](https://apitoll.com/dashboard) |
| Seller API (75 endpoints) | [api.apitoll.com](https://api.apitoll.com) |
| Swagger API Docs | [api.apitoll.com/api/docs](https://api.apitoll.com/api/docs) |
| Discovery API | [apitoll.com/api/discover](https://apitoll.com/api/discover) |
| What Is It? | [apitoll.com/what](https://apitoll.com/what) |

## Dashboard

The analytics dashboard at [apitoll.com/dashboard](https://apitoll.com/dashboard) provides:

- **Overview** — Total spend, daily spend chart, success rate, avg latency
- **Transactions** — Searchable, filterable transaction history
- **Agents** — Manage agent wallets, policies, spending
- **Sellers** — Register APIs, track revenue per endpoint
- **Discovery** — Browse paid tools in the marketplace
- **Playground** — Test API calls with live payment flow
- **Billing** — Free / Pro / Enterprise tiers via Stripe
- **Revenue** — Platform fee analytics (admin)
- **Webhooks, API Keys, Policies, Disputes, Deposits** — Full management suite

## Project Structure

```
APITOLL/
├── packages/
│   ├── shared/           Core types, USDC utilities, chain configs, security helpers
│   ├── seller-sdk/       Express & Hono payment middleware for API monetization
│   ├── buyer-sdk/        Agent wallet with auto-402 handling, policy engine, 5 signers
│   ├── facilitator/      x402 payment relay with custodial wallet (Base + Solana)
│   ├── mcp-server/       MCP server with paid tools support
│   └── langchain/        LangChain and CrewAI adapters for paid tool execution
├── apps/
│   ├── dashboard/        Next.js analytics dashboard (Convex + Clerk + Stripe)
│   ├── seller-api/       Production seller API with 75 paid endpoints
│   ├── agent-client/     Example agent that auto-pays for APIs
│   ├── indexer/          PostgreSQL transaction indexer (Hono)
│   └── discovery/        Tool discovery & marketplace API (Hono)
├── convex/               Serverless backend — 29 tables, real-time queries
├── examples/             Working examples for sellers, agents, MCP, LangChain
├── docs/                 Quick start, architecture, deployment, self-custody guides
├── scripts/              Wallet setup, seed data, testing utilities
└── infra/                PostgreSQL schema for optional indexer
```

## Development

```bash
git clone https://github.com/TasnidChain/APITOLL.git
cd APITOLL
npm install
npm run build
npm test
```

### Environment Variables

Copy `.env.example` and fill in your values. Key variables:

| Variable | Required For | Description |
|----------|-------------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Dashboard | Convex deployment URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Dashboard | Clerk auth public key |
| `CLERK_SECRET_KEY` | Dashboard | Clerk auth secret |
| `STRIPE_SECRET_KEY` | Billing | Stripe payments |
| `FACILITATOR_PRIVATE_KEY` | Facilitator | Hot wallet private key |
| `FACILITATOR_API_KEYS` | Facilitator | Comma-separated API keys |
| `BASE_RPC_URL` | On-chain verification | Base L2 RPC endpoint |
| `SOLANA_RPC_URL` | Solana payments | Solana RPC endpoint |
| `REDIS_URL` | Rate limiting | Redis connection string |

See [`.env.example`](./.env.example) for the full list.

## Documentation

- [Quick Start Guide](./docs/quickstart.md) — Get started in 5 minutes
- [Architecture](./docs/architecture.md) — System design and payment flow
- [Self-Custody Guide](./docs/self-custody.md) — Run agents with your own keys
- [Deployment Guide](./DEPLOYMENT.md) — Deploy to Railway, Fly.io, or Render
- [Security](./SECURITY.md) — Security policies and reporting

## Built On

- [x402 Protocol](https://x402.org) — Open HTTP standard for internet-native payments
- [Base](https://base.org) — Coinbase L2 for fast, cheap USDC payments (~$0.001/tx)
- [Solana](https://solana.com) — High-throughput chain for SPL token payments
- [Coinbase CDP](https://docs.cdp.coinbase.com/x402) — Facilitator and wallet infrastructure
- [Convex](https://convex.dev) — Real-time serverless backend
- [Clerk](https://clerk.com) — Authentication and user management
- [Stripe](https://stripe.com) — Fiat billing and USDC on-ramp

## License

[MIT](./LICENSE)
