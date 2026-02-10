# API Toll Examples

Ready-to-run examples showing how to monetize APIs and build AI agents that pay for tools with USDC on Base.

## Quick Start

```bash
# Install dependencies
npm install

# Pick any example below and run it
```

## Seller Examples (Monetize Your API)

| Example | What It Does | Price | Run Command |
|---------|-------------|-------|-------------|
| **[seller-express](./seller-express/)** | Weather API with forecast + historical data | $0.001-$0.005/call | `SELLER_WALLET=0x... npx tsx seller-express/server.ts` |
| **[seller-stock-api](./seller-stock-api/)** | Stock & crypto prices, candles, portfolio analysis | $0.001-$0.005/call | `SELLER_WALLET=0x... npx tsx seller-stock-api/server.ts` |
| **[seller-ai-proxy](./seller-ai-proxy/)** | GPT-4 proxy — completion, summarization, sentiment | $0.002-$0.01/call | `SELLER_WALLET=0x... npx tsx seller-ai-proxy/server.ts` |
| **[mcp-server](./mcp-server/)** | MCP server with free + paid weather tools | $0.005-$0.01/call | `npx tsx mcp-server/server.ts` |

All seller examples use `@apitoll/seller-sdk` — add 3 lines of code to monetize any Express or Hono API.

## Buyer/Agent Examples (Pay for APIs Automatically)

| Example | What It Does | Budget | Run Command |
|---------|-------------|--------|-------------|
| **[buyer-agent](./buyer-agent/)** | ResearchBot with budget controls + spend tracking | $50/day | `npx tsx buyer-agent/research-bot.ts` |
| **[multi-agent-swarm](./multi-agent-swarm/)** | 3 agents (researcher, analyst, scout) working together | $2-$10/day each | `npx tsx multi-agent-swarm/swarm.ts` |
| **[openai-agents](./openai-agents/)** | GPT-4 function calling with paid x402 tools | $5/day | `OPENAI_API_KEY=sk-... npx tsx openai-agents/agent.ts` |
| **[anthropic-claude](./anthropic-claude/)** | Anthropic Claude SDK with tool_use + x402 payments | $5/day | `ANTHROPIC_API_KEY=sk-... npx tsx anthropic-claude/agent.ts` |
| **[vercel-ai-sdk](./vercel-ai-sdk/)** | Vercel AI SDK tool pattern with x402 payments | $10/day | `npx tsx vercel-ai-sdk/agent.ts` |
| **[langchain-agent](./langchain-agent/)** | LangChain + CrewAI integration with paid tools | $10/day | `npx tsx langchain-agent/agent.ts` |
| **[langgraph-agent](./langgraph-agent/)** | LangGraph stateful graph with conditional loops | $5/day | `npx tsx langgraph-agent/agent.ts` |
| **[autogen-agents](./autogen-agents/)** | AutoGen-style multi-agent pipeline (Researcher + Analyst + Writer) | $0.50-$2/day each | `npx tsx autogen-agents/agent.ts` |
| **[semantic-kernel](./semantic-kernel/)** | Microsoft Semantic Kernel plugin pattern with planner | $3/day | `npx tsx semantic-kernel/agent.ts` |
| **[self-custody](./self-custody/)** | Self-custody wallets: local signing, direct broadcast, Solana | $5/day | `AGENT_PRIVATE_KEY=0x... npx tsx self-custody/agent.ts` |

All buyer examples use `@apitoll/buyer-sdk` with automatic 402 handling, budget policies, and optional evolution (self-optimization).

## Full Demo: End-to-End Payment Flow

Run a seller and buyer together to see the complete x402 payment flow:

```bash
# Terminal 1: Start a seller API
SELLER_WALLET=0xYourWallet npx tsx seller-express/server.ts

# Terminal 2: Start a buyer agent
npx tsx buyer-agent/research-bot.ts
```

The agent will:
1. Call the weather API
2. Get a 402 "Payment Required" response
3. Sign a USDC payment via the facilitator
4. Retry with the `X-PAYMENT` header
5. Receive the weather data

## Key Concepts

**x402 Protocol**: HTTP status 402 (Payment Required) with standardized payment requirements. The agent parses the requirements, signs a USDC transfer, and retries.

**Budget Policies**: Agents have configurable spending limits (daily cap, per-request max, vendor allowlist, rate limits).

**Evolution**: Opt-in self-optimization. After each successful transaction, the agent adjusts its preferences (chain selection, escrow usage, auto-top-up thresholds).

**Discovery**: Every 402 and 200 response carries `X-APITOLL-DISCOVERY` headers with tool directory info, referral codes, and integration hints.

## Links

- [npm: @apitoll/seller-sdk](https://www.npmjs.com/package/@apitoll/seller-sdk)
- [npm: @apitoll/buyer-sdk](https://www.npmjs.com/package/@apitoll/buyer-sdk)
- [Dashboard](https://apitoll.com/dashboard)
- [x402 Protocol Spec](https://www.x402.org/)
