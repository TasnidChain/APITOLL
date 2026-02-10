# Deployment Guide

## Prerequisites

- Node.js >= 18
- npm >= 9
- A Convex account (for the dashboard backend)
- A Clerk account (for dashboard auth)
- An EVM wallet with ETH + USDC on Base (for the facilitator)

## Facilitator Server

The facilitator handles USDC payment settlement on Base and Solana.

### Docker

```bash
# Build
docker build -t apitoll-facilitator .

# Run
docker run -p 3000:3000 \
  -e FACILITATOR_PRIVATE_KEY=0x... \
  -e FACILITATOR_API_KEYS=key1,key2 \
  -e BASE_RPC_URL=https://mainnet.base.org \
  -e CONVEX_URL=https://your-deployment.convex.cloud \
  apitoll-facilitator
```

### Direct

```bash
cd packages/facilitator
npm install
npm run build
npm start
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FACILITATOR_PRIVATE_KEY` | Yes | — | Hex private key for signing transactions |
| `FACILITATOR_API_KEYS` | No | (open mode) | Comma-separated API keys |
| `BASE_RPC_URL` | No | `https://mainnet.base.org` | Base L2 RPC endpoint |
| `SOLANA_PRIVATE_KEY` | No | — | Enables Solana chain support |
| `SOLANA_RPC_URL` | No | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |
| `CONVEX_URL` | No | — | Enables transaction persistence |
| `SENTRY_DSN` | No | — | Error monitoring |
| `PORT` | No | `3000` | Server port |

### Health Check

```bash
curl https://your-facilitator.com/health
# {"status":"ok","timestamp":"...","pending_payments":0}
```

### Monitoring (authenticated)

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" https://your-facilitator.com/status
```

---

## Seller API

The seller API exposes 75 paid endpoints.

```bash
cd apps/seller-api

# Set required env
export SELLER_WALLET=0xYourWalletAddress
export FACILITATOR_URL=https://pay.apitoll.com

# Start
npx tsx server.ts
```

### Graceful Shutdown

The seller-api handles SIGTERM and SIGINT signals gracefully, draining in-flight requests within 15 seconds before exiting.

---

## Dashboard

The dashboard is a Next.js app with Convex backend and Clerk auth.

```bash
cd apps/dashboard

# Set environment
cp .env.example .env.local
# Edit .env.local with your Convex URL, Clerk keys, etc.

# Development
npm run dev

# Production build
npm run build
npm start
```

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `STRIPE_SECRET_KEY` | Stripe billing (optional) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks (optional) |

---

## Convex Backend

```bash
# Login to Convex
npx convex login

# Deploy functions
npx convex deploy

# Run locally
npx convex dev
```

---

## CI/CD

The project uses GitHub Actions (`.github/workflows/ci.yml`):

- **Build & Test**: Runs on Node 18, 20, 22 with type checking
- **Lint**: ESLint on Node 20
- **Dashboard Build**: Verifies Next.js build succeeds
- **Package Integrity**: Verifies dist/ output and dry-run npm pack

All checks run on push to `main` and on pull requests.
