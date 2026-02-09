import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { holidayCache } from "../cache";

const router = Router();
const CACHE_TTL = 86400_000;

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.get("/api/holidays", async (req: Request, res: Response) => {
  const country = ((req.query.country as string) || "US").toUpperCase();
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  const cacheKey = `holidays:${country}:${year}`;
  const cached = holidayCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    const resp = await fetch(`https://date.nager.at/api/v3/publicholidays/${year}/${country}`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return res.status(404).json({ error: `No holidays found for ${country} ${year}` });
    const data = await resp.json() as Array<{ date: string; localName: string; name: string; countryCode: string; types: string[] }>;

    const holidays = data.map((h) => ({ date: h.date, name: h.name, localName: h.localName, types: h.types }));
    const payload = { country, year, holidays, count: holidays.length };
    holidayCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Holiday service unavailable", details: (err as Error).message });
  }
});

export default router;
