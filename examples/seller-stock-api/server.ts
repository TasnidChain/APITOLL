/**
 * Example: Monetize a stock/crypto data API with x402 micropayments.
 *
 * Run: SELLER_WALLET=0x... npx tsx examples/seller-stock-api/server.ts
 *
 * Endpoints:
 *   GET /api/price/:symbol    — $0.001/call — Real-time price quote
 *   GET /api/candles/:symbol  — $0.003/call — OHLCV candlestick data
 *   GET /api/portfolio        — $0.005/call — Portfolio analysis
 *   GET /health               — FREE
 *
 * Agents pay with USDC on Base. No API keys, no rate limits — just pay per call.
 */

import express from "express";
import { paymentMiddleware, getX402Context } from "@apitoll/seller-sdk";

const app = express();
app.use(express.json());

// Simulated market data
const prices: Record<string, { price: number; change24h: number; volume: number }> = {
  BTC: { price: 97450.32, change24h: 2.4, volume: 28_500_000_000 },
  ETH: { price: 3820.15, change24h: 1.8, volume: 15_200_000_000 },
  SOL: { price: 198.42, change24h: -0.5, volume: 4_100_000_000 },
  USDC: { price: 1.0, change24h: 0.0, volume: 8_900_000_000 },
  AAPL: { price: 243.85, change24h: 0.7, volume: 52_000_000 },
  TSLA: { price: 412.30, change24h: 3.2, volume: 98_000_000 },
  NVDA: { price: 875.20, change24h: 1.1, volume: 45_000_000 },
};

// x402 payment middleware
app.use(
  paymentMiddleware({
    walletAddress: process.env.SELLER_WALLET!,
    endpoints: {
      "GET /api/price/:symbol": {
        price: "0.001",
        chains: ["base"],
        description: "Real-time price quote for any stock or crypto",
      },
      "GET /api/candles/:symbol": {
        price: "0.003",
        chains: ["base"],
        description: "OHLCV candlestick data (1m, 5m, 1h, 1d intervals)",
      },
      "GET /api/portfolio": {
        price: "0.005",
        chains: ["base"],
        description: "Portfolio analysis with allocation breakdown",
      },
    },
    facilitatorUrl: process.env.FACILITATOR_URL || "https://pay.apitoll.com",
    discovery: {
      sellerName: "Stock & Crypto Data API",
      referralCode: process.env.REFERRAL_CODE || "stock-data",
      relatedTools: [
        { name: "Price Quote", url: "/api/price/BTC", price: "0.001", description: "Real-time price for any ticker", method: "GET" },
        { name: "Candlestick Data", url: "/api/candles/ETH", price: "0.003", description: "OHLCV candles", method: "GET" },
        { name: "Portfolio Analysis", url: "/api/portfolio", price: "0.005", description: "Portfolio breakdown", method: "GET" },
      ],
    },
  })
);

// Real-time price
app.get("/api/price/:symbol", (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const data = prices[symbol];
  const ctx = getX402Context(req);

  if (!data) {
    return res.status(404).json({ error: `Symbol ${symbol} not found` });
  }

  res.json({
    symbol,
    price: data.price + (Math.random() - 0.5) * data.price * 0.001, // Slight randomness
    change24h: data.change24h,
    volume24h: data.volume,
    timestamp: new Date().toISOString(),
    source: "API Toll Stock Data",
    payment: ctx?.receipt ? { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount } : null,
  });
});

// Candlestick data
app.get("/api/candles/:symbol", (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const interval = (req.query.interval as string) || "1h";
  const limit = Math.min(parseInt(req.query.limit as string) || 24, 100);
  const data = prices[symbol];

  if (!data) {
    return res.status(404).json({ error: `Symbol ${symbol} not found` });
  }

  const candles = Array.from({ length: limit }, (_, i) => {
    const base = data.price * (1 + (Math.random() - 0.5) * 0.02);
    return {
      timestamp: new Date(Date.now() - i * 3600000).toISOString(),
      open: base * (1 + (Math.random() - 0.5) * 0.005),
      high: base * (1 + Math.random() * 0.01),
      low: base * (1 - Math.random() * 0.01),
      close: base,
      volume: Math.round(data.volume / limit * (0.8 + Math.random() * 0.4)),
    };
  });

  res.json({ symbol, interval, candles });
});

// Portfolio analysis
app.get("/api/portfolio", (req, res) => {
  const holdings = (req.query.holdings as string || "BTC:0.5,ETH:2,SOL:10").split(",");
  const portfolio = holdings.map((h) => {
    const [symbol, qty] = h.split(":");
    const data = prices[symbol?.toUpperCase()];
    return {
      symbol: symbol?.toUpperCase(),
      quantity: parseFloat(qty || "0"),
      price: data?.price || 0,
      value: (data?.price || 0) * parseFloat(qty || "0"),
      change24h: data?.change24h || 0,
    };
  });

  const totalValue = portfolio.reduce((sum, p) => sum + p.value, 0);

  res.json({
    portfolio: portfolio.map((p) => ({
      ...p,
      allocation: totalValue > 0 ? ((p.value / totalValue) * 100).toFixed(1) + "%" : "0%",
    })),
    totalValue,
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "stock-data-api", symbols: Object.keys(prices).length });
});

const PORT = parseInt(process.env.PORT || "4403", 10);

if (!process.env.SELLER_WALLET) {
  console.error("ERROR: SELLER_WALLET required. Usage: SELLER_WALLET=0x... npx tsx server.ts");
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`\nStock & Crypto Data API on http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET /api/price/:symbol    $0.001  Real-time quote`);
  console.log(`  GET /api/candles/:symbol  $0.003  OHLCV data`);
  console.log(`  GET /api/portfolio        $0.005  Portfolio analysis`);
  console.log(`  GET /health               FREE`);
  console.log(`\nSeller: ${process.env.SELLER_WALLET}`);
  console.log(`Ready to receive payments.\n`);
});
