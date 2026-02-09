import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { webCache } from "../cache";
import { safeFetch } from "../safe-fetch";

const router = Router();
const CACHE_TTL = 3600_000;

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

function extractMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i"),
  ];
  for (const p of patterns) { const m = html.match(p); if (m) return m[1]; }
  return null;
}

router.get("/api/meta", async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: "Provide ?url=https://example.com" });

  const cacheKey = `meta:${url}`;
  const cached = webCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    const resp = await safeFetch(url, { headers: { "User-Agent": "APIToll-MetaBot/1.0" }, timeoutMs: 10000 });
    const html = (await resp.text()).slice(0, 100000);

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
    const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i);

    const payload = {
      url, title: titleMatch?.[1]?.trim() || null,
      description: extractMeta(html, "description"),
      openGraph: { title: extractMeta(html, "og:title"), description: extractMeta(html, "og:description"), image: extractMeta(html, "og:image"), type: extractMeta(html, "og:type"), url: extractMeta(html, "og:url") },
      twitter: { card: extractMeta(html, "twitter:card"), title: extractMeta(html, "twitter:title"), description: extractMeta(html, "twitter:description"), image: extractMeta(html, "twitter:image") },
      canonical: canonicalMatch?.[1] || null, favicon: faviconMatch?.[1] || null,
    };
    webCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("internal") || msg.includes("private") || msg.includes("blocked") || msg.includes("Invalid") || msg.includes("Only")) {
      return res.status(400).json({ error: msg });
    }
    res.status(502).json({ error: "Failed to fetch URL" });
  }
});

export default router;
