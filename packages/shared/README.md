# @apitoll/shared

Shared types, utilities, and constants for the [API Toll](https://apitoll.com) SDK ecosystem.

## Installation

```bash
npm install @apitoll/shared
```

## What's Included

- **Types** — `PaymentRequirement`, `PaymentReceipt`, `SellerConfig`, `AgentConfig`, `Policy`, `Transaction`, `ChainConfig`, and more
- **Utilities** — USDC unit conversion, route matching, fee calculation, budget checking, input validation, nonce tracking
- **Logger** — Structured JSON/pretty logger with child loggers and request/transaction logging
- **Constants** — Chain configs, plan limits, platform fee defaults, security headers

## Usage

```ts
import {
  type PaymentRequirement,
  type SellerConfig,
  calculateFeeBreakdown,
  getPlanLimits,
} from "@apitoll/shared";
```

## Part of API Toll

This package is used internally by:
- [`@apitoll/seller-sdk`](https://www.npmjs.com/package/@apitoll/seller-sdk) — Monetize any API with x402 micropayments
- [`@apitoll/buyer-sdk`](https://www.npmjs.com/package/@apitoll/buyer-sdk) — Give AI agents the ability to pay for APIs

Learn more at [apitoll.com](https://apitoll.com) | [GitHub](https://github.com/TasnidChain/APITOLL)

## License

MIT
