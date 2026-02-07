# @apitoll/facilitator

x402 facilitator service — handles HTTP 402 payment flows for AI agents making micropayments to services.

## What It Does

When an agent receives an HTTP 402 "Payment Required" response from a tool/API:

1. **Receives the 402 response** with payment requirements
2. **Initiates payment** (POST /pay) — sends USDC to the seller via custodial wallet
3. **Tracks payment status** (GET /pay/:id) — polls blockchain for confirmation
4. **Forwards to seller** (POST /forward/:id) — retries original request with payment receipt

## Installation

```bash
npm install @apitoll/facilitator
```

## Quick Start

### 1. Set Environment Variables

```bash
# Required
FACILITATOR_PRIVATE_KEY=0x...           # Custodial hot wallet private key
BASE_RPC_URL=https://mainnet.base.org   # or Alchemy/Infura endpoint

# Security (required in production)
FACILITATOR_API_KEYS=key1,key2,key3     # Comma-separated API keys for auth
ALLOWED_ORIGINS=https://apitoll.com     # CORS whitelist

# Optional
PORT=3000
```

### 2. Start the Facilitator Service

```bash
npm start
# Listens on http://localhost:3000
```

### 3. Initiate a Payment

```bash
curl -X POST http://localhost:3000/pay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "original_url": "https://api.example.com/weather?location=nyc",
    "original_method": "GET",
    "payment_required": {
      "amount": "0.005",
      "currency": "USDC",
      "recipient": "0x123...",
      "chain": "base"
    },
    "agent_wallet": "0x456..."
  }'
```

Response:
```json
{
  "payment_id": "uuid-here",
  "status": "processing",
  "check_url": "/pay/uuid-here"
}
```

### 4. Check Payment Status

```bash
curl http://localhost:3000/pay/uuid-here \
  -H "Authorization: Bearer your-api-key"
```

### 5. Forward to Seller

```bash
curl -X POST http://localhost:3000/forward/uuid-here \
  -H "Authorization: Bearer your-api-key"
```

The facilitator forwards the original request to the seller with `X-PAYMENT` and `X-PAYMENT-TX-HASH` headers containing the payment receipt, and returns the seller's response.

## How It Works

### Payment Flow

```
Agent receives HTTP 402 from seller
         |
Agent -> Facilitator (POST /pay with Authorization header)
         |
    Validates request with Zod schemas
    Checks amount safety cap ($100 max)
    Executes USDC transfer from custodial wallet
    Waits for 2 block confirmations on Base L2
         |
Agent <- Status endpoint (GET /pay/:id)
         |
Agent -> Facilitator (POST /forward/:id)
         |
Facilitator -> Seller (original request + X-PAYMENT receipt header)
         |
Agent <- Seller response (proxied through facilitator)
```

### Payment Modes

1. **Custodial (default)**: The facilitator holds a hot wallet (`FACILITATOR_PRIVATE_KEY`) that agents pre-fund. Agents never send private keys.

2. **Self-custody**: Agents can provide a pre-signed transaction in `signed_tx` field. The facilitator just broadcasts it.

## Architecture

### Endpoints

**GET /health** (no auth)
- Health check with pending payment count

**POST /pay** (auth required)
- Initiates payment via Zod-validated request
- Returns: payment_id + status (202 Accepted)
- Safety cap: $100 max per payment

**GET /pay/:paymentId** (auth required)
- Check payment status
- Returns: status, tx_hash, error (if failed)

**POST /forward/:paymentId** (auth required)
- Forward original request to seller with receipt
- Only works after payment confirmed
- Returns: seller response + receipt

### Security

- **API key authentication** on all payment endpoints (Bearer token)
- **No private keys in requests** — uses custodial wallet or pre-signed transactions
- **Zod validation** on all request bodies
- **Amount safety cap** — $100 max per payment (configurable)
- **Rate limiting** — 30 requests/minute per API key
- **CORS** — configurable allowed origins
- **Security headers** — X-Content-Type-Options, X-Frame-Options, HSTS, etc.
- **Error sanitization** — internal errors never leak to clients
- **Graceful shutdown** — SIGTERM/SIGINT handling

### State Management

- **In-memory store** (development) — auto-cleans stale entries after 24h
- **Redis** (recommended for production) — TODO: persistent across restarts

## Integration with Agents

### Using with Buyer SDK

```typescript
import { createAgentWallet } from '@apitoll/buyer-sdk';

const agent = createAgentWallet({
  name: 'ResearchBot',
  chain: 'base',
  policies: [{ type: 'budget', dailyCap: 50, maxPerRequest: 0.10 }],
});

// When receiving 402 response, call the facilitator:
const payRes = await fetch('http://facilitator:3000/pay', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-key',
  },
  body: JSON.stringify({
    original_url: 'https://api.weather.pro/forecast',
    original_method: 'GET',
    payment_required: { amount: '0.005', recipient: '0x...', chain: 'base' },
    agent_wallet: agent.address,
  }),
});

const { payment_id } = await payRes.json();

// Poll for completion, then forward
const forwardRes = await fetch(`http://facilitator:3000/forward/${payment_id}`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer your-api-key' },
});
const { seller_response } = await forwardRes.json();
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FACILITATOR_PRIVATE_KEY` | Yes | — | Custodial hot wallet private key |
| `BASE_RPC_URL` | No | `https://mainnet.base.org` | Base L2 RPC endpoint |
| `FACILITATOR_API_KEYS` | Prod | — | Comma-separated API keys |
| `ALLOWED_ORIGINS` | Prod | `*` (dev) | CORS whitelist |
| `PORT` | No | `3000` | Server port |

## Testing

```bash
npm test
```

## License

MIT
