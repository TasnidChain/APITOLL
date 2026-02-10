import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// ─── Named Entity Extraction ─────────────────────────────────

const ENTITY_PATTERNS: [string, RegExp][] = [
  ["EMAIL", /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g],
  ["URL", /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g],
  ["PHONE", /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g],
  ["IP_ADDRESS", /\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  ["DATE", /\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b/gi],
  ["CURRENCY", /(?:\$|€|£|¥)\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s?(?:USD|EUR|GBP|BTC|ETH|USDC)\b/g],
  ["CRYPTO_ADDRESS", /\b0x[a-fA-F0-9]{40}\b/g],
  ["HASHTAG", /#[a-zA-Z]\w{1,49}\b/g],
  ["MENTION", /@[a-zA-Z]\w{0,38}\b/g],
  ["VERSION", /\bv?\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9.]+)?\b/g],
];

router.post("/api/entities", (req: Request, res: Response) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Provide { text: string } in request body" });
  }
  if (text.length > 50000) {
    return res.status(400).json({ error: "Text must be under 50,000 characters" });
  }

  const entities: Array<{ type: string; value: string; start: number; end: number }> = [];

  for (const [type, pattern] of ENTITY_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      entities.push({
        type,
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Sort by position
  entities.sort((a, b) => a.start - b.start);

  // Group by type
  const byType: Record<string, string[]> = {};
  for (const e of entities) {
    if (!byType[e.type]) byType[e.type] = [];
    if (!byType[e.type].includes(e.value)) byType[e.type].push(e.value);
  }

  res.json({
    text: text.slice(0, 200),
    entityCount: entities.length,
    entities,
    byType,
    payment: formatPayment(getX402Context(req)),
  });
});

// ─── Text Similarity (Jaccard + Cosine on word vectors) ──────

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function cosineSimilarity(a: string[], b: string[]): number {
  const vocab = new Set([...a, ...b]);
  const vecA: number[] = [];
  const vecB: number[] = [];

  for (const word of vocab) {
    vecA.push(a.filter((w) => w === word).length);
    vecB.push(b.filter((w) => w === word).length);
  }

  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] ** 2;
    magB += vecB[i] ** 2;
  }

  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag === 0 ? 0 : dot / mag;
}

router.post("/api/similarity", (req: Request, res: Response) => {
  const { text1, text2 } = req.body || {};
  if (!text1 || !text2 || typeof text1 !== "string" || typeof text2 !== "string") {
    return res.status(400).json({ error: "Provide { text1: string, text2: string } in request body" });
  }

  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  const jaccard = Math.round(jaccardSimilarity(set1, set2) * 1000) / 1000;
  const cosine = Math.round(cosineSimilarity(tokens1, tokens2) * 1000) / 1000;

  // Shared and unique words
  const shared = [...set1].filter((w) => set2.has(w));
  const uniqueTo1 = [...set1].filter((w) => !set2.has(w));
  const uniqueTo2 = [...set2].filter((w) => !set1.has(w));

  res.json({
    jaccard,
    cosine,
    combined: Math.round(((jaccard + cosine) / 2) * 1000) / 1000,
    sharedWords: shared.length,
    shared: shared.slice(0, 20),
    uniqueToText1: uniqueTo1.slice(0, 20),
    uniqueToText2: uniqueTo2.slice(0, 20),
    text1Length: tokens1.length,
    text2Length: tokens2.length,
    payment: formatPayment(getX402Context(req)),
  });
});

export default router;
