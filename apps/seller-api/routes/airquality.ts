import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { weatherCache } from "../cache";

const router = Router();
const CACHE_TTL = 600_000; // 10 minutes

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// Air quality via Open-Meteo (free, no key)
router.get("/api/air-quality", async (req: Request, res: Response) => {
  const city = req.query.city as string | undefined;
  let lat = parseFloat(req.query.lat as string);
  let lon = parseFloat(req.query.lon as string);

  if (!city && (isNaN(lat) || isNaN(lon))) {
    return res.status(400).json({ error: "Provide ?city= or ?lat=&lon=", example: "/api/air-quality?city=Beijing" });
  }

  try {
    let locationName = `${lat},${lon}`;

    if (city) {
      const geoResp = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
        { signal: AbortSignal.timeout(5000) }
      );
      const geoData = await geoResp.json() as { results?: Array<{ latitude: number; longitude: number; name: string; country: string }> };
      if (!geoData.results?.length) return res.status(404).json({ error: `City not found: ${city}` });
      lat = geoData.results[0].latitude;
      lon = geoData.results[0].longitude;
      locationName = `${geoData.results[0].name}, ${geoData.results[0].country}`;
    }

    const cacheKey = `airquality:${lat.toFixed(2)}:${lon.toFixed(2)}`;
    const cached = weatherCache.get<Record<string, unknown>>(cacheKey);
    if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

    const resp = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&hourly=us_aqi,pm2_5,pm10&forecast_days=1`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!resp.ok) {
      return res.status(502).json({ error: "Air quality API unavailable" });
    }

    const data = await resp.json() as {
      current?: {
        us_aqi?: number; pm10?: number; pm2_5?: number;
        carbon_monoxide?: number; nitrogen_dioxide?: number;
        sulphur_dioxide?: number; ozone?: number;
      };
      hourly?: { time: string[]; us_aqi: (number | null)[]; pm2_5: (number | null)[]; pm10: (number | null)[] };
    };

    const aqi = data.current?.us_aqi ?? null;
    let category = "Unknown";
    if (aqi !== null) {
      if (aqi <= 50) category = "Good";
      else if (aqi <= 100) category = "Moderate";
      else if (aqi <= 150) category = "Unhealthy for Sensitive Groups";
      else if (aqi <= 200) category = "Unhealthy";
      else if (aqi <= 300) category = "Very Unhealthy";
      else category = "Hazardous";
    }

    const hourly = (data.hourly?.time || []).slice(0, 24).map((time, i) => ({
      time,
      aqi: data.hourly?.us_aqi[i] ?? null,
      pm25: data.hourly?.pm2_5[i] ?? null,
      pm10: data.hourly?.pm10[i] ?? null,
    }));

    const payload = {
      location: locationName,
      current: {
        aqi,
        category,
        pm25: data.current?.pm2_5 ?? null,
        pm10: data.current?.pm10 ?? null,
        co: data.current?.carbon_monoxide ?? null,
        no2: data.current?.nitrogen_dioxide ?? null,
        so2: data.current?.sulphur_dioxide ?? null,
        ozone: data.current?.ozone ?? null,
      },
      hourly,
      source: "open-meteo.com",
    };

    weatherCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Air quality API unavailable", details: (err as Error).message });
  }
});

export default router;
