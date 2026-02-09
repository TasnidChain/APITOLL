import "dotenv/config";
import express from "express";
import { paymentMiddleware } from "@apitoll/seller-sdk";
import { BASE_USDC_ADDRESS } from "@apitoll/shared";

// Route modules
import jokeRouter from "./routes/joke";
import searchRouter from "./routes/search";
import scraperRouter from "./routes/scraper";
import cryptoRouter from "./routes/crypto";
import newsRouter from "./routes/news";
import reputationRouter from "./routes/reputation";
import geocodingRouter from "./routes/geocoding";
import codeExecRouter from "./routes/code-exec";
import enrichRouter from "./routes/enrich";
import emailRouter from "./routes/email";
import pdfExtractRouter from "./routes/pdf-extract";
import financeRouter from "./routes/finance";

const app = express();
app.use(express.json());

// ═══════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════
const USDC_ADDRESS = process.env.USDC_ADDRESS || BASE_USDC_ADDRESS;
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const NETWORK_ID = process.env.NETWORK_ID || "eip155:8453";
const PORT = parseInt(process.env.PORT || "4402", 10);
const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:3000";
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ═══════════════════════════════════════════════════
// x402 Payment Middleware — protects all paid endpoints
// ═══════════════════════════════════════════════════
app.use(
  paymentMiddleware({
    walletAddress: process.env.SELLER_WALLET!,
    endpoints: {
      // ── Jokes ──────────────────────────────────
      "GET /api/joke": {
        price: "0.001",
        chains: ["base"],
        description: "Get a random programming joke",
      },

      // ── Web Search ─────────────────────────────
      "GET /api/search": {
        price: "0.003",
        chains: ["base"],
        description: "Web search — structured results with title, snippet, URL",
      },

      // ── URL Scraper ────────────────────────────
      "POST /api/scrape": {
        price: "0.002",
        chains: ["base"],
        description: "Convert any URL to clean Markdown content",
      },

      // ── Crypto Prices ──────────────────────────
      "GET /api/crypto/price": {
        price: "0.001",
        chains: ["base"],
        description: "Live crypto/token prices from CoinGecko",
      },
      "GET /api/crypto/trending": {
        price: "0.001",
        chains: ["base"],
        description: "Trending tokens and DeFi protocol data",
      },

      // ── News ───────────────────────────────────
      "GET /api/news": {
        price: "0.001",
        chains: ["base"],
        description: "Latest news — tech, crypto, business, science",
      },

      // ── Agent Reputation ───────────────────────
      "GET /api/reputation/agent/:agentId": {
        price: "0.001",
        chains: ["base"],
        description: "Agent trust score and activity profile",
      },
      "GET /api/reputation/trending": {
        price: "0.001",
        chains: ["base"],
        description: "Trending APIs ranked by agent activity",
      },

      // ── Geocoding ──────────────────────────────
      "GET /api/geocode": {
        price: "0.001",
        chains: ["base"],
        description: "Forward geocoding — address to coordinates",
      },
      "GET /api/geocode/reverse": {
        price: "0.001",
        chains: ["base"],
        description: "Reverse geocoding — coordinates to address",
      },

      // ── Code Execution ───────────────────────────
      "POST /api/execute": {
        price: "0.008",
        chains: ["base"],
        description: "Execute Python or JavaScript code in a sandbox (30s timeout)",
      },

      // ── Data Enrichment ──────────────────────────
      "GET /api/enrich/domain": {
        price: "0.02",
        chains: ["base"],
        description: "Domain/company enrichment — tech stack, socials, DNS",
      },
      "GET /api/enrich/github": {
        price: "0.01",
        chains: ["base"],
        description: "GitHub user/org profile with top repos",
      },
      "GET /api/enrich/wiki": {
        price: "0.005",
        chains: ["base"],
        description: "Wikipedia summary for any topic",
      },

      // ── Email ────────────────────────────────────
      "POST /api/email/send": {
        price: "0.003",
        chains: ["base"],
        description: "Send an email (up to 10 recipients)",
      },
      "POST /api/email/validate": {
        price: "0.002",
        chains: ["base"],
        description: "Validate email addresses with MX record check",
      },

      // ── PDF & Document Extraction ────────────────
      "POST /api/extract/pdf": {
        price: "0.01",
        chains: ["base"],
        description: "Extract text from PDF (URL or base64 upload)",
      },
      "POST /api/extract/text": {
        price: "0.002",
        chains: ["base"],
        description: "Extract clean text from HTML content",
      },

      // ── Finance & Stocks ─────────────────────────
      "GET /api/finance/quote": {
        price: "0.002",
        chains: ["base"],
        description: "Real-time stock quote (price, volume, 52-week range)",
      },
      "GET /api/finance/history": {
        price: "0.005",
        chains: ["base"],
        description: "Historical OHLCV candlestick data for any stock",
      },
      "GET /api/finance/forex": {
        price: "0.001",
        chains: ["base"],
        description: "Live exchange rates for 150+ currencies",
      },
      "GET /api/finance/convert": {
        price: "0.001",
        chains: ["base"],
        description: "Currency conversion with live rates",
      },
    },
    chainConfigs: {
      base: {
        networkId: NETWORK_ID,
        rpcUrl: BASE_RPC_URL,
        usdcAddress: USDC_ADDRESS,
        facilitatorUrl: FACILITATOR_URL,
      },
    },
    facilitatorUrl: FACILITATOR_URL,
    webhookUrl: process.env.CONVEX_WEBHOOK_URL,
    platformApiKey: process.env.APITOLL_PLATFORM_KEY,
    // Agent discovery — every 402 and 200 response carries this metadata
    discovery: {
      sellerName: "API Toll Tools",
      referralCode: process.env.REFERRAL_CODE || "apitoll-tools",
      referralBps: 50,
      relatedTools: [
        { name: "Web Search", url: `${BASE_URL}/api/search`, price: "0.003", description: "Search the web. Structured JSON results.", method: "GET" },
        { name: "URL Scraper", url: `${BASE_URL}/api/scrape`, price: "0.002", description: "Convert URL to clean Markdown.", method: "POST" },
        { name: "Crypto Prices", url: `${BASE_URL}/api/crypto/price`, price: "0.001", description: "Live token prices via CoinGecko.", method: "GET" },
        { name: "Trending Crypto", url: `${BASE_URL}/api/crypto/trending`, price: "0.001", description: "Trending tokens & DeFi data.", method: "GET" },
        { name: "News Feed", url: `${BASE_URL}/api/news`, price: "0.001", description: "Latest news from major sources.", method: "GET" },
        { name: "Agent Reputation", url: `${BASE_URL}/api/reputation/agent/:agentId`, price: "0.001", description: "Agent trust score lookup.", method: "GET" },
        { name: "Trending APIs", url: `${BASE_URL}/api/reputation/trending`, price: "0.001", description: "Trending APIs by agent activity.", method: "GET" },
        { name: "Geocoding", url: `${BASE_URL}/api/geocode`, price: "0.001", description: "Address to coordinates.", method: "GET" },
        { name: "Reverse Geocode", url: `${BASE_URL}/api/geocode/reverse`, price: "0.001", description: "Coordinates to address.", method: "GET" },
        { name: "Jokes", url: `${BASE_URL}/api/joke`, price: "0.001", description: "Random programming joke.", method: "GET" },
        { name: "Code Execution", url: `${BASE_URL}/api/execute`, price: "0.008", description: "Run Python/JS code in a sandbox.", method: "POST" },
        { name: "Domain Enrichment", url: `${BASE_URL}/api/enrich/domain`, price: "0.02", description: "Company intel: tech stack, socials, DNS.", method: "GET" },
        { name: "GitHub Enrichment", url: `${BASE_URL}/api/enrich/github`, price: "0.01", description: "GitHub profile with top repos.", method: "GET" },
        { name: "Wikipedia Summary", url: `${BASE_URL}/api/enrich/wiki`, price: "0.005", description: "Wikipedia summary for any topic.", method: "GET" },
        { name: "Send Email", url: `${BASE_URL}/api/email/send`, price: "0.003", description: "Send email to up to 10 recipients.", method: "POST" },
        { name: "Validate Emails", url: `${BASE_URL}/api/email/validate`, price: "0.002", description: "Validate emails with MX check.", method: "POST" },
        { name: "PDF Extraction", url: `${BASE_URL}/api/extract/pdf`, price: "0.01", description: "Extract text from PDF.", method: "POST" },
        { name: "Text Extraction", url: `${BASE_URL}/api/extract/text`, price: "0.002", description: "Clean text from HTML.", method: "POST" },
        { name: "Stock Quote", url: `${BASE_URL}/api/finance/quote`, price: "0.002", description: "Real-time stock/ETF price.", method: "GET" },
        { name: "Stock History", url: `${BASE_URL}/api/finance/history`, price: "0.005", description: "Historical OHLCV candles.", method: "GET" },
        { name: "Forex Rates", url: `${BASE_URL}/api/finance/forex`, price: "0.001", description: "150+ currency exchange rates.", method: "GET" },
        { name: "Currency Convert", url: `${BASE_URL}/api/finance/convert`, price: "0.001", description: "Convert between currencies.", method: "GET" },
      ],
    },
  })
);

// ═══════════════════════════════════════════════════
// Mount Routes
// ═══════════════════════════════════════════════════
app.use(jokeRouter);
app.use(searchRouter);
app.use(scraperRouter);
app.use(cryptoRouter);
app.use(newsRouter);
app.use(reputationRouter);
app.use(geocodingRouter);
app.use(codeExecRouter);
app.use(enrichRouter);
app.use(emailRouter);
app.use(pdfExtractRouter);
app.use(financeRouter);

// ═══════════════════════════════════════════════════
// Free Endpoints (no payment required)
// ═══════════════════════════════════════════════════

// Root route — redirect browsers to dashboard, agents get JSON
app.get("/", (req, res) => {
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    return res.redirect(302, "https://apitoll.com/dashboard/sellers");
  }
  res.json({
    service: "apitoll-seller-api",
    protocol: "x402",
    description: "API Toll seller API — pay-per-call tools for AI agents on Base using USDC.",
    docs: "https://github.com/TasnidChain/APITOLL",
    dashboard: "https://apitoll.com/dashboard",
    health: "https://api.apitoll.com/health",
    tools: "https://api.apitoll.com/api/tools",
    discovery: "https://apitoll.com/api/discover",
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "apitoll-tools",
    seller: process.env.SELLER_WALLET,
    endpoints: 24,
    tools: [
      "joke", "search", "scrape",
      "crypto/price", "crypto/trending",
      "news",
      "reputation/agent", "reputation/trending",
      "geocode", "geocode/reverse",
      "execute",
      "enrich/domain", "enrich/github", "enrich/wiki",
      "email/send", "email/validate",
      "extract/pdf", "extract/text",
      "finance/quote", "finance/history", "finance/forex", "finance/convert",
    ],
  });
});

// Tool directory for agents
app.get("/api/tools", (_req, res) => {
  res.json({
    platform: "apitoll",
    protocol: "x402",
    tools: [
      { endpoint: "GET /api/joke", price: "$0.001 USDC", description: "Random programming joke" },
      { endpoint: "GET /api/search?q=...", price: "$0.003 USDC", description: "Web search with structured results" },
      { endpoint: "POST /api/scrape", price: "$0.002 USDC", description: "URL to Markdown converter" },
      { endpoint: "GET /api/crypto/price?ids=...", price: "$0.001 USDC", description: "Live crypto prices" },
      { endpoint: "GET /api/crypto/trending", price: "$0.001 USDC", description: "Trending tokens & DeFi data" },
      { endpoint: "GET /api/news?category=...", price: "$0.001 USDC", description: "Latest news by category" },
      { endpoint: "GET /api/reputation/agent/:id", price: "$0.001 USDC", description: "Agent trust score" },
      { endpoint: "GET /api/reputation/trending", price: "$0.001 USDC", description: "Trending APIs by agent activity" },
      { endpoint: "GET /api/geocode?q=...", price: "$0.001 USDC", description: "Address to coordinates" },
      { endpoint: "GET /api/geocode/reverse?lat=...&lon=...", price: "$0.001 USDC", description: "Coordinates to address" },
      { endpoint: "POST /api/execute", price: "$0.008 USDC", description: "Run Python/JS code in sandbox" },
      { endpoint: "GET /api/enrich/domain?domain=...", price: "$0.02 USDC", description: "Company/domain enrichment" },
      { endpoint: "GET /api/enrich/github?username=...", price: "$0.01 USDC", description: "GitHub profile enrichment" },
      { endpoint: "GET /api/enrich/wiki?q=...", price: "$0.005 USDC", description: "Wikipedia summary" },
      { endpoint: "POST /api/email/send", price: "$0.003 USDC", description: "Send email" },
      { endpoint: "POST /api/email/validate", price: "$0.002 USDC", description: "Validate email addresses" },
      { endpoint: "POST /api/extract/pdf", price: "$0.01 USDC", description: "Extract text from PDF" },
      { endpoint: "POST /api/extract/text", price: "$0.002 USDC", description: "Extract text from HTML" },
      { endpoint: "GET /api/finance/quote?symbol=...", price: "$0.002 USDC", description: "Real-time stock quote" },
      { endpoint: "GET /api/finance/history?symbol=...", price: "$0.005 USDC", description: "Historical OHLCV data" },
      { endpoint: "GET /api/finance/forex?base=USD", price: "$0.001 USDC", description: "Exchange rates (150+ currencies)" },
      { endpoint: "GET /api/finance/convert?from=...&to=...&amount=...", price: "$0.001 USDC", description: "Currency conversion" },
    ],
    seller_wallet: process.env.SELLER_WALLET,
    facilitator: FACILITATOR_URL,
    chain: "base",
  });
});

// ═══════════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════════
if (!process.env.SELLER_WALLET) {
  console.error("ERROR: SELLER_WALLET environment variable required");
  console.error("Usage: SELLER_WALLET=0x... npx tsx server.ts");
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  API Toll Multi-Tool API`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`\n  Paid Endpoints (x402 USDC on Base):`);
  console.log(`  ────────────────────────────────────────`);
  console.log(`  GET  /api/joke                    $0.001`);
  console.log(`  GET  /api/search?q=...            $0.003`);
  console.log(`  POST /api/scrape                  $0.002`);
  console.log(`  GET  /api/crypto/price?ids=...    $0.001`);
  console.log(`  GET  /api/crypto/trending         $0.001`);
  console.log(`  GET  /api/news?category=...       $0.001`);
  console.log(`  GET  /api/reputation/agent/:id    $0.001`);
  console.log(`  GET  /api/reputation/trending     $0.001`);
  console.log(`  GET  /api/geocode?q=...           $0.001`);
  console.log(`  GET  /api/geocode/reverse         $0.001`);
  console.log(`  POST /api/execute                 $0.008`);
  console.log(`  GET  /api/enrich/domain           $0.020`);
  console.log(`  GET  /api/enrich/github           $0.010`);
  console.log(`  GET  /api/enrich/wiki             $0.005`);
  console.log(`  POST /api/email/send              $0.003`);
  console.log(`  POST /api/email/validate          $0.002`);
  console.log(`  POST /api/extract/pdf             $0.010`);
  console.log(`  POST /api/extract/text            $0.002`);
  console.log(`  GET  /api/finance/quote           $0.002`);
  console.log(`  GET  /api/finance/history         $0.005`);
  console.log(`  GET  /api/finance/forex           $0.001`);
  console.log(`  GET  /api/finance/convert         $0.001`);
  console.log(`\n  Free Endpoints:`);
  console.log(`  ────────────────────────────────────────`);
  console.log(`  GET  /health`);
  console.log(`  GET  /api/tools`);
  console.log(`\n  Seller wallet:  ${process.env.SELLER_WALLET}`);
  console.log(`  Facilitator:    ${FACILITATOR_URL}`);
  console.log(`\n  24 paid endpoints ready to receive payments.\n`);
});

export default app;
