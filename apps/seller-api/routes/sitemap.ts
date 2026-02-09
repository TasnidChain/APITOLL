import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { webCache } from "../cache";
import { safeFetch, validateDomain } from "../safe-fetch";

const router = Router();
const CACHE_TTL = 3600_000;

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.get("/api/sitemap", async (req: Request, res: Response) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).json({ error: "Provide ?domain=example.com" });

  let cleanDomain: string;
  try { cleanDomain = validateDomain(domain); } catch (err) { return res.status(400).json({ error: (err as Error).message }); }

  const cacheKey = `sitemap:${cleanDomain}`;
  const cached = webCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  const sitemapUrls = [
    `https://${cleanDomain}/sitemap.xml`,
    `https://${cleanDomain}/sitemap_index.xml`,
    `https://${cleanDomain}/sitemap.xml.gz`,
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const resp = await safeFetch(sitemapUrl, {
        headers: { "User-Agent": "APIToll-SitemapBot/1.0" },
        timeoutMs: 10000,
      });

      if (!resp.ok) continue;

      const xml = (await resp.text()).slice(0, 500000);

      const urlRegex = /<loc>([^<]+)<\/loc>/gi;
      const urls: { loc: string; lastmod?: string; priority?: string }[] = [];
      let match;

      while ((match = urlRegex.exec(xml)) !== null && urls.length < 500) {
        const loc = match[1].trim();
        const surrounding = xml.slice(Math.max(0, match.index - 200), match.index + match[0].length + 200);
        const lastmodMatch = surrounding.match(/<lastmod>([^<]+)<\/lastmod>/i);
        const priorityMatch = surrounding.match(/<priority>([^<]+)<\/priority>/i);

        urls.push({
          loc,
          lastmod: lastmodMatch?.[1] || undefined,
          priority: priorityMatch?.[1] || undefined,
        });
      }

      const isSitemapIndex = xml.includes("<sitemapindex");

      const payload = {
        domain: cleanDomain,
        sitemapUrl,
        isSitemapIndex,
        totalUrls: urls.length,
        urls: urls.slice(0, 100),
        truncated: urls.length > 100,
      };
      webCache.set(cacheKey, payload, CACHE_TTL);
      return res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
    } catch {
      continue;
    }
  }

  res.status(404).json({ error: "No sitemap found", domain: cleanDomain, triedUrls: sitemapUrls });
});

export default router;
