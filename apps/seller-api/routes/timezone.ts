import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { timezoneCache } from "../cache";

const router = Router();
const CACHE_TTL = 60_000;

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.get("/api/timezone", async (req: Request, res: Response) => {
  const tz = req.query.tz as string | undefined;

  if (!tz) return res.status(400).json({ error: "Provide ?tz=America/New_York", example: "/api/timezone?tz=Europe/London" });

  const cacheKey = `tz:${tz}`;
  const cached = timezoneCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    const resp = await fetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(tz)}`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return res.status(404).json({ error: `Timezone not found: ${tz}` });
    const data = await resp.json() as Record<string, unknown>;

    const payload = { timezone: data.timezone, datetime: data.datetime, utcOffset: data.utc_offset, abbreviation: data.abbreviation, dayOfWeek: data.day_of_week, weekNumber: data.week_number, unixtime: data.unixtime };
    timezoneCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Timezone service unavailable", details: (err as Error).message });
  }
});

export default router;
