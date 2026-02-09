# @apitoll/buyer-sdk

Give your AI agents the ability to pay for APIs. Auto-handles x402 `402 Payment Required` responses with built-in budget controls and spend tracking.

Built on the [x402 HTTP Payment Protocol](https://www.x402.org/) — settled instantly on Base with USDC.

## Installation

```bash
npm install @apitoll/buyer-sdk
```

## Quick Start

```ts
import { createAgentWallet } from "@apitoll/buyer-sdk";

const agent = createAgentWallet({
  name: "ResearchBot",
  chain: "base",
  policies: [
    { type: "budget", dailyCap: 50, maxPerRequest: 0.10 },
    { type: "vendor_acl", allowedVendors: ["*"] },
  ],
  privateKey: process.env.AGENT_PRIVATE_KEY,
});

// Auto-handles 402 responses — just use fetch like normal
const data = await agent.fetch("https://api.weather.pro/forecast");
console.log(data);
```

## How It Works

1. Your agent calls `agent.fetch(url)` like a normal HTTP request
2. If the API returns `402 Payment Required`, the SDK reads the payment details
3. Policy engine checks: is this within budget? Is this vendor allowed?
4. If approved, the SDK signs and sends the USDC payment via the facilitator
5. SDK retries the request with the `X-PAYMENT` header
6. Your agent gets the data — the payment happened invisibly

## Features

- **Drop-in fetch** — replace `fetch()` with `agent.fetch()`, everything else works
- **Policy engine** — budget caps, vendor allowlists, rate limits
- **Spend tracking** — real-time transaction history and spend summaries
- **Multi-chain** — Base and Solana support
- **Callbacks** — hooks for payments, policy rejections, and errors
- **Facilitator signer** — built-in custodial USDC transfer signing

## Policy Engine

Control what your agents can spend:

```ts
const agent = createAgentWallet({
  name: "DataBot",
  chain: "base",
  policies: [
    // Budget: $50/day max, $0.10 per request max
    { type: "budget", dailyCap: 50, maxPerRequest: 0.10 },

    // Vendor ACL: only allow specific sellers
    { type: "vendor_acl", allowedVendors: ["0xSeller1...", "0xSeller2..."] },

    // Rate limit: max 100 requests per minute
    { type: "rate_limit", maxRequests: 100, windowMs: 60000 },
  ],
});
```

## Event Callbacks

```ts
const agent = createAgentWallet({
  // ...config
  onPayment: (receipt, url) => {
    console.log(`Paid ${receipt.amount} USDC for ${url}`);
  },
  onPolicyRejection: (result, url) => {
    console.warn(`Policy blocked: ${result.reason} for ${url}`);
  },
  onError: (error, url) => {
    console.error(`Payment error for ${url}:`, error);
  },
});
```

## Facilitator Signer

For custodial wallets that use the API Toll facilitator:

```ts
import { createAgentWallet, createFacilitatorSigner } from "@apitoll/buyer-sdk";

const signer = createFacilitatorSigner({
  facilitatorUrl: "https://pay.apitoll.com",
  apiKey: "your-facilitator-api-key",
});

const agent = createAgentWallet({
  name: "MyAgent",
  chain: "base",
  signer,
  policies: [{ type: "budget", dailyCap: 10, maxPerRequest: 0.05 }],
});
```

## API Reference

### `createAgentWallet(options)`
Factory function that returns an `AgentWallet` instance.

### `AgentWallet`
- `.fetch(url, options?)` — fetch with automatic 402 payment handling
- `.getSpendSummary()` — current spend totals and transaction count
- `.getTransactions()` — full transaction history

### `PolicyEngine`
- `.check(amount, vendor, url)` — check if a payment is allowed by policies
- Supports `budget`, `vendor_acl`, and `rate_limit` policy types

### `createFacilitatorSigner(config)`
Create a signer that uses the API Toll facilitator for custodial USDC transfers.

## Part of API Toll

API Toll is the payment infrastructure for autonomous AI agents. Learn more:

- [apitoll.com](https://apitoll.com) — Dashboard & marketplace
- [`@apitoll/seller-sdk`](https://www.npmjs.com/package/@apitoll/seller-sdk) — For API sellers
- [x402 Protocol](https://www.x402.org/) — The HTTP payment standard
- [GitHub](https://github.com/TasnidChain/APITOLL)

## License

MIT
