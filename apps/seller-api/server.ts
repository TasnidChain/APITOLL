import "dotenv/config";
import express from "express";
import { paymentMiddleware } from "@apitoll/seller-sdk";

// Route modules
import jokeRouter from "./routes/joke";
import searchRouter from "./routes/search";
import scraperRouter from "./routes/scraper";
import cryptoRouter from "./routes/crypto";
import newsRouter from "./routes/news";
import reputationRouter from "./routes/reputation";
import geocodingRouter from "./routes/geocoding";

const app = express();
app.use(express.json());

// ═══════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════
const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
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

// ═══════════════════════════════════════════════════
// Free Endpoints (no payment required)
// ═══════════════════════════════════════════════════
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "apitoll-tools",
    seller: process.env.SELLER_WALLET,
    endpoints: 10,
    tools: ["joke", "search", "scrape", "crypto/price", "crypto/trending", "news", "reputation/agent", "reputation/trending", "geocode", "geocode/reverse"],
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
  console.log(`  GET  /api/crypto/trending          $0.001`);
  console.log(`  GET  /api/news?category=...       $0.001`);
  console.log(`  GET  /api/reputation/agent/:id    $0.001`);
  console.log(`  GET  /api/reputation/trending      $0.001`);
  console.log(`  GET  /api/geocode?q=...           $0.001`);
  console.log(`  GET  /api/geocode/reverse          $0.001`);
  console.log(`\n  Free Endpoints:`);
  console.log(`  ────────────────────────────────────────`);
  console.log(`  GET  /health`);
  console.log(`  GET  /api/tools`);
  console.log(`\n  Seller wallet:  ${process.env.SELLER_WALLET}`);
  console.log(`  Facilitator:    ${FACILITATOR_URL}`);
  console.log(`\n  Ready to receive payments.\n`);
});

export default app;
