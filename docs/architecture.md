# API Toll Architecture

## Overview

API Toll is the payment layer for the AI agent economy, built on the x402 protocol (HTTP 402 Payment Required). It enables AI agents to autonomously pay for API calls using USDC stablecoins on Base L2 and Solana.

## System Diagram

```
                          AI Agent
                             │
                    ┌────────┴────────┐
                    │  @apitoll/buyer  │
                    │    - PolicyEngine │
                    │    - Mutator     │
                    │    - Signer      │
                    └────────┬────────┘
                             │
               ┌─────────────┼─────────────┐
               │             │             │
          HTTP 402      X-PAYMENT     Paid Response
          Response       Header         (200 OK)
               │             │             │
     ┌─────────┴─────────┐  │  ┌──────────┴──────────┐
     │  Seller API        │  │  │   Facilitator        │
     │  @apitoll/seller   │──┘  │   @apitoll/facilitator│
     │  - x402 Middleware │     │   - Payment relay     │
     │  - Rate Limiting   │     │   - On-chain settle   │
     └───────────────────┘     └──────────┬───────────┘
                                          │
                              ┌───────────┴───────────┐
                              │     Blockchain         │
                              │  Base L2 / Solana      │
                              │  USDC Transfers        │
                              └───────────────────────┘
```

## Package Map

| Package | Role | npm |
|---------|------|-----|
| `@apitoll/shared` | Types, utils, env validation | `@apitoll/shared` |
| `@apitoll/buyer-sdk` | Agent wallet, policies, signers, evolution | `@apitoll/buyer-sdk` |
| `@apitoll/seller-sdk` | Express/Hono middleware for x402 payment gates | `@apitoll/seller-sdk` |
| `@apitoll/facilitator` | Payment relay server — settles USDC on-chain | `@apitoll/facilitator` |
| `@apitoll/mcp-server` | MCP tool monetization adapter | `@apitoll/mcp-server` |

## Payment Flow (x402)

1. Agent calls a paid API endpoint
2. Seller returns **HTTP 402** with `payment-required` header (contains price, chain, recipient)
3. Agent's buyer-sdk:
   - Checks policies (budget, vendor ACL, rate limit)
   - Signs payment via configured signer
   - Retries request with `X-PAYMENT` header
4. Seller forwards payment proof to facilitator
5. Facilitator verifies payment on-chain
6. Seller returns the API response (200 OK)

## Signer Modes

| Signer | Key Location | Broadcast | Trust Model |
|--------|-------------|-----------|-------------|
| `createFacilitatorSigner` | Facilitator | Facilitator | Custodial |
| `createLocalEVMSigner` | Agent local | Via facilitator | Semi-custodial |
| `createDirectEVMSigner` | Agent local | Direct to chain | Fully sovereign |
| `createLocalSolanaSigner` | Agent local | Via facilitator | Semi-custodial |
| `createDirectSolanaSigner` | Agent local | Direct to chain | Fully sovereign |

## Evolution Engine

The `APITOLLMutator` self-optimizes agent behavior:

- **Preference boost**: Increases platform preference on successful transactions
- **Escrow activation**: Enables escrow after 10+ txns with 90%+ success rate
- **Chain optimization**: Promotes faster chains based on latency
- **Auto-top-up**: Sets balance thresholds after consistent usage patterns

Mutations are gated by reputation score and reversible.

## Data Layer (Convex)

Real-time serverless backend:
- **Organizations**: User accounts, billing, auto-top-up config
- **Agents**: Wallet addresses, balances, policies
- **Transactions**: Payment records with on-chain verification
- **Deposits**: Fiat-to-USDC on-ramp tracking
- **Sellers**: Endpoint registry with pricing and analytics

## Dashboard (Next.js)

- Agent management and deployment
- Real-time transaction monitoring
- Budget and policy configuration
- Fiat on-ramp via Stripe
- Auto-top-up configuration
