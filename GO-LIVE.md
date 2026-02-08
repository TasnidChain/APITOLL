# Go Live — Make Money with API Toll

Your code is 100% production-ready. You need 30 minutes of configuration to start earning USDC.

## Quick Summary

You have 3 services:

| Service | What It Does | Status |
|---------|-------------|--------|
| **Facilitator** | Pays sellers on behalf of agents | Deployed on Railway |
| **Seller API** | Your joke API ($0.001/call) | Deployed on Railway |
| **Agent Client** | Tests the payment flow | Local script |

**All code is done. You just need to fund the wallet.**

---

## Step 1: Create Your Facilitator Wallet (2 min)

The facilitator needs a hot wallet that holds USDC + ETH to process payments.

```bash
# Option A: Generate a new wallet
npx tsx scripts/create-wallet.ts --role facilitator

# Option B: Use an existing wallet
# Just get the private key from MetaMask, Coinbase Wallet, etc.
```

**Save the private key securely.** You'll need it in Step 3.

---

## Step 2: Fund the Wallet (5-10 min)

Send funds to the facilitator wallet address on **Base (Coinbase L2)**:

### For Testnet (free, use this first):
1. Get Base Sepolia ETH: https://www.coinbase.com/faucets
2. Get testnet USDC: Bridge from Sepolia or use a faucet

### For Mainnet (real money):
1. **ETH for gas** — Send ~$5 worth of ETH on Base
   - Bridge from Ethereum: https://bridge.base.org
   - Buy on Coinbase and withdraw to Base
2. **USDC for payments** — Send $10-100 USDC on Base
   - Buy USDC on Coinbase, withdraw to Base
   - Or swap ETH → USDC on Uniswap (Base)

### Verify your balance:
```bash
npx tsx scripts/check-balance.ts 0xYOUR_FACILITATOR_ADDRESS
```

---

## Step 3: Set Environment Variables (5 min)

### Generate a secure API key:
```bash
openssl rand -hex 32
# Example output: a1b2c3d4e5f6... (save this)
```

### On Railway — Facilitator Service:
Go to https://railway.app → your project → facilitator service → Variables:

```
FACILITATOR_PRIVATE_KEY=<your-private-key-without-0x-prefix>
FACILITATOR_API_KEYS=<your-generated-api-key>
BASE_RPC_URL=https://mainnet.base.org
ALLOWED_ORIGINS=https://apitoll.com
```

### On Railway — Seller API Service:
```
SELLER_WALLET=0x2955B6a41a2d10A5cC5C8A4a144829502a73B0a5
FACILITATOR_URL=https://facilitator-production-fbd7.up.railway.app
PORT=4402
```

### Local — Agent Client (.env):
```bash
# apps/agent-client/.env
AGENT_WALLET=0x2955B6a41a2d10A5cC5C8A4a144829502a73B0a5
FACILITATOR_URL=https://facilitator-production-fbd7.up.railway.app
FACILITATOR_API_KEY=<your-generated-api-key>
JOKE_API_URL=https://seller-api-production.up.railway.app
```

---

## Step 4: Redeploy on Railway (2 min)

After setting env vars, Railway auto-deploys. Or manually trigger:

```bash
# Push latest code (Railway auto-deploys from GitHub)
git push origin main
```

Wait for both services to be healthy:
- https://facilitator-production-fbd7.up.railway.app/health
- https://seller-api-production.up.railway.app/health

---

## Step 5: Validate Everything (2 min)

```bash
# Run the full validation suite
npm run setup

# Test the payment flow end-to-end
npm run test-flow

# Check facilitator wallet balance
npm run check-balance
```

---

## Step 6: Make Your First Payment (1 min)

```bash
# Run the agent!
npm run agent
```

Expected output:
```
Joke Agent starting...
Requesting joke from https://seller-api-production.up.railway.app/api/joke ...
(If the API requires payment, the agent will auto-pay)

Payment confirmed: 0x<real-transaction-hash>
  Amount: $0.001 USDC
  Chain:  base
  To:     0x2955B6a41a2d10A5cC5C8A4a144829502a73B0a5

Joke: Why do programmers prefer dark mode? Because light attracts bugs!

Spend summary:
  Today: $0.001000 USDC
  Transactions: 1
```

**Verify on-chain:** https://basescan.org/tx/<your-tx-hash>

---

## Step 7: Monitor Your Revenue

### Check facilitator status:
```bash
curl -H "Authorization: Bearer <your-api-key>" \
  https://facilitator-production-fbd7.up.railway.app/status
```

### View on dashboard:
https://apitoll.com/dashboard

### Check wallet balance:
https://basescan.org/address/0x2955B6a41a2d10A5cC5C8A4a144829502a73B0a5

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Agent gets 402 but payment fails | Fund the facilitator wallet with USDC |
| "Insufficient funds for gas" | Send ETH to the facilitator wallet |
| "Invalid API key" | Update FACILITATOR_API_KEY in agent .env |
| Seller returns 500 | Check SELLER_WALLET is set correctly |
| Facilitator unhealthy | Check FACILITATOR_PRIVATE_KEY is set |

---

## Architecture

```
Agent                    Facilitator              Seller
  |                          |                       |
  |--- GET /api/joke ------->|                       |
  |                          |                       |
  |<----- 402 + requirements |                       |
  |                          |                       |
  |--- POST /pay ----------->|                       |
  |    (payment details)     |                       |
  |                          |--- USDC transfer ---->|
  |                          |    (on-chain, Base)   |
  |<---- 202 + payment_id ---|                       |
  |                          |                       |
  |--- GET /pay/:id -------->|                       |
  |<---- completed + txHash -|                       |
  |                          |                       |
  |--- GET /api/joke --------|---------------------->|
  |    + X-PAYMENT header    |                       |
  |                          |                       |
  |<---- 200 + joke ---------|---------------------->|
  |    + payment receipt     |--- POST /verify ----->|
  |                          |<--- valid: true ------|
```

---

## Revenue Model

- **You are the facilitator** — you run the infrastructure
- **Sellers pay you** — via platform fees (configurable)
- **Agents pay through you** — facilitator processes USDC transfers
- **Referrals earn commission** — 0.5% (50 bps) on referred volume
- **Every response is viral** — X-APITOLL-DISCOVERY headers on every 402/200

---

## Key URLs

| Service | URL |
|---------|-----|
| Dashboard | https://apitoll.com |
| Facilitator | https://facilitator-production-fbd7.up.railway.app |
| Seller API | https://seller-api-production.up.railway.app |
| npm: seller-sdk | https://www.npmjs.com/package/@apitoll/seller-sdk |
| npm: buyer-sdk | https://www.npmjs.com/package/@apitoll/buyer-sdk |
| GitHub | https://github.com/TasnidChain/APITOLL |
| Base Explorer | https://basescan.org |
