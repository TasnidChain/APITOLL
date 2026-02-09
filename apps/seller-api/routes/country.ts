import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { countryCache } from "../cache";

const router = Router();
const CACHE_TTL = 86400_000;

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.get("/api/country", async (req: Request, res: Response) => {
  const name = req.query.name as string | undefined;
  const code = req.query.code as string | undefined;

  if (!name && !code) return res.status(400).json({ error: "Provide ?name= or ?code=", example: "/api/country?name=Germany" });

  const cacheKey = `country:${name || code}`;
  const cached = countryCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    const url = code
      ? `https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}`
      : `https://restcountries.com/v3.1/name/${encodeURIComponent(name!)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return res.status(404).json({ error: "Country not found" });
    const data = await resp.json() as Array<Record<string, unknown>>;
    const c = data[0] as Record<string, unknown>;
    const nameObj = c.name as Record<string, unknown>;

    const payload = {
      name: nameObj?.common, official: nameObj?.official,
      capital: (c.capital as string[])?.[0], population: c.population, area: c.area,
      region: c.region, subregion: c.subregion,
      languages: c.languages, currencies: c.currencies,
      flag: (c.flags as Record<string, string>)?.svg, cca2: c.cca2, cca3: c.cca3,
      borders: c.borders, timezones: c.timezones, latlng: c.latlng,
    };
    countryCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Country service unavailable", details: (err as Error).message });
  }
});

export default router;
