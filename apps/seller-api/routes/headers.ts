import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { webCache } from "../cache";
import { safeFetch } from "../safe-fetch";

const router = Router();
const CACHE_TTL = 600_000;

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.get("/api/headers", async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: "Provide ?url=https://example.com" });

  const cacheKey = `headers:${url}`;
  const cached = webCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    const resp = await safeFetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "APIToll-HeaderBot/1.0" },
      timeoutMs: 10000,
    });

    const headers: Record<string, string> = {};
    resp.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Extract security headers
    const securityHeaders = {
      "strict-transport-security": headers["strict-transport-security"] || null,
      "content-security-policy": headers["content-security-policy"] || null,
      "x-frame-options": headers["x-frame-options"] || null,
      "x-content-type-options": headers["x-content-type-options"] || null,
      "x-xss-protection": headers["x-xss-protection"] || null,
      "referrer-policy": headers["referrer-policy"] || null,
      "permissions-policy": headers["permissions-policy"] || null,
    };

    const presentSecurity = Object.entries(securityHeaders).filter(([, v]) => v !== null).length;
    const totalSecurity = Object.keys(securityHeaders).length;

    const payload = {
      url,
      statusCode: resp.status,
      statusText: resp.statusText,
      headers,
      securityHeaders,
      securityScore: `${presentSecurity}/${totalSecurity}`,
      server: headers["server"] || null,
      contentType: headers["content-type"] || null,
      redirected: resp.redirected,
      finalUrl: resp.url,
    };
    webCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("internal") || msg.includes("private") || msg.includes("blocked")) {
      return res.status(400).json({ error: msg });
    }
    res.status(502).json({ error: "Failed to fetch headers" });
  }
});

export default router;
