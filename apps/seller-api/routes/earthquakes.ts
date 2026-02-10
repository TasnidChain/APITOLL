import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { enrichCache } from "../cache";

const router = Router();
const CACHE_TTL = 300_000; // 5 minutes

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// USGS Earthquake data (free, no key)
router.get("/api/earthquakes", async (req: Request, res: Response) => {
  const period = (req.query.period as string) || "day"; // hour, day, week, month
  const minMagnitude = req.query.min_magnitude as string || "2.5"; // significant, 4.5, 2.5, 1.0, all
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

  const validPeriods = ["hour", "day", "week", "month"];
  if (!validPeriods.includes(period)) {
    return res.status(400).json({ error: `Invalid period. Use: ${validPeriods.join(", ")}`, example: "/api/earthquakes?period=day&min_magnitude=4.5" });
  }

  // Map magnitude to USGS feed names
  const magMap: Record<string, string> = {
    "significant": "significant",
    "4.5": "4.5",
    "2.5": "2.5",
    "1.0": "1.0",
    "all": "all",
  };
  const magKey = magMap[minMagnitude] || "2.5";

  try {
    const cacheKey = `earthquakes:${period}:${magKey}`;
    const cached = enrichCache.get<Record<string, unknown>>(cacheKey);
    if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

    const url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${magKey}_${period}.geojson`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!resp.ok) {
      return res.status(502).json({ error: "USGS Earthquake API unavailable" });
    }

    const data = await resp.json() as {
      metadata: { generated: number; title: string; count: number };
      features: Array<{
        properties: {
          mag: number; place: string; time: number; url: string;
          tsunami: number; type: string; title: string; alert?: string;
        };
        geometry: { coordinates: [number, number, number] };
      }>;
    };

    const earthquakes = data.features.slice(0, limit).map((f) => ({
      magnitude: f.properties.mag,
      location: f.properties.place,
      time: new Date(f.properties.time).toISOString(),
      coordinates: {
        longitude: f.geometry.coordinates[0],
        latitude: f.geometry.coordinates[1],
        depthKm: f.geometry.coordinates[2],
      },
      tsunami: f.properties.tsunami === 1,
      type: f.properties.type,
      alert: f.properties.alert || null,
      detailsUrl: f.properties.url,
    }));

    const payload = {
      title: data.metadata.title,
      totalCount: data.metadata.count,
      returned: earthquakes.length,
      earthquakes,
      source: "earthquake.usgs.gov",
    };

    enrichCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "USGS Earthquake API unavailable", details: (err as Error).message });
  }
});

export default router;
