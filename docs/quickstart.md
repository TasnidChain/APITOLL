# Quick Start Guide

## For Buyers (AI Agents)

### 1. Install

```bash
npm install @apitoll/buyer-sdk
```

### 2. Create an Agent Wallet

```typescript
import { createAgentWallet, createFacilitatorSigner } from "@apitoll/buyer-sdk";

const agent = createAgentWallet({
  name: "MyAgent",
  chain: "base",
  policies: [
    { type: "budget", dailyCap: 10.0, maxPerRequest: 0.05 },
    { type: "vendor_acl", allowedVendors: ["*"] },
  ],
  signer: createFacilitatorSigner(
    "https://pay.apitoll.com",
    process.env.FACILITATOR_API_KEY!,
    process.env.AGENT_WALLET!
  ),
});
```

### 3. Make Paid API Calls

```typescript
// Agent automatically handles 402 → pay → retry
const response = await agent.fetch("https://tools.apitoll.com/api/search?q=AI+agents");
const data = await response.json();
console.log(data);
```

### 4. Check Spend

```typescript
const summary = agent.getSpendSummary();
console.log(`Spent today: $${summary.today.toFixed(4)} USDC`);
console.log(`Transactions: ${summary.transactionCount}`);
```

---

## For Sellers (API Providers)

### 1. Install

```bash
npm install @apitoll/seller-sdk
```

### 2. Add Payment Middleware

```typescript
import express from "express";
import { createPaymentMiddleware } from "@apitoll/seller-sdk";

const app = express();

const paywall = createPaymentMiddleware({
  walletAddress: process.env.SELLER_WALLET!,
  endpoints: {
    "/api/search": { price: "0.005", chains: ["base"], description: "Web search" },
    "/api/data": { price: "0.01", chains: ["base", "solana"], description: "Data lookup" },
  },
});

app.use(paywall);

app.get("/api/search", (req, res) => {
  res.json({ results: ["result 1", "result 2"] });
});
```

---

## Self-Custody Mode

For agents that want to hold their own keys:

```typescript
import { createAgentWallet, createLocalEVMSigner } from "@apitoll/buyer-sdk";

const agent = createAgentWallet({
  name: "SelfCustodyBot",
  chain: "base",
  policies: [{ type: "budget", dailyCap: 5.0, maxPerRequest: 0.05 }],
  signer: createLocalEVMSigner({
    privateKey: process.env.AGENT_PRIVATE_KEY!,
    rpcUrl: "https://mainnet.base.org",
    facilitatorUrl: "https://pay.apitoll.com",
  }),
});
```

For fully decentralized (no facilitator):

```typescript
import { createDirectEVMSigner } from "@apitoll/buyer-sdk";

const agent = createAgentWallet({
  name: "FullySovereign",
  chain: "base",
  policies: [{ type: "budget", dailyCap: 5.0, maxPerRequest: 0.05 }],
  signer: createDirectEVMSigner({
    privateKey: process.env.AGENT_PRIVATE_KEY!,
    rpcUrl: "https://mainnet.base.org",
  }),
});
```

---

## MCP Tool Monetization

```typescript
import { createMCPPaymentServer } from "@apitoll/mcp-server";

const server = createMCPPaymentServer({
  walletAddress: process.env.SELLER_WALLET!,
  tools: {
    search: { price: "0.005", description: "Search the web" },
    analyze: { price: "0.01", description: "Analyze data" },
  },
});
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FACILITATOR_API_KEY` | For custodial mode | API key for the facilitator |
| `AGENT_WALLET` | For custodial mode | Agent wallet address |
| `AGENT_PRIVATE_KEY` | For self-custody | Agent's private key (hex) |
| `SELLER_WALLET` | For sellers | Wallet to receive payments |
| `BASE_RPC_URL` | Optional | Base L2 RPC endpoint |
| `SOLANA_RPC_URL` | Optional | Solana RPC endpoint |
| `SOLANA_PRIVATE_KEY` | For Solana self-custody | Solana private key (base58 or JSON) |
