import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

const STOP_WORDS = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "was", "are", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "can", "shall", "it", "its", "this", "that", "these", "those", "i", "you", "he", "she", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his", "our", "their", "not", "no", "as", "if", "then", "so", "from", "up", "out", "about", "into", "over", "after", "before", "also", "just", "more", "very", "much", "many", "some", "any", "each", "every", "all", "both", "few", "most", "other", "such", "than"]);

router.post("/api/keywords", (req: Request, res: Response) => {
  const { text, count = 10 } = req.body || {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "Provide { text: string, count?: number }" });
  if (text.length > 50000) return res.status(400).json({ error: "Text must be under 50,000 characters" });

  const words = text.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;

  const maxCount = Math.min(Math.max(count, 1), 50);
  const keywords = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxCount)
    .map(([word, cnt]) => ({ word, count: cnt, score: Math.round((cnt / words.length) * 10000) / 10000 }));

  res.json({ keywords, totalWords: words.length, uniqueWords: Object.keys(freq).length, payment: formatPayment(getX402Context(req)) });
});

export default router;
