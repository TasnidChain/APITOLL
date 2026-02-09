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

interface RobotsRule {
  userAgent: string;
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
}

function parseRobotsTxt(text: string): { rules: RobotsRule[]; sitemaps: string[] } {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const rules: RobotsRule[] = [];
  const sitemaps: string[] = [];
  let current: RobotsRule | null = null;

  for (const line of lines) {
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const lowerKey = key.toLowerCase().trim();

    if (lowerKey === "user-agent") {
      current = { userAgent: value, allow: [], disallow: [] };
      rules.push(current);
    } else if (lowerKey === "allow" && current) {
      current.allow.push(value);
    } else if (lowerKey === "disallow" && current) {
      current.disallow.push(value);
    } else if (lowerKey === "crawl-delay" && current) {
      current.crawlDelay = parseFloat(value) || undefined;
    } else if (lowerKey === "sitemap") {
      sitemaps.push(value);
    }
  }

  return { rules, sitemaps };
}

router.get("/api/robots", async (req: Request, res: Response) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).json({ error: "Provide ?domain=example.com" });

  let cleanDomain: string;
  try { cleanDomain = validateDomain(domain); } catch (err) { return res.status(400).json({ error: (err as Error).message }); }

  const cacheKey = `robots:${cleanDomain}`;
  const cached = webCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    const url = `https://${cleanDomain}/robots.txt`;
    const resp = await safeFetch(url, {
      headers: { "User-Agent": "APIToll-RobotsBot/1.0" },
      timeoutMs: 10000,
    });

    if (!resp.ok) {
      return res.status(404).json({ error: "robots.txt not found", domain: cleanDomain, statusCode: resp.status });
    }

    const text = (await resp.text()).slice(0, 100000);
    const parsed = parseRobotsTxt(text);

    const payload = {
      domain: cleanDomain,
      url,
      rules: parsed.rules,
      sitemaps: parsed.sitemaps,
      raw: text.slice(0, 5000),
    };
    webCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("internal") || msg.includes("private") || msg.includes("blocked")) {
      return res.status(400).json({ error: msg });
    }
    res.status(502).json({ error: "Failed to fetch robots.txt" });
  }
});

export default router;
