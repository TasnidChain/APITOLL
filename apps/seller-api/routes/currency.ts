import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { currencyCache } from "../cache";

const router = Router();
const CACHE_TTL = 3600_000;

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.get("/api/currency", async (req: Request, res: Response) => {
  const from = ((req.query.from as string) || "USD").toUpperCase();
  const to = ((req.query.to as string) || "EUR").toUpperCase();
  const amount = parseFloat(req.query.amount as string) || 1;

  const cacheKey = `currency:${from}:${to}:${amount}`;
  const cached = currencyCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    const resp = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}&amount=${amount}`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return res.status(400).json({ error: `Invalid currency pair: ${from}/${to}` });
    const data = await resp.json() as { base: string; date: string; rates: Record<string, number> };

    const payload = { from, to, amount, converted: data.rates[to], rate: data.rates[to] / amount, date: data.date };
    currencyCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Currency service unavailable", details: (err as Error).message });
  }
});

export default router;
