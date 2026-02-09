import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { textCache } from "../cache";

const router = Router();
const CACHE_TTL = 3600_000;

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.post("/api/translate", async (req: Request, res: Response) => {
  const { text, from = "auto", to } = req.body || {};
  if (!text || !to) return res.status(400).json({ error: "Provide { text, to, from? }", example: '{ "text": "Hello", "to": "es" }' });
  if (text.length > 5000) return res.status(400).json({ error: "Text must be under 5,000 characters" });

  const cacheKey = `translate:${from}:${to}:${text.slice(0, 100)}`;
  const cached = textCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    const resp = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source: from === "auto" ? "auto" : from, target: to }),
      signal: AbortSignal.timeout(10000),
    });

    if (resp.ok) {
      const data = await resp.json() as { translatedText: string; detectedLanguage?: { language: string } };
      const payload = { original: text.slice(0, 500), translated: data.translatedText, from: data.detectedLanguage?.language || from, to, engine: "libretranslate" };
      textCache.set(cacheKey, payload, CACHE_TTL);
      return res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
    }

    // Fallback: return original with note
    res.json({ original: text.slice(0, 500), translated: text, from, to, engine: "passthrough", note: "Translation service temporarily unavailable", payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.json({ original: text.slice(0, 500), translated: text, from, to, engine: "passthrough", note: "Translation service unavailable", payment: formatPayment(getX402Context(req)) });
  }
});

export default router;
