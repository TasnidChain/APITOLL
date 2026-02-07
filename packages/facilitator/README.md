# @apitoll/facilitator

x402 facilitator service — handles HTTP 402 payment flows for AI agents making micropayments to services.

## What It Does

When an agent receives an HTTP 402 "Payment Required" response from a tool/API:

1. **Receives the 402 response** with payment requirements
2. **Initiates payment** (POST /pay) — sends USDC to the seller
3. **Tracks payment status** (GET /pay/:id) — polls blockchain for confirmation
4. **Forwards to seller** (POST /forward/:id) — retries original request with receipt

## Installation

```bash
npm install @apitoll/facilitator
```

## Quick Start

### 1. Start the Facilitator Service

```bash
npm start
# Listens on http://localhost:3000
```

### 2. Set Environment Variables

```bash
BASE_RPC_URL=https://mainnet.base.org  # or Alchemy/Infura endpoint
```

### 3. Initiate a Payment

```bash
curl -X POST http://localhost:3000/pay \
  -H "Content-Type: application/json" \
  -d '{
    "original_url": "https://api.example.com/weather?location=nyc",
    "original_method": "GET",
    "payment_required": {
      "amount": 1000,
      "currency": "USDC",
      "recipient": "0x123...",
      "chain": "base"
    },
    "agent_wallet": "0x456...",
    "agent_private_key": "0x789..."
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
curl http://localhost:3000/pay/uuid-here
```

Response:
```json
{
  "payment_id": "uuid-here",
  "status": "completed",
  "tx_hash": "0x...",
  "completed_at": 1707255600000
}
```

### 5. Forward to Seller

```bash
curl -X POST http://localhost:3000/forward/uuid-here
```

## How It Works

### Payment Flow

```
Agent → Facilitator (POST /pay)
         ↓
    Validates payment requirements
    Signs USDC transfer with agent wallet
    Submits to Base L2 blockchain
         ↓
Facilitator ← Blockchain confirmation (wait 2 blocks)
         ↓
Agent ← Status endpoint (GET /pay/:id)
         ↓
Agent → Facilitator (POST /forward/:id)
         ↓
Facilitator → Seller (with receipt)
```

## Architecture

### Endpoints

**POST /pay**
- Initiates payment
- Returns: payment_id + status
- Async processing (202 Accepted)

**GET /pay/:paymentId**
- Check payment status
- Returns: status, tx_hash, error (if failed)

**POST /forward/:paymentId**
- Forward original request to seller with receipt
- Only works after payment confirmed
- Returns: seller response + receipt

### State Management

- **In-memory store** (development) — loses state on restart
- **Redis** (recommended for production) — persistent across restarts
- **Database** (optional) — full audit trail

## Integration with Agents

### Using with Buyer SDK

```typescript
import { AgentWallet } from '@apitoll/buyer-sdk';
import { facilitatorClient } from '@apitoll/facilitator';

const wallet = new AgentWallet({ privateKey: '0x...' });

// When receiving 402 response:
const response = await fetch('https://api.example.com/data');
if (response.status === 402) {
  const paymentRequired = response.headers['x-payment-required'];
  
  // Pay via facilitator
  const payment = await facilitatorClient.pay({
    original_url: response.url,
    original_method: response.request.method,
    payment_required: JSON.parse(paymentRequired),
    agent_wallet: wallet.address,
    agent_private_key: wallet.privateKey,
  });
  
  // Retry original request
  const retryResponse = await facilitatorClient.forward(payment.payment_id);
}
```

## Security

- **Private key handling**: Never expose agent private keys — use environment variables
- **Receipt validation**: Verify tx_hash on-chain before trusting payment
- **Rate limiting**: Implement per-agent rate limits on payment endpoints
- **CORS**: Configure ALLOWED_ORIGINS in production

## Production Deployment

### Docker

```bash
docker build -t apitoll-facilitator .
docker run -e BASE_RPC_URL=... apitoll-facilitator
```

### Railway / Fly.io

Use provided deployment configs in root repository.

### Environment Variables

```
BASE_RPC_URL=https://mainnet.base.org
PORT=3000
LOG_LEVEL=info
REDIS_URL=redis://... (optional)
```

## Cost Estimation

- **Base L2 gas**: ~$0.01-0.05 per transfer
- **Facilitator hosting**: $5-50/month
- **Total per payment**: ~$0.01-0.10

## Roadmap

- [ ] Multi-chain support (Solana, Ethereum, Polygon)
- [ ] WebSocket support for real-time payment status
- [ ] Batch payment processing
- [ ] Automated retry logic for failed transfers
- [ ] Payment analytics dashboard

## Testing

```bash
npm test
```

## License

MIT
