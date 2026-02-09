import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { cryptoCache } from "../cache";

const router = Router();

const PRICE_CACHE_TTL = 60_000; // 60 seconds
const TRENDING_CACHE_TTL = 300_000; // 5 minutes

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// CoinGecko free API — no key, 10-30 req/min
async function fetchCoinGeckoPrices(ids: string, vsCurrencies: string, include24h: boolean, includeMarketCap: boolean) {
  const params = new URLSearchParams({
    ids,
    vs_currencies: vsCurrencies,
    include_24hr_change: include24h ? "true" : "false",
    include_market_cap: includeMarketCap ? "true" : "false",
  });

  const resp = await fetch(`https://api.coingecko.com/api/v3/simple/price?${params}`, {
    headers: { "User-Agent": "APIToll-Crypto/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!resp.ok) throw new Error(`CoinGecko returned ${resp.status}`);
  return resp.json();
}

async function fetchCoinGeckoTrending() {
  const resp = await fetch("https://api.coingecko.com/api/v3/search/trending", {
    headers: { "User-Agent": "APIToll-Crypto/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!resp.ok) throw new Error(`CoinGecko trending returned ${resp.status}`);
  return resp.json() as Promise<{
    coins: Array<{
      item: {
        id: string;
        name: string;
        symbol: string;
        market_cap_rank: number;
        data?: { price?: number; price_change_percentage_24h?: { usd?: number } };
      };
    }>;
  }>;
}

async function fetchDefiLlama() {
  const resp = await fetch("https://api.llama.fi/protocols", {
    headers: { "User-Agent": "APIToll-Crypto/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!resp.ok) throw new Error(`DeFi Llama returned ${resp.status}`);
  const protocols = (await resp.json()) as Array<{
    name: string;
    tvl: number;
    change_1d: number;
    chain: string;
    category: string;
  }>;

  // Return top 10 by TVL
  return protocols
    .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
    .slice(0, 10)
    .map((p) => ({
      name: p.name,
      tvlUsd: Math.round(p.tvl || 0),
      change24h: Math.round((p.change_1d || 0) * 100) / 100,
      chain: p.chain,
      category: p.category,
    }));
}

// GET /api/crypto/price?ids=bitcoin,ethereum&vs_currencies=usd
router.get("/api/crypto/price", async (req: Request, res: Response) => {
  const ids = ((req.query.ids as string) || "").trim();
  if (!ids) {
    return res.status(400).json({
      error: "Missing required parameter: ids",
      example: "/api/crypto/price?ids=bitcoin,ethereum,solana",
    });
  }

  const vsCurrencies = ((req.query.vs_currencies as string) || "usd").trim();
  const include24h = req.query.include_24h_change !== "false";
  const includeMarketCap = req.query.include_market_cap === "true";

  const cacheKey = `crypto:price:${ids}:${vsCurrencies}:${include24h}:${includeMarketCap}`;
  const cached = cryptoCache.get<Record<string, unknown>>(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });
  }

  try {
    const prices = await fetchCoinGeckoPrices(ids, vsCurrencies, include24h, includeMarketCap);
    const payload = { prices, source: "coingecko" };
    cryptoCache.set(cacheKey, payload, PRICE_CACHE_TTL);

    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Crypto price service unavailable", details: (err as Error).message });
  }
});

// GET /api/crypto/trending
router.get("/api/crypto/trending", async (req: Request, res: Response) => {
  const includeDefi = req.query.include_defi === "true";
  const cacheKey = `crypto:trending:${includeDefi}`;

  const cached = cryptoCache.get<Record<string, unknown>>(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });
  }

  try {
    const [trendingData, defiData] = await Promise.all([
      fetchCoinGeckoTrending(),
      includeDefi ? fetchDefiLlama() : Promise.resolve([]),
    ]);

    const trending = (trendingData.coins || []).map((c) => ({
      id: c.item.id,
      name: c.item.name,
      symbol: c.item.symbol,
      marketCapRank: c.item.market_cap_rank,
      priceUsd: c.item.data?.price ?? null,
      priceChange24h: c.item.data?.price_change_percentage_24h?.usd ?? null,
    }));

    const payload: Record<string, unknown> = {
      trending,
      source: includeDefi ? "coingecko+defillama" : "coingecko",
    };

    if (includeDefi) {
      payload.defi = defiData;
    }

    cryptoCache.set(cacheKey, payload, TRENDING_CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Trending data unavailable", details: (err as Error).message });
  }
});

export default router;
