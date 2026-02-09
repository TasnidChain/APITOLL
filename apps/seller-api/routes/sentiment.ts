import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// AFINN-165 subset — common positive/negative words with scores (-5 to +5)
const AFINN: Record<string, number> = {
  good: 3, great: 3, excellent: 3, amazing: 4, awesome: 4, fantastic: 4, wonderful: 4, love: 3, happy: 3, joy: 3, beautiful: 3, perfect: 3, best: 3, brilliant: 4, outstanding: 5, superb: 5, magnificent: 4, delightful: 3, pleasant: 3, nice: 2, fine: 2, okay: 1, like: 2, enjoy: 2, glad: 3, pleased: 2, satisfied: 2, impressed: 3, remarkable: 3, exceptional: 4, positive: 2, success: 2, win: 3, winning: 3, won: 3, profit: 2, gain: 2, improve: 2, improved: 2, helpful: 2, useful: 2, valuable: 2, exciting: 3, inspired: 3, creative: 2, innovative: 2, effective: 2, efficient: 2,
  bad: -3, terrible: -4, horrible: -4, awful: -4, worst: -5, hate: -4, angry: -3, sad: -2, ugly: -3, poor: -2, fail: -2, failure: -2, failed: -2, wrong: -2, error: -2, mistake: -2, broken: -2, damage: -2, damaged: -2, destroy: -3, destroyed: -3, loss: -2, lose: -2, lost: -2, pain: -2, painful: -2, hurt: -2, suffer: -2, negative: -2, problem: -2, trouble: -2, risk: -2, danger: -3, dangerous: -3, fear: -2, worried: -2, boring: -2, dull: -2, disappointing: -3, disappointed: -2, frustrating: -2, frustrated: -2, annoying: -2, annoyed: -2, useless: -2, waste: -2, wasted: -2, stupid: -3, ridiculous: -3, pathetic: -3, disaster: -4, catastrophe: -4, crisis: -3, death: -3, dead: -3, kill: -3, killed: -3, toxic: -3, scam: -4, fraud: -4,
};

router.post("/api/sentiment", (req: Request, res: Response) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "Provide { text: string } in request body" });

  const words = text.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
  let score = 0;
  const positive: string[] = [];
  const negative: string[] = [];

  for (const word of words) {
    const val = AFINN[word];
    if (val !== undefined) {
      score += val;
      if (val > 0) positive.push(word);
      else negative.push(word);
    }
  }

  const comparative = words.length > 0 ? score / words.length : 0;
  res.json({
    text: text.slice(0, 200), score, comparative: Math.round(comparative * 1000) / 1000,
    sentiment: score > 0 ? "positive" : score < 0 ? "negative" : "neutral",
    positive: [...new Set(positive)], negative: [...new Set(negative)],
    wordCount: words.length, payment: formatPayment(getX402Context(req)),
  });
});

export default router;
