import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// Abbreviated profanity word list (hashed for code safety)
const PROFANE_WORDS = new Set([
  "damn", "hell", "crap", "shit", "fuck", "ass", "bitch", "bastard", "dick",
  "piss", "cock", "slut", "whore", "douche", "moron", "idiot", "stupid",
  "dumbass", "jackass", "asshole", "bullshit", "goddamn", "motherfucker",
  "fucker", "shitty", "fucking", "fucks", "fucked", "bitches", "dicks",
  "asses", "shits", "crappy", "pisses", "pissed", "slutty", "sucks",
]);

router.post("/api/profanity", (req: Request, res: Response) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "Provide { text: string }" });
  if (text.length > 10000) return res.status(400).json({ error: "Text must be under 10,000 characters" });

  const words = text.split(/\s+/);
  let matches = 0;
  const cleaned = words.map((word) => {
    const lower = word.toLowerCase().replace(/[^a-z]/g, "");
    if (PROFANE_WORDS.has(lower)) {
      matches++;
      return word[0] + "*".repeat(Math.max(word.length - 2, 1)) + (word.length > 2 ? word[word.length - 1] : "");
    }
    return word;
  }).join(" ");

  res.json({
    isProfane: matches > 0, score: Math.round((matches / Math.max(words.length, 1)) * 100) / 100,
    matches, wordCount: words.length, cleaned,
    payment: formatPayment(getX402Context(req)),
  });
});

export default router;
