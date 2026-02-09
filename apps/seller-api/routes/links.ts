import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { webCache } from "../cache";
import { safeFetch } from "../safe-fetch";

const router = Router();
const CACHE_TTL = 1800_000;

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.get("/api/links", async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: "Provide ?url=https://example.com" });

  let parsed: URL;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: "Invalid URL" }); }

  const cacheKey = `links:${url}`;
  const cached = webCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    const resp = await safeFetch(url, { headers: { "User-Agent": "APIToll-LinkBot/1.0" }, timeoutMs: 10000 });
    const html = (await resp.text()).slice(0, 200000);

    const linkRegex = /<a[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const links: { href: string; text: string; external: boolean }[] = [];
    let match;

    while ((match = linkRegex.exec(html)) !== null && links.length < 200) {
      let href = match[1].trim();
      const text = match[2].replace(/<[^>]*>/g, "").trim().slice(0, 200);

      // Resolve relative URLs
      try {
        href = new URL(href, url).toString();
      } catch { continue; }

      const external = new URL(href).hostname !== parsed.hostname;
      links.push({ href, text: text || "(no text)", external });
    }

    const internal = links.filter((l) => !l.external);
    const ext = links.filter((l) => l.external);

    const payload = {
      url,
      totalLinks: links.length,
      internalLinks: internal.length,
      externalLinks: ext.length,
      links,
    };
    webCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("internal") || msg.includes("private") || msg.includes("blocked")) {
      return res.status(400).json({ error: msg });
    }
    res.status(502).json({ error: "Failed to fetch URL" });
  }
});

export default router;
