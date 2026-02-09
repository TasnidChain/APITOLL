import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function contrastColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

router.get("/api/placeholder", (req: Request, res: Response) => {
  const width = Math.min(Math.max(parseInt((req.query.width as string) || "300", 10), 1), 2000);
  const height = Math.min(Math.max(parseInt((req.query.height as string) || "200", 10), 1), 2000);
  // Sanitize bg — only allow valid hex color characters to prevent SVG injection
  const rawBg = ((req.query.bg as string) || "cccccc").replace("#", "");
  const bg = rawBg.replace(/[^0-9a-fA-F]/g, "").slice(0, 6) || "cccccc";
  const text = (req.query.text as string) || `${width}x${height}`;
  const format = (req.query.format as string) || "svg";

  if (text.length > 100) return res.status(400).json({ error: "Text must be under 100 characters" });

  if (format === "svg") {
    const bgColor = `#${bg}`;
    const textColor = contrastColor(bg);
    const fontSize = Math.min(Math.floor(Math.min(width, height) / 5), 48);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bgColor}"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="${fontSize}" fill="${textColor}">
    ${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
  </text>
</svg>`;

    // Return as JSON or raw SVG
    if (req.headers.accept?.includes("application/json")) {
      return res.json({
        width, height,
        backgroundColor: bgColor,
        textColor,
        format: "svg",
        svg,
        payment: formatPayment(getX402Context(req)),
      });
    }

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(svg);
  }

  res.status(400).json({ error: 'Only "svg" format supported' });
});

export default router;
