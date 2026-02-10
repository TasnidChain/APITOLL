/**
 * Live Demo: AI Agent paying for real APIs on api.apitoll.com
 *
 * This script demonstrates the complete x402 payment flow against
 * the live API Toll marketplace — 60 paid endpoints, real USDC on Base.
 *
 * Run (full demo with payments):
 *   APITOLL_API_KEY=... npx tsx examples/buyer-agent/live-demo.ts
 *
 * Run (402 handshake demo, no wallet needed):
 *   npx tsx examples/buyer-agent/live-demo.ts
 *
 * What happens:
 *   1. Agent calls api.apitoll.com endpoints
 *   2. Gets HTTP 402 "Payment Required" with USDC payment details
 *   3. Signs a USDC micropayment via the facilitator
 *   4. Retries with X-PAYMENT header
 *   5. Gets the data — settlement in ~2 seconds on Base
 */

import { createAgentWallet, createFacilitatorSigner } from "@apitoll/buyer-sdk";

const API_BASE = "https://api.apitoll.com";

// ─── Helpers ─────────────────────────────────────────────

function header(title: string) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(50)}\n`);
}

function indent(line: string) {
  console.log(`   ${line}`);
}

// ─── Step 1: Create an agent wallet ──────────────────────

const agent = createAgentWallet({
  name: "LiveDemoAgent",
  chain: "base",

  policies: [
    { type: "budget", dailyCap: 1, maxPerRequest: 0.05 },
    { type: "vendor_acl", allowedVendors: ["*"] },
    { type: "rate_limit", maxPerMinute: 30, maxPerHour: 200 },
  ],

  signer: createFacilitatorSigner({
    facilitatorUrl: "https://pay.apitoll.com",
    apiKey: process.env.APITOLL_API_KEY || "",
  }),

  onPayment: (receipt, url) => {
    console.log(`  ✅ Paid $${receipt.amount} USDC → ${new URL(url).pathname}`);
    if (receipt.txHash) {
      console.log(`     tx: https://basescan.org/tx/${receipt.txHash}`);
    }
  },
  onPolicyRejection: (result, url) => {
    console.log(`  🚫 Policy blocked: ${result.reason} → ${new URL(url).pathname}`);
  },
});

// ─── Full demo with payments ─────────────────────────────

async function demo() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║  API Toll — Live Demo                           ║");
  console.log("║  60 APIs • USDC on Base • ~2s settlement        ║");
  console.log("╚══════════════════════════════════════════════════╝");

  // ── 1. Discover available tools ──
  header("1. Tool Discovery (free)");
  const toolsResp = await fetch(`${API_BASE}/api/tools`);
  const tools = await toolsResp.json() as { totalEndpoints: number };
  indent(`Found ${tools.totalEndpoints} paid endpoints on the marketplace`);

  // ── 2. Data & Lookup ──
  header("2. Data & Lookup APIs");

  indent("🌤️  Weather in Tokyo...");
  await callGet("/api/weather?city=Tokyo", (d: any) =>
    `${d.city} — ${d.temperature}°C, ${d.description}`
  );

  indent("💱 USD → EUR exchange rate...");
  await callGet("/api/currency?from=USD&to=EUR", (d: any) =>
    `1 ${d.from} = ${d.rate} ${d.to}`
  );

  indent("🌍 Country info for Japan...");
  await callGet("/api/country?name=Japan", (d: any) =>
    `${d.name} — Pop: ${(d.population / 1e6).toFixed(1)}M, Capital: ${d.capital}`
  );

  indent("🔍 DNS records for google.com...");
  await callGet("/api/dns?domain=google.com", (d: any) =>
    `${d.domain} — ${d.records?.length || 0} records`
  );

  indent("📅 Public holidays in US 2025...");
  await callGet("/api/holidays?country=US&year=2025", (d: any) =>
    `${d.country} — ${d.holidays?.length || 0} holidays`
  );

  // ── 3. Text Processing ──
  header("3. Text Processing APIs");

  indent("📊 Sentiment analysis...");
  await callPost("/api/sentiment", {
    text: "API Toll makes it incredibly easy for agents to pay for APIs. The x402 protocol is brilliant and the settlement is lightning fast!",
  }, (d: any) =>
    `Score: ${d.score} (${d.comparative > 0 ? "positive" : d.comparative < 0 ? "negative" : "neutral"})`
  );

  indent("📝 Keyword extraction...");
  await callPost("/api/keywords", {
    text: "Autonomous AI agents can now pay for API calls using USDC micropayments on the Base blockchain. The x402 protocol enables HTTP-native payments with 2-second settlement times.",
  }, (d: any) =>
    `Keywords: ${d.keywords?.slice(0, 5).join(", ") || "none"}`
  );

  indent("🌐 Language detection...");
  await callGet("/api/language?text=Bonjour le monde, comment allez-vous?", (d: any) =>
    `Detected: ${d.language} (confidence: ${(d.confidence * 100).toFixed(0)}%)`
  );

  // ── 4. Web & URL Utilities ──
  header("4. Web & URL Utilities");

  indent("🏷️  Meta tags for apitoll.com...");
  await callGet("/api/meta?url=https://apitoll.com", (d: any) =>
    `Title: ${d.title || "n/a"} | OG: ${d.ogTitle || d.title || "n/a"}`
  );

  indent("🔒 SSL certificate for apitoll.com...");
  await callGet("/api/ssl?domain=apitoll.com", (d: any) =>
    `Issuer: ${d.issuer || "n/a"} | Valid: ${d.valid ? "yes" : "no"} | Expires: ${d.validTo || "n/a"}`
  );

  indent("📋 HTTP headers for apitoll.com...");
  await callGet("/api/headers?url=https://apitoll.com", (d: any) => {
    const count = d.headers ? Object.keys(d.headers).length : 0;
    return `${count} response headers received`;
  });

  // ── 5. Compute & Dev Tools ──
  header("5. Compute & Dev Tools");

  indent("🔐 SHA-256 hash...");
  await callPost("/api/hash", {
    text: "hello x402",
    algorithm: "sha256",
  }, (d: any) =>
    `sha256: ${d.hash?.slice(0, 32)}...`
  );

  indent("🆔 UUID generation...");
  await callPost("/api/uuid", { version: "v4" }, (d: any) =>
    `v4: ${d.uuid}`
  );

  indent("⏰ Cron parser...");
  await callPost("/api/cron", { expression: "*/15 * * * *" }, (d: any) =>
    `"*/15 * * * *" → next: ${d.next?.[0] || "n/a"}`
  );

  // ── 6. Media & Visual ──
  header("6. Media & Visual APIs");

  indent("📱 QR code for apitoll.com...");
  await callGet("/api/qr?data=https://apitoll.com", (d: any) =>
    `Generated QR code (${d.format || "svg"}, ${d.size || "n/a"})`
  );

  indent("🎨 Color info for #3B82F6...");
  await callGet("/api/color?hex=3B82F6", (d: any) =>
    `RGB(${d.rgb?.r}, ${d.rgb?.g}, ${d.rgb?.b}) — ${d.name || "Blue"}`
  );

  // ── 7. Blockchain ──
  header("7. Blockchain APIs");

  indent("🔗 ENS resolution for vitalik.eth...");
  await callGet("/api/ens?name=vitalik.eth", (d: any) =>
    `vitalik.eth → ${d.address?.slice(0, 10)}...${d.address?.slice(-6) || "n/a"}`
  );

  // ── 8. Tier 2: Data Enrichment ──
  header("8. Tier 2: Data Enrichment ($0.005–$0.02/call)");

  indent("🏢 Domain enrichment for github.com...");
  await callGet("/api/enrich/domain?domain=github.com", (d: any) =>
    `Tech: ${d.technologies?.slice(0, 3).join(", ") || "n/a"} | Social: ${d.social ? Object.keys(d.social).length : 0} profiles`
  );

  indent("👤 GitHub enrichment for torvalds...");
  await callGet("/api/enrich/github?username=torvalds", (d: any) =>
    `${d.name || d.login} — ${d.publicRepos || "?"} repos, ${d.followers || "?"} followers`
  );

  indent("📚 Wikipedia summary for 'Blockchain'...");
  await callGet("/api/enrich/wiki?q=Blockchain", (d: any) =>
    `${d.title || "Blockchain"}: ${d.extract?.slice(0, 80)}...`
  );

  // ── 9. Tier 2: Finance ──
  header("9. Tier 2: Finance APIs");

  indent("📈 Stock quote for AAPL...");
  await callGet("/api/finance/quote?symbol=AAPL", (d: any) =>
    `AAPL: $${d.price || d.regularMarketPrice || "n/a"} (${d.change > 0 ? "+" : ""}${d.change || "n/a"}%)`
  );

  indent("💹 Forex rates (USD base)...");
  await callGet("/api/finance/forex?base=USD", (d: any) => {
    const count = d.rates ? Object.keys(d.rates).length : 0;
    return `${count} currency pairs | EUR: ${d.rates?.EUR || "n/a"}, GBP: ${d.rates?.GBP || "n/a"}`;
  });

  // ── 10. Multi-step research workflow ──
  header("10. Multi-Step Agent Workflow");
  indent("Simulating an agent research pipeline:\n");

  indent("Step 1: Search for 'x402 protocol payments'...");
  await callGet("/api/search?q=x402+protocol+payments", (d: any) =>
    `Found ${d.results?.length || 0} results`
  );

  indent("Step 2: Get crypto market data...");
  await callGet("/api/crypto/price?ids=ethereum,bitcoin", (d: any) => {
    const coins = d.prices || d;
    const eth = coins.ethereum || coins[0];
    const btc = coins.bitcoin || coins[1];
    return `BTC: $${btc?.usd?.toLocaleString() || "n/a"}, ETH: $${eth?.usd?.toLocaleString() || "n/a"}`;
  });

  indent("Step 3: Get latest tech news...");
  await callGet("/api/news?category=technology", (d: any) =>
    `${d.articles?.length || d.results?.length || 0} articles retrieved`
  );

  indent("Step 4: Analyze sentiment of findings...");
  await callPost("/api/sentiment", {
    text: "The cryptocurrency market shows strong momentum with Bitcoin reaching new highs. Institutional adoption continues to accelerate as major banks launch crypto custody services.",
  }, (d: any) =>
    `Market sentiment: ${d.comparative > 0.1 ? "Bullish" : d.comparative < -0.1 ? "Bearish" : "Neutral"} (score: ${d.score})`
  );

  // ── Summary ──
  header("Session Summary");
  const summary = agent.getSpendSummary();
  const txns = agent.getTransactions();

  indent(`Total spent:    $${summary.today.toFixed(6)} USDC`);
  indent(`Transactions:   ${summary.transactionCount}`);
  indent(`Daily budget:   $${summary.today.toFixed(4)} / $1.00`);
  indent(`Budget used:    ${((summary.today / 1) * 100).toFixed(1)}%`);
  console.log("");

  if (txns.length > 0) {
    indent("Transaction Log:");
    txns.forEach((tx, i) => {
      indent(`  ${String(i + 1).padStart(2)}. ${tx.endpoint.padEnd(30)} $${tx.amount} ${tx.chain} [${tx.status}]`);
    });
  }

  console.log("\n  Every API call above was paid with real USDC on Base.\n");
}

// ─── GET helper ──────────────────────────────────────────

async function callGet(path: string, format: (data: any) => string) {
  try {
    const resp = await agent.fetch(`${API_BASE}${path}`);
    if (resp.ok) {
      const data = await resp.json();
      indent(`  → ${format(data)}`);
    } else {
      indent(`  → ${resp.status} ${resp.statusText}`);
    }
  } catch (err) {
    indent(`  → Error: ${(err as Error).message}`);
  }
}

// ─── POST helper ─────────────────────────────────────────

async function callPost(path: string, body: any, format: (data: any) => string) {
  try {
    const resp = await agent.fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (resp.ok) {
      const data = await resp.json();
      indent(`  → ${format(data)}`);
    } else {
      indent(`  → ${resp.status} ${resp.statusText}`);
    }
  } catch (err) {
    indent(`  → Error: ${(err as Error).message}`);
  }
}

// ─── 402 handshake demo (no wallet) ─────────────────────

interface PaymentResponse {
  error?: string;
  paymentRequirements?: Array<{
    scheme: string;
    network: string;
    maxAmountRequired: string;
    payTo: string;
    asset: string;
    extra?: { name: string; decimals: number };
  }>;
  description?: string;
}

async function show402(label: string, url: string): Promise<void> {
  try {
    const resp = await fetch(url);
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("json")) {
      indent(`${resp.status} │ $?.??? USDC │ ${label} (non-JSON response)`);
      return;
    }
    const body = await resp.json() as PaymentResponse;
    const req = body.paymentRequirements?.[0];
    if (req) {
      const amount = parseInt(req.maxAmountRequired) / 1e6;
      indent(`${resp.status} │ $${amount.toFixed(3)} USDC │ ${label}`);
    } else {
      indent(`${resp.status} │ ${label} (no payment info)`);
    }
  } catch {
    indent(`err │ ${label} (request failed)`);
  }
}

async function demoWithout402() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║  API Toll — x402 Protocol Demo                  ║");
  console.log("║  60 APIs • USDC on Base • HTTP-native payments  ║");
  console.log("╚══════════════════════════════════════════════════╝");

  // ── 1. Discovery ──
  header("1. Discover the marketplace (free)");
  const toolsResp = await fetch(`${API_BASE}/api/tools`);
  const tools = await toolsResp.json() as { totalEndpoints: number; tools: Array<{ category: string; endpoint: string; price: string; description: string }> };
  indent(`${tools.totalEndpoints} paid endpoints live on api.apitoll.com\n`);

  const categories = [...new Set(tools.tools.map((t) => t.category))];
  for (const cat of categories) {
    const count = tools.tools.filter((t) => t.category === cat).length;
    indent(`  ${cat.padEnd(14)} ${String(count).padStart(2)} endpoints`);
  }

  // ── 2. Deep dive on one endpoint ──
  header("2. Call a paid endpoint (no payment)");
  indent("→ GET /api/weather?city=Tokyo\n");

  const resp = await fetch(`${API_BASE}/api/weather?city=Tokyo`);
  indent(`Status: ${resp.status} Payment Required\n`);

  const body = await resp.json() as PaymentResponse;
  const req = body.paymentRequirements?.[0];
  if (req) {
    const amount = parseInt(req.maxAmountRequired) / 1e6;
    indent("The server says: pay me first.\n");
    indent("Payment Requirements:");
    indent(`  ├── Protocol:  x402 (HTTP 402)`);
    indent(`  ├── Network:   ${req.network} (Base L2)`);
    indent(`  ├── Amount:    $${amount.toFixed(3)} ${req.extra?.name || "USDC"}`);
    indent(`  ├── Pay To:    ${req.payTo.slice(0, 10)}...${req.payTo.slice(-6)}`);
    indent(`  └── Asset:     USDC on Base`);
  }

  // ── 3. Show pricing across categories ──
  header("3. Pricing across 10 categories");
  indent("Every endpoint returns 402 with its price. Watch:\n");
  indent("  Status │ Price       │ Endpoint");
  indent("  ───────┼─────────────┼──────────────────────────────");

  await show402("Weather (Tokyo)",                `${API_BASE}/api/weather?city=Tokyo`);
  await show402("Crypto prices (BTC, ETH)",       `${API_BASE}/api/crypto/price?ids=bitcoin,ethereum`);
  await show402("DNS lookup (google.com)",         `${API_BASE}/api/dns?domain=google.com`);
  await show402("Language detection (French)",     `${API_BASE}/api/language?text=Bonjour+le+monde`);
  await show402("SSL certificate (github.com)",    `${API_BASE}/api/ssl?domain=github.com`);
  await show402("QR code (apitoll.com)",           `${API_BASE}/api/qr?data=https://apitoll.com`);
  await show402("ENS resolve (vitalik.eth)",       `${API_BASE}/api/ens?name=vitalik.eth`);
  await show402("Domain enrichment (stripe.com)",  `${API_BASE}/api/enrich/domain?domain=stripe.com`);
  await show402("Stock quote (AAPL)",              `${API_BASE}/api/finance/quote?symbol=AAPL`);
  await show402("Color info (#3B82F6)",             `${API_BASE}/api/color?hex=3B82F6`);

  // ── 4. Agent discovery ──
  header("4. Agent auto-discovery");
  indent("Every 402 response includes a discovery header so agents");
  indent("can find MORE tools automatically:\n");

  const discoveryHeader = resp.headers.get("x-apitoll-discovery");
  if (discoveryHeader) {
    const discovery = JSON.parse(Buffer.from(discoveryHeader, "base64").toString());
    indent(`Seller: ${discovery.seller_name || "API Toll Tools"}`);
    indent(`Related tools: ${discovery.related_tools?.length || 0} available\n`);
    if (discovery.related_tools?.length) {
      discovery.related_tools.slice(0, 8).forEach((tool: any) => {
        indent(`  • ${tool.name.padEnd(22)} $${tool.price} USDC  ${tool.description}`);
      });
      if (discovery.related_tools.length > 8) {
        indent(`  ... and ${discovery.related_tools.length - 8} more`);
      }
    }
  } else {
    indent("  (discovery header not present — server may be in dev mode)");
  }

  // ── 5. The flow ──
  header("5. How agents pay (fully automatic)");
  indent("1. Agent calls any endpoint");
  indent("2. Gets HTTP 402 + payment requirements (you just saw this)");
  indent("3. SDK signs a USDC transfer on Base L2");
  indent("4. Retries with X-PAYMENT header");
  indent("5. Gets data back — settlement in ~2 seconds\n");

  indent("Code:\n");
  indent('  import { createAgentWallet, createFacilitatorSigner } from "@apitoll/buyer-sdk";\n');
  indent("  const agent = createAgentWallet({");
  indent('    name: "MyBot",');
  indent('    chain: "base",');
  indent("    policies: [{ type: 'budget', dailyCap: 1.00, maxPerRequest: 0.05 }],");
  indent("    signer: createFacilitatorSigner({ facilitatorUrl: 'https://pay.apitoll.com' }),");
  indent("  });\n");
  indent('  const resp = await agent.fetch("https://api.apitoll.com/api/weather?city=Tokyo");');
  indent("  const data = await resp.json();");
  indent("  // 402 → pay → 200 — handled automatically ✨\n");

  // ── Summary ──
  header("Summary");
  indent(`✅  ${tools.totalEndpoints} paid API endpoints live`);
  indent("✅  $0.001 – $0.02 USDC per call");
  indent("✅  No API key signup required");
  indent("✅  No billing, no invoices — just pay & go");
  indent("✅  Settlement on Base L2 in ~2 seconds");
  indent("✅  Works with any AI agent framework\n");
  indent("📖  Docs:      https://api.apitoll.com/api/docs");
  indent("📊  Dashboard: https://apitoll.com/dashboard");
  indent("🔗  GitHub:    https://github.com/TasnidChain/APITOLL\n");
}

// ─── Run ─────────────────────────────────────────────────

if (process.env.APITOLL_API_KEY) {
  demo().catch(console.error);
} else {
  demoWithout402().catch(console.error);
}
