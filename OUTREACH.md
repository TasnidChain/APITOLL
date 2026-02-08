# APITOLL Launch Outreach — Copy-Paste Ready

---

## 1. SHOW HN POST

**Title:** Show HN: API Toll – 3-line SDK to let AI agents pay for APIs with USDC

**Body:**

Hi HN, I built API Toll — payment infrastructure that lets AI agents autonomously pay for API calls using USDC on Base (Coinbase L2).

The problem: AI agents need to consume paid APIs (data feeds, AI models, SaaS tools), but they can't use credit cards. Current workarounds involve pre-funded accounts, API key sharing, or manual top-ups — none of which scale to autonomous agent swarms.

API Toll uses the x402 HTTP payment protocol. The flow is simple:

1. Agent calls your API
2. Your API returns HTTP 402 with a payment request
3. Agent's wallet auto-pays USDC on Base (2s finality)
4. Agent retries the request with payment proof
5. Your API returns 200 with the data

For sellers (API developers), it's 3 lines of code:

```js
import { paymentMiddleware } from '@apitoll/seller-sdk';
app.use('/api/data', paymentMiddleware({
  price: '0.001', wallet: '0x...', facilitatorUrl: '...'
}));
```

For buyers (AI agents), the SDK handles payments transparently:

```js
const agent = createAgentWallet({ name: 'ResearchBot', privateKey: '...' });
const res = await agent.fetch('https://api.example.com/data');
// Automatically handles 402 → pay → retry
```

Key features:
- Zero chargebacks (blockchain finality)
- Budget policies (daily caps, per-tx limits, vendor allowlists)
- Works with LangChain, CrewAI, OpenAI Agents SDK, Vercel AI SDK
- MCP server for tool discovery
- Agent gossip network for viral API discovery

Live on mainnet. Real USDC. Not testnet.

Tech stack: TypeScript, Express/Hono middleware, ethers.js, Convex (real-time backend), Next.js dashboard, deployed on Railway + Cloudflare.

- Dashboard: https://apitoll.com
- npm: @apitoll/seller-sdk, @apitoll/buyer-sdk
- GitHub: https://github.com/TasnidChain/APITOLL
- Protocol spec: https://x402.org

Happy to answer questions about x402, agent commerce, or the technical architecture.

---

## 2. LAUNCH TWEET (Pin this)

I built a 3-line SDK that lets AI agents pay for APIs with USDC.

Agent calls your API. Gets 402. Pays automatically. Gets data.

Zero chargebacks. 2-second settlement. $0.001 minimum.

npm install @apitoll/seller-sdk

Live on Base mainnet. Not testnet.

https://apitoll.com

---

## 3. TWEET THREAD (More detail)

**Tweet 1:**
I spent months building payment infrastructure for AI agents.

The result: API Toll — agents can now autonomously pay for any API with USDC micropayments.

Here's how it works (thread):

**Tweet 2:**
The problem: AI agents need to consume paid APIs — data feeds, AI models, SaaS tools.

But agents can't use credit cards. Pre-funded accounts don't scale. API key sharing is a security nightmare.

We need native agent-to-API payments.

**Tweet 3:**
The solution: HTTP 402 (Payment Required).

Your API returns a 402 response with a payment request. The agent's wallet auto-pays USDC on Base. 2-second finality. The agent retries and gets the data.

No credit cards. No subscriptions. No chargebacks.

**Tweet 4:**
For API developers, it's 3 lines:

```
app.use('/api/data', paymentMiddleware({
  price: '0.001',
  wallet: '0x...'
}));
```

You just turned your API into a revenue stream for AI agents.

**Tweet 5:**
For agent builders, payments are transparent:

```
const agent = createAgentWallet({ name: 'Bot' });
const res = await agent.fetch('https://api.example.com/data');
// Handles 402 → pay → retry automatically
```

Works with @LangChainAI, CrewAI, @OpenAI Agents SDK, @veraborhter AI SDK.

**Tweet 6:**
This is live on Base mainnet. Real USDC. Not testnet demos.

npm install @apitoll/seller-sdk
npm install @apitoll/buyer-sdk

Dashboard: https://apitoll.com
GitHub: https://github.com/TasnidChain/APITOLL

Built on the x402 protocol by @coinbase + @CloudflareDev

---

## 4. COINBASE DEVREL OUTREACH

**Subject:** First production x402 implementation — API Toll on Base

Hi [name],

I'm building API Toll — the first production implementation of the x402 HTTP payment protocol on Base mainnet.

API Toll lets AI agents autonomously pay for API calls with USDC micropayments. The seller SDK turns any Express/Hono API into a paid endpoint in 3 lines of code, and the buyer SDK gives agents budget-controlled wallets that handle 402 payment flows transparently.

We're live on mainnet with published npm packages (@apitoll/seller-sdk, @apitoll/buyer-sdk) and a real-time dashboard at https://apitoll.com.

I'd love to:
1. Get listed in the Coinbase/Base ecosystem directory
2. Discuss potential Base Ecosystem Fund support
3. Coordinate on x402 protocol development (we've built facilitator, signer, and verification infrastructure that could benefit the ecosystem)

GitHub: https://github.com/TasnidChain/APITOLL
npm: https://www.npmjs.com/package/@apitoll/seller-sdk

Would you be open to a quick call?

Best,
[Your name]
Rizq Labs AI LLC

---

## 5. KEYGRAPH (SHANNON) PARTNERSHIP OUTREACH

**Subject:** Shannon + API Toll — Pentest-as-a-Service via x402 payments

Hi Keygraph team,

I'm the founder of API Toll (https://apitoll.com) — payment infrastructure for AI agents on the x402 protocol.

I came across Shannon and immediately saw a killer integration opportunity:

**Shannon-as-a-Service via x402:**
- Expose Shannon pentests as a paid API endpoint
- CI/CD agents call `POST /api/pentest` → HTTP 402 → pay $25-50 USDC → scan runs → report delivered
- No subscriptions, no API keys to manage — agents just pay per scan
- Perfect fit for automated security in CI/CD pipelines

From our side, we'd:
- Build a reference integration using @apitoll/seller-sdk
- Feature Shannon as a premium tool in our discovery marketplace
- Promote the integration to our developer community

Shannon is exactly the type of high-value, agent-consumed service that x402 was designed for. The per-scan cost (~$50 in LLM credits) maps perfectly to per-request USDC pricing.

Would love to explore this. Happy to do a quick call or async over email.

GitHub: https://github.com/TasnidChain/APITOLL
Dashboard: https://apitoll.com

Best,
[Your name]
Rizq Labs AI LLC

---

## 6. REDDIT POSTS

### r/LangChain

**Title:** I built a payment SDK that lets LangChain agents pay for APIs with USDC

**Body:**
Hey everyone — I built API Toll, a payment layer for AI agents. It works with LangChain tools out of the box.

The idea: your LangChain agent calls a paid API, gets an HTTP 402 response, automatically pays USDC on Base (Coinbase L2), and retries. The whole flow is transparent to your agent code.

```python
# Your agent's tool just works — payments happen automatically
from apitoll import AgentWallet
wallet = AgentWallet(name="ResearchBot", private_key="...")
response = wallet.fetch("https://paid-api.com/data")
```

We also have a LangChain adapter package: `@apitoll/langchain`

If you're building agents that need to consume paid data (financial data, AI models, research databases), this eliminates the "how do I give my agent a credit card" problem.

- npm: @apitoll/buyer-sdk, @apitoll/langchain
- GitHub: https://github.com/TasnidChain/APITOLL
- Examples: https://github.com/TasnidChain/APITOLL/tree/main/examples/langchain-agent

Would love feedback from the community.

### r/ethdev

**Title:** Built payment infrastructure for AI agents on Base — x402 protocol + USDC micropayments

**Body:**
Built an open-source SDK for the x402 HTTP payment protocol that lets AI agents pay for API calls with USDC on Base.

The protocol flow:
1. Agent → API request
2. API → HTTP 402 + payment details (amount, wallet, chain)
3. Agent → USDC transfer on Base (2s finality)
4. Agent → Retry with X-PAYMENT header (tx proof)
5. API → Verifies payment → 200 response

The seller SDK wraps Express/Hono middleware. 3 lines to monetize any endpoint:

```js
app.use('/api/data', paymentMiddleware({
  price: '0.001', wallet: '0x...', facilitatorUrl: '...'
}));
```

On-chain: USDC on Base, ethers.js v6 for signing/verification, facilitator handles payment coordination.

Everything is TypeScript, MIT licensed, published on npm.

- GitHub: https://github.com/TasnidChain/APITOLL
- x402 spec: https://x402.org
- npm: @apitoll/seller-sdk

Looking for feedback on the architecture and early adopters building agent-to-API payment flows.

### r/LocalLLaMA

**Title:** Built a way for local AI agents to pay for external APIs with crypto micropayments

**Body:**
If you're running local agents (AutoGPT, BabyAGI, custom LangChain setups) that need external data — weather, stock prices, AI inference endpoints — I built a payment SDK that handles it automatically.

Your agent hits a paid API, gets an HTTP 402 (Payment Required), auto-pays USDC (as little as $0.001), and gets the data. No API keys to manage, no subscriptions, no credit cards.

Works with any agent framework — it's just a fetch wrapper:

```js
const agent = createAgentWallet({ name: 'LocalBot', privateKey: '...' });
const data = await agent.fetch('https://paid-api.com/stock/AAPL');
```

Built-in budget controls so your agent can't drain your wallet:
- Daily spending caps
- Per-transaction limits
- Vendor allowlists/blocklists

If you're building agents that need real-world data access, this might save you some headaches.

GitHub: https://github.com/TasnidChain/APITOLL
npm: @apitoll/buyer-sdk

---

## 7. SHANNON PENTEST CONFIG (for scanning APITOLL)

Save as `apitoll-config.yaml` in the shannon directory:

```yaml
# APITOLL Security Scan Config
authentication:
  login_type: form
  login_url: "https://apitoll.com/sign-in"
  credentials:
    username: "YOUR_TEST_EMAIL"
    password: "YOUR_TEST_PASSWORD"
  login_flow:
    - "Type $username into the email field"
    - "Type $password into the password field"
    - "Click the 'Continue' button"
  success_condition:
    type: url_contains
    value: "/dashboard"

rules:
  focus:
    - description: "Focus on payment API endpoints"
      type: path
      url_path: "/api/*"
    - description: "Focus on discovery endpoints"
      type: path
      url_path: "/api/discover/*"
    - description: "Focus on gossip endpoint"
      type: path
      url_path: "/api/gossip"
  avoid:
    - description: "Skip Clerk auth pages"
      type: path
      url_path: "/sign-up"
    - description: "Skip static assets"
      type: path
      url_path: "/_next/*"
```

---

## POSTING ORDER (Recommended)

1. **Day 1 (Today):** Create @apitoll on X, pin the launch tweet
2. **Day 1:** Post Show HN
3. **Day 1:** Post r/ethdev (most technical, best first impression)
4. **Day 2:** Post r/LangChain + r/LocalLLaMA
5. **Day 2:** Send Coinbase devrel email
6. **Day 3:** Send Keygraph email (after Shannon scan completes — mention you used their tool)
7. **Day 3-5:** Engage with all comments, DM anyone interested
