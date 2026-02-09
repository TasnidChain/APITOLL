import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { weatherCache } from "../cache";

const router = Router();
const CACHE_TTL = 600_000;

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.get("/api/weather", async (req: Request, res: Response) => {
  const city = req.query.city as string | undefined;
  let lat = parseFloat(req.query.lat as string);
  let lon = parseFloat(req.query.lon as string);

  if (!city && (isNaN(lat) || isNaN(lon))) {
    return res.status(400).json({ error: "Provide ?city= or ?lat=&lon=", example: "/api/weather?city=London" });
  }

  try {
    let locationName = `${lat},${lon}`;
    if (city) {
      const geoResp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`, { signal: AbortSignal.timeout(8000) });
      const geoData = await geoResp.json() as { results?: Array<{ latitude: number; longitude: number; name: string; country: string }> };
      if (!geoData.results?.length) return res.status(404).json({ error: `City not found: ${city}` });
      lat = geoData.results[0].latitude;
      lon = geoData.results[0].longitude;
      locationName = `${geoData.results[0].name}, ${geoData.results[0].country}`;
    }

    const cacheKey = `weather:${lat.toFixed(2)}:${lon.toFixed(2)}`;
    const cached = weatherCache.get<Record<string, unknown>>(cacheKey);
    if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

    const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m`, { signal: AbortSignal.timeout(8000) });
    const weather = await resp.json() as { current_weather?: { temperature: number; windspeed: number; weathercode: number }; hourly?: { time: string[]; temperature_2m: number[]; relative_humidity_2m: number[]; wind_speed_10m: number[] } };

    const hourly = (weather.hourly?.time || []).slice(0, 24).map((time, i) => ({
      time, temperature: weather.hourly?.temperature_2m[i] ?? null,
      humidity: weather.hourly?.relative_humidity_2m[i] ?? null, windSpeed: weather.hourly?.wind_speed_10m[i] ?? null,
    }));

    const payload = {
      location: locationName,
      current: { temperature: weather.current_weather?.temperature ?? null, humidity: hourly[0]?.humidity ?? null, windSpeed: weather.current_weather?.windspeed ?? null, weatherCode: weather.current_weather?.weathercode ?? null },
      hourly,
    };
    weatherCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Weather service unavailable", details: (err as Error).message });
  }
});

export default router;
