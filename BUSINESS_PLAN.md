# Apitoll Business Plan

## The Payment Layer for Autonomous AI Agents

**Version:** 1.0
**Date:** February 2026

---

## Executive Summary

Apitoll is a payment infrastructure platform that enables AI agents to autonomously purchase API calls using USDC stablecoins on Base and Solana. Built on the x402 HTTP Payment Protocol, Apitoll lets API providers monetize their endpoints with 3 lines of code and gives agent builders programmatic spending controls — all settled in under 2 seconds with zero chargebacks.

**Revenue model:** 3% platform fee on every transaction + SaaS subscription tiers ($0 / $49 / $499 per month).

**Current status:** Live in production with facilitator, seller SDK, buyer SDK, dashboard, and first paid API endpoint operational on Base mainnet.

---

## The Problem

AI agents are becoming autonomous economic actors. They need to discover, evaluate, and pay for API services without human intervention. Today's payment infrastructure doesn't support this:

| Problem | Impact |
|---------|--------|
| **Credit cards require human authorization** | Agents can't autonomously pay for API calls |
| **Invoice-based billing has 30-day payment terms** | API providers wait weeks to get paid |
| **Chargebacks create risk for sellers** | Small API providers avoid micropayment models |
| **No standard protocol for machine-to-machine payments** | Every integration is custom |
| **Minimum transaction sizes are too high** | Can't charge $0.001 per API call with Stripe's 30-cent fee |

The API economy is $4.5 trillion by 2030 (Gartner). The AI agent market is projected at $47 billion by 2030. The intersection — autonomous agent commerce — has no payment standard. Apitoll is that standard.

---

## The Solution

Apitoll implements the x402 HTTP Payment Protocol:

```
Agent → GET /api/data → 402 Payment Required ($0.01 USDC on Base)
Agent → Signs USDC payment → Retries with X-PAYMENT header
Seller → Verifies payment on-chain → Returns data (200 OK)
```

**Settlement:** 2 seconds on Base, 400ms on Solana
**Minimum payment:** $0.001 USDC
**Chargebacks:** Zero — blockchain transactions are final
**Integration:** 3 lines of code for sellers, 1 function call for agents

### For API Sellers
- Drop-in Express/Hono middleware to monetize any endpoint
- Instant settlement in USDC — no invoicing, no chargebacks
- Real-time analytics dashboard with revenue, latency, and success rates
- Multi-chain support (Base + Solana)

### For Agent Builders
- Auto-payment handling: agent wallet detects 402, signs payment, retries
- Policy engine: budget caps, vendor allowlists, rate limits — enforced before payment
- Custodial or self-custody wallet options
- Works with LangChain, CrewAI, MCP servers out of the box

---

## Revenue Model

### 1. Transaction Fees (Primary Revenue)

**3% platform fee** on every API payment processed through Apitoll.

| Monthly API Volume | Platform Revenue (3%) |
|---|---|
| $10,000 | $300 |
| $100,000 | $3,000 |
| $1,000,000 | $30,000 |
| $10,000,000 | $300,000 |

The fee is deducted automatically: if a buyer pays $1.00, the seller receives $0.97 and Apitoll keeps $0.03.

### 2. SaaS Subscriptions (Secondary Revenue)

| Plan | Price | Daily Calls | Agents | Sellers | Analytics |
|------|-------|-------------|--------|---------|-----------|
| **Free** | $0/mo | 1,000 | 1 | 2 | 7 days |
| **Pro** | $49/mo | 100,000 | 10 | 25 | 90 days |
| **Enterprise** | $499/mo | Unlimited | Unlimited | Unlimited | 365 days |

Annual billing: Pro $490/yr (17% discount), Enterprise $4,990/yr (17% discount).

### 3. Future Revenue Streams
- **Featured listings** in the tool marketplace ($20-100/mo for premium placement)
- **White-label facilitator** for enterprises running their own payment infrastructure
- **Premium analytics & reporting** add-ons
- **Batch payment processing** for high-volume agent operations

---

## Market Opportunity

### Total Addressable Market (TAM)

**AI Agent Market:** $47B by 2030 (MarketsandMarkets)
- Autonomous agents that need to transact are growing 40%+ annually
- Every agent framework (LangChain, CrewAI, AutoGPT) needs payment rails

**API Economy:** $4.5T by 2030 (Gartner)
- 90% of developers use APIs; most are free or subscription-based today
- Micropayment models unlock long-tail API monetization

**Stablecoin Payments:** $12T in stablecoin transfer volume in 2024 (Chainalysis)
- USDC on Base has near-zero transaction costs (~$0.001 per tx)
- Institutional and developer adoption accelerating

### Serviceable Addressable Market (SAM)

AI agents paying for APIs via crypto: **$2-5B by 2028**

- 50,000+ active AI agent developers (LangChain alone has 100K+ GitHub stars)
- Average agent makes 100-10,000 API calls per day
- Even at $0.001-$0.01 per call, volume compounds rapidly

### Serviceable Obtainable Market (SOM)

Year 1 target: **$50K-$200K** in transaction volume (yielding $1.5K-$6K/mo in fees)
Year 2 target: **$2M-$10M** in transaction volume (yielding $60K-$300K/yr in fees)
Year 3 target: **$50M+** in transaction volume (yielding $1.5M+/yr in fees)

---

## Go-To-Market Strategy

### Phase 1: Developer Adoption (Months 1-3)
**Goal:** 50 sellers listing paid APIs, 100 agents making real payments

1. **Launch on Hacker News / Product Hunt** — "HTTP 402 is finally real"
2. **Open-source the SDKs** — seller-sdk, buyer-sdk on npm with MIT license
3. **Build 10 example APIs** — jokes, weather, image gen, web scraping, etc.
4. **Publish integration guides** — LangChain, CrewAI, MCP, Express, Hono
5. **Free tier is generous** — 1,000 calls/day, enough for developers to build and test

**Cost:** $0 (organic, content-driven)

### Phase 2: Ecosystem Growth (Months 3-6)
**Goal:** 500 sellers, 1,000 agents, $100K monthly volume

1. **Tool marketplace** — searchable directory of paid APIs, ratings, pricing
2. **Agent framework partnerships** — official LangChain/CrewAI payment integration
3. **Seller onboarding automation** — register API, get paid in 5 minutes
4. **Developer content program** — tutorials, videos, live streams showing real payments
5. **Referral program** — sellers earn 0.5% on referred transaction volume for 6 months

**Cost:** $2K-$5K/mo (content, community management)

### Phase 3: Enterprise & Scale (Months 6-12)
**Goal:** Enterprise customers, $1M+ monthly volume

1. **Enterprise tier launch** — SLAs, dedicated support, custom integrations
2. **White-label facilitator** — enterprises run their own payment infrastructure
3. **Compliance & audit** — SOC 2 Type II, financial reporting
4. **Strategic partnerships** — Coinbase, Base ecosystem, major API marketplaces
5. **Geographic expansion** — EU/Asia agent developer communities

**Cost:** $10K-$30K/mo (sales, compliance, infrastructure)

---

## Competitive Landscape

| Competitor | What They Do | Why Apitoll Wins |
|---|---|---|
| **Stripe** | Card payments for APIs | Can't do sub-cent micropayments; 2.9% + $0.30 minimum makes $0.001 calls impossible |
| **Coinbase x402** | Open x402 protocol spec | Apitoll builds the complete platform on top: SDKs, dashboard, marketplace, policy engine |
| **RapidAPI** | API marketplace | Subscription-based, no per-call micropayments, no agent-native payments |
| **Nevermined** | AI agent payments | Token-based, not stablecoin; more complex integration |
| **Stripe Billing** | Usage-based billing | Invoice-based (net 30), chargebacks, no instant settlement |

**Apitoll's moat:**
1. **Network effects** — more sellers attract more agents, more agents attract more sellers
2. **Transaction data** — own the payment graph between agents and APIs
3. **Protocol-level positioning** — x402 is an HTTP standard, Apitoll is the default implementation
4. **Developer experience** — 3-line integration is hard to beat

---

## Technology Stack

| Layer | Technology | Status |
|---|---|---|
| **Payment Protocol** | x402 (HTTP 402 + USDC) | Live |
| **Blockchain** | Base (EVM), Solana | Base live, Solana in progress |
| **Smart Contract** | USDC on Base (0x833589...) | Mainnet |
| **Seller SDK** | TypeScript, Express/Hono middleware | Published |
| **Buyer SDK** | TypeScript, AgentWallet | Published |
| **Facilitator** | Node.js, ethers.js | Live on Railway |
| **Dashboard** | Next.js 14, Convex, Clerk Auth | Live on Cloudflare |
| **Database** | Convex (real-time serverless) | Production |
| **Auth** | Clerk (organizations + users) | Production |
| **Hosting** | Railway (services), Cloudflare (dashboard) | Production |

---

## Financial Projections

### Year 1 — Foundation

| Quarter | Monthly Volume | Platform Fees (3%) | Subscriptions | Total MRR |
|---------|---------------|-------------------|---------------|-----------|
| Q1 | $5,000 | $150 | $0 | $150 |
| Q2 | $25,000 | $750 | $245 | $995 |
| Q3 | $100,000 | $3,000 | $735 | $3,735 |
| Q4 | $300,000 | $9,000 | $1,960 | $10,960 |

**Year 1 Total Revenue:** ~$48,000
**Year 1 Costs:** ~$15,000 (infra $6K, domain/services $2K, content $5K, misc $2K)

### Year 2 — Growth

| Quarter | Monthly Volume | Platform Fees (3%) | Subscriptions | Total MRR |
|---------|---------------|-------------------|---------------|-----------|
| Q1 | $500,000 | $15,000 | $4,900 | $19,900 |
| Q2 | $1,000,000 | $30,000 | $9,800 | $39,800 |
| Q3 | $2,500,000 | $75,000 | $19,600 | $94,600 |
| Q4 | $5,000,000 | $150,000 | $34,300 | $184,300 |

**Year 2 Total Revenue:** ~$1M
**Year 2 Costs:** ~$300K (team $200K, infra $50K, marketing $30K, misc $20K)

### Year 3 — Scale

**Monthly volume target:** $20M-$50M
**Annual revenue target:** $10M-$20M
**Team size:** 10-15 people

---

## Execution Roadmap

### Now (Week 1-2)
- [x] Core payment flow working end-to-end on Base mainnet
- [x] Dashboard with real-time analytics (17 pages)
- [x] First paid API live (Joke API at $0.001/call)
- [x] Facilitator, seller-api, dashboard deployed to production
- [ ] Form LLC (Wyoming — $100 filing, no state income tax)
- [ ] Set up business bank account (Mercury recommended for crypto companies)
- [ ] List 5 more example APIs on the marketplace

### Month 1
- [ ] Publish seller-sdk and buyer-sdk to npm
- [ ] Write integration guides (LangChain, CrewAI, MCP)
- [ ] Launch on Hacker News with "HTTP 402 is finally real" narrative
- [ ] Onboard 10 beta sellers with real paid APIs
- [ ] Set up Stripe billing for Pro/Enterprise tiers

### Month 2-3
- [ ] Tool marketplace with search, ratings, categories
- [ ] Agent framework official integrations
- [ ] Solana USDC support live
- [ ] Developer documentation site
- [ ] 50+ sellers, 100+ agents

### Month 4-6
- [ ] Enterprise tier with SLAs
- [ ] Advanced analytics and reporting
- [ ] Batch payment processing
- [ ] SOC 2 Type II preparation
- [ ] $100K+ monthly transaction volume

### Month 7-12
- [ ] White-label facilitator offering
- [ ] Additional chain support (Arbitrum, Polygon)
- [ ] Partnership with major API marketplaces
- [ ] Series A fundraise (if needed)
- [ ] $1M+ monthly transaction volume

---

## Team Requirements

### Immediate (Solo / Co-founder)
- **You** — Full-stack dev, product, business development
- The entire platform is built and deployed. Focus on GTM and seller onboarding.

### Month 3-6 (First Hires)
- **Developer Advocate** — Content, tutorials, community ($80-120K)
- **Backend Engineer** — Scale facilitator, add chains ($120-160K)

### Month 6-12 (Growth)
- **Sales / BD** — Enterprise customers, partnerships ($100-140K + commission)
- **Frontend Engineer** — Dashboard features, marketplace ($110-150K)

---

## Key Metrics to Track

| Metric | Why It Matters |
|---|---|
| **Gross Transaction Volume (GTV)** | Total payments processed — drives fee revenue |
| **Take Rate** | Platform fees / GTV — should stay at 3% |
| **Monthly Active Sellers** | Supply side of marketplace |
| **Monthly Active Agents** | Demand side of marketplace |
| **API Calls per Agent** | Usage intensity — higher = stickier |
| **Seller Retention (30-day)** | Are sellers staying and earning? |
| **Agent Retention (30-day)** | Are agents staying and spending? |
| **Settlement Success Rate** | Payment reliability — target 99.9% |
| **Average Transaction Size** | Trending up = healthier unit economics |
| **MRR (Subscriptions)** | Recurring revenue from Pro/Enterprise |

---

## Why This Business Works

1. **Transaction fees compound.** Every new seller and agent adds volume to the network. 3% of exponentially growing volume creates exponential revenue.

2. **Network effects are real.** Sellers list APIs because agents pay. Agents fund wallets because sellers list APIs. The marketplace creates a flywheel.

3. **Zero marginal cost per transaction.** Blockchain settlement costs ~$0.001 on Base. At 3% take rate, even a $0.01 transaction generates $0.0003 in profit after gas.

4. **The timing is perfect.** AI agents are exploding (ChatGPT plugins → function calling → autonomous agents). They need payment rails. x402 is becoming the standard. Apitoll is first to market with a complete platform.

5. **Low burn rate.** The entire platform runs on $50-100/mo of infrastructure (Railway + Cloudflare + Convex). You can operate profitably from day one of meaningful volume.

6. **The product is built.** This isn't a pitch deck — the facilitator is live, the seller API processes real 402 payments, the dashboard shows real transactions. The hardest part (building) is done. Now it's about distribution.

---

## LLC Formation Checklist

### Option A: Wyoming LLC (Recommended)
- **Cost:** $100 filing fee + $60/yr registered agent
- **Time:** 1-2 business days
- **Benefits:** No state income tax, strong asset protection, crypto-friendly
- **How:** File online at https://www.sos.wyo.gov or use a service like Stripe Atlas ($500 — includes bank account + tax ID)

### Option B: Delaware LLC
- **Cost:** $90 filing fee + $300/yr franchise tax
- **Benefits:** Standard for VC-backed companies, well-established case law
- **Best for:** If you plan to raise institutional capital

### After Filing
1. Get EIN from IRS (free, instant online)
2. Open business bank account (Mercury, Relay, or Brex)
3. Set up Stripe account under the LLC
4. Transfer domain ownership to LLC
5. Update Railway/Cloudflare accounts to business

---

## Summary

Apitoll is the payment infrastructure for the AI agent economy. The product is live. The market is emerging now. The business model (3% transaction fee + SaaS subscriptions) scales with volume and compounds with network effects.

**Next step:** Form the LLC, publish the SDKs to npm, and start onboarding sellers. The code is done. Time to sell.
