import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// Random inspirational/famous quotes (ZenQuotes - free, no key)
router.get("/api/quote", async (req: Request, res: Response) => {
  const count = Math.min(parseInt(req.query.count as string) || 1, 10);

  try {
    // ZenQuotes API — free, no key required
    const url = count > 1
      ? "https://zenquotes.io/api/quotes"
      : "https://zenquotes.io/api/random";
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (resp.ok) {
      const data = await resp.json() as Array<{ q: string; a: string; h: string }>;
      const quotes = data.slice(0, count).map((q) => ({
        text: q.q,
        author: q.a,
      }));

      return res.json({
        quotes,
        count: quotes.length,
        source: "zenquotes.io",
        cached: false,
        payment: formatPayment(getX402Context(req)),
      });
    }
  } catch {
    // Fall through to fallback
  }

  try {
    // Fallback: Quotable API
    const resp = await fetch(`https://api.quotable.io/quotes/random?limit=${count}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (resp.ok) {
      const data = await resp.json() as Array<{ content: string; author: string; tags: string[] }>;
      const quotes = data.map((q) => ({
        text: q.content,
        author: q.author,
        tags: q.tags,
      }));

      return res.json({
        quotes,
        count: quotes.length,
        source: "quotable.io",
        cached: false,
        payment: formatPayment(getX402Context(req)),
      });
    }
  } catch {
    // Fall through
  }

  res.status(502).json({ error: "Quote services unavailable" });
});

export default router;
