import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  const vowelGroups = word.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;
  if (word.endsWith("e") && count > 1) count--;
  if (word.endsWith("le") && word.length > 3 && !/[aeiouy]/.test(word[word.length - 3])) count++;
  return Math.max(1, count);
}

router.post("/api/readability", (req: Request, res: Response) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "Provide { text: string }" });
  if (text.length > 50000) return res.status(400).json({ error: "Text must be under 50,000 characters" });

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.replace(/[^a-z\s]/gi, "").split(/\s+/).filter(Boolean);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const sentenceCount = Math.max(sentences.length, 1);
  const wordCount = Math.max(words.length, 1);
  const avgSentenceLength = wordCount / sentenceCount;
  const avgSyllablesPerWord = syllables / wordCount;

  const fleschReadingEase = 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;
  const fleschKincaid = 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;

  let grade = "College";
  if (fleschReadingEase >= 90) grade = "5th Grade";
  else if (fleschReadingEase >= 80) grade = "6th Grade";
  else if (fleschReadingEase >= 70) grade = "7th Grade";
  else if (fleschReadingEase >= 60) grade = "8th-9th Grade";
  else if (fleschReadingEase >= 50) grade = "10th-12th Grade";
  else if (fleschReadingEase >= 30) grade = "College";
  else grade = "College Graduate";

  res.json({
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    fleschKincaid: Math.round(fleschKincaid * 10) / 10,
    grade, avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    sentences: sentenceCount, words: wordCount, syllables,
    payment: formatPayment(getX402Context(req)),
  });
});

export default router;
