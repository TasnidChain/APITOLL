/**
 * OpenAPI 3.0.3 specification for API Toll seller-api.
 *
 * Auto-generated from the paymentMiddleware endpoint config in server.ts.
 * Serves both the raw JSON spec and a Swagger UI HTML page.
 */
import { Router } from "express";

const router = Router();

// ═══════════════════════════════════════════════════
// Endpoint definitions — single source of truth
// ═══════════════════════════════════════════════════
// Keep in sync with server.ts paymentMiddleware config

interface EndpointDef {
  method: "get" | "post";
  path: string;
  price: string;
  description: string;
  category: string;
  params?: Array<{
    name: string;
    in: "query" | "path";
    description: string;
    required: boolean;
    schema: { type: string; example?: string };
  }>;
  requestBody?: {
    description: string;
    properties: Record<string, { type: string; description: string; example?: unknown }>;
    required?: string[];
  };
}

const ENDPOINTS: EndpointDef[] = [
  // ── Original ──────────────────────────────────
  { method: "get", path: "/api/joke", price: "0.001", description: "Get a random programming joke", category: "Original" },
  { method: "get", path: "/api/search", price: "0.003", description: "Web search — structured results with title, snippet, URL", category: "Original", params: [{ name: "q", in: "query", description: "Search query", required: true, schema: { type: "string", example: "machine learning" } }] },
  { method: "post", path: "/api/scrape", price: "0.002", description: "Convert any URL to clean Markdown content", category: "Original", requestBody: { description: "URL to scrape", properties: { url: { type: "string", description: "URL to convert", example: "https://example.com" } }, required: ["url"] } },
  { method: "get", path: "/api/crypto/price", price: "0.001", description: "Live crypto/token prices from CoinGecko", category: "Original", params: [{ name: "ids", in: "query", description: "Comma-separated CoinGecko IDs", required: true, schema: { type: "string", example: "bitcoin,ethereum" } }] },
  { method: "get", path: "/api/crypto/trending", price: "0.001", description: "Trending tokens and DeFi protocol data", category: "Original" },
  { method: "get", path: "/api/news", price: "0.001", description: "Latest news — tech, crypto, business, science", category: "Original", params: [{ name: "category", in: "query", description: "News category", required: false, schema: { type: "string", example: "tech" } }] },
  { method: "get", path: "/api/reputation/agent/{agentId}", price: "0.001", description: "Agent trust score and activity profile", category: "Original", params: [{ name: "agentId", in: "path", description: "Agent identifier", required: true, schema: { type: "string" } }] },
  { method: "get", path: "/api/reputation/trending", price: "0.001", description: "Trending APIs ranked by agent activity", category: "Original" },
  { method: "get", path: "/api/geocode", price: "0.001", description: "Forward geocoding — address to coordinates", category: "Original", params: [{ name: "q", in: "query", description: "Address or place name", required: true, schema: { type: "string", example: "San Francisco" } }] },
  { method: "get", path: "/api/geocode/reverse", price: "0.001", description: "Reverse geocoding — coordinates to address", category: "Original", params: [{ name: "lat", in: "query", description: "Latitude", required: true, schema: { type: "string", example: "37.7749" } }, { name: "lon", in: "query", description: "Longitude", required: true, schema: { type: "string", example: "-122.4194" } }] },

  // ── Data & Lookup ─────────────────────────────
  { method: "get", path: "/api/weather", price: "0.001", description: "Current weather by city or coordinates (Open-Meteo)", category: "Data & Lookup", params: [{ name: "city", in: "query", description: "City name", required: false, schema: { type: "string", example: "London" } }, { name: "lat", in: "query", description: "Latitude (alt to city)", required: false, schema: { type: "string" } }, { name: "lon", in: "query", description: "Longitude (alt to city)", required: false, schema: { type: "string" } }] },
  { method: "get", path: "/api/ip", price: "0.001", description: "IP geolocation lookup (ip-api.com)", category: "Data & Lookup", params: [{ name: "ip", in: "query", description: "IP address to look up", required: false, schema: { type: "string", example: "8.8.8.8" } }] },
  { method: "get", path: "/api/timezone", price: "0.001", description: "Timezone info by coordinates or zone name", category: "Data & Lookup", params: [{ name: "lat", in: "query", description: "Latitude", required: false, schema: { type: "string" } }, { name: "lon", in: "query", description: "Longitude", required: false, schema: { type: "string" } }] },
  { method: "get", path: "/api/currency", price: "0.002", description: "Currency exchange rates (ECB/Frankfurter)", category: "Data & Lookup", params: [{ name: "from", in: "query", description: "Base currency code", required: false, schema: { type: "string", example: "USD" } }, { name: "to", in: "query", description: "Target currency code(s)", required: false, schema: { type: "string", example: "EUR,GBP" } }] },
  { method: "get", path: "/api/country", price: "0.001", description: "Country info — population, capital, currencies, languages", category: "Data & Lookup", params: [{ name: "name", in: "query", description: "Country name", required: true, schema: { type: "string", example: "Japan" } }] },
  { method: "get", path: "/api/company", price: "0.005", description: "Company/corporate entity lookup (OpenCorporates)", category: "Data & Lookup", params: [{ name: "q", in: "query", description: "Company name", required: true, schema: { type: "string", example: "Stripe" } }] },
  { method: "get", path: "/api/whois", price: "0.002", description: "Domain WHOIS/RDAP registration data", category: "Data & Lookup", params: [{ name: "domain", in: "query", description: "Domain name", required: true, schema: { type: "string", example: "example.com" } }] },
  { method: "get", path: "/api/dns", price: "0.001", description: "DNS record lookup (A, AAAA, MX, TXT, NS, CNAME)", category: "Data & Lookup", params: [{ name: "domain", in: "query", description: "Domain name", required: true, schema: { type: "string", example: "example.com" } }] },
  { method: "get", path: "/api/domain", price: "0.003", description: "Full domain profile — DNS + WHOIS combined", category: "Data & Lookup", params: [{ name: "domain", in: "query", description: "Domain name", required: true, schema: { type: "string", example: "example.com" } }] },
  { method: "get", path: "/api/holidays", price: "0.001", description: "Public holidays by country and year (Nager.Date)", category: "Data & Lookup", params: [{ name: "country", in: "query", description: "ISO 3166-1 alpha-2 country code", required: true, schema: { type: "string", example: "US" } }, { name: "year", in: "query", description: "Year", required: false, schema: { type: "string", example: "2025" } }] },

  // ── Text Processing ───────────────────────────
  { method: "post", path: "/api/sentiment", price: "0.002", description: "Sentiment analysis with AFINN lexicon scoring", category: "Text Processing", requestBody: { description: "Text to analyze", properties: { text: { type: "string", description: "Text content", example: "I love this product!" } }, required: ["text"] } },
  { method: "post", path: "/api/summarize", price: "0.003", description: "Extractive text summarization", category: "Text Processing", requestBody: { description: "Text to summarize", properties: { text: { type: "string", description: "Text content" }, sentences: { type: "number", description: "Number of summary sentences", example: 3 } }, required: ["text"] } },
  { method: "post", path: "/api/keywords", price: "0.002", description: "Keyword/keyphrase extraction (frequency-based)", category: "Text Processing", requestBody: { description: "Text to extract keywords from", properties: { text: { type: "string", description: "Text content" } }, required: ["text"] } },
  { method: "post", path: "/api/readability", price: "0.001", description: "Readability scoring (Flesch-Kincaid, grade level)", category: "Text Processing", requestBody: { description: "Text to score", properties: { text: { type: "string", description: "Text content" } }, required: ["text"] } },
  { method: "get", path: "/api/language", price: "0.001", description: "Language detection via trigram analysis", category: "Text Processing", params: [{ name: "text", in: "query", description: "Text to detect language of", required: true, schema: { type: "string", example: "Bonjour le monde" } }] },
  { method: "post", path: "/api/translate", price: "0.003", description: "Text translation (LibreTranslate)", category: "Text Processing", requestBody: { description: "Translation request", properties: { text: { type: "string", description: "Text to translate" }, source: { type: "string", description: "Source language code", example: "en" }, target: { type: "string", description: "Target language code", example: "es" } }, required: ["text", "target"] } },
  { method: "post", path: "/api/profanity", price: "0.001", description: "Profanity detection and filtering", category: "Text Processing", requestBody: { description: "Text to check", properties: { text: { type: "string", description: "Text content" } }, required: ["text"] } },

  // ── Web & URL Utilities ───────────────────────
  { method: "get", path: "/api/meta", price: "0.002", description: "URL meta tag extraction (OpenGraph, Twitter Cards)", category: "Web & URL", params: [{ name: "url", in: "query", description: "URL to extract meta from", required: true, schema: { type: "string", example: "https://github.com" } }] },
  { method: "get", path: "/api/screenshot", price: "0.01", description: "URL screenshot via free screenshot service", category: "Web & URL", params: [{ name: "url", in: "query", description: "URL to screenshot", required: true, schema: { type: "string" } }] },
  { method: "get", path: "/api/links", price: "0.002", description: "Extract all links from a URL", category: "Web & URL", params: [{ name: "url", in: "query", description: "URL to extract links from", required: true, schema: { type: "string" } }] },
  { method: "get", path: "/api/sitemap", price: "0.002", description: "Parse sitemap.xml from any domain", category: "Web & URL", params: [{ name: "domain", in: "query", description: "Domain to fetch sitemap from", required: true, schema: { type: "string", example: "example.com" } }] },
  { method: "get", path: "/api/robots", price: "0.001", description: "Parse robots.txt rules from any domain", category: "Web & URL", params: [{ name: "domain", in: "query", description: "Domain to fetch robots.txt from", required: true, schema: { type: "string", example: "example.com" } }] },
  { method: "get", path: "/api/headers", price: "0.001", description: "HTTP response headers + security header analysis", category: "Web & URL", params: [{ name: "url", in: "query", description: "URL to check headers", required: true, schema: { type: "string" } }] },
  { method: "get", path: "/api/ssl", price: "0.002", description: "SSL/TLS certificate info for any domain", category: "Web & URL", params: [{ name: "domain", in: "query", description: "Domain to check SSL", required: true, schema: { type: "string", example: "github.com" } }] },

  // ── Compute & Dev Tools ───────────────────────
  { method: "post", path: "/api/hash", price: "0.001", description: "Hash generation (MD5, SHA1, SHA256, SHA512)", category: "Compute & Dev", requestBody: { description: "Data to hash", properties: { data: { type: "string", description: "Input string" }, algorithm: { type: "string", description: "Hash algorithm", example: "sha256" } }, required: ["data"] } },
  { method: "post", path: "/api/jwt/decode", price: "0.001", description: "JWT token decode (header + payload, no verification)", category: "Compute & Dev", requestBody: { description: "JWT to decode", properties: { token: { type: "string", description: "JWT token string" } }, required: ["token"] } },
  { method: "post", path: "/api/regex", price: "0.002", description: "Regex test, match, and replace", category: "Compute & Dev", requestBody: { description: "Regex operation", properties: { pattern: { type: "string", description: "Regular expression" }, text: { type: "string", description: "Text to test against" }, flags: { type: "string", description: "Regex flags", example: "gi" } }, required: ["pattern", "text"] } },
  { method: "post", path: "/api/cron", price: "0.001", description: "Cron expression parser — next N scheduled runs", category: "Compute & Dev", requestBody: { description: "Cron expression", properties: { expression: { type: "string", description: "Cron expression", example: "0 9 * * 1-5" }, count: { type: "number", description: "Number of next runs", example: 5 } }, required: ["expression"] } },
  { method: "post", path: "/api/diff", price: "0.002", description: "Text diff — compare two strings with unified output", category: "Compute & Dev", requestBody: { description: "Diff inputs", properties: { a: { type: "string", description: "Original text" }, b: { type: "string", description: "Modified text" } }, required: ["a", "b"] } },
  { method: "post", path: "/api/json/validate", price: "0.001", description: "JSON schema validation", category: "Compute & Dev", requestBody: { description: "Schema and data", properties: { schema: { type: "object", description: "JSON schema" }, data: { type: "object", description: "Data to validate" } }, required: ["schema", "data"] } },
  { method: "post", path: "/api/base64", price: "0.001", description: "Base64 encode/decode", category: "Compute & Dev", requestBody: { description: "Encode or decode", properties: { data: { type: "string", description: "Input string" }, action: { type: "string", description: "'encode' or 'decode'", example: "encode" } }, required: ["data"] } },
  { method: "post", path: "/api/uuid", price: "0.001", description: "UUID generation (v4 random, v7 timestamp-sortable)", category: "Compute & Dev", requestBody: { description: "UUID options", properties: { version: { type: "string", description: "UUID version: 'v4' or 'v7'", example: "v4" }, count: { type: "number", description: "Number of UUIDs", example: 1 } } } },
  { method: "post", path: "/api/markdown", price: "0.002", description: "Markdown to HTML conversion with stats", category: "Compute & Dev", requestBody: { description: "Markdown content", properties: { markdown: { type: "string", description: "Markdown source" } }, required: ["markdown"] } },

  // ── Media & Visual ────────────────────────────
  { method: "get", path: "/api/qr", price: "0.002", description: "QR code generation (SVG or data URL)", category: "Media & Visual", params: [{ name: "data", in: "query", description: "Data to encode", required: true, schema: { type: "string", example: "https://apitoll.com" } }] },
  { method: "get", path: "/api/placeholder", price: "0.001", description: "Placeholder image generation (SVG)", category: "Media & Visual", params: [{ name: "width", in: "query", description: "Width in pixels", required: false, schema: { type: "string", example: "400" } }, { name: "height", in: "query", description: "Height in pixels", required: false, schema: { type: "string", example: "300" } }] },
  { method: "get", path: "/api/color", price: "0.001", description: "Color info — hex to RGB, HSL, name, contrast ratios", category: "Media & Visual", params: [{ name: "hex", in: "query", description: "Hex color code", required: true, schema: { type: "string", example: "FF5733" } }] },
  { method: "get", path: "/api/favicon", price: "0.001", description: "Favicon extraction from any domain", category: "Media & Visual", params: [{ name: "domain", in: "query", description: "Domain to extract favicon from", required: true, schema: { type: "string", example: "github.com" } }] },
  { method: "get", path: "/api/avatar", price: "0.001", description: "Deterministic identicon avatar from any string", category: "Media & Visual", params: [{ name: "input", in: "query", description: "Seed string for avatar", required: true, schema: { type: "string", example: "alice" } }] },

  // ── Blockchain ────────────────────────────────
  { method: "get", path: "/api/ens", price: "0.002", description: "ENS name resolution (name ↔ address)", category: "Blockchain", params: [{ name: "name", in: "query", description: "ENS name or Ethereum address", required: true, schema: { type: "string", example: "vitalik.eth" } }] },

  // ── Data Enrichment ───────────────────────────
  { method: "get", path: "/api/enrich/domain", price: "0.020", description: "Domain/company enrichment — tech stack, social links, DNS", category: "Enrichment", params: [{ name: "domain", in: "query", description: "Domain to enrich", required: true, schema: { type: "string", example: "stripe.com" } }] },
  { method: "get", path: "/api/enrich/github", price: "0.010", description: "GitHub user profile + top repos by stars", category: "Enrichment", params: [{ name: "username", in: "query", description: "GitHub username", required: true, schema: { type: "string", example: "torvalds" } }] },
  { method: "get", path: "/api/enrich/wiki", price: "0.005", description: "Wikipedia summary for any topic", category: "Enrichment", params: [{ name: "q", in: "query", description: "Search query", required: true, schema: { type: "string", example: "Ethereum" } }] },

  // ── Email ─────────────────────────────────────
  { method: "post", path: "/api/email/send", price: "0.003", description: "Send email via Resend or SMTP (max 10 recipients)", category: "Email", requestBody: { description: "Email to send", properties: { to: { type: "string", description: "Recipient email" }, subject: { type: "string", description: "Email subject" }, body: { type: "string", description: "Email body (text or HTML)" } }, required: ["to", "subject", "body"] } },
  { method: "post", path: "/api/email/validate", price: "0.002", description: "Validate email addresses with MX record check", category: "Email", requestBody: { description: "Email to validate", properties: { email: { type: "string", description: "Email address to validate" } }, required: ["email"] } },

  // ── Document Extraction ───────────────────────
  { method: "post", path: "/api/extract/pdf", price: "0.010", description: "Extract text from PDF (URL or base64, up to 100 pages)", category: "Documents", requestBody: { description: "PDF source", properties: { url: { type: "string", description: "URL of PDF" }, base64: { type: "string", description: "Base64-encoded PDF (alternative to URL)" } } } },
  { method: "post", path: "/api/extract/text", price: "0.002", description: "Extract clean text from HTML content or URL", category: "Documents", requestBody: { description: "HTML source", properties: { url: { type: "string", description: "URL to extract text from" }, html: { type: "string", description: "Raw HTML (alternative to URL)" } } } },

  // ── Finance ───────────────────────────────────
  { method: "get", path: "/api/finance/quote", price: "0.002", description: "Real-time stock quote (multi-symbol supported)", category: "Finance", params: [{ name: "symbol", in: "query", description: "Stock ticker symbol(s)", required: true, schema: { type: "string", example: "AAPL,MSFT" } }] },
  { method: "get", path: "/api/finance/history", price: "0.005", description: "Historical OHLCV candles (1m to 5y range)", category: "Finance", params: [{ name: "symbol", in: "query", description: "Stock ticker", required: true, schema: { type: "string", example: "AAPL" } }, { name: "range", in: "query", description: "Time range (1m, 3m, 6m, 1y, 5y)", required: false, schema: { type: "string", example: "3m" } }] },
  { method: "get", path: "/api/finance/forex", price: "0.001", description: "150+ currency exchange rates", category: "Finance", params: [{ name: "base", in: "query", description: "Base currency", required: false, schema: { type: "string", example: "USD" } }] },
  { method: "get", path: "/api/finance/convert", price: "0.001", description: "Currency conversion with live rates", category: "Finance", params: [{ name: "from", in: "query", description: "Source currency", required: true, schema: { type: "string", example: "USD" } }, { name: "to", in: "query", description: "Target currency", required: true, schema: { type: "string", example: "EUR" } }, { name: "amount", in: "query", description: "Amount to convert", required: false, schema: { type: "string", example: "100" } }] },

  // ── NLP & Text Intelligence ───────────────────
  { method: "post", path: "/api/entities", price: "0.002", description: "Named entity extraction (emails, URLs, dates, crypto addresses, etc)", category: "NLP", requestBody: { description: "Text for entity extraction", properties: { text: { type: "string", description: "Text content" } }, required: ["text"] } },
  { method: "post", path: "/api/similarity", price: "0.002", description: "Text similarity scoring (Jaccard + cosine)", category: "NLP", requestBody: { description: "Two texts to compare", properties: { a: { type: "string", description: "First text" }, b: { type: "string", description: "Second text" } }, required: ["a", "b"] } },

  // ── Data Transformation ───────────────────────
  { method: "post", path: "/api/transform/csv", price: "0.002", description: "CSV to JSON conversion with header detection", category: "Transform", requestBody: { description: "CSV data", properties: { csv: { type: "string", description: "CSV content" } }, required: ["csv"] } },
  { method: "post", path: "/api/transform/json-to-csv", price: "0.002", description: "JSON array to CSV conversion", category: "Transform", requestBody: { description: "JSON data", properties: { data: { type: "array", description: "Array of objects" } }, required: ["data"] } },
  { method: "post", path: "/api/transform/xml", price: "0.002", description: "XML to JSON conversion", category: "Transform", requestBody: { description: "XML data", properties: { xml: { type: "string", description: "XML content" } }, required: ["xml"] } },
  { method: "post", path: "/api/transform/yaml", price: "0.002", description: "YAML to JSON conversion", category: "Transform", requestBody: { description: "YAML data", properties: { yaml: { type: "string", description: "YAML content" } }, required: ["yaml"] } },

  // ── Date & Time ───────────────────────────────
  { method: "get", path: "/api/datetime/between", price: "0.001", description: "Calculate duration between two dates", category: "Date & Time", params: [{ name: "from", in: "query", description: "Start date (ISO 8601)", required: true, schema: { type: "string", example: "2024-01-01" } }, { name: "to", in: "query", description: "End date (ISO 8601)", required: true, schema: { type: "string", example: "2024-12-31" } }] },
  { method: "get", path: "/api/datetime/business-days", price: "0.001", description: "Business days calculator (count or add)", category: "Date & Time", params: [{ name: "from", in: "query", description: "Start date", required: true, schema: { type: "string", example: "2024-01-01" } }, { name: "to", in: "query", description: "End date (for counting)", required: false, schema: { type: "string" } }] },
  { method: "get", path: "/api/datetime/unix", price: "0.001", description: "Unix timestamp converter (to/from ISO dates)", category: "Date & Time", params: [{ name: "timestamp", in: "query", description: "Unix timestamp (seconds)", required: false, schema: { type: "string", example: "1704067200" } }] },

  // ── Security & Recon ──────────────────────────
  { method: "get", path: "/api/security/headers", price: "0.003", description: "Security headers audit with grade (A+ to F)", category: "Security", params: [{ name: "url", in: "query", description: "URL to audit", required: true, schema: { type: "string", example: "https://github.com" } }] },
  { method: "get", path: "/api/security/techstack", price: "0.005", description: "Technology stack detection for any URL", category: "Security", params: [{ name: "url", in: "query", description: "URL to detect tech", required: true, schema: { type: "string", example: "https://vercel.com" } }] },
  { method: "get", path: "/api/security/uptime", price: "0.001", description: "URL uptime/health check with response time", category: "Security", params: [{ name: "url", in: "query", description: "URL to check", required: true, schema: { type: "string", example: "https://api.apitoll.com" } }] },

  // ── Math & Calculation ────────────────────────
  { method: "post", path: "/api/math/eval", price: "0.001", description: "Safe math expression evaluator (sqrt, trig, etc)", category: "Math", requestBody: { description: "Math expression", properties: { expression: { type: "string", description: "Math expression to evaluate", example: "sqrt(144) + 3^2" } }, required: ["expression"] } },
  { method: "get", path: "/api/math/convert", price: "0.001", description: "Unit converter (length, weight, temp, data, time, speed)", category: "Math", params: [{ name: "value", in: "query", description: "Numeric value", required: true, schema: { type: "string", example: "100" } }, { name: "from", in: "query", description: "Source unit", required: true, schema: { type: "string", example: "km" } }, { name: "to", in: "query", description: "Target unit", required: true, schema: { type: "string", example: "mi" } }] },
  { method: "post", path: "/api/math/stats", price: "0.002", description: "Statistical analysis (mean, median, std dev, percentiles)", category: "Math", requestBody: { description: "Numeric data", properties: { data: { type: "array", description: "Array of numbers" } }, required: ["data"] } },
];

// ═══════════════════════════════════════════════════
// Build OpenAPI 3.0.3 Spec
// ═══════════════════════════════════════════════════

function buildSpec(): object {
  const categories = [...new Set(ENDPOINTS.map((e) => e.category))];
  const tags = categories.map((c) => ({ name: c }));

  const paths: Record<string, Record<string, object>> = {};

  for (const ep of ENDPOINTS) {
    const openapiPath = ep.path; // already in OpenAPI format with {param}
    if (!paths[openapiPath]) paths[openapiPath] = {};

    const parameters: object[] = [];
    if (ep.params) {
      for (const p of ep.params) {
        parameters.push({
          name: p.name,
          in: p.in,
          description: p.description,
          required: p.required,
          schema: p.schema,
        });
      }
    }

    const operation: Record<string, unknown> = {
      tags: [ep.category],
      summary: ep.description,
      description: `**Price:** $${ep.price} USDC per call\n\nPaid via x402 protocol — send USDC on Base L2.`,
      operationId: ep.path.replace(/[/{}:]/g, "_").replace(/^_/, "").replace(/_+/g, "_") + "_" + ep.method,
      responses: {
        "200": {
          description: "Successful response",
          content: { "application/json": { schema: { type: "object" } } },
        },
        "402": {
          description: "Payment Required — send USDC via x402 protocol",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: { type: "string", example: "X-PAYMENT header required" },
                  accepts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        scheme: { type: "string", example: "exact" },
                        network: { type: "string", example: "base" },
                        maxAmountRequired: { type: "string", example: ep.price },
                        resource: { type: "string" },
                        description: { type: "string" },
                        payTo: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "429": { description: "Rate limit exceeded" },
      },
    };

    if (parameters.length > 0) {
      operation.parameters = parameters;
    }

    if (ep.requestBody) {
      const props: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(ep.requestBody.properties)) {
        props[key] = { type: val.type, description: val.description };
        if (val.example !== undefined) (props[key] as Record<string, unknown>).example = val.example;
      }
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: props,
              required: ep.requestBody.required,
            },
          },
        },
      };
    }

    paths[openapiPath][ep.method] = operation;
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "API Toll — Pay-Per-Call API for AI Agents",
      description:
        "60+ paid API endpoints accessible via USDC micropayments on Base L2.\n\n" +
        "**How it works:**\n" +
        "1. Call any endpoint → get a `402 Payment Required` response with payment details\n" +
        "2. Send USDC to the facilitator via the x402 protocol\n" +
        "3. Retry with `X-PAYMENT` header containing the payment receipt\n" +
        "4. Receive data\n\n" +
        "**Pricing:** $0.001–$0.02 USDC per call depending on the endpoint.\n\n" +
        "**Dashboard:** [apitoll.com/dashboard](https://apitoll.com/dashboard)\n\n" +
        "**GitHub:** [github.com/TasnidChain/APITOLL](https://github.com/TasnidChain/APITOLL)",
      version: "1.0.0",
      contact: { name: "API Toll", url: "https://apitoll.com" },
    },
    servers: [
      { url: "https://api.apitoll.com", description: "Production" },
      { url: "http://localhost:4402", description: "Local development" },
    ],
    tags,
    paths,
    components: {
      securitySchemes: {
        x402: {
          type: "apiKey",
          in: "header",
          name: "X-PAYMENT",
          description: "x402 payment receipt (JSON-encoded). Obtained by paying USDC via the facilitator.",
        },
      },
    },
  };
}

// ═══════════════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════════════

// Raw OpenAPI JSON
router.get("/api/openapi.json", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(buildSpec());
});

// Swagger UI (served from CDN — dark-themed to match apitoll.com)
router.get("/api/docs", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>API Toll — API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg-primary: #0a0e1a;
      --bg-secondary: #111827;
      --bg-card: #1a2035;
      --bg-hover: #1e293b;
      --border: #1e293b;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent-blue: #3b82f6;
      --accent-cyan: #22d3ee;
      --accent-green: #22c55e;
      --accent-orange: #f59e0b;
      --accent-red: #ef4444;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    /* ── Header bar ─────────────────────────── */
    .docs-header {
      position: sticky; top: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      height: 64px; padding: 0 24px;
      background: rgba(10,14,26,0.85); backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .docs-header .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
    .docs-header .brand-badge {
      background: var(--accent-blue); color: #fff; font-weight: 700;
      font-size: 11px; padding: 3px 8px; border-radius: 6px;
    }
    .docs-header .brand-name { font-size: 18px; font-weight: 700; color: var(--text-primary); }
    .docs-header .nav-links { display: flex; gap: 16px; }
    .docs-header .nav-links a {
      color: var(--text-secondary); text-decoration: none; font-size: 13px;
      font-weight: 500; padding: 6px 12px; border-radius: 8px; transition: all 0.15s;
    }
    .docs-header .nav-links a:hover { background: var(--bg-hover); color: var(--text-primary); }

    /* ── Swagger UI dark theme overrides ────── */
    .swagger-ui { padding: 0 24px 48px; max-width: 1200px; margin: 0 auto; }
    .topbar { display: none !important; }

    /* Info section */
    .swagger-ui .info { margin: 32px 0 24px; }
    .swagger-ui .info hgroup.main { margin: 0; }
    .swagger-ui .info .title { font-size: 1.75em; color: var(--text-primary); font-family: 'Inter', sans-serif; }
    .swagger-ui .info .title small { background: var(--accent-blue); color: #fff; border-radius: 6px; padding: 2px 10px; font-size: 12px; vertical-align: middle; }
    .swagger-ui .info .description, .swagger-ui .info .description p { color: var(--text-secondary); font-size: 14px; line-height: 1.6; }
    .swagger-ui .info .description a { color: var(--accent-cyan); }
    .swagger-ui .info .description code { background: var(--bg-card); padding: 2px 6px; border-radius: 4px; color: var(--accent-cyan); font-size: 13px; }
    .swagger-ui .info .base-url { color: var(--text-muted); font-size: 13px; }

    /* Filter/search bar */
    .swagger-ui .filter-container { background: transparent; padding: 12px 0; margin: 0; }
    .swagger-ui .filter-container .operation-filter-input {
      background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px;
      color: var(--text-primary); padding: 10px 16px; font-size: 14px; width: 100%;
    }
    .swagger-ui .filter-container .operation-filter-input::placeholder { color: var(--text-muted); }

    /* Tags / category headers */
    .swagger-ui .opblock-tag {
      color: var(--text-primary) !important; border-bottom: 1px solid var(--border) !important;
      font-family: 'Inter', sans-serif; font-size: 16px !important; font-weight: 600 !important;
      padding: 14px 0 !important;
    }
    .swagger-ui .opblock-tag:hover { background: var(--bg-hover) !important; }
    .swagger-ui .opblock-tag svg { fill: var(--text-muted) !important; }
    .swagger-ui .opblock-tag small { color: var(--text-muted); font-size: 12px; }

    /* Endpoint blocks */
    .swagger-ui .opblock { border: 1px solid var(--border) !important; border-radius: 10px !important; margin-bottom: 8px !important; background: var(--bg-secondary) !important; box-shadow: none !important; }
    .swagger-ui .opblock .opblock-summary { padding: 8px 16px !important; border: none !important; }
    .swagger-ui .opblock .opblock-summary-method {
      border-radius: 6px !important; font-size: 12px !important; font-weight: 700 !important;
      min-width: 56px; text-align: center; padding: 6px 0 !important;
    }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #164e63 !important; color: var(--accent-cyan) !important; }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #14532d !important; color: var(--accent-green) !important; }
    .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #78350f !important; color: var(--accent-orange) !important; }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #7f1d1d !important; color: var(--accent-red) !important; }
    .swagger-ui .opblock .opblock-summary-path { color: var(--text-primary) !important; font-size: 14px !important; font-family: 'Menlo', 'Consolas', monospace; }
    .swagger-ui .opblock .opblock-summary-path__deprecated { color: var(--text-muted) !important; }
    .swagger-ui .opblock .opblock-summary-description { color: var(--text-secondary) !important; font-size: 13px !important; }
    .swagger-ui .opblock.opblock-get { border-color: #164e63 !important; }
    .swagger-ui .opblock.opblock-post { border-color: #14532d !important; }

    /* Expanded endpoint body */
    .swagger-ui .opblock-body { background: var(--bg-card) !important; }
    .swagger-ui .opblock-body pre { background: var(--bg-primary) !important; color: var(--accent-cyan) !important; border: 1px solid var(--border); border-radius: 8px; }
    .swagger-ui .opblock .opblock-section-header { background: var(--bg-card) !important; border-bottom: 1px solid var(--border) !important; box-shadow: none !important; }
    .swagger-ui .opblock .opblock-section-header h4 { color: var(--text-primary) !important; font-size: 13px !important; }

    /* Parameter table */
    .swagger-ui table thead tr th, .swagger-ui table thead tr td { color: var(--text-muted) !important; border-bottom: 1px solid var(--border) !important; font-size: 12px; }
    .swagger-ui table tbody tr td { color: var(--text-secondary) !important; border-bottom: 1px solid var(--border) !important; padding: 10px !important; }
    .swagger-ui .parameter__name { color: var(--text-primary) !important; font-family: 'Menlo', monospace; font-size: 13px !important; }
    .swagger-ui .parameter__name.required::after { color: var(--accent-red) !important; }
    .swagger-ui .parameter__type { color: var(--accent-blue) !important; font-size: 12px !important; }

    /* Inputs */
    .swagger-ui input[type=text], .swagger-ui textarea, .swagger-ui select {
      background: var(--bg-primary) !important; color: var(--text-primary) !important;
      border: 1px solid var(--border) !important; border-radius: 6px !important;
    }
    .swagger-ui select { background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%2394a3b8'%3E%3Cpath d='m4.5 6 3.5 4 3.5-4z'/%3E%3C/svg%3E") !important; }

    /* Buttons */
    .swagger-ui .btn { border-radius: 8px !important; font-weight: 600 !important; font-size: 13px !important; }
    .swagger-ui .btn.execute { background: var(--accent-blue) !important; color: #fff !important; border: none !important; }
    .swagger-ui .btn.execute:hover { background: #2563eb !important; }
    .swagger-ui .btn.cancel { background: transparent !important; color: var(--text-secondary) !important; border: 1px solid var(--border) !important; }
    .swagger-ui .try-out__btn { color: var(--accent-cyan) !important; border-color: var(--accent-cyan) !important; }
    .swagger-ui .btn.authorize { color: var(--accent-green) !important; border-color: var(--accent-green) !important; background: transparent !important; }
    .swagger-ui .btn.authorize svg { fill: var(--accent-green) !important; }

    /* Response section */
    .swagger-ui .responses-inner { padding: 12px !important; }
    .swagger-ui .responses-inner h4, .swagger-ui .responses-inner h5 { color: var(--text-primary) !important; }
    .swagger-ui .response-col_status { color: var(--text-primary) !important; font-weight: 600; }
    .swagger-ui .response-col_description { color: var(--text-secondary) !important; }
    .swagger-ui .response-col_description__inner p { color: var(--text-secondary) !important; }
    .swagger-ui .responses-table thead td { color: var(--text-muted) !important; }
    .swagger-ui .response .response-col_links { color: var(--text-muted) !important; }
    .swagger-ui .responses-header td { color: var(--text-primary) !important; }

    /* Markdown content */
    .swagger-ui .renderedMarkdown p { color: var(--text-secondary) !important; }
    .swagger-ui .renderedMarkdown a { color: var(--accent-cyan) !important; }
    .swagger-ui .renderedMarkdown code { background: var(--bg-primary); padding: 2px 5px; border-radius: 4px; color: var(--accent-cyan); }

    /* Models */
    .swagger-ui .model-box { background: var(--bg-card) !important; }
    .swagger-ui .model { color: var(--text-secondary) !important; }
    .swagger-ui .model-title { color: var(--text-primary) !important; }

    /* Auth dialog */
    .swagger-ui .dialog-ux .modal-ux { background: var(--bg-secondary) !important; border: 1px solid var(--border) !important; }
    .swagger-ui .dialog-ux .modal-ux-header { border-bottom: 1px solid var(--border) !important; }
    .swagger-ui .dialog-ux .modal-ux-header h3 { color: var(--text-primary) !important; }
    .swagger-ui .dialog-ux .modal-ux-content p { color: var(--text-secondary) !important; }
    .swagger-ui .dialog-ux .backdrop-ux { background: rgba(0,0,0,0.6) !important; }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg-primary); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    /* Links */
    .swagger-ui a { color: var(--accent-cyan) !important; }
    .swagger-ui .info a { color: var(--accent-cyan) !important; }
    .swagger-ui .opblock-description-wrapper p { color: var(--text-secondary) !important; }

    /* Loading */
    .swagger-ui .loading-container { padding: 48px; }
    .swagger-ui .loading-container .loading::after { color: var(--text-muted); }

    /* Server dropdown */
    .swagger-ui .scheme-container { background: var(--bg-secondary) !important; border: 1px solid var(--border); border-radius: 10px; padding: 16px !important; margin: 16px 0 !important; box-shadow: none !important; }
    .swagger-ui .scheme-container label { color: var(--text-secondary) !important; }

    /* Copy to clipboard */
    .swagger-ui .copy-to-clipboard { bottom: 5px; right: 5px; }
    .swagger-ui .copy-to-clipboard button { background: var(--bg-hover) !important; border: 1px solid var(--border) !important; border-radius: 6px !important; }

    /* Responsive */
    @media (max-width: 768px) {
      .docs-header .nav-links { display: none; }
      .swagger-ui { padding: 0 12px 32px; }
    }
  </style>
</head>
<body>
  <div class="docs-header">
    <a href="https://apitoll.com" class="brand">
      <span class="brand-badge">402</span>
      <span class="brand-name">API Toll</span>
    </a>
    <div class="nav-links">
      <a href="https://apitoll.com">Home</a>
      <a href="https://apitoll.com/what">What Is It?</a>
      <a href="https://apitoll.com/dashboard/discovery">Discovery</a>
      <a href="https://apitoll.com/dashboard">Dashboard</a>
      <a href="https://github.com/TasnidChain/APITOLL" target="_blank">GitHub</a>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/api/openapi.json",
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset
      ],
      layout: "BaseLayout",
      defaultModelsExpandDepth: -1,
      docExpansion: "list",
      filter: true,
      tagsSorter: "alpha",
    });
  </script>
</body>
</html>`);
});

export default router;
