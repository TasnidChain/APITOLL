import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { enrichCache } from "../cache";

const router = Router();
const CACHE_TTL = 3_600_000; // 1 hour

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// NASA Astronomy Picture of the Day (free, no key required for demo.api)
router.get("/api/nasa/apod", async (req: Request, res: Response) => {
  const date = req.query.date as string | undefined;

  try {
    const cacheKey = `nasa:apod:${date || "today"}`;
    const cached = enrichCache.get<Record<string, unknown>>(cacheKey);
    if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

    const apiKey = process.env.NASA_API_KEY || "DEMO_KEY";
    const url = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}${date ? `&date=${date}` : ""}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!resp.ok) {
      return res.status(502).json({ error: "NASA API unavailable", status: resp.status });
    }

    const data = await resp.json() as {
      title: string; explanation: string; url: string; hdurl?: string;
      date: string; media_type: string; copyright?: string;
    };

    const payload = {
      title: data.title,
      explanation: data.explanation,
      imageUrl: data.url,
      hdImageUrl: data.hdurl || null,
      date: data.date,
      mediaType: data.media_type,
      copyright: data.copyright || null,
      source: "nasa.gov",
    };

    enrichCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "NASA API unavailable", details: (err as Error).message });
  }
});

// NASA Near Earth Objects (asteroids)
router.get("/api/nasa/asteroids", async (req: Request, res: Response) => {
  const startDate = req.query.start_date as string | undefined;
  const endDate = req.query.end_date as string | undefined;

  if (!startDate) {
    return res.status(400).json({ error: "Provide ?start_date=YYYY-MM-DD", example: "/api/nasa/asteroids?start_date=2025-01-01&end_date=2025-01-07" });
  }

  try {
    const cacheKey = `nasa:neo:${startDate}:${endDate || ""}`;
    const cached = enrichCache.get<Record<string, unknown>>(cacheKey);
    if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

    const apiKey = process.env.NASA_API_KEY || "DEMO_KEY";
    const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${startDate}${endDate ? `&end_date=${endDate}` : ""}&api_key=${apiKey}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!resp.ok) {
      return res.status(502).json({ error: "NASA NEO API unavailable", status: resp.status });
    }

    const data = await resp.json() as {
      element_count: number;
      near_earth_objects: Record<string, Array<{
        name: string; id: string;
        estimated_diameter: { kilometers: { estimated_diameter_min: number; estimated_diameter_max: number } };
        is_potentially_hazardous_asteroid: boolean;
        close_approach_data: Array<{ close_approach_date: string; relative_velocity: { kilometers_per_hour: string }; miss_distance: { kilometers: string } }>;
      }>>;
    };

    const asteroids = Object.entries(data.near_earth_objects).flatMap(([date, objects]) =>
      objects.map((obj) => ({
        name: obj.name,
        id: obj.id,
        date,
        diameterKm: {
          min: obj.estimated_diameter.kilometers.estimated_diameter_min,
          max: obj.estimated_diameter.kilometers.estimated_diameter_max,
        },
        hazardous: obj.is_potentially_hazardous_asteroid,
        closestApproach: obj.close_approach_data[0] ? {
          date: obj.close_approach_data[0].close_approach_date,
          velocityKmH: parseFloat(obj.close_approach_data[0].relative_velocity.kilometers_per_hour),
          missDistanceKm: parseFloat(obj.close_approach_data[0].miss_distance.kilometers),
        } : null,
      }))
    );

    const payload = {
      totalCount: data.element_count,
      asteroids: asteroids.slice(0, 20),
      source: "nasa.gov",
    };

    enrichCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "NASA NEO API unavailable", details: (err as Error).message });
  }
});

export default router;
