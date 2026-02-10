import "dotenv/config";
import express from "express";
import { paymentMiddleware } from "@apitoll/seller-sdk";
import { BASE_USDC_ADDRESS, createLogger } from "@apitoll/shared";
import { rateLimit } from "./rate-limit";

const log = createLogger("seller-api");

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

// Tier 2 APIs (high-demand agent tools)
import enrichRouter from "./routes/enrich";
import emailRouter from "./routes/email";
import pdfExtractRouter from "./routes/pdf-extract";
import financeRouter from "./routes/finance";

// Tier 3 APIs (agent productivity tools)
import nlpRouter from "./routes/nlp";
import transformRouter from "./routes/transform";
import datetimeRouter from "./routes/datetime";
import securityRouter from "./routes/security";
import mathRouter from "./routes/math";

// Tier 4 APIs (real-world data from free public APIs)
import nasaRouter from "./routes/nasa";
import quotesRouter from "./routes/quotes";
import booksRouter from "./routes/books";
import earthquakesRouter from "./routes/earthquakes";
import airqualityRouter from "./routes/airquality";
import factsRouter from "./routes/facts";

// API Documentation (OpenAPI 3.0.3 + Swagger UI)
import openapiRouter from "./openapi";

const app = express();
app.use(express.json({ limit: "25mb" })); // PDF base64 uploads can be large

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
// Rate Limiting
// ═══════════════════════════════════════════════════

// Global: 200 requests per minute per IP
app.use(rateLimit({ windowMs: 60_000, max: 200, keyPrefix: "global", message: "Rate limit exceeded — max 200 req/min" }));

// Stricter limit on free endpoints to prevent abuse
app.use("/health", rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "health" }));
app.use("/api/tools", rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "tools" }));

// ═══════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════
const USDC_ADDRESS = process.env.USDC_ADDRESS || BASE_USDC_ADDRESS;
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const NETWORK_ID = process.env.NETWORK_ID || "eip155:8453";
const PORT = parseInt(process.env.PORT || "4402", 10);

const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:3000";
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

if (!process.env.FACILITATOR_URL) {
  log.warn("FACILITATOR_URL not set — defaulting to http://localhost:3000 (development only)");
}
if (!process.env.BASE_URL) {
  log.warn("BASE_URL not set — defaulting to http://localhost:" + PORT + " (development only)");
}

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

      // ─── Tier 2: Data Enrichment ───────────────────
      "GET /api/enrich/domain": {
        price: "0.020",
        chains: ["base"],
        description: "Domain/company enrichment — tech stack, social links, DNS",
      },
      "GET /api/enrich/github": {
        price: "0.010",
        chains: ["base"],
        description: "GitHub user profile + top repos by stars",
      },
      "GET /api/enrich/wiki": {
        price: "0.005",
        chains: ["base"],
        description: "Wikipedia summary for any topic",
      },

      // ─── Tier 2: Email ─────────────────────────────
      "POST /api/email/send": {
        price: "0.003",
        chains: ["base"],
        description: "Send email via Resend or SMTP (max 10 recipients)",
      },
      "POST /api/email/validate": {
        price: "0.002",
        chains: ["base"],
        description: "Validate email addresses with MX record check",
      },

      // ─── Tier 2: Document Extraction ───────────────
      "POST /api/extract/pdf": {
        price: "0.010",
        chains: ["base"],
        description: "Extract text from PDF (URL or base64, up to 100 pages)",
      },
      "POST /api/extract/text": {
        price: "0.002",
        chains: ["base"],
        description: "Extract clean text from HTML content or URL",
      },

      // ─── Tier 2: Finance ───────────────────────────
      "GET /api/finance/quote": {
        price: "0.002",
        chains: ["base"],
        description: "Real-time stock quote (multi-symbol supported)",
      },
      "GET /api/finance/history": {
        price: "0.005",
        chains: ["base"],
        description: "Historical OHLCV candles (1m to 5y range)",
      },
      "GET /api/finance/forex": {
        price: "0.001",
        chains: ["base"],
        description: "150+ currency exchange rates",
      },
      "GET /api/finance/convert": {
        price: "0.001",
        chains: ["base"],
        description: "Currency conversion with live rates",
      },

      // ─── Tier 3: NLP & Text Intelligence ─────────────
      "POST /api/entities": {
        price: "0.002",
        chains: ["base"],
        description: "Named entity extraction (emails, URLs, dates, crypto addresses, etc)",
      },
      "POST /api/similarity": {
        price: "0.002",
        chains: ["base"],
        description: "Text similarity scoring (Jaccard + cosine)",
      },

      // ─── Tier 3: Data Transformation ──────────────────
      "POST /api/transform/csv": {
        price: "0.002",
        chains: ["base"],
        description: "CSV to JSON conversion with header detection",
      },
      "POST /api/transform/json-to-csv": {
        price: "0.002",
        chains: ["base"],
        description: "JSON array to CSV conversion",
      },
      "POST /api/transform/xml": {
        price: "0.002",
        chains: ["base"],
        description: "XML to JSON conversion",
      },
      "POST /api/transform/yaml": {
        price: "0.002",
        chains: ["base"],
        description: "YAML to JSON conversion",
      },

      // ─── Tier 3: Date & Time ──────────────────────────
      "GET /api/datetime/between": {
        price: "0.001",
        chains: ["base"],
        description: "Calculate duration between two dates",
      },
      "GET /api/datetime/business-days": {
        price: "0.001",
        chains: ["base"],
        description: "Business days calculator (count or add)",
      },
      "GET /api/datetime/unix": {
        price: "0.001",
        chains: ["base"],
        description: "Unix timestamp converter (to/from ISO dates)",
      },

      // ─── Tier 3: Security & Recon ─────────────────────
      "GET /api/security/headers": {
        price: "0.003",
        chains: ["base"],
        description: "Security headers audit with grade (A+ to F)",
      },
      "GET /api/security/techstack": {
        price: "0.005",
        chains: ["base"],
        description: "Technology stack detection for any URL",
      },
      "GET /api/security/uptime": {
        price: "0.001",
        chains: ["base"],
        description: "URL uptime/health check with response time",
      },

      // ─── Tier 3: Math & Calculation ───────────────────
      "POST /api/math/eval": {
        price: "0.001",
        chains: ["base"],
        description: "Safe math expression evaluator (sqrt, trig, etc)",
      },
      "GET /api/math/convert": {
        price: "0.001",
        chains: ["base"],
        description: "Unit converter (length, weight, temp, data, time, speed)",
      },
      "POST /api/math/stats": {
        price: "0.002",
        chains: ["base"],
        description: "Statistical analysis (mean, median, std dev, percentiles)",
      },

      // ─── Tier 4: Real-World Data (free public APIs) ─────
      "GET /api/nasa/apod": {
        price: "0.002",
        chains: ["base"],
        description: "NASA Astronomy Picture of the Day with explanation",
      },
      "GET /api/nasa/asteroids": {
        price: "0.003",
        chains: ["base"],
        description: "Near-Earth asteroid data from NASA",
      },
      "GET /api/quote": {
        price: "0.001",
        chains: ["base"],
        description: "Random inspirational/famous quotes",
      },
      "GET /api/books/search": {
        price: "0.002",
        chains: ["base"],
        description: "Search books via Open Library (title, author, ISBN)",
      },
      "GET /api/books/isbn/:isbn": {
        price: "0.002",
        chains: ["base"],
        description: "Book details by ISBN from Open Library",
      },
      "GET /api/earthquakes": {
        price: "0.002",
        chains: ["base"],
        description: "Recent earthquake data from USGS (magnitude, location, depth)",
      },
      "GET /api/air-quality": {
        price: "0.002",
        chains: ["base"],
        description: "Air quality index and pollutant levels by city or coordinates",
      },
      "GET /api/fact": {
        price: "0.001",
        chains: ["base"],
        description: "Random facts — cats, dogs, numbers, or general trivia",
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
        // Tier 2
        { name: "Domain Enrichment", url: `${BASE_URL}/api/enrich/domain`, price: "0.020", description: "Domain intel — tech stack, socials, DNS.", method: "GET" },
        { name: "GitHub Enrichment", url: `${BASE_URL}/api/enrich/github`, price: "0.010", description: "GitHub profile + top repos.", method: "GET" },
        { name: "Wikipedia", url: `${BASE_URL}/api/enrich/wiki`, price: "0.005", description: "Wikipedia summary for any topic.", method: "GET" },
        { name: "Email Send", url: `${BASE_URL}/api/email/send`, price: "0.003", description: "Send email via Resend/SMTP.", method: "POST" },
        { name: "Email Validate", url: `${BASE_URL}/api/email/validate`, price: "0.002", description: "Validate emails with MX check.", method: "POST" },
        { name: "PDF Extract", url: `${BASE_URL}/api/extract/pdf`, price: "0.010", description: "PDF to text extraction.", method: "POST" },
        { name: "Text Extract", url: `${BASE_URL}/api/extract/text`, price: "0.002", description: "HTML to clean text.", method: "POST" },
        { name: "Stock Quote", url: `${BASE_URL}/api/finance/quote`, price: "0.002", description: "Real-time stock quotes.", method: "GET" },
        { name: "Stock History", url: `${BASE_URL}/api/finance/history`, price: "0.005", description: "Historical OHLCV candles.", method: "GET" },
        { name: "Forex Rates", url: `${BASE_URL}/api/finance/forex`, price: "0.001", description: "150+ currency exchange rates.", method: "GET" },
        { name: "Currency Convert", url: `${BASE_URL}/api/finance/convert`, price: "0.001", description: "Currency conversion.", method: "GET" },
        // Tier 3
        { name: "Entity Extraction", url: `${BASE_URL}/api/entities`, price: "0.002", description: "Named entity extraction from text.", method: "POST" },
        { name: "Text Similarity", url: `${BASE_URL}/api/similarity`, price: "0.002", description: "Compare text similarity.", method: "POST" },
        { name: "CSV to JSON", url: `${BASE_URL}/api/transform/csv`, price: "0.002", description: "Convert CSV to JSON.", method: "POST" },
        { name: "Security Audit", url: `${BASE_URL}/api/security/headers`, price: "0.003", description: "Security headers audit.", method: "GET" },
        { name: "Tech Detection", url: `${BASE_URL}/api/security/techstack`, price: "0.005", description: "Detect website technologies.", method: "GET" },
        { name: "Uptime Check", url: `${BASE_URL}/api/security/uptime`, price: "0.001", description: "URL health/uptime check.", method: "GET" },
        { name: "Math Eval", url: `${BASE_URL}/api/math/eval`, price: "0.001", description: "Evaluate math expressions.", method: "POST" },
        { name: "Unit Convert", url: `${BASE_URL}/api/math/convert`, price: "0.001", description: "Unit conversion.", method: "GET" },
        { name: "Statistics", url: `${BASE_URL}/api/math/stats`, price: "0.002", description: "Statistical analysis.", method: "POST" },
        // Tier 4
        { name: "NASA APOD", url: `${BASE_URL}/api/nasa/apod`, price: "0.002", description: "NASA Astronomy Picture of the Day.", method: "GET" },
        { name: "NASA Asteroids", url: `${BASE_URL}/api/nasa/asteroids`, price: "0.003", description: "Near-Earth asteroid tracking.", method: "GET" },
        { name: "Quotes", url: `${BASE_URL}/api/quote`, price: "0.001", description: "Random inspirational quotes.", method: "GET" },
        { name: "Book Search", url: `${BASE_URL}/api/books/search`, price: "0.002", description: "Search books via Open Library.", method: "GET" },
        { name: "Earthquakes", url: `${BASE_URL}/api/earthquakes`, price: "0.002", description: "Recent earthquake data from USGS.", method: "GET" },
        { name: "Air Quality", url: `${BASE_URL}/api/air-quality`, price: "0.002", description: "Air quality index by city.", method: "GET" },
        { name: "Random Facts", url: `${BASE_URL}/api/fact`, price: "0.001", description: "Random trivia facts.", method: "GET" },
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

// Tier 2 APIs (high-demand agent tools)
app.use(enrichRouter);
app.use(emailRouter);
app.use(pdfExtractRouter);
app.use(financeRouter);

// Tier 3 APIs (agent productivity tools)
app.use(nlpRouter);
app.use(transformRouter);
app.use(datetimeRouter);
app.use(securityRouter);
app.use(mathRouter);

// Tier 4 APIs (real-world data from free public APIs)
app.use(nasaRouter);
app.use(quotesRouter);
app.use(booksRouter);
app.use(earthquakesRouter);
app.use(airqualityRouter);
app.use(factsRouter);

// ═══════════════════════════════════════════════════
// API Documentation (free — no payment required)
// ═══════════════════════════════════════════════════
app.use(openapiRouter);

// ═══════════════════════════════════════════════════
// Free Endpoints (no payment required)
// ═══════════════════════════════════════════════════

// Root route — show landing for browsers, JSON for agents
app.get("/", (req, res) => {
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Toll — Pay-Per-Call API for AI Agents</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'JetBrains Mono', monospace; background: #0a0a0f; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
    .container { max-width: 720px; padding: 48px 32px; text-align: center; }
    .logo { font-size: 14px; letter-spacing: 4px; text-transform: uppercase; color: #818cf8; margin-bottom: 24px; }
    h1 { font-size: 36px; font-weight: 700; margin-bottom: 12px; background: linear-gradient(135deg, #818cf8, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .tagline { font-size: 16px; color: #94a3b8; margin-bottom: 40px; }
    .stats { display: flex; gap: 32px; justify-content: center; margin-bottom: 40px; }
    .stat { text-align: center; }
    .stat-num { font-size: 32px; font-weight: 700; color: #818cf8; }
    .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
    .links { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-bottom: 32px; }
    .links a { display: inline-block; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; transition: all .2s; }
    .primary { background: #6366f1; color: white; }
    .primary:hover { background: #818cf8; }
    .secondary { border: 1px solid #334155; color: #94a3b8; }
    .secondary:hover { border-color: #818cf8; color: #818cf8; }
    .endpoint { font-size: 13px; color: #64748b; margin-top: 32px; }
    .endpoint code { background: #1e1e2e; padding: 2px 8px; border-radius: 4px; color: #818cf8; }
    .protocol { display: inline-block; margin-top: 24px; padding: 6px 16px; border-radius: 999px; font-size: 11px; letter-spacing: 2px; border: 1px solid #334155; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">⚡ API TOLL</div>
    <h1>Pay-Per-Call APIs for AI Agents</h1>
    <p class="tagline">80+ endpoints. USDC micropayments on Base. One HTTP header.</p>
    <div class="stats">
      <div class="stat"><div class="stat-num">80+</div><div class="stat-label">Endpoints</div></div>
      <div class="stat"><div class="stat-num">x402</div><div class="stat-label">Protocol</div></div>
      <div class="stat"><div class="stat-num">USDC</div><div class="stat-label">On Base L2</div></div>
    </div>
    <div class="links">
      <a href="/api/docs" class="primary">📖 API Docs</a>
      <a href="/api/tools" class="secondary">🔧 Browse Tools</a>
      <a href="/health" class="secondary">💚 Health Check</a>
      <a href="https://apitoll.com" class="secondary">🏠 Dashboard</a>
      <a href="https://apitoll.com/what" class="secondary">❓ What Is It?</a>
    </div>
    <p class="endpoint">Try it: <code>curl https://api.apitoll.com/api/joke</code></p>
    <div class="protocol">x402 PAYMENT REQUIRED</div>
  </div>
</body>
</html>`);
  }
  res.json({
    service: "apitoll-seller-api",
    protocol: "x402",
    description: "API Toll seller API — pay-per-call tools for AI agents on Base using USDC.",
    docs: "https://api.apitoll.com/api/docs",
    openapi: "https://api.apitoll.com/api/openapi.json",
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
    endpoints: 75,
    categories: {
      original: ["joke", "search", "scrape", "crypto/price", "crypto/trending", "news", "reputation/agent", "reputation/trending", "geocode", "geocode/reverse"],
      dataLookup: ["weather", "ip", "timezone", "currency", "country", "company", "whois", "dns", "domain", "holidays"],
      textProcessing: ["sentiment", "summarize", "keywords", "readability", "language", "translate", "profanity"],
      webUrl: ["meta", "screenshot", "links", "sitemap", "robots", "headers", "ssl"],
      computeDev: ["hash", "jwt/decode", "regex", "cron", "diff", "json/validate", "base64", "uuid", "markdown"],
      mediaVisual: ["qr", "placeholder", "color", "favicon", "avatar"],
      blockchain: ["ens"],
      nlp: ["entities", "similarity"],
      transform: ["transform/csv", "transform/json-to-csv", "transform/xml", "transform/yaml"],
      datetime: ["datetime/between", "datetime/business-days", "datetime/unix"],
      security: ["security/headers", "security/techstack", "security/uptime"],
      math: ["math/eval", "math/convert", "math/stats"],
    },
  });
});

// Tool directory for agents
app.get("/api/tools", (_req, res) => {
  res.json({
    platform: "apitoll",
    protocol: "x402",
    totalEndpoints: 75,
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

      // ── Data Enrichment ─────────────────────────
      { endpoint: "GET /api/enrich/domain?domain=...", price: "$0.020 USDC", description: "Domain enrichment — tech stack, socials, DNS", category: "enrichment" },
      { endpoint: "GET /api/enrich/github?username=...", price: "$0.010 USDC", description: "GitHub user profile + top repos", category: "enrichment" },
      { endpoint: "GET /api/enrich/wiki?q=...", price: "$0.005 USDC", description: "Wikipedia summary", category: "enrichment" },

      // ── Email ───────────────────────────────────
      { endpoint: "POST /api/email/send", price: "$0.003 USDC", description: "Send email (Resend or SMTP)", category: "email" },
      { endpoint: "POST /api/email/validate", price: "$0.002 USDC", description: "Email validation with MX check", category: "email" },

      // ── Document Extraction ─────────────────────
      { endpoint: "POST /api/extract/pdf", price: "$0.010 USDC", description: "PDF to text extraction", category: "documents" },
      { endpoint: "POST /api/extract/text", price: "$0.002 USDC", description: "HTML to clean text", category: "documents" },

      // ── Finance ─────────────────────────────────
      { endpoint: "GET /api/finance/quote?symbol=...", price: "$0.002 USDC", description: "Real-time stock quote", category: "finance" },
      { endpoint: "GET /api/finance/history?symbol=...", price: "$0.005 USDC", description: "Historical OHLCV candles", category: "finance" },
      { endpoint: "GET /api/finance/forex?base=...", price: "$0.001 USDC", description: "150+ currency exchange rates", category: "finance" },
      { endpoint: "GET /api/finance/convert?from=...&to=...", price: "$0.001 USDC", description: "Currency conversion", category: "finance" },

      // ── NLP & Text Intelligence ─────────────────────
      { endpoint: "POST /api/entities", price: "$0.002 USDC", description: "Named entity extraction (emails, URLs, dates, crypto)", category: "nlp" },
      { endpoint: "POST /api/similarity", price: "$0.002 USDC", description: "Text similarity scoring (Jaccard + cosine)", category: "nlp" },

      // ── Data Transformation ─────────────────────────
      { endpoint: "POST /api/transform/csv", price: "$0.002 USDC", description: "CSV to JSON conversion", category: "transform" },
      { endpoint: "POST /api/transform/json-to-csv", price: "$0.002 USDC", description: "JSON array to CSV", category: "transform" },
      { endpoint: "POST /api/transform/xml", price: "$0.002 USDC", description: "XML to JSON conversion", category: "transform" },
      { endpoint: "POST /api/transform/yaml", price: "$0.002 USDC", description: "YAML to JSON conversion", category: "transform" },

      // ── Date & Time ─────────────────────────────────
      { endpoint: "GET /api/datetime/between?from=...&to=...", price: "$0.001 USDC", description: "Duration between dates", category: "datetime" },
      { endpoint: "GET /api/datetime/business-days?from=...&to=...", price: "$0.001 USDC", description: "Business days calculator", category: "datetime" },
      { endpoint: "GET /api/datetime/unix?timestamp=...", price: "$0.001 USDC", description: "Unix timestamp converter", category: "datetime" },

      // ── Security & Recon ────────────────────────────
      { endpoint: "GET /api/security/headers?url=...", price: "$0.003 USDC", description: "Security headers audit (A+ to F grade)", category: "security" },
      { endpoint: "GET /api/security/techstack?url=...", price: "$0.005 USDC", description: "Technology stack detection", category: "security" },
      { endpoint: "GET /api/security/uptime?url=...", price: "$0.001 USDC", description: "URL uptime check with response time", category: "security" },

      // ── Math & Calculation ──────────────────────────
      { endpoint: "POST /api/math/eval", price: "$0.001 USDC", description: "Math expression evaluator", category: "math" },
      { endpoint: "GET /api/math/convert?value=...&from=...&to=...", price: "$0.001 USDC", description: "Unit converter (length, weight, temp, etc)", category: "math" },
      { endpoint: "POST /api/math/stats", price: "$0.002 USDC", description: "Statistical analysis (mean, median, std dev)", category: "math" },
    ],
    chain: "base",
    protocol_version: "x402-v1",
  });
});

// ═══════════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════════
if (!process.env.SELLER_WALLET) {
  log.error("SELLER_WALLET environment variable required. Usage: SELLER_WALLET=0x... npx tsx server.ts");
  process.exit(1);
}

const server = app.listen(PORT, () => {
  log.info("API Toll seller-api started", {
    port: PORT,
    paidEndpoints: 75,
    freeEndpoints: ["GET /health", "GET /api/tools"],
    sellerWallet: process.env.SELLER_WALLET,
    facilitatorUrl: FACILITATOR_URL,
  });
});

// ═══════════════════════════════════════════════════
// Graceful Shutdown
// ═══════════════════════════════════════════════════

const SHUTDOWN_TIMEOUT_MS = 15_000; // 15s for in-flight requests to finish

function gracefulShutdown(signal: string) {
  log.info(`Shutting down gracefully…`, { signal });

  server.close(() => {
    log.info("All connections drained. Exiting.");
    process.exit(0);
  });

  // Force exit if connections don't drain in time
  setTimeout(() => {
    log.error("Forced exit — shutdown timeout exceeded.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ═══════════════════════════════════════════════════
// Global Error Handlers
// ═══════════════════════════════════════════════════

process.on("unhandledRejection", (reason) => {
  log.error("Unhandled promise rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on("uncaughtException", (error) => {
  log.error("Uncaught exception — shutting down", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

export default app;
