import "dotenv/config";
import express from "express";
import { paymentMiddleware, getX402Context } from "@apitoll/seller-sdk";

const app = express();
app.use(express.json());

// Base Mainnet USDC (override with env vars for testnet)
const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const NETWORK_ID = process.env.NETWORK_ID || "eip155:8453"; // Base Mainnet

const jokes = [
  "Why do programmers prefer dark mode? Because light attracts bugs!",
  "How many programmers does it take to change a light bulb? None, that's a hardware problem.",
  "Why do Java developers wear glasses? Because they can't C#!",
  "What's a programmer's favorite hangout place? The Foo Bar.",
  "Why did the programmer quit his job? Because he didn't get arrays!",
  "What do you call a programmer from Finland? Nerdic.",
  "Why do programmers always mix up Christmas and Halloween? Because Oct 31 == Dec 25!",
  "What's the object-oriented way to become wealthy? Inheritance.",
  "A SQL query walks into a bar, walks up to two tables, and asks: 'Can I join you?'",
  "There are only 10 kinds of people in the world: those who understand binary, and those who don't.",
];

// x402 payment middleware — protects paid endpoints
app.use(
  paymentMiddleware({
    walletAddress: process.env.SELLER_WALLET!,
    endpoints: {
      "GET /api/joke": {
        price: "0.001", // $0.001 USDC per joke
        chains: ["base"],
        description: "Get a random programming joke",
      },
    },
    chainConfigs: {
      base: {
        networkId: NETWORK_ID,
        rpcUrl: BASE_RPC_URL,
        usdcAddress: USDC_ADDRESS,
        facilitatorUrl: process.env.FACILITATOR_URL || "http://localhost:3000",
      },
    },
    facilitatorUrl:
      process.env.FACILITATOR_URL || "http://localhost:3000",
    webhookUrl: process.env.CONVEX_WEBHOOK_URL,
    platformApiKey: process.env.APITOLL_PLATFORM_KEY,
  })
);

// Paid endpoint — returns a joke after payment verification
app.get("/api/joke", (req, res) => {
  const joke = jokes[Math.floor(Math.random() * jokes.length)];
  const ctx = getX402Context(req);

  res.json({
    joke,
    payment: ctx?.receipt
      ? {
          txHash: ctx.receipt.txHash,
          amount: ctx.receipt.amount,
          from: ctx.receipt.from,
          chain: ctx.receipt.chain,
        }
      : null,
  });
});

// Free health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "joke-api", seller: process.env.SELLER_WALLET });
});

const PORT = parseInt(process.env.PORT || "4402", 10);

if (!process.env.SELLER_WALLET) {
  console.error("ERROR: SELLER_WALLET environment variable required");
  console.error("Usage: SELLER_WALLET=0x... npx tsx server.ts");
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`\nJoke API running on http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET /api/joke  — $0.001 USDC (Base)`);
  console.log(`  GET /health    — FREE`);
  console.log(`\nSeller wallet: ${process.env.SELLER_WALLET}`);
  console.log(`Facilitator:   ${process.env.FACILITATOR_URL || "http://localhost:3000"}`);
  console.log(`\nReady to receive payments.\n`);
});

export default app;
