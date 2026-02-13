/**
 * Hireable Agents — MCP Server
 *
 * 5 compound AI agent tools that other agents can discover and pay for via API Toll.
 * Each tool chains together multiple API calls to deliver higher-value results
 * than any single endpoint can provide.
 *
 * Tools:
 *   web_research  — $0.05  — Search + scrape + synthesize research
 *   smart_scrape  — $0.03  — URL to structured, enriched data
 *   code_eval     — $0.01  — Sandboxed JavaScript execution
 *   lead_enrich   — $0.08  — Full domain/company intelligence
 *   data_analyst  — $0.02  — JSON/CSV statistical analysis
 *
 * @version 0.1.0-beta.5
 */

import express from 'express'
import { createPaidMCPServer, toExpressRouter } from '@apitoll/mcp-server'

import { webResearchSchema, webResearch } from './tools/web-research'
import { smartScrapeSchema, smartScrape } from './tools/smart-scrape'
import { codeEvalSchema, codeEval } from './tools/code-eval'
import { leadEnrichSchema, leadEnrich } from './tools/lead-enrich'
import { dataAnalystSchema, dataAnalyst } from './tools/data-analyst'

// ── Server Config ────────────────────────────────────────────

const WALLET = process.env.WALLET_ADDRESS || process.env.SELLER_WALLET
if (!WALLET) {
  console.error('❌ WALLET_ADDRESS or SELLER_WALLET environment variable is required.')
  console.error('   Usage: WALLET_ADDRESS=0x... npm start')
  process.exit(1)
}

const PORT = process.env.PORT || 3005
const DISCOVERY_URL = process.env.DISCOVERY_URL || 'https://apitoll.com/api/discover'
const SELLER_ID = process.env.SELLER_ID || 'hireable-agents'

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['https://apitoll.com', 'https://dashboard.apitoll.com', 'https://api.apitoll.com']

// ── MCP Server ───────────────────────────────────────────────

const server = createPaidMCPServer({
  walletAddress: WALLET,
  defaultChain: 'base',
  discoveryUrl: DISCOVERY_URL,
  sellerId: SELLER_ID,
  onPayment: (tool, amount, txHash) => {
    console.log(`💰 ${tool} — $${amount} received (tx: ${txHash})`)
  },
  onPaymentError: (tool, error) => {
    console.error(`❌ ${tool} — payment failed: ${error.message}`)
  },
})

// ── Register Tools ───────────────────────────────────────────

// 1. Web Research — $0.05/call
server.paidTool(
  'web_research',
  'Deep web research agent — searches multiple sources, scrapes content, extracts entities, and synthesizes findings into a structured report. Returns analyzed results, not raw data.',
  webResearchSchema,
  {
    price: 0.05,
    chains: ['base', 'solana'],
    category: 'research',
    tags: ['research', 'search', 'analysis', 'synthesis', 'agent'],
  },
  webResearch,
)

// 2. Smart Scrape — $0.03/call
server.paidTool(
  'smart_scrape',
  'Intelligent web scraper — extracts clean text, metadata, links, entities, sentiment, and summary from any URL. Returns structured, enriched data ready for agent consumption.',
  smartScrapeSchema,
  {
    price: 0.03,
    chains: ['base', 'solana'],
    category: 'scraping',
    tags: ['scrape', 'extract', 'nlp', 'metadata', 'agent'],
  },
  smartScrape,
)

// 3. Code Eval — $0.01/call
server.paidTool(
  'code_eval',
  'Sandboxed JavaScript code execution — run calculations, transform data, test logic. Isolated VM with no filesystem or network access. Returns output, console logs, and execution time.',
  codeEvalSchema,
  {
    price: 0.01,
    chains: ['base', 'solana'],
    category: 'compute',
    tags: ['code', 'javascript', 'sandbox', 'execution', 'agent'],
  },
  codeEval,
)

// 4. Lead Enrich — $0.08/call
server.paidTool(
  'lead_enrich',
  'Full domain/company intelligence — DNS records, WHOIS, tech stack detection, SSL certificate, security headers, and computed trust score. One call for complete lead enrichment.',
  leadEnrichSchema,
  {
    price: 0.08,
    chains: ['base', 'solana'],
    category: 'enrichment',
    tags: ['leads', 'enrichment', 'domain', 'company', 'intelligence', 'agent'],
  },
  leadEnrich,
)

// 5. Data Analyst — $0.02/call
server.paidTool(
  'data_analyst',
  'Statistical data analysis agent — feed JSON arrays or CSV data and get statistics, correlations, outliers, distributions, trends, and missing data reports. Supports specific questions about your data.',
  dataAnalystSchema,
  {
    price: 0.02,
    chains: ['base', 'solana'],
    category: 'analytics',
    tags: ['data', 'statistics', 'analytics', 'csv', 'agent'],
  },
  dataAnalyst,
)

// ── Express App ──────────────────────────────────────────────

const app = express()
app.use(express.json({ limit: '5mb' }))

// CORS — restrict origins in production
app.use((req, res, next) => {
  const origin = req.headers.origin || ''
  if (process.env.NODE_ENV === 'production') {
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
    }
    // No header = browser blocks cross-origin (safe default)
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Payment, Authorization')
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})

// Security Headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
})

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'hireable-agents',
    tools: server.getToolDefinitions().length,
    wallet: WALLET,
  })
})

// MCP routes
app.use('/mcp', toExpressRouter(server))

// Root — list available tools with pricing
app.get('/', (_req, res) => {
  const tools = server.getToolDefinitions()
  res.json({
    name: 'API Toll — Hireable Agents',
    description: 'Compound AI agent tools that other agents can discover and pay for. Each tool chains multiple operations for higher-value results.',
    version: '0.1.0',
    endpoints: {
      listTools: 'GET /mcp/tools',
      callTool: 'POST /mcp/tools/:name',
      jsonRpc: 'POST /mcp/rpc',
      paymentInfo: 'GET /mcp/tools/:name/payment',
    },
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      price: (t as Record<string, unknown>)['x-402']
        ? `$${((t as Record<string, unknown>)['x-402'] as Record<string, unknown>).price} USDC`
        : 'free',
    })),
  })
})

// ── Start ────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🤖 Hireable Agents — MCP Server                    ║
║                                                       ║
║   Port: ${String(PORT).padEnd(46)}║
║   Wallet: ${WALLET.slice(0, 6)}...${WALLET.slice(-4)}                                  ║
║                                                       ║
║   Tools:                                              ║
║     web_research   — $0.05/call  (research)           ║
║     smart_scrape   — $0.03/call  (scraping)           ║
║     code_eval      — $0.01/call  (compute)            ║
║     lead_enrich    — $0.08/call  (enrichment)         ║
║     data_analyst   — $0.02/call  (analytics)          ║
║                                                       ║
║   Endpoints:                                          ║
║     GET  /mcp/tools            List tools             ║
║     POST /mcp/tools/:name      Call tool              ║
║     POST /mcp/rpc              JSON-RPC               ║
║     GET  /mcp/tools/:name/payment  Payment info       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`)

  // Auto-register with discovery
  if (DISCOVERY_URL && SELLER_ID) {
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`
    server.registerWithDiscovery(baseUrl).then(() => {
      console.log('📡 Registered with Discovery API')
    }).catch(err => {
      console.warn('⚠️  Discovery registration failed:', err.message)
    })
  }
})
