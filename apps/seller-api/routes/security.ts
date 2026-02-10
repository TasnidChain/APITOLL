import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { safeFetch, validateDomain } from "../safe-fetch";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}


const SECURITY_HEADERS = [
  { name: "Strict-Transport-Security", severity: "high", description: "HSTS — enforces HTTPS connections" },
  { name: "Content-Security-Policy", severity: "high", description: "CSP — prevents XSS and injection attacks" },
  { name: "X-Content-Type-Options", severity: "medium", description: "Prevents MIME-type sniffing" },
  { name: "X-Frame-Options", severity: "medium", description: "Prevents clickjacking via iframes" },
  { name: "X-XSS-Protection", severity: "low", description: "Legacy XSS filter (deprecated but still useful)" },
  { name: "Referrer-Policy", severity: "medium", description: "Controls referrer information sent with requests" },
  { name: "Permissions-Policy", severity: "medium", description: "Controls browser feature permissions" },
  { name: "Cross-Origin-Opener-Policy", severity: "low", description: "Isolates browsing context" },
  { name: "Cross-Origin-Resource-Policy", severity: "low", description: "Prevents cross-origin reads" },
  { name: "Cross-Origin-Embedder-Policy", severity: "low", description: "Controls cross-origin embedding" },
];

router.get("/api/security/headers", async (req: Request, res: Response) => {
  const url = (req.query.url as string || "").trim();
  if (!url) {
    return res.status(400).json({
      error: "Missing required parameter: url",
      example: "/api/security/headers?url=https://example.com",
    });
  }

  let targetUrl = url;
  if (!targetUrl.startsWith("http")) targetUrl = `https://${targetUrl}`;

  try {
    const resp = await safeFetch(targetUrl, {
      timeoutMs: 10000,
      headers: {
        "User-Agent": "APIToll-SecurityScan/1.0",
        Accept: "text/html",
      },
    });

    const present: Array<{ name: string; value: string; severity: string; description: string }> = [];
    const missing: Array<{ name: string; severity: string; description: string }> = [];

    for (const header of SECURITY_HEADERS) {
      const value = resp.headers.get(header.name);
      if (value) {
        present.push({ ...header, value });
      } else {
        missing.push(header);
      }
    }

    const score = Math.round((present.length / SECURITY_HEADERS.length) * 100);
    let grade: string;
    if (score >= 90) grade = "A+";
    else if (score >= 80) grade = "A";
    else if (score >= 70) grade = "B";
    else if (score >= 60) grade = "C";
    else if (score >= 40) grade = "D";
    else grade = "F";

    res.json({
      url: targetUrl,
      score,
      grade,
      present,
      missing,
      totalChecked: SECURITY_HEADERS.length,
      server: resp.headers.get("server") || null,
      payment: formatPayment(getX402Context(req)),
    });
  } catch (err) {
    res.status(502).json({ error: "Failed to check security headers", details: (err as Error).message });
  }
});


const TECH_SIGNATURES: [string, string, RegExp][] = [
  ["framework", "React", /react[.-]dom|__next|__NEXT_DATA__/i],
  ["framework", "Next.js", /__NEXT_DATA__|next\/static/i],
  ["framework", "Vue.js", /vue[.-](?:min\.)?js|__vue__/i],
  ["framework", "Nuxt", /__nuxt|_nuxt/i],
  ["framework", "Angular", /ng-app|ng-version/i],
  ["framework", "Svelte", /svelte|__svelte/i],
  ["cms", "WordPress", /wp-content|wp-includes/i],
  ["cms", "Shopify", /cdn\.shopify\.com/i],
  ["cms", "Squarespace", /squarespace\.com/i],
  ["cms", "Wix", /wix\.com|parastorage\.com/i],
  ["analytics", "Google Analytics", /googletagmanager|gtag|google-analytics/i],
  ["analytics", "Plausible", /plausible\.io/i],
  ["analytics", "Fathom", /usefathom\.com/i],
  ["cdn", "Cloudflare", /cloudflare/i],
  ["cdn", "Vercel", /vercel/i],
  ["cdn", "Netlify", /netlify/i],
  ["cdn", "AWS CloudFront", /cloudfront\.net/i],
  ["payment", "Stripe", /js\.stripe\.com/i],
  ["chat", "Intercom", /intercom\.io/i],
  ["chat", "Crisp", /crisp\.chat/i],
];

router.get("/api/security/techstack", async (req: Request, res: Response) => {
  const url = (req.query.url as string || "").trim();
  if (!url) {
    return res.status(400).json({
      error: "Missing required parameter: url",
      example: "/api/security/techstack?url=https://example.com",
    });
  }

  let targetUrl = url;
  if (!targetUrl.startsWith("http")) targetUrl = `https://${targetUrl}`;

  try {
    const resp = await safeFetch(targetUrl, {
      timeoutMs: 10000,
      headers: {
        "User-Agent": "APIToll-TechDetect/1.0",
        Accept: "text/html",
      },
    });

    const html = await resp.text();
    const detected: Array<{ category: string; name: string }> = [];

    for (const [category, name, pattern] of TECH_SIGNATURES) {
      if (pattern.test(html)) {
        detected.push({ category, name });
      }
    }

    // Check server headers
    const server = resp.headers.get("server");
    if (server) detected.push({ category: "server", name: server });

    const poweredBy = resp.headers.get("x-powered-by");
    if (poweredBy) detected.push({ category: "runtime", name: poweredBy });

    // Group by category
    const byCategory: Record<string, string[]> = {};
    for (const tech of detected) {
      if (!byCategory[tech.category]) byCategory[tech.category] = [];
      byCategory[tech.category].push(tech.name);
    }

    res.json({
      url: targetUrl,
      technologiesDetected: detected.length,
      technologies: detected,
      byCategory,
      payment: formatPayment(getX402Context(req)),
    });
  } catch (err) {
    res.status(502).json({ error: "Failed to detect technologies", details: (err as Error).message });
  }
});


router.get("/api/security/uptime", async (req: Request, res: Response) => {
  const url = (req.query.url as string || "").trim();
  if (!url) {
    return res.status(400).json({
      error: "Missing required parameter: url",
      example: "/api/security/uptime?url=https://example.com",
    });
  }

  let targetUrl = url;
  if (!targetUrl.startsWith("http")) targetUrl = `https://${targetUrl}`;

  const start = performance.now();

  try {
    const resp = await safeFetch(targetUrl, {
      timeoutMs: 15000,
      headers: { "User-Agent": "APIToll-Uptime/1.0" },
    });

    const elapsed = Math.round(performance.now() - start);
    const contentLength = resp.headers.get("content-length");

    res.json({
      url: targetUrl,
      status: resp.status,
      statusText: resp.statusText,
      up: resp.status >= 200 && resp.status < 400,
      responseTimeMs: elapsed,
      contentLength: contentLength ? parseInt(contentLength) : null,
      server: resp.headers.get("server") || null,
      contentType: resp.headers.get("content-type") || null,
      checkedAt: new Date().toISOString(),
      payment: formatPayment(getX402Context(req)),
    });
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    res.json({
      url: targetUrl,
      up: false,
      error: (err as Error).message,
      responseTimeMs: elapsed,
      checkedAt: new Date().toISOString(),
      payment: formatPayment(getX402Context(req)),
    });
  }
});

export default router;
