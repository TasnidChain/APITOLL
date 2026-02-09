import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { isBlockedHostname } from "../safe-fetch";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

/**
 * Screenshot endpoint — returns a screenshot URL via a free screenshot service.
 * Uses free screenshot APIs (no headless browser needed on server).
 */
router.get("/api/screenshot", async (req: Request, res: Response) => {
  const url = req.query.url as string;
  const width = parseInt((req.query.width as string) || "1280", 10);
  const height = parseInt((req.query.height as string) || "800", 10);

  if (!url) return res.status(400).json({ error: "Provide ?url=https://example.com" });

  let parsed: URL;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: "Invalid URL" }); }
  if (!["http:", "https:"].includes(parsed.protocol)) return res.status(400).json({ error: "Only HTTP(S) URLs" });
  if (isBlockedHostname(parsed.hostname)) return res.status(400).json({ error: "Cannot screenshot internal/private addresses" });

  const clampedWidth = Math.min(Math.max(width, 320), 1920);
  const clampedHeight = Math.min(Math.max(height, 240), 1080);

  // Use multiple free screenshot services as options
  const screenshotUrls = {
    primary: `https://image.thum.io/get/width/${clampedWidth}/crop/${clampedHeight}/${url}`,
    fallback: `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`,
  };

  try {
    const resp = await fetch(screenshotUrls.primary, {
      method: "HEAD",
      signal: AbortSignal.timeout(10000),
    });

    if (resp.ok) {
      return res.json({
        url,
        screenshotUrl: screenshotUrls.primary,
        width: clampedWidth,
        height: clampedHeight,
        service: "thum.io",
        payment: formatPayment(getX402Context(req)),
      });
    }

    res.json({
      url,
      screenshotUrl: screenshotUrls.fallback,
      width: clampedWidth,
      height: clampedHeight,
      service: "microlink",
      payment: formatPayment(getX402Context(req)),
    });
  } catch {
    res.json({
      url,
      screenshotUrl: screenshotUrls.primary,
      width: clampedWidth,
      height: clampedHeight,
      service: "thum.io",
      note: "URL generated — service availability not confirmed",
      payment: formatPayment(getX402Context(req)),
    });
  }
});

export default router;
