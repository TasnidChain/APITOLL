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

router.get("/api/favicon", async (req: Request, res: Response) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).json({ error: "Provide ?domain=example.com" });

  let cleanDomain: string;
  try { cleanDomain = validateDomain(domain); } catch (err) { return res.status(400).json({ error: (err as Error).message }); }

  const cacheKey = `favicon:${cleanDomain}`;
  const cached = webCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    const resp = await safeFetch(`https://${cleanDomain}`, {
      headers: { "User-Agent": "APIToll-FaviconBot/1.0" },
      timeoutMs: 10000,
    });

    const html = (await resp.text()).slice(0, 100000);

    const favicons: { href: string; type?: string; sizes?: string }[] = [];

    const iconRegex = /<link[^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*>/gi;
    const appleTouchRegex = /<link[^>]*rel=["']apple-touch-icon["'][^>]*>/gi;
    const allIconRegex = [iconRegex, appleTouchRegex];

    for (const regex of allIconRegex) {
      let match;
      while ((match = regex.exec(html)) !== null) {
        const tag = match[0];
        const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
        const typeMatch = tag.match(/type=["']([^"']+)["']/i);
        const sizesMatch = tag.match(/sizes=["']([^"']+)["']/i);

        if (hrefMatch) {
          let href = hrefMatch[1];
          try { href = new URL(href, `https://${cleanDomain}`).toString(); } catch { /* keep as-is */ }
          favicons.push({
            href,
            type: typeMatch?.[1] || undefined,
            sizes: sizesMatch?.[1] || undefined,
          });
        }
      }
    }

    const defaultFavicon = `https://${cleanDomain}/favicon.ico`;

    const payload = {
      domain: cleanDomain,
      favicons,
      defaultFavicon,
      googleFavicon: `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`,
      count: favicons.length,
    };
    webCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("internal") || msg.includes("private") || msg.includes("blocked")) {
      return res.status(400).json({ error: msg });
    }
    // Fallback
    const payload = {
      domain: cleanDomain,
      favicons: [],
      defaultFavicon: `https://${cleanDomain}/favicon.ico`,
      googleFavicon: `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`,
      count: 0,
      note: "Could not fetch page — returning default locations",
    };
    res.json({ ...payload, payment: formatPayment(getX402Context(req)) });
  }
});

export default router;
