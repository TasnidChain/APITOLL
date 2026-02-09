import "dotenv/config";
import express from "express";
import { paymentMiddleware } from "@apitoll/seller-sdk";
import { BASE_USDC_ADDRESS } from "@apitoll/shared";

// ═══════════════════════════════════════════════════
// Route Imports
// ═══════════════════════════════════════════════════

// Original routes
import jokeRouter from "./routes/joke";
import searchRouter from "./routes/search";
import scraperRouter from "./routes/scraper";
import cryptoRouter from "./routes/crypto";
import newsRouter from "./routes/news";
import reputationRouter from "./routes/reputation";
import geocodingRouter from "./routes/geocoding";

// Data & Lookup
import weatherRouter from "./routes/weather";
import ipRouter from "./routes/ip";
import timezoneRouter from "./routes/timezone";
import currencyRouter from "./routes/currency";
import countryRouter from "./routes/country";
import companyRouter from "./routes/company";
import whoisRouter from "./routes/whois";
import dnsRouter from "./routes/dns-lookup";
import domainRouter from "./routes/domain";
import holidaysRouter from "./routes/holidays";

// Text Processing
import sentimentRouter from "./routes/sentiment";
import summarizeRouter from "./routes/summarize";
import keywordsRouter from "./routes/keywords";
import readabilityRouter from "./routes/readability";
import languageRouter from "./routes/language";
import translateRouter from "./routes/translate";
import profanityRouter from "./routes/profanity";

// Web & URL Utilities
import metaRouter from "./routes/meta";
import screenshotRouter from "./routes/screenshot";
import linksRouter from "./routes/links";
import sitemapRouter from "./routes/sitemap";
import robotsRouter from "./routes/robots";
import headersRouter from "./routes/headers";
import sslRouter from "./routes/ssl";

// Compute & Dev Tools
import hashRouter from "./routes/hash";
import jwtDecodeRouter from "./routes/jwt-decode";
import regexRouter from "./routes/regex";
import cronRouter from "./routes/cron";
import diffRouter from "./routes/diff";
// REMOVED: exec route — vm module is NOT a security boundary (full RCE via constructor chain)
// import execRouter from "./routes/exec";
import jsonValidateRouter from "./routes/json-validate";
import base64Router from "./routes/base64";
import uuidRouter from "./routes/uuid";
import markdownRouter from "./routes/markdown";

// Media & Visual
import qrRouter from "./routes/qr";
import placeholderRouter from "./routes/placeholder";
import colorRouter from "./routes/color";
import faviconRouter from "./routes/favicon";
import avatarRouter from "./routes/avatar";

// Blockchain
import ensRouter from "./routes/ens";

const app = express();
app.use(express.json({ limit: "100kb" }));

// ═══════════════════════════════════════════════════
// Security Headers (applied to all responses)
// ═══════════════════════════════════════════════════
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

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
      // ── Original Endpoints ───────────────────────
      "GET /api/joke": {
        price: "0.001",
        chains: ["base"],
        description: "Get a random programming joke",
      },
      "GET /api/search": {
        price: "0.003",
        chains: ["base"],
        description: "Web search — structured results with title, snippet, URL",
      },
      "POST /api/scrape": {
        price: "0.002",
        chains: ["base"],
        description: "Convert any URL to clean Markdown content",
      },
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
      "GET /api/news": {
        price: "0.001",
        chains: ["base"],
        description: "Latest news — tech, crypto, business, science",
      },
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

      // ── Data & Lookup ────────────────────────────
      "GET /api/weather": {
        price: "0.001",
        chains: ["base"],
        description: "Current weather by city or coordinates (Open-Meteo)",
      },
      "GET /api/ip": {
        price: "0.001",
        chains: ["base"],
        description: "IP geolocation lookup (ip-api.com)",
      },
      "GET /api/timezone": {
        price: "0.001",
        chains: ["base"],
        description: "Timezone info by coordinates or zone name",
      },
      "GET /api/currency": {
        price: "0.002",
        chains: ["base"],
        description: "Currency exchange rates (ECB/Frankfurter)",
      },
      "GET /api/country": {
        price: "0.001",
        chains: ["base"],
        description: "Country info — population, capital, currencies, languages",
      },
      "GET /api/company": {
        price: "0.005",
        chains: ["base"],
        description: "Company/corporate entity lookup (OpenCorporates)",
      },
      "GET /api/whois": {
        price: "0.002",
        chains: ["base"],
        description: "Domain WHOIS/RDAP registration data",
      },
      "GET /api/dns": {
        price: "0.001",
        chains: ["base"],
        description: "DNS record lookup (A, AAAA, MX, TXT, NS, CNAME)",
      },
      "GET /api/domain": {
        price: "0.003",
        chains: ["base"],
        description: "Full domain profile — DNS + WHOIS combined",
      },
      "GET /api/holidays": {
        price: "0.001",
        chains: ["base"],
        description: "Public holidays by country and year (Nager.Date)",
      },

      // ── Text Processing ──────────────────────────
      "POST /api/sentiment": {
        price: "0.002",
        chains: ["base"],
        description: "Sentiment analysis with AFINN lexicon scoring",
      },
      "POST /api/summarize": {
        price: "0.003",
        chains: ["base"],
        description: "Extractive text summarization",
      },
      "POST /api/keywords": {
        price: "0.002",
        chains: ["base"],
        description: "Keyword/keyphrase extraction (frequency-based)",
      },
      "POST /api/readability": {
        price: "0.001",
        chains: ["base"],
        description: "Readability scoring (Flesch-Kincaid, grade level)",
      },
      "GET /api/language": {
        price: "0.001",
        chains: ["base"],
        description: "Language detection via trigram analysis",
      },
      "POST /api/translate": {
        price: "0.003",
        chains: ["base"],
        description: "Text translation (LibreTranslate)",
      },
      "POST /api/profanity": {
        price: "0.001",
        chains: ["base"],
        description: "Profanity detection and filtering",
      },

      // ── Web & URL Utilities ──────────────────────
      "GET /api/meta": {
        price: "0.002",
        chains: ["base"],
        description: "URL meta tag extraction (OpenGraph, Twitter Cards)",
      },
      "GET /api/screenshot": {
        price: "0.01",
        chains: ["base"],
        description: "URL screenshot via free screenshot service",
      },
      "GET /api/links": {
        price: "0.002",
        chains: ["base"],
        description: "Extract all links from a URL",
      },
      "GET /api/sitemap": {
        price: "0.002",
        chains: ["base"],
        description: "Parse sitemap.xml from any domain",
      },
      "GET /api/robots": {
        price: "0.001",
        chains: ["base"],
        description: "Parse robots.txt rules from any domain",
      },
      "GET /api/headers": {
        price: "0.001",
        chains: ["base"],
        description: "HTTP response headers + security header analysis",
      },
      "GET /api/ssl": {
        price: "0.002",
        chains: ["base"],
        description: "SSL/TLS certificate info for any domain",
      },

      // ── Compute & Dev Tools ──────────────────────
      "POST /api/hash": {
        price: "0.001",
        chains: ["base"],
        description: "Hash generation (MD5, SHA1, SHA256, SHA512)",
      },
      "POST /api/jwt/decode": {
        price: "0.001",
        chains: ["base"],
        description: "JWT token decode (header + payload, no verification)",
      },
      "POST /api/regex": {
        price: "0.002",
        chains: ["base"],
        description: "Regex test, match, and replace",
      },
      "POST /api/cron": {
        price: "0.001",
        chains: ["base"],
        description: "Cron expression parser — next N scheduled runs",
      },
      "POST /api/diff": {
        price: "0.002",
        chains: ["base"],
        description: "Text diff — compare two strings with unified output",
      },
      // REMOVED: /api/exec — vm module sandbox escape (CVE: RCE via this.constructor.constructor)
      "POST /api/json/validate": {
        price: "0.001",
        chains: ["base"],
        description: "JSON schema validation",
      },
      "POST /api/base64": {
        price: "0.001",
        chains: ["base"],
        description: "Base64 encode/decode",
      },
      "POST /api/uuid": {
        price: "0.001",
        chains: ["base"],
        description: "UUID generation (v4 random, v7 timestamp-sortable)",
      },
      "POST /api/markdown": {
        price: "0.002",
        chains: ["base"],
        description: "Markdown to HTML conversion with stats",
      },

      // ── Media & Visual ───────────────────────────
      "GET /api/qr": {
        price: "0.002",
        chains: ["base"],
        description: "QR code generation (SVG or data URL)",
      },
      "GET /api/placeholder": {
        price: "0.001",
        chains: ["base"],
        description: "Placeholder image generation (SVG)",
      },
      "GET /api/color": {
        price: "0.001",
        chains: ["base"],
        description: "Color info — hex to RGB, HSL, name, contrast ratios",
      },
      "GET /api/favicon": {
        price: "0.001",
        chains: ["base"],
        description: "Favicon extraction from any domain",
      },
      "GET /api/avatar": {
        price: "0.001",
        chains: ["base"],
        description: "Deterministic identicon avatar from any string",
      },

      // ── Blockchain ───────────────────────────────
      "GET /api/ens": {
        price: "0.002",
        chains: ["base"],
        description: "ENS name resolution (name ↔ address)",
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
        // Original
        { name: "Web Search", url: `${BASE_URL}/api/search`, price: "0.003", description: "Search the web. Structured JSON results.", method: "GET" },
        { name: "URL Scraper", url: `${BASE_URL}/api/scrape`, price: "0.002", description: "Convert URL to clean Markdown.", method: "POST" },
        { name: "Crypto Prices", url: `${BASE_URL}/api/crypto/price`, price: "0.001", description: "Live token prices via CoinGecko.", method: "GET" },
        { name: "News Feed", url: `${BASE_URL}/api/news`, price: "0.001", description: "Latest news from major sources.", method: "GET" },
        { name: "Geocoding", url: `${BASE_URL}/api/geocode`, price: "0.001", description: "Address to coordinates.", method: "GET" },
        // Data & Lookup
        { name: "Weather", url: `${BASE_URL}/api/weather`, price: "0.001", description: "Current weather by city or coordinates.", method: "GET" },
        { name: "IP Geolocation", url: `${BASE_URL}/api/ip`, price: "0.001", description: "IP address geolocation lookup.", method: "GET" },
        { name: "Currency Rates", url: `${BASE_URL}/api/currency`, price: "0.002", description: "Exchange rates from ECB.", method: "GET" },
        { name: "DNS Lookup", url: `${BASE_URL}/api/dns`, price: "0.001", description: "DNS records for any domain.", method: "GET" },
        { name: "Domain Info", url: `${BASE_URL}/api/domain`, price: "0.003", description: "Full domain profile (DNS + WHOIS).", method: "GET" },
        // Text Processing
        { name: "Sentiment", url: `${BASE_URL}/api/sentiment`, price: "0.002", description: "Text sentiment analysis.", method: "POST" },
        { name: "Summarize", url: `${BASE_URL}/api/summarize`, price: "0.003", description: "Extractive text summarization.", method: "POST" },
        { name: "Translate", url: `${BASE_URL}/api/translate`, price: "0.003", description: "Text translation.", method: "POST" },
        // Web & URL
        { name: "Meta Tags", url: `${BASE_URL}/api/meta`, price: "0.002", description: "Extract URL meta tags.", method: "GET" },
        { name: "SSL Check", url: `${BASE_URL}/api/ssl`, price: "0.002", description: "SSL certificate info.", method: "GET" },
        // Compute
        { name: "Hash", url: `${BASE_URL}/api/hash`, price: "0.001", description: "Generate hashes (SHA256, etc).", method: "POST" },
        { name: "JSON Validate", url: `${BASE_URL}/api/json/validate`, price: "0.001", description: "JSON Schema validation.", method: "POST" },
        { name: "QR Code", url: `${BASE_URL}/api/qr`, price: "0.002", description: "Generate QR codes.", method: "GET" },
        { name: "ENS", url: `${BASE_URL}/api/ens`, price: "0.002", description: "ENS name resolution.", method: "GET" },
        { name: "Jokes", url: `${BASE_URL}/api/joke`, price: "0.001", description: "Random programming joke.", method: "GET" },
      ],
    },
  })
);

// ═══════════════════════════════════════════════════
// Mount Routes
// ═══════════════════════════════════════════════════

// Original
app.use(jokeRouter);
app.use(searchRouter);
app.use(scraperRouter);
app.use(cryptoRouter);
app.use(newsRouter);
app.use(reputationRouter);
app.use(geocodingRouter);

// Data & Lookup
app.use(weatherRouter);
app.use(ipRouter);
app.use(timezoneRouter);
app.use(currencyRouter);
app.use(countryRouter);
app.use(companyRouter);
app.use(whoisRouter);
app.use(dnsRouter);
app.use(domainRouter);
app.use(holidaysRouter);

// Text Processing
app.use(sentimentRouter);
app.use(summarizeRouter);
app.use(keywordsRouter);
app.use(readabilityRouter);
app.use(languageRouter);
app.use(translateRouter);
app.use(profanityRouter);

// Web & URL Utilities
app.use(metaRouter);
app.use(screenshotRouter);
app.use(linksRouter);
app.use(sitemapRouter);
app.use(robotsRouter);
app.use(headersRouter);
app.use(sslRouter);

// Compute & Dev Tools
app.use(hashRouter);
app.use(jwtDecodeRouter);
app.use(regexRouter);
app.use(cronRouter);
app.use(diffRouter);
// REMOVED: execRouter — RCE vulnerability
app.use(jsonValidateRouter);
app.use(base64Router);
app.use(uuidRouter);
app.use(markdownRouter);

// Media & Visual
app.use(qrRouter);
app.use(placeholderRouter);
app.use(colorRouter);
app.use(faviconRouter);
app.use(avatarRouter);

// Blockchain
app.use(ensRouter);

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
    seller: process.env.SELLER_WALLET ? `${process.env.SELLER_WALLET.slice(0, 6)}...${process.env.SELLER_WALLET.slice(-4)}` : null,
    endpoints: 49,
    categories: {
      original: ["joke", "search", "scrape", "crypto/price", "crypto/trending", "news", "reputation/agent", "reputation/trending", "geocode", "geocode/reverse"],
      dataLookup: ["weather", "ip", "timezone", "currency", "country", "company", "whois", "dns", "domain", "holidays"],
      textProcessing: ["sentiment", "summarize", "keywords", "readability", "language", "translate", "profanity"],
      webUrl: ["meta", "screenshot", "links", "sitemap", "robots", "headers", "ssl"],
      computeDev: ["hash", "jwt/decode", "regex", "cron", "diff", "json/validate", "base64", "uuid", "markdown"],
      mediaVisual: ["qr", "placeholder", "color", "favicon", "avatar"],
      blockchain: ["ens"],
    },
  });
});

// Tool directory for agents
app.get("/api/tools", (_req, res) => {
  res.json({
    platform: "apitoll",
    protocol: "x402",
    totalEndpoints: 49,
    tools: [
      // ── Original ──────────────────────────────────
      { endpoint: "GET /api/joke", price: "$0.001 USDC", description: "Random programming joke", category: "original" },
      { endpoint: "GET /api/search?q=...", price: "$0.003 USDC", description: "Web search with structured results", category: "original" },
      { endpoint: "POST /api/scrape", price: "$0.002 USDC", description: "URL to Markdown converter", category: "original" },
      { endpoint: "GET /api/crypto/price?ids=...", price: "$0.001 USDC", description: "Live crypto prices", category: "original" },
      { endpoint: "GET /api/crypto/trending", price: "$0.001 USDC", description: "Trending tokens & DeFi data", category: "original" },
      { endpoint: "GET /api/news?category=...", price: "$0.001 USDC", description: "Latest news by category", category: "original" },
      { endpoint: "GET /api/reputation/agent/:id", price: "$0.001 USDC", description: "Agent trust score", category: "original" },
      { endpoint: "GET /api/reputation/trending", price: "$0.001 USDC", description: "Trending APIs by agent activity", category: "original" },
      { endpoint: "GET /api/geocode?q=...", price: "$0.001 USDC", description: "Address to coordinates", category: "original" },
      { endpoint: "GET /api/geocode/reverse?lat=...&lon=...", price: "$0.001 USDC", description: "Coordinates to address", category: "original" },

      // ── Data & Lookup ─────────────────────────────
      { endpoint: "GET /api/weather?city=...", price: "$0.001 USDC", description: "Current weather by city or lat/lon", category: "data" },
      { endpoint: "GET /api/ip?ip=...", price: "$0.001 USDC", description: "IP geolocation lookup", category: "data" },
      { endpoint: "GET /api/timezone?lat=...&lon=...", price: "$0.001 USDC", description: "Timezone by coordinates or zone name", category: "data" },
      { endpoint: "GET /api/currency?from=...&to=...", price: "$0.002 USDC", description: "Currency exchange rates", category: "data" },
      { endpoint: "GET /api/country?name=...", price: "$0.001 USDC", description: "Country info lookup", category: "data" },
      { endpoint: "GET /api/company?q=...", price: "$0.005 USDC", description: "Company/corporate entity search", category: "data" },
      { endpoint: "GET /api/whois?domain=...", price: "$0.002 USDC", description: "Domain WHOIS/RDAP data", category: "data" },
      { endpoint: "GET /api/dns?domain=...", price: "$0.001 USDC", description: "DNS records (A, AAAA, MX, TXT)", category: "data" },
      { endpoint: "GET /api/domain?domain=...", price: "$0.003 USDC", description: "Full domain profile (DNS + WHOIS)", category: "data" },
      { endpoint: "GET /api/holidays?country=...&year=...", price: "$0.001 USDC", description: "Public holidays by country", category: "data" },

      // ── Text Processing ───────────────────────────
      { endpoint: "POST /api/sentiment", price: "$0.002 USDC", description: "Sentiment analysis (AFINN lexicon)", category: "text" },
      { endpoint: "POST /api/summarize", price: "$0.003 USDC", description: "Extractive text summarization", category: "text" },
      { endpoint: "POST /api/keywords", price: "$0.002 USDC", description: "Keyword extraction", category: "text" },
      { endpoint: "POST /api/readability", price: "$0.001 USDC", description: "Readability score (Flesch-Kincaid)", category: "text" },
      { endpoint: "GET /api/language?text=...", price: "$0.001 USDC", description: "Language detection", category: "text" },
      { endpoint: "POST /api/translate", price: "$0.003 USDC", description: "Text translation", category: "text" },
      { endpoint: "POST /api/profanity", price: "$0.001 USDC", description: "Profanity filter/detection", category: "text" },

      // ── Web & URL Utilities ───────────────────────
      { endpoint: "GET /api/meta?url=...", price: "$0.002 USDC", description: "URL meta tags (OG, Twitter Cards)", category: "web" },
      { endpoint: "GET /api/screenshot?url=...", price: "$0.01 USDC", description: "URL screenshot", category: "web" },
      { endpoint: "GET /api/links?url=...", price: "$0.002 USDC", description: "Extract all links from URL", category: "web" },
      { endpoint: "GET /api/sitemap?domain=...", price: "$0.002 USDC", description: "Parse sitemap.xml", category: "web" },
      { endpoint: "GET /api/robots?domain=...", price: "$0.001 USDC", description: "Parse robots.txt", category: "web" },
      { endpoint: "GET /api/headers?url=...", price: "$0.001 USDC", description: "HTTP response headers", category: "web" },
      { endpoint: "GET /api/ssl?domain=...", price: "$0.002 USDC", description: "SSL certificate info", category: "web" },

      // ── Compute & Dev Tools ───────────────────────
      { endpoint: "POST /api/hash", price: "$0.001 USDC", description: "Hash generation (MD5, SHA256, etc)", category: "compute" },
      { endpoint: "POST /api/jwt/decode", price: "$0.001 USDC", description: "JWT token decode", category: "compute" },
      { endpoint: "POST /api/regex", price: "$0.002 USDC", description: "Regex test & match", category: "compute" },
      { endpoint: "POST /api/cron", price: "$0.001 USDC", description: "Cron expression parser", category: "compute" },
      { endpoint: "POST /api/diff", price: "$0.002 USDC", description: "Text diff comparison", category: "compute" },
      // exec endpoint removed — security vulnerability
      { endpoint: "POST /api/json/validate", price: "$0.001 USDC", description: "JSON schema validation", category: "compute" },
      { endpoint: "POST /api/base64", price: "$0.001 USDC", description: "Base64 encode/decode", category: "compute" },
      { endpoint: "POST /api/uuid", price: "$0.001 USDC", description: "UUID generation (v4, v7)", category: "compute" },
      { endpoint: "POST /api/markdown", price: "$0.002 USDC", description: "Markdown to HTML", category: "compute" },

      // ── Media & Visual ────────────────────────────
      { endpoint: "GET /api/qr?data=...", price: "$0.002 USDC", description: "QR code generation", category: "media" },
      { endpoint: "GET /api/placeholder?width=...&height=...", price: "$0.001 USDC", description: "Placeholder image (SVG)", category: "media" },
      { endpoint: "GET /api/color?hex=...", price: "$0.001 USDC", description: "Color info (RGB, HSL, name)", category: "media" },
      { endpoint: "GET /api/favicon?domain=...", price: "$0.001 USDC", description: "Favicon extraction", category: "media" },
      { endpoint: "GET /api/avatar?input=...", price: "$0.001 USDC", description: "Deterministic identicon avatar", category: "media" },

      // ── Blockchain ────────────────────────────────
      { endpoint: "GET /api/ens?name=...", price: "$0.002 USDC", description: "ENS name ↔ address resolution", category: "blockchain" },
    ],
    chain: "base",
    protocol_version: "x402-v1",
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
  console.log(`  API Toll — 49 Paid API Endpoints`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`\n  Paid Endpoints (x402 USDC on Base): 49`);
  console.log(`  ────────────────────────────────────────`);
  console.log(`  Original (10)    : joke, search, scrape, crypto, news, reputation, geocode`);
  console.log(`  Data & Lookup (10): weather, ip, timezone, currency, country, company, whois, dns, domain, holidays`);
  console.log(`  Text (7)         : sentiment, summarize, keywords, readability, language, translate, profanity`);
  console.log(`  Web & URL (7)    : meta, screenshot, links, sitemap, robots, headers, ssl`);
  console.log(`  Compute (9)      : hash, jwt/decode, regex, cron, diff, json/validate, base64, uuid, markdown`);
  console.log(`  Media (5)        : qr, placeholder, color, favicon, avatar`);
  console.log(`  Blockchain (1)   : ens`);
  console.log(`\n  Free Endpoints:`);
  console.log(`  ────────────────────────────────────────`);
  console.log(`  GET  /health`);
  console.log(`  GET  /api/tools`);
  console.log(`\n  Seller wallet:  ${process.env.SELLER_WALLET}`);
  console.log(`  Facilitator:    ${FACILITATOR_URL}`);
  console.log(`\n  Ready to receive payments.\n`);
});

export default app;
