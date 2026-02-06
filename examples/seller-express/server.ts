/**
 * Example: Monetize a weather API with x402 micropayments.
 *
 * Run: npx ts-node examples/seller-express/server.ts
 *
 * This server charges $0.002 per weather forecast request
 * and $0.005 per historical data query, accepting USDC on
 * both Base and Solana.
 */

import express from "express";
import { paymentMiddleware, getPaymentReceipt } from "@apitoll/seller-sdk";

const app = express();
app.use(express.json());

// ─── Add x402 payment middleware ────────────────────────────────
// This is the only integration step. Everything else is your normal API.

app.use(
  paymentMiddleware({
    walletAddress: process.env.SELLER_WALLET || "0xYourUSDCWalletAddress",
    endpoints: {
      "GET /api/forecast": {
        price: "0.002",
        chains: ["base", "solana"],
        description: "7-day weather forecast for any city",
      },
      "GET /api/historical": {
        price: "0.005",
        chains: ["base", "solana"],
        description: "Historical weather data (up to 30 days)",
      },
      "POST /api/alerts": {
        price: "0.001",
        chains: ["base"],
        description: "Subscribe to severe weather alerts",
      },
    },
    // Optional: Platform analytics (get an API key at agentcommerce.xyz)
    platformApiKey: process.env.AGENTCOMMERCE_API_KEY,
    // Optional: Real-time webhooks
    webhookUrl: process.env.WEBHOOK_URL,
  })
);

// ─── Your normal API routes (unchanged) ─────────────────────────

app.get("/api/forecast", (req, res) => {
  const city = req.query.city || "New York";
  const receipt = getPaymentReceipt(req);

  res.json({
    city,
    forecast: [
      { day: "Mon", high: 72, low: 58, conditions: "Sunny" },
      { day: "Tue", high: 68, low: 55, conditions: "Partly Cloudy" },
      { day: "Wed", high: 65, low: 52, conditions: "Rain" },
      { day: "Thu", high: 70, low: 56, conditions: "Sunny" },
      { day: "Fri", high: 74, low: 60, conditions: "Clear" },
      { day: "Sat", high: 76, low: 62, conditions: "Sunny" },
      { day: "Sun", high: 71, low: 57, conditions: "Cloudy" },
    ],
    payment: receipt
      ? { txHash: receipt.txHash, amount: receipt.amount, chain: receipt.chain }
      : null,
  });
});

app.get("/api/historical", (req, res) => {
  const city = req.query.city || "New York";
  const days = parseInt(req.query.days as string) || 7;

  res.json({
    city,
    period: `Last ${days} days`,
    data: Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.now() - i * 86400000).toISOString().split("T")[0],
      high: Math.round(65 + Math.random() * 15),
      low: Math.round(50 + Math.random() * 10),
      precipitation: Math.round(Math.random() * 100) / 100,
    })),
  });
});

// Free endpoint (no payment required)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

// ─── Start server ───────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🌤️  Weather API running on http://localhost:${PORT}`);
  console.log(`\n📋 Endpoints:`);
  console.log(`   GET  /api/forecast    $0.002/call  (Base + Solana)`);
  console.log(`   GET  /api/historical  $0.005/call  (Base + Solana)`);
  console.log(`   POST /api/alerts      $0.001/call  (Base only)`);
  console.log(`   GET  /api/health      FREE`);
  console.log(`\n💡 Agents will receive HTTP 402 with payment requirements.`);
  console.log(`   After paying, they retry with X-PAYMENT header.\n`);
});
