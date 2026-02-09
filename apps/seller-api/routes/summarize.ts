import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

const STOP_WORDS = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "was", "are", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "can", "shall", "it", "its", "this", "that", "these", "those", "i", "you", "he", "she", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his", "our", "their", "not", "no", "nor", "as", "if", "then", "so", "from", "up", "out", "about", "into", "over", "after", "before"]);

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
}

router.post("/api/summarize", (req: Request, res: Response) => {
  const { text, sentences: numSentences = 3 } = req.body || {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "Provide { text: string, sentences?: number }" });
  if (text.length > 50000) return res.status(400).json({ error: "Text must be under 50,000 characters" });

  const sentenceCount = Math.min(Math.max(numSentences, 1), 10);
  const sentences = splitSentences(text);

  if (sentences.length <= sentenceCount) {
    return res.json({ summary: text, sentenceCount: sentences.length, originalLength: text.length, summaryLength: text.length, payment: formatPayment(getX402Context(req)) });
  }

  // Count word frequencies (TF scoring)
  const wordFreq: Record<string, number> = {};
  for (const sentence of sentences) {
    const words = sentence.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
    for (const w of words) {
      if (!STOP_WORDS.has(w) && w.length > 2) wordFreq[w] = (wordFreq[w] || 0) + 1;
    }
  }

  // Score each sentence by sum of word frequencies
  const scored = sentences.map((s, i) => {
    const words = s.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
    const score = words.reduce((sum, w) => sum + (wordFreq[w] || 0), 0) / Math.max(words.length, 1);
    return { sentence: s, score, index: i };
  });

  // Pick top N by score, return in original order
  const top = scored.sort((a, b) => b.score - a.score).slice(0, sentenceCount).sort((a, b) => a.index - b.index);
  const summary = top.map((t) => t.sentence).join(" ");

  res.json({ summary, sentenceCount: top.length, originalLength: text.length, summaryLength: summary.length, compressionRatio: Math.round((1 - summary.length / text.length) * 100) + "%", payment: formatPayment(getX402Context(req)) });
});

export default router;
