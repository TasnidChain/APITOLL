import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { geocodeCache } from "../cache";

const router = Router();

const CACHE_TTL = 86_400_000; // 24 hours — geocode results are essentially static
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || "APIToll-Geocode/1.0 (https://apitoll.com)";

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// Serial queue to enforce Nominatim's 1 req/sec rate limit
let lastRequestTime = 0;
async function nominatimThrottle(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 1100) {
    await new Promise((resolve) => setTimeout(resolve, 1100 - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

interface GeoResult {
  lat: number;
  lon: number;
  displayName: string;
  type: string;
  importance: number;
  boundingBox: number[] | null;
}

// Forward geocoding: address/place → coordinates
async function forwardGeocode(query: string, limit: number): Promise<GeoResult[]> {
  await nominatimThrottle();

  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: String(limit),
    addressdetails: "1",
  });

  const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!resp.ok) throw new Error(`Nominatim returned ${resp.status}`);

  const data = (await resp.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    type: string;
    importance: number;
    boundingbox?: string[];
  }>;

  return data.map((r) => ({
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    displayName: r.display_name,
    type: r.type,
    importance: Math.round(r.importance * 1000) / 1000,
    boundingBox: r.boundingbox ? r.boundingbox.map(Number) : null,
  }));
}

// Reverse geocoding: coordinates → address
async function reverseGeocode(lat: number, lon: number): Promise<Record<string, unknown> | null> {
  await nominatimThrottle();

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "json",
    addressdetails: "1",
  });

  const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!resp.ok) throw new Error(`Nominatim returned ${resp.status}`);

  const data = (await resp.json()) as {
    display_name?: string;
    address?: Record<string, string>;
  };

  if (!data.display_name) return null;

  return {
    displayName: data.display_name,
    road: data.address?.road || null,
    houseNumber: data.address?.house_number || null,
    city: data.address?.city || data.address?.town || data.address?.village || null,
    state: data.address?.state || null,
    country: data.address?.country || null,
    postalCode: data.address?.postcode || null,
  };
}

// GET /api/geocode?q=...&limit=5
router.get("/api/geocode", async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || "").trim();
  if (!q) {
    return res.status(400).json({
      error: "Missing required parameter: q",
      example: "/api/geocode?q=San+Francisco",
    });
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 5, 1), 10);
  const cacheKey = `geo:fwd:${q.toLowerCase()}:${limit}`;

  const cached = geocodeCache.get<any>(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });
  }

  try {
    const results = await forwardGeocode(q, limit);
    const payload = { query: q, results, resultCount: results.length, source: "nominatim" };
    geocodeCache.set(cacheKey, payload, CACHE_TTL);

    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Geocoding service unavailable", details: (err as Error).message });
  }
});

// GET /api/geocode/reverse?lat=...&lon=...
router.get("/api/geocode/reverse", async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({
      error: "Missing required parameters: lat, lon",
      example: "/api/geocode/reverse?lat=37.7749&lon=-122.4194",
    });
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: "lat must be -90 to 90, lon must be -180 to 180" });
  }

  const cacheKey = `geo:rev:${lat.toFixed(5)}:${lon.toFixed(5)}`;
  const cached = geocodeCache.get<any>(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });
  }

  try {
    const address = await reverseGeocode(lat, lon);
    if (!address) {
      return res.json({
        lat, lon,
        address: null,
        message: "No address found for these coordinates",
        source: "nominatim",
        cached: false,
        payment: formatPayment(getX402Context(req)),
      });
    }

    const payload = { lat, lon, address, source: "nominatim" };
    geocodeCache.set(cacheKey, payload, CACHE_TTL);

    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Reverse geocoding unavailable", details: (err as Error).message });
  }
});

export default router;
