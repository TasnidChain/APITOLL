/**
 * Example: Monetize an AI/LLM proxy with x402 micropayments.
 *
 * Run: SELLER_WALLET=0x... OPENAI_API_KEY=sk-... npx tsx examples/seller-ai-proxy/server.ts
 *
 * This is the killer use case — wrap any AI model behind a paid API.
 * Agents pay per-request in USDC instead of needing API keys.
 *
 * Endpoints:
 *   POST /api/complete    — $0.01/call  — Text completion (GPT-4)
 *   POST /api/summarize   — $0.005/call — Summarize text
 *   POST /api/sentiment   — $0.002/call — Sentiment analysis
 *   GET  /health          — FREE
 */

import express from "express";
import { paymentMiddleware, getX402Context } from "@apitoll/seller-sdk";

const app = express();
app.use(express.json());

// x402 payment middleware — agents pay per call, no API keys needed
app.use(
  paymentMiddleware({
    walletAddress: process.env.SELLER_WALLET!,
    endpoints: {
      "POST /api/complete": {
        price: "0.01",
        chains: ["base"],
        description: "GPT-4 text completion. Send { prompt, max_tokens? }",
      },
      "POST /api/summarize": {
        price: "0.005",
        chains: ["base"],
        description: "Summarize long text. Send { text, max_length? }",
      },
      "POST /api/sentiment": {
        price: "0.002",
        chains: ["base"],
        description: "Analyze sentiment of text. Send { text }",
      },
    },
    facilitatorUrl: process.env.FACILITATOR_URL || "https://facilitator-production-fbd7.up.railway.app",
    discovery: {
      sellerName: "AI Proxy API",
      referralCode: process.env.REFERRAL_CODE || "ai-proxy",
      relatedTools: [
        { name: "Text Completion", url: "/api/complete", price: "0.01", description: "GPT-4 completion", method: "POST" },
        { name: "Summarization", url: "/api/summarize", price: "0.005", description: "Text summarization", method: "POST" },
        { name: "Sentiment Analysis", url: "/api/sentiment", price: "0.002", description: "Sentiment analysis", method: "POST" },
      ],
    },
  })
);

// Helper: call OpenAI (or return mock if no key)
async function callLLM(prompt: string, maxTokens = 200): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    // Mock response for demo
    return `[Mock response] Analysis of: "${prompt.slice(0, 50)}..." — This is a simulated AI response. Set OPENAI_API_KEY to use real GPT-4.`;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
    }),
  });

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content || "No response generated";
}

// Text completion
app.post("/api/complete", async (req, res) => {
  const { prompt, max_tokens } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing 'prompt' in body" });

  const ctx = getX402Context(req);
  const completion = await callLLM(prompt, max_tokens || 200);

  res.json({
    completion,
    model: process.env.OPENAI_API_KEY ? "gpt-4" : "mock",
    tokens_used: completion.split(" ").length,
    payment: ctx?.receipt ? { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount } : null,
  });
});

// Summarization
app.post("/api/summarize", async (req, res) => {
  const { text, max_length } = req.body;
  if (!text) return res.status(400).json({ error: "Missing 'text' in body" });

  const prompt = `Summarize the following text in ${max_length || 100} words or fewer:\n\n${text}`;
  const summary = await callLLM(prompt, max_length || 100);

  res.json({
    summary,
    original_length: text.length,
    summary_length: summary.length,
    compression: ((1 - summary.length / text.length) * 100).toFixed(1) + "%",
  });
});

// Sentiment analysis
app.post("/api/sentiment", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing 'text' in body" });

  const prompt = `Analyze the sentiment of this text. Return ONLY a JSON object with: { "sentiment": "positive"|"negative"|"neutral", "confidence": 0-1, "keywords": ["word1", "word2"] }\n\nText: ${text}`;
  const result = await callLLM(prompt, 100);

  // Try to parse as JSON, fallback to raw
  try {
    const parsed = JSON.parse(result);
    res.json({ analysis: parsed, text_length: text.length });
  } catch {
    res.json({
      analysis: { sentiment: "neutral", confidence: 0.5, raw: result },
      text_length: text.length,
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "ai-proxy",
    model: process.env.OPENAI_API_KEY ? "gpt-4" : "mock",
  });
});

const PORT = parseInt(process.env.PORT || "4404", 10);

if (!process.env.SELLER_WALLET) {
  console.error("ERROR: SELLER_WALLET required");
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`\nAI Proxy API on http://localhost:${PORT}`);
  console.log(`Model: ${process.env.OPENAI_API_KEY ? "GPT-4 (live)" : "Mock (set OPENAI_API_KEY for real)"}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /api/complete   $0.01   Text completion`);
  console.log(`  POST /api/summarize  $0.005  Summarization`);
  console.log(`  POST /api/sentiment  $0.002  Sentiment analysis`);
  console.log(`  GET  /health         FREE`);
  console.log(`\nSeller: ${process.env.SELLER_WALLET}\n`);
});
