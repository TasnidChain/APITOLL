import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { ipCache } from "../cache";

const router = Router();
const CACHE_TTL = 3600_000;

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.get("/api/ip", async (req: Request, res: Response) => {
  const address = (req.query.address as string) || req.ip || "8.8.8.8";

  const cacheKey = `ip:${address}`;
  const cached = ipCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    const resp = await fetch(`http://ip-api.com/json/${encodeURIComponent(address)}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`, { signal: AbortSignal.timeout(8000) });
    const data = await resp.json() as Record<string, unknown>;

    if (data.status === "fail") return res.status(400).json({ error: data.message || "Invalid IP address" });

    const payload = { ip: data.query, country: data.country, countryCode: data.countryCode, region: data.regionName, city: data.city, zip: data.zip, lat: data.lat, lon: data.lon, timezone: data.timezone, isp: data.isp, org: data.org, as: data.as };
    ipCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "IP lookup service unavailable", details: (err as Error).message });
  }
});

export default router;
