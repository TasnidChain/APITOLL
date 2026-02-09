/**
 * Seed Marketplace — Register all 10 seller-api tools in the Convex tools table
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
  console.error("Example: npx tsx scripts/seed-marketplace.ts https://your-seller-api.railway.app");
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
  {
    name: "Web Search",
    description: "Search the web with structured JSON results — titles, snippets, URLs. Powered by DuckDuckGo + Brave Search.",
    method: "GET",
    path: "/api/search",
    price: 0.003,
    category: "data",
  },
  {
    name: "URL Scraper",
    description: "Convert any URL to clean Markdown content. Extracts article text, metadata, author info. Ideal for AI agents reading web pages.",
    method: "POST",
    path: "/api/scrape",
    price: 0.002,
    category: "data",
  },
  {
    name: "Crypto Prices",
    description: "Live cryptocurrency prices from CoinGecko — supports any coin ID. Returns USD price, 24h change, market cap, volume.",
    method: "GET",
    path: "/api/crypto/price",
    price: 0.001,
    category: "finance",
  },
  {
    name: "Trending Crypto",
    description: "Trending tokens and top DeFi protocols. CoinGecko trending coins + DeFi Llama top protocols by TVL.",
    method: "GET",
    path: "/api/crypto/trending",
    price: 0.001,
    category: "finance",
  },
  {
    name: "News Feed",
    description: "Latest news from major sources — Reuters, BBC, TechCrunch, CoinDesk, and more. Filter by category: general, technology, crypto, business, science.",
    method: "GET",
    path: "/api/news",
    price: 0.001,
    category: "data",
  },
  {
    name: "Agent Reputation",
    description: "Look up any AI agent's trust score (0-100) and activity profile. Based on transaction history, endpoint diversity, and recency.",
    method: "GET",
    path: "/api/reputation/agent/:agentId",
    price: 0.001,
    category: "ai",
  },
  {
    name: "Trending APIs",
    description: "Discover trending APIs ranked by agent activity, discovery count, and transaction volume. Network-wide stats included.",
    method: "GET",
    path: "/api/reputation/trending",
    price: 0.001,
    category: "ai",
  },
  {
    name: "Geocoding",
    description: "Forward geocoding — convert any address or place name to latitude/longitude coordinates. Powered by OpenStreetMap.",
    method: "GET",
    path: "/api/geocode",
    price: 0.001,
    category: "data",
  },
  {
    name: "Reverse Geocode",
    description: "Reverse geocoding — convert latitude/longitude coordinates to a human-readable address. Street, city, country, postal code.",
    method: "GET",
    path: "/api/geocode/reverse",
    price: 0.001,
    category: "data",
  },
  {
    name: "Programming Jokes",
    description: "Random programming and developer jokes. A fun micro-tool for AI agents to lighten conversations.",
    method: "GET",
    path: "/api/joke",
    price: 0.001,
    category: "entertainment",
  },
];

async function seed() {
  console.log(`\nSeeding marketplace with ${TOOLS.length} tools...`);
  console.log(`  Convex:  ${CONVEX_URL}`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Wallet:  ${SELLER_WALLET}\n`);

  let registered = 0;
  let skipped = 0;

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
    }
  }

  console.log(`\nDone! ${registered} registered, ${skipped} already existed.\n`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
