/**
 * Seed Marketplace — Register all 75 seller-api tools in the Convex tools table
 *
 * Usage:
 *   npx tsx scripts/seed-marketplace.ts https://your-seller-api.railway.app
 *
 * This calls the Convex `tools.registerPublic` mutation directly for each tool.
 * Tools start as unverified but are immediately discoverable by agents.
 */

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error("CONVEX_URL environment variable is required");
  process.exit(1);
}
const SELLER_WALLET = process.env.SELLER_WALLET || "0x2955B6a41a2d10A5cC5C8A4a144829502a73B0a5";

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error("Usage: npx tsx scripts/seed-marketplace.ts <BASE_URL>");
  console.error("Example: npx tsx scripts/seed-marketplace.ts https://api.apitoll.com");
  process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);
const registerPublic = makeFunctionReference<"mutation">("tools:registerPublic");

interface ToolDef {
  name: string;
  description: string;
  method: string;
  path: string;
  price: number;
  category: string;
}

const TOOLS: ToolDef[] = [
  { name: "Programming Jokes", description: "Random programming and developer jokes. A fun micro-tool for AI agents to lighten conversations.", method: "GET", path: "/api/joke", price: 0.001, category: "data" },
  { name: "Web Search", description: "Search the web with structured JSON results — titles, snippets, URLs. Powered by DuckDuckGo + Brave Search.", method: "GET", path: "/api/search", price: 0.003, category: "data" },
  { name: "URL Scraper", description: "Convert any URL to clean Markdown content. Extracts article text, metadata, author info. Ideal for AI agents reading web pages.", method: "POST", path: "/api/scrape", price: 0.002, category: "data" },
  { name: "Crypto Prices", description: "Live cryptocurrency prices from CoinGecko — supports any coin ID. Returns USD price, 24h change, market cap, volume.", method: "GET", path: "/api/crypto/price", price: 0.001, category: "finance" },
  { name: "Trending Crypto", description: "Trending tokens and top DeFi protocols. CoinGecko trending coins + DeFi Llama top protocols by TVL.", method: "GET", path: "/api/crypto/trending", price: 0.001, category: "finance" },
  { name: "News Feed", description: "Latest news from major sources — Reuters, BBC, TechCrunch, CoinDesk, and more. Filter by category: general, technology, crypto, business, science.", method: "GET", path: "/api/news", price: 0.001, category: "data" },
  { name: "Agent Reputation", description: "Look up any AI agent's trust score (0-100) and activity profile. Based on transaction history, endpoint diversity, and recency.", method: "GET", path: "/api/reputation/agent/:agentId", price: 0.001, category: "ai" },
  { name: "Trending APIs", description: "Discover trending APIs ranked by agent activity, discovery count, and transaction volume. Network-wide stats included.", method: "GET", path: "/api/reputation/trending", price: 0.001, category: "ai" },
  { name: "Geocoding", description: "Forward geocoding — convert any address or place name to latitude/longitude coordinates. Powered by OpenStreetMap.", method: "GET", path: "/api/geocode", price: 0.001, category: "data" },
  { name: "Reverse Geocode", description: "Reverse geocoding — convert latitude/longitude coordinates to a human-readable address. Street, city, country, postal code.", method: "GET", path: "/api/geocode/reverse", price: 0.001, category: "data" },

  { name: "Weather", description: "Current weather by city or coordinates. Temperature, humidity, wind speed, conditions. Powered by Open-Meteo.", method: "GET", path: "/api/weather", price: 0.001, category: "data" },
  { name: "IP Geolocation", description: "IP address geolocation lookup — country, region, city, ISP, coordinates. Works with IPv4 and IPv6.", method: "GET", path: "/api/ip", price: 0.001, category: "data" },
  { name: "Timezone", description: "Timezone info by coordinates or zone name. Current time, UTC offset, DST status.", method: "GET", path: "/api/timezone", price: 0.001, category: "data" },
  { name: "Currency Rates", description: "Currency exchange rates from ECB/Frankfurter. 30+ currencies with daily updates.", method: "GET", path: "/api/currency", price: 0.002, category: "finance" },
  { name: "Country Info", description: "Country information — population, capital, currencies, languages, region, flag.", method: "GET", path: "/api/country", price: 0.001, category: "data" },
  { name: "Company Lookup", description: "Corporate entity lookup via OpenCorporates. Company name, jurisdiction, status, registration number.", method: "GET", path: "/api/company", price: 0.005, category: "data" },
  { name: "WHOIS Lookup", description: "Domain WHOIS/RDAP registration data — registrar, creation date, expiry, nameservers.", method: "GET", path: "/api/whois", price: 0.002, category: "data" },
  { name: "DNS Lookup", description: "DNS record lookup — A, AAAA, MX, TXT, NS, CNAME records for any domain.", method: "GET", path: "/api/dns", price: 0.001, category: "data" },
  { name: "Domain Profile", description: "Full domain profile — DNS + WHOIS combined in one call. Complete domain intelligence.", method: "GET", path: "/api/domain", price: 0.003, category: "data" },
  { name: "Public Holidays", description: "Public holidays by country and year. Powered by Nager.Date API.", method: "GET", path: "/api/holidays", price: 0.001, category: "data" },

  { name: "Sentiment Analysis", description: "Sentiment analysis with AFINN lexicon scoring. Returns score, comparative, positive/negative tokens.", method: "POST", path: "/api/sentiment", price: 0.002, category: "ai" },
  { name: "Text Summarizer", description: "Extractive text summarization — condense long text into key sentences. Configurable length.", method: "POST", path: "/api/summarize", price: 0.003, category: "ai" },
  { name: "Keyword Extraction", description: "Keyword and keyphrase extraction from text using frequency-based analysis.", method: "POST", path: "/api/keywords", price: 0.002, category: "ai" },
  { name: "Readability Score", description: "Readability scoring — Flesch-Kincaid, grade level, reading time, word count.", method: "POST", path: "/api/readability", price: 0.001, category: "ai" },
  { name: "Language Detection", description: "Language detection via trigram analysis. Identifies 50+ languages from text samples.", method: "GET", path: "/api/language", price: 0.001, category: "ai" },
  { name: "Text Translation", description: "Text translation between 30+ languages. Powered by LibreTranslate.", method: "POST", path: "/api/translate", price: 0.003, category: "ai" },
  { name: "Profanity Filter", description: "Profanity detection and filtering. Returns clean text with offensive words masked.", method: "POST", path: "/api/profanity", price: 0.001, category: "ai" },

  { name: "URL Meta Tags", description: "Extract OpenGraph, Twitter Card, and standard meta tags from any URL.", method: "GET", path: "/api/meta", price: 0.002, category: "data" },
  { name: "Screenshot", description: "Capture a screenshot of any URL. Returns image URL via free screenshot service.", method: "GET", path: "/api/screenshot", price: 0.01, category: "data" },
  { name: "Link Extractor", description: "Extract all links from a URL — internal, external, with anchor text and status.", method: "GET", path: "/api/links", price: 0.002, category: "data" },
  { name: "Sitemap Parser", description: "Parse sitemap.xml from any domain. Returns all URLs with last modified dates.", method: "GET", path: "/api/sitemap", price: 0.002, category: "data" },
  { name: "Robots.txt Parser", description: "Parse robots.txt rules from any domain. Shows allowed/disallowed paths per user-agent.", method: "GET", path: "/api/robots", price: 0.001, category: "data" },
  { name: "HTTP Headers", description: "HTTP response headers analysis — security headers check, server info, caching directives.", method: "GET", path: "/api/headers", price: 0.001, category: "data" },
  { name: "SSL Certificate", description: "SSL/TLS certificate info — issuer, expiry, protocol version, cipher suite.", method: "GET", path: "/api/ssl", price: 0.002, category: "data" },

  { name: "Hash Generator", description: "Hash generation — MD5, SHA1, SHA256, SHA512. Compute secure hashes for any input string.", method: "POST", path: "/api/hash", price: 0.001, category: "compute" },
  { name: "JWT Decoder", description: "JWT token decode — extract header and payload without verification. Debug auth tokens.", method: "POST", path: "/api/jwt/decode", price: 0.001, category: "compute" },
  { name: "Regex Tester", description: "Regex test, match, and replace operations. Full JavaScript regex support with flags.", method: "POST", path: "/api/regex", price: 0.002, category: "compute" },
  { name: "Cron Parser", description: "Cron expression parser — get the next N scheduled execution times for any cron expression.", method: "POST", path: "/api/cron", price: 0.001, category: "compute" },
  { name: "Text Diff", description: "Text diff — compare two strings with unified output. Shows additions, deletions, changes.", method: "POST", path: "/api/diff", price: 0.002, category: "compute" },
  { name: "JSON Validator", description: "JSON schema validation — validate any JSON data against a JSON Schema.", method: "POST", path: "/api/json/validate", price: 0.001, category: "compute" },
  { name: "Base64 Codec", description: "Base64 encode/decode — convert strings to/from Base64 encoding.", method: "POST", path: "/api/base64", price: 0.001, category: "compute" },
  { name: "UUID Generator", description: "UUID generation — v4 (random) and v7 (timestamp-sortable). Generate 1 or multiple UUIDs.", method: "POST", path: "/api/uuid", price: 0.001, category: "compute" },
  { name: "Markdown to HTML", description: "Markdown to HTML conversion with word count, heading extraction, and reading time stats.", method: "POST", path: "/api/markdown", price: 0.002, category: "compute" },

  { name: "QR Code Generator", description: "QR code generation — returns SVG or data URL. Encode any text, URL, or data.", method: "GET", path: "/api/qr", price: 0.002, category: "data" },
  { name: "Placeholder Image", description: "Placeholder image generation — SVG with custom width, height, and colors.", method: "GET", path: "/api/placeholder", price: 0.001, category: "data" },
  { name: "Color Info", description: "Color information — hex to RGB, HSL, named color, contrast ratios against black/white.", method: "GET", path: "/api/color", price: 0.001, category: "data" },
  { name: "Favicon Extractor", description: "Extract favicon from any domain. Returns the best available icon URL.", method: "GET", path: "/api/favicon", price: 0.001, category: "data" },
  { name: "Avatar Generator", description: "Deterministic identicon avatar from any string. Unique visual identity for usernames.", method: "GET", path: "/api/avatar", price: 0.001, category: "data" },

  { name: "ENS Resolver", description: "ENS name resolution — resolve .eth names to Ethereum addresses and reverse lookup.", method: "GET", path: "/api/ens", price: 0.002, category: "finance" },

  { name: "Domain Enrichment", description: "Domain/company enrichment — tech stack detection, social links, DNS records combined.", method: "GET", path: "/api/enrich/domain", price: 0.02, category: "data" },
  { name: "GitHub Profile", description: "GitHub user profile enrichment — bio, stats, top repos by stars, contribution data.", method: "GET", path: "/api/enrich/github", price: 0.01, category: "data" },
  { name: "Wikipedia Summary", description: "Wikipedia summary for any topic. Returns extract, thumbnail, page URL.", method: "GET", path: "/api/enrich/wiki", price: 0.005, category: "data" },

  { name: "Send Email", description: "Send email via Resend or SMTP. Supports HTML body, up to 10 recipients per call.", method: "POST", path: "/api/email/send", price: 0.003, category: "communication" },
  { name: "Email Validator", description: "Validate email addresses — syntax check, MX record verification, disposable domain detection.", method: "POST", path: "/api/email/validate", price: 0.002, category: "communication" },

  { name: "PDF Extractor", description: "Extract text from PDF documents — URL or base64 input, up to 100 pages.", method: "POST", path: "/api/extract/pdf", price: 0.01, category: "data" },
  { name: "Text Extractor", description: "Extract clean text from HTML content or any URL. Strips tags, scripts, styles.", method: "POST", path: "/api/extract/text", price: 0.002, category: "data" },

  { name: "Stock Quote", description: "Real-time stock quote — price, change, volume, market cap. Multi-symbol supported.", method: "GET", path: "/api/finance/quote", price: 0.002, category: "finance" },
  { name: "Price History", description: "Historical OHLCV candles — 1 month to 5 year range. Daily candlestick data for any ticker.", method: "GET", path: "/api/finance/history", price: 0.005, category: "finance" },
  { name: "Forex Rates", description: "150+ currency exchange rates — real-time forex data from multiple sources.", method: "GET", path: "/api/finance/forex", price: 0.001, category: "finance" },
  { name: "Currency Converter", description: "Currency conversion with live rates — specify amount, from/to currencies.", method: "GET", path: "/api/finance/convert", price: 0.001, category: "finance" },

  { name: "Entity Extraction", description: "Named entity extraction — emails, URLs, dates, phone numbers, crypto addresses, and more.", method: "POST", path: "/api/entities", price: 0.002, category: "ai" },
  { name: "Text Similarity", description: "Text similarity scoring — Jaccard and cosine similarity between two text inputs.", method: "POST", path: "/api/similarity", price: 0.002, category: "ai" },

  { name: "CSV to JSON", description: "CSV to JSON conversion with automatic header detection and type inference.", method: "POST", path: "/api/transform/csv", price: 0.002, category: "compute" },
  { name: "JSON to CSV", description: "JSON array to CSV conversion — flatten objects into tabular format.", method: "POST", path: "/api/transform/json-to-csv", price: 0.002, category: "compute" },
  { name: "XML to JSON", description: "XML to JSON conversion — parse XML documents into structured JSON.", method: "POST", path: "/api/transform/xml", price: 0.002, category: "compute" },
  { name: "YAML to JSON", description: "YAML to JSON conversion — parse YAML documents into JSON format.", method: "POST", path: "/api/transform/yaml", price: 0.002, category: "compute" },

  { name: "Date Duration", description: "Calculate duration between two dates — days, weeks, months, years, hours, minutes.", method: "GET", path: "/api/datetime/between", price: 0.001, category: "compute" },
  { name: "Business Days", description: "Business days calculator — count business days or add N business days to a date.", method: "GET", path: "/api/datetime/business-days", price: 0.001, category: "compute" },
  { name: "Unix Timestamp", description: "Unix timestamp converter — convert to/from ISO dates, milliseconds, human-readable.", method: "GET", path: "/api/datetime/unix", price: 0.001, category: "compute" },

  { name: "Security Audit", description: "Security headers audit with A+ to F grade. Checks CSP, HSTS, X-Frame-Options, and more.", method: "GET", path: "/api/security/headers", price: 0.003, category: "data" },
  { name: "Tech Stack Detect", description: "Technology stack detection — frameworks, CMS, analytics, CDN, hosting for any URL.", method: "GET", path: "/api/security/techstack", price: 0.005, category: "data" },
  { name: "Uptime Check", description: "URL uptime/health check — response time, status code, SSL validity, redirect chain.", method: "GET", path: "/api/security/uptime", price: 0.001, category: "data" },

  { name: "Math Evaluator", description: "Safe math expression evaluator — supports sqrt, trig, log, constants (pi, e), and more.", method: "POST", path: "/api/math/eval", price: 0.001, category: "compute" },
  { name: "Unit Converter", description: "Unit converter — length, weight, temperature, data, time, speed. 100+ unit combinations.", method: "GET", path: "/api/math/convert", price: 0.001, category: "compute" },
  { name: "Statistics", description: "Statistical analysis — mean, median, mode, std deviation, variance, percentiles, quartiles.", method: "POST", path: "/api/math/stats", price: 0.002, category: "compute" },
];

async function seed() {
  console.log(`\nSeeding marketplace with ${TOOLS.length} tools...`);
  console.log(`  Convex:  ${CONVEX_URL}`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Wallet:  ${SELLER_WALLET}\n`);

  let registered = 0;
  let skipped = 0;
  let failed = 0;

  for (const tool of TOOLS) {
    try {
      const result = await convex.mutation(registerPublic, {
        name: tool.name,
        description: tool.description,
        baseUrl: baseUrl,
        method: tool.method,
        path: tool.path,
        price: tool.price,
        category: tool.category,
        chains: ["base"],
        walletAddress: SELLER_WALLET,
        referralCode: "apitoll-tools",
      });

      if (result.status === "already_registered") {
        console.log(`  ⏭  ${tool.name} — already registered (${result.slug})`);
        skipped++;
      } else {
        console.log(`  ✅ ${tool.name} — registered (${result.slug})`);
        registered++;
      }
    } catch (err) {
      console.error(`  ❌ ${tool.name} — failed: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone! ${registered} registered, ${skipped} already existed, ${failed} failed.\n`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
