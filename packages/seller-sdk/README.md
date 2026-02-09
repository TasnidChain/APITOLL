# @apitoll/seller-sdk

Monetize any API with x402 micropayments. Add per-request USDC payments in 3 lines of code.

Built on the [x402 HTTP Payment Protocol](https://www.x402.org/) — settled instantly on Base.

## Installation

```bash
npm install @apitoll/seller-sdk
```

## Quick Start (Express)

```ts
import express from "express";
import { paymentMiddleware } from "@apitoll/seller-sdk";

const app = express();

app.use(paymentMiddleware({
  walletAddress: "0xYourWallet...",
  endpoints: {
    "GET /api/data": {
      price: "0.001",
      chains: ["base"],
      description: "Premium data feed",
    },
  },
}));

app.get("/api/data", (req, res) => {
  res.json({ data: "You paid for this!" });
});

app.listen(3000);
```

## Quick Start (Hono)

```ts
import { Hono } from "hono";
import { honoPaymentMiddleware } from "@apitoll/seller-sdk";

const app = new Hono();

app.use("*", honoPaymentMiddleware({
  walletAddress: "0xYourWallet...",
  endpoints: {
    "GET /api/joke": {
      price: "0.001",
      chains: ["base"],
    },
  },
}));
```

## How It Works

1. Agent requests your API endpoint
2. Middleware returns `402 Payment Required` with USDC price and chain info
3. Agent pays via the x402 facilitator
4. Agent retries with `X-PAYMENT` header containing the signed payment
5. Middleware verifies payment and lets the request through
6. You get paid instantly in USDC on Base

## Features

- **Express & Hono** middleware out of the box
- **Per-endpoint pricing** — different prices for different routes
- **Multi-chain** — Base and Solana support
- **Platform fees** — automatic fee splitting (3% default)
- **Analytics** — built-in transaction reporting to the API Toll dashboard
- **Rate limiting** — optional Redis-backed rate limiting
- **Circuit breaker** — automatic protection against payment verification failures

## Platform Fee Splitting

```ts
app.use(paymentMiddleware({
  walletAddress: "0xYourWallet...",
  endpoints: { ... },
  platformFee: {
    feeBps: 300,  // 3%
    feeCollector: "0xPlatformWallet...",
  },
}));
```

## Analytics Reporting

```ts
import { AnalyticsReporter } from "@apitoll/seller-sdk";

const reporter = new AnalyticsReporter({
  apiKey: "your-seller-api-key",
  dashboardUrl: "https://apitoll.com",
});

// Transactions are automatically batched and reported
```

## API Reference

### `paymentMiddleware(config)`
Express middleware. Intercepts requests, returns 402 for unpaid endpoints, verifies payments.

### `honoPaymentMiddleware(config)`
Same as above, but for Hono framework.

### `buildPaymentRequirements(endpoint, config)`
Build x402-compliant payment requirement objects.

### `verifyPayment(header, requirements)`
Verify a signed payment header against requirements.

### `AnalyticsReporter`
Batch transaction reporter for the API Toll dashboard.

## Part of API Toll

API Toll is the payment infrastructure for autonomous AI agents. Learn more:

- [apitoll.com](https://apitoll.com) — Dashboard & marketplace
- [`@apitoll/buyer-sdk`](https://www.npmjs.com/package/@apitoll/buyer-sdk) — For AI agent builders
- [x402 Protocol](https://www.x402.org/) — The HTTP payment standard
- [GitHub](https://github.com/TasnidChain/APITOLL)

## License

MIT
