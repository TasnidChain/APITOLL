import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { financeCache } from "../cache";

const router = Router();

const QUOTE_CACHE_TTL = 60_000; // 1 minute
const HISTORY_CACHE_TTL = 300_000; // 5 minutes
const MARKET_CACHE_TTL = 120_000; // 2 minutes

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}


interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  exchange: string;
  currency: string;
  timestamp: string;
}

async function fetchYahooQuote(symbol: string): Promise<StockQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

  const resp = await fetch(url, {
    headers: {
      "User-Agent": "APIToll-Finance/1.0",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!resp.ok) return null;

  const data = (await resp.json()) as {
    chart?: {
      result?: Array<{
        meta?: {
          symbol?: string;
          shortName?: string;
          regularMarketPrice?: number;
          previousClose?: number;
          regularMarketVolume?: number;
          marketCap?: number;
          regularMarketDayHigh?: number;
          regularMarketDayLow?: number;
          fiftyTwoWeekHigh?: number;
          fiftyTwoWeekLow?: number;
          exchangeName?: string;
          currency?: string;
        };
      }>;
    };
  };

  const meta = data.chart?.result?.[0]?.meta;
  if (!meta || !meta.regularMarketPrice) return null;

  const price = meta.regularMarketPrice;
  const prevClose = meta.previousClose || price;
  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: meta.symbol || symbol.toUpperCase(),
    name: meta.shortName || symbol.toUpperCase(),
    price,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    volume: meta.regularMarketVolume || 0,
    marketCap: meta.marketCap || null,
    dayHigh: meta.regularMarketDayHigh || null,
    dayLow: meta.regularMarketDayLow || null,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow || null,
    exchange: meta.exchangeName || "unknown",
    currency: meta.currency || "USD",
    timestamp: new Date().toISOString(),
  };
}

async function fetchYahooHistory(symbol: string, range: string, interval: string): Promise<{
  symbol: string;
  candles: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
}> {
  const validRanges = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y"];
  const validIntervals = ["1m", "5m", "15m", "1h", "1d", "1wk", "1mo"];

  const safeRange = validRanges.includes(range) ? range : "1mo";
  const safeInterval = validIntervals.includes(interval) ? interval : "1d";

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${safeInterval}&range=${safeRange}`;

  const resp = await fetch(url, {
    headers: {
      "User-Agent": "APIToll-Finance/1.0",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) throw new Error(`Yahoo Finance returned ${resp.status}`);

  const data = (await resp.json()) as {
    chart?: {
      result?: Array<{
        meta?: { symbol?: string };
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: (number | null)[];
            high?: (number | null)[];
            low?: (number | null)[];
            close?: (number | null)[];
            volume?: (number | null)[];
          }>;
        };
      }>;
    };
  };

  const result = data.chart?.result?.[0];
  if (!result?.timestamp) throw new Error("No data available for this symbol");

  const quotes = result.indicators?.quote?.[0];
  const candles = result.timestamp.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString(),
    open: quotes?.open?.[i] ?? 0,
    high: quotes?.high?.[i] ?? 0,
    low: quotes?.low?.[i] ?? 0,
    close: quotes?.close?.[i] ?? 0,
    volume: quotes?.volume?.[i] ?? 0,
  })).filter((c) => c.open > 0); // Filter out null candles

  return {
    symbol: result.meta?.symbol || symbol.toUpperCase(),
    candles,
  };
}


interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: string;
}

async function fetchExchangeRates(base: string): Promise<ExchangeRates> {
  // Using exchangerate.host or open.er-api.com (free, no key)
  const resp = await fetch(
    `https://open.er-api.com/v6/latest/${encodeURIComponent(base.toUpperCase())}`,
    {
      headers: { "User-Agent": "APIToll-Finance/1.0" },
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!resp.ok) throw new Error(`Exchange rate API returned ${resp.status}`);

  const data = (await resp.json()) as {
    base_code?: string;
    rates?: Record<string, number>;
    time_last_update_utc?: string;
  };

  if (!data.rates) throw new Error("No exchange rate data available");

  return {
    base: data.base_code || base.toUpperCase(),
    rates: data.rates,
    timestamp: data.time_last_update_utc || new Date().toISOString(),
  };
}

// GET /api/finance/quote?symbol=AAPL
router.get("/api/finance/quote", async (req: Request, res: Response) => {
  const symbolParam = ((req.query.symbol as string) || "").trim().toUpperCase();
  if (!symbolParam) {
    return res.status(400).json({
      error: "Missing required parameter: symbol",
      example: "/api/finance/quote?symbol=AAPL",
    });
  }

  // Support multiple symbols (comma-separated)
  const symbols = symbolParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const cacheKey = `finance:quote:${symbol}`;
      const cached = financeCache.get<StockQuote>(cacheKey);
      if (cached) return { ...cached, cached: true };

      try {
        const quote = await fetchYahooQuote(symbol);
        if (!quote) return { symbol, error: "Symbol not found" };

        financeCache.set(cacheKey, quote, QUOTE_CACHE_TTL);
        return { ...quote, cached: false };
      } catch (err) {
        return { symbol, error: (err as Error).message };
      }
    })
  );

  if (symbols.length === 1) {
    const result = results[0];
    if ("error" in result && !("price" in result)) {
      return res.status(404).json({ error: result.error, symbol: symbols[0] });
    }
    return res.json({ ...result, source: "yahoo-finance", payment: formatPayment(getX402Context(req)) });
  }

  res.json({
    quotes: results,
    source: "yahoo-finance",
    payment: formatPayment(getX402Context(req)),
  });
});

// GET /api/finance/history?symbol=AAPL&range=1mo&interval=1d
router.get("/api/finance/history", async (req: Request, res: Response) => {
  const symbol = ((req.query.symbol as string) || "").trim().toUpperCase();
  if (!symbol) {
    return res.status(400).json({
      error: "Missing required parameter: symbol",
      example: "/api/finance/history?symbol=AAPL&range=1mo&interval=1d",
    });
  }

  const range = ((req.query.range as string) || "1mo").trim();
  const interval = ((req.query.interval as string) || "1d").trim();

  const cacheKey = `finance:history:${symbol}:${range}:${interval}`;
  const cached = financeCache.get<Record<string, unknown>>(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });
  }

  try {
    const history = await fetchYahooHistory(symbol, range, interval);
    const payload = {
      ...history,
      range,
      interval,
      candleCount: history.candles.length,
      source: "yahoo-finance",
    };

    financeCache.set(cacheKey, payload, HISTORY_CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Failed to fetch history", details: (err as Error).message });
  }
});

// GET /api/finance/forex?base=USD
router.get("/api/finance/forex", async (req: Request, res: Response) => {
  const base = ((req.query.base as string) || "USD").trim().toUpperCase();
  const symbols = ((req.query.symbols as string) || "").trim().toUpperCase();

  const cacheKey = `finance:forex:${base}`;
  const cached = financeCache.get<ExchangeRates>(cacheKey);

  let rates: ExchangeRates;
  if (cached) {
    rates = cached;
  } else {
    try {
      rates = await fetchExchangeRates(base);
      financeCache.set(cacheKey, rates, MARKET_CACHE_TTL);
    } catch (err) {
      return res.status(502).json({ error: "Exchange rate service unavailable", details: (err as Error).message });
    }
  }

  // Filter to requested symbols if specified
  let filteredRates = rates.rates;
  if (symbols) {
    const wanted = new Set(symbols.split(",").map((s) => s.trim()));
    filteredRates = Object.fromEntries(
      Object.entries(rates.rates).filter(([k]) => wanted.has(k))
    );
  }

  res.json({
    base: rates.base,
    rates: filteredRates,
    rateCount: Object.keys(filteredRates).length,
    timestamp: rates.timestamp,
    cached: !!cached,
    source: "open-er-api",
    payment: formatPayment(getX402Context(req)),
  });
});

// GET /api/finance/convert?from=USD&to=EUR&amount=100
router.get("/api/finance/convert", async (req: Request, res: Response) => {
  const from = ((req.query.from as string) || "").trim().toUpperCase();
  const to = ((req.query.to as string) || "").trim().toUpperCase();
  const amount = parseFloat((req.query.amount as string) || "1");

  if (!from || !to) {
    return res.status(400).json({
      error: "Missing required parameters: from, to",
      example: "/api/finance/convert?from=USD&to=EUR&amount=100",
    });
  }

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  const cacheKey = `finance:forex:${from}`;
  let rates = financeCache.get<ExchangeRates>(cacheKey);

  if (!rates) {
    try {
      rates = await fetchExchangeRates(from);
      financeCache.set(cacheKey, rates, MARKET_CACHE_TTL);
    } catch (err) {
      return res.status(502).json({ error: "Exchange rate service unavailable", details: (err as Error).message });
    }
  }

  const rate = rates.rates[to];
  if (!rate) {
    return res.status(404).json({ error: `Currency '${to}' not found` });
  }

  const converted = Math.round(amount * rate * 100) / 100;

  res.json({
    from,
    to,
    amount,
    rate,
    converted,
    timestamp: rates.timestamp,
    source: "open-er-api",
    payment: formatPayment(getX402Context(req)),
  });
});

export default router;
