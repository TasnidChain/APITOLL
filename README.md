# AgentCommerce

**The commerce layer for the x402 agent economy.**

Monetize APIs with micropayments. Control agent spending. Own the transaction graph.

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
               │  (Transaction   │
               │   Indexer +     │
               │   Analytics)    │
               └─────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@agentcommerce/seller-sdk` | Express/Hono middleware — add x402 payments to any API in 3 lines |
| `@agentcommerce/buyer-sdk` | Agent wallet with auto 402 handling, budget policies, spend tracking |
| `@agentcommerce/shared` | Shared types, utilities, chain configs |
| `apps/dashboard` | Next.js dashboard for agent funding, budgets, and analytics |
| `apps/indexer` | Transaction indexer API (Hono + PostgreSQL) |

## Quick Start

### Seller: Monetize Your API

```bash
npm install @agentcommerce/seller-sdk
```

```typescript
import express from "express";
import { paymentMiddleware } from "@agentcommerce/seller-sdk";

const app = express();

app.use(
  paymentMiddleware({
    walletAddress: "0xYourUSDCWallet",
    endpoints: {
      "GET /api/data": {
        price: "0.005",
        chains: ["base", "solana"],
        description: "Premium data feed",
      },
    },
  })
);

app.get("/api/data", (req, res) => {
  // Your normal handler — payment already verified
  res.json({ data: "premium content" });
});

app.listen(3001);
```

**That's it.** Requests without payment get `HTTP 402` with payment requirements. Agents pay and retry automatically.

### Buyer: Deploy an Agent with Budget Controls

```bash
npm install @agentcommerce/buyer-sdk
```

```typescript
import { createAgentWallet } from "@agentcommerce/buyer-sdk";

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

## How It Works

```
1. Agent requests resource          → GET /api/data
2. Server returns 402              ← HTTP 402 + PaymentRequired header
3. Agent's policy engine checks    → Budget OK? Vendor allowed? Rate limit?
4. Agent signs USDC payment        → EIP-3009 (Base) or SPL transfer (Solana)
5. Agent retries with payment      → GET /api/data + X-PAYMENT header
6. Facilitator verifies on-chain   → Coinbase CDP or self-hosted
7. Server returns data             ← 200 OK + data
8. Transaction indexed             → Dashboard updates in real-time
```

## Chain Support

| Chain | Token | Finality | Tx Cost | Scheme |
|-------|-------|----------|---------|--------|
| Base (EVM) | USDC | ~2s | ~$0.001 | EIP-3009 |
| Solana | USDC (SPL) | ~400ms | ~$0.00025 | SPL Transfer |

## Policy Engine

The buyer SDK enforces policies before any payment is signed:

**Budget Policies** — Daily/weekly caps, per-request maximums
```typescript
{ type: "budget", dailyCap: 50, weeklyCap: 200, maxPerRequest: 0.10 }
```

**Vendor ACL** — Whitelist/blacklist sellers
```typescript
{ type: "vendor_acl", allowedVendors: ["api.weather.pro", "neynar.com"] }
```

**Rate Limits** — Per-endpoint request throttling
```typescript
{ type: "rate_limit", maxPerMinute: 60, maxPerHour: 1000 }
```

## Project Structure

```
agentcommerce/
├── packages/
│   ├── shared/              # Types, utilities, chain configs
│   │   └── src/
│   │       ├── types.ts     # Core type definitions
│   │       └── utils.ts     # USDC conversion, route matching, policy checks
│   ├── seller-sdk/          # Payment middleware for API sellers
│   │   └── src/
│   │       ├── payment.ts           # 402 response builder, payment verification
│   │       ├── analytics.ts         # Transaction reporting to platform
│   │       ├── middleware-express.ts # Express middleware
│   │       └── middleware-hono.ts   # Hono middleware
│   └── buyer-sdk/           # Agent wallet with policy enforcement
│       └── src/
│           ├── agent-wallet.ts  # Main AgentWallet class with auto-402 handling
│           └── policy-engine.ts # Budget, ACL, and rate limit enforcement
├── apps/
│   ├── dashboard/           # Next.js analytics dashboard
│   └── indexer/             # Transaction indexer API
├── examples/
│   ├── seller-express/      # Express API with x402 payments
│   └── buyer-agent/         # AI agent with budget controls
└── infra/                   # Transaction indexer, DB schema
```

## Development

```bash
# Clone
git clone https://github.com/TasnidChain/AgentCommerce.git
cd agentcommerce

# Install
npm install

# Build all packages
npm run build

# Run example seller
npx ts-node examples/seller-express/server.ts

# Run example agent (in another terminal)
npx ts-node examples/buyer-agent/research-bot.ts

# Run the full stack (dashboard + indexer)
npm run dev
```

## Roadmap

- [x] Seller SDK (Express + Hono middleware)
- [x] Buyer SDK (Agent wallet + policy engine)
- [x] Shared types and utilities
- [x] Transaction indexer (PostgreSQL + Hono API)
- [x] Dashboard (Next.js)
- [ ] Discovery API (agent-queryable tool registry)
- [ ] Self-hosted facilitator
- [ ] MCP server integration helpers
- [ ] LangChain / CrewAI / AutoGen adapters

## Built on

- [x402 Protocol](https://x402.org) — Open standard for internet-native payments
- [Coinbase CDP](https://docs.cdp.coinbase.com/x402) — Facilitator and wallet infrastructure
- [Base](https://base.org) — EVM L2 for fast, cheap USDC payments
- [Solana](https://solana.com) — Sub-second finality for high-frequency agent transactions

## License

MIT
