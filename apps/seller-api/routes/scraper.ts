import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";
import { scraperCache } from "../cache";
import { safeFetch } from "../safe-fetch";

const router = Router();
const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
const CACHE_TTL = 900_000; // 15 minutes
const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.post("/api/scrape", async (req: Request, res: Response) => {
  const { url, includeMetadata = true } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing required field: url" });
  }

  // Check cache
  const cacheKey = `scrape:${url}`;
  const cached = scraperCache.get<Record<string, unknown>>(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });
  }

  try {
    // Fetch the page (safeFetch handles SSRF, redirects, DNS rebinding)
    const resp = await safeFetch(url, {
      headers: {
        "User-Agent": "APIToll-Scraper/1.0 (compatible; agent-tool)",
        "Accept": "text/html,application/xhtml+xml",
      },
      timeoutMs: 10000,
    });

    if (!resp.ok) {
      return res.status(502).json({ error: `Target returned HTTP ${resp.status}` });
    }

    const contentLength = parseInt(resp.headers.get("content-length") || "0");
    if (contentLength > MAX_BODY_SIZE) {
      return res.status(413).json({ error: "Page too large (>5MB)" });
    }

    const html = await resp.text();
    if (html.length > MAX_BODY_SIZE) {
      return res.status(413).json({ error: "Page too large (>5MB)" });
    }

    // Parse HTML → DOM → Readability → Markdown
    const { document } = parseHTML(html);
    // linkedom Document is compatible with Readability but types differ
     
    const reader = new Readability(document as unknown as Document);
    const article = reader.parse();

    if (!article || !article.content) {
      // Fallback: convert raw HTML to markdown
      const markdown = turndown.turndown(html).slice(0, 50000);
      const payload = {
        url,
        title: document.title || null,
        markdown,
        metadata: includeMetadata ? { author: null, description: null, siteName: null } : undefined,
        wordCount: markdown.split(/\s+/).length,
      };
      scraperCache.set(cacheKey, payload, CACHE_TTL);
      return res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
    }

    const markdown = turndown.turndown(article.content).slice(0, 50000);

    const payload: Record<string, unknown> = {
      url,
      title: article.title,
      markdown,
      wordCount: markdown.split(/\s+/).length,
    };

    if (includeMetadata) {
      payload.metadata = {
        author: article.byline || null,
        description: article.excerpt || null,
        siteName: article.siteName || null,
        length: article.length,
      };
    }

    scraperCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes("TimeoutError") || message.includes("AbortError") || message.includes("timeout")) {
      return res.status(504).json({ error: "Target page timed out (10s limit)" });
    }
    if (message.includes("internal") || message.includes("private") || message.includes("blocked")) {
      return res.status(400).json({ error: message });
    }
    res.status(502).json({ error: "Scraping failed" });
  }
});

export default router;
