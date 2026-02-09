import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { pdfCache } from "../cache";
import crypto from "crypto";

const router = Router();

const CACHE_TTL = 3_600_000; // 1 hour
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_URL_FETCH_SIZE = 10 * 1024 * 1024; // 10MB

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// SSRF protection (same as scraper)
function isBlockedUrl(hostname: string): boolean {
  const blocked = ["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0", "[::]"];
  const blockedPrefixes = [
    "10.", "192.168.",
    "172.16.", "172.17.", "172.18.", "172.19.",
    "172.20.", "172.21.", "172.22.", "172.23.",
    "172.24.", "172.25.", "172.26.", "172.27.",
    "172.28.", "172.29.", "172.30.", "172.31.",
    "169.254.", "fc00:", "fd00:", "fe80:",
  ];
  return (
    blocked.includes(hostname) ||
    blockedPrefixes.some((p) => hostname.startsWith(p)) ||
    /^\d+$/.test(hostname)
  );
}

// Extract text from PDF buffer using pdf-parse
async function extractPdfText(buffer: Buffer): Promise<{
  text: string;
  numPages: number;
  info: Record<string, unknown>;
}> {
  const pdfParse = (await import("pdf-parse")).default;

  const data = await pdfParse(buffer, {
    max: 100, // Max 100 pages
  });

  return {
    text: data.text.trim(),
    numPages: data.numpages,
    info: {
      title: data.info?.Title || null,
      author: data.info?.Author || null,
      creator: data.info?.Creator || null,
      producer: data.info?.Producer || null,
      creationDate: data.info?.CreationDate || null,
    },
  };
}

// POST /api/extract/pdf — extract text from PDF (URL or base64)
router.post("/api/extract/pdf", async (req: Request, res: Response) => {
  const { url, base64, options = {} } = req.body || {};

  if (!url && !base64) {
    return res.status(400).json({
      error: "Must provide either 'url' (PDF URL) or 'base64' (base64-encoded PDF)",
    });
  }

  let buffer: Buffer;
  let sourceHash: string;

  if (url) {
    // Fetch PDF from URL
    let parsed: URL;
    try {
      parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return res.status(400).json({ error: "Only HTTP/HTTPS URLs allowed" });
      }
      if (isBlockedUrl(parsed.hostname)) {
        return res.status(400).json({ error: "Cannot fetch from internal/local addresses" });
      }
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    // Check cache
    sourceHash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);
    const cached = pdfCache.get<Record<string, unknown>>(`pdf:${sourceHash}`);
    if (cached) {
      return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });
    }

    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "APIToll-PDFExtract/1.0" },
        signal: AbortSignal.timeout(15_000),
        redirect: "follow",
      });

      if (!resp.ok) {
        return res.status(502).json({ error: `Failed to fetch PDF: HTTP ${resp.status}` });
      }

      const contentLength = parseInt(resp.headers.get("content-length") || "0");
      if (contentLength > MAX_URL_FETCH_SIZE) {
        return res.status(413).json({ error: "PDF too large (max 10MB for URL fetches)" });
      }

      buffer = Buffer.from(await resp.arrayBuffer());

      if (buffer.length > MAX_URL_FETCH_SIZE) {
        return res.status(413).json({ error: "PDF too large (max 10MB for URL fetches)" });
      }
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes("timeout") || message.includes("Abort")) {
        return res.status(504).json({ error: "PDF fetch timed out (15s limit)" });
      }
      return res.status(502).json({ error: "Failed to fetch PDF", details: message });
    }
  } else {
    // Decode base64
    try {
      buffer = Buffer.from(base64, "base64");
      sourceHash = crypto.createHash("sha256").update(base64.slice(0, 1000)).digest("hex").slice(0, 16);
    } catch {
      return res.status(400).json({ error: "Invalid base64 encoding" });
    }

    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(413).json({ error: "PDF too large (max 20MB)" });
    }

    // Check cache
    const cached = pdfCache.get<Record<string, unknown>>(`pdf:${sourceHash}`);
    if (cached) {
      return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });
    }
  }

  // Verify it's actually a PDF
  if (buffer.length < 5 || buffer.subarray(0, 5).toString() !== "%PDF-") {
    return res.status(400).json({ error: "File does not appear to be a valid PDF" });
  }

  try {
    const result = await extractPdfText(buffer);

    // Optionally truncate text
    const maxChars = parseInt(options.maxChars) || 100_000;
    const truncated = result.text.length > maxChars;
    const text = truncated ? result.text.slice(0, maxChars) + "\n[TEXT TRUNCATED]" : result.text;

    const payload = {
      source: url || "base64-upload",
      text,
      numPages: result.numPages,
      characterCount: result.text.length,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      truncated,
      info: result.info,
    };

    pdfCache.set(`pdf:${sourceHash}`, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(500).json({ error: "PDF extraction failed", details: (err as Error).message });
  }
});

// POST /api/extract/text — extract clean text from HTML content
router.post("/api/extract/text", async (req: Request, res: Response) => {
  const { html, url } = req.body || {};

  if (!html && !url) {
    return res.status(400).json({ error: "Must provide 'html' (raw HTML string) or 'url'" });
  }

  let rawHtml: string;

  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return res.status(400).json({ error: "Only HTTP/HTTPS URLs allowed" });
      }
      if (isBlockedUrl(parsed.hostname)) {
        return res.status(400).json({ error: "Cannot fetch from internal/local addresses" });
      }
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "APIToll-TextExtract/1.0",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(10_000),
        redirect: "follow",
      });

      if (!resp.ok) {
        return res.status(502).json({ error: `Failed to fetch URL: HTTP ${resp.status}` });
      }

      rawHtml = await resp.text();
    } catch (err) {
      return res.status(502).json({ error: "Failed to fetch URL", details: (err as Error).message });
    }
  } else {
    rawHtml = html;
  }

  if (rawHtml.length > 5 * 1024 * 1024) {
    return res.status(413).json({ error: "HTML content too large (max 5MB)" });
  }

  // Strip HTML tags and extract clean text
  const text = rawHtml
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  res.json({
    source: url || "html-input",
    text: text.slice(0, 100_000),
    characterCount: text.length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    truncated: text.length > 100_000,
    payment: formatPayment(getX402Context(req)),
  });
});

export default router;
