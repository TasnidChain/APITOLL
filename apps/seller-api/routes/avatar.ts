import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import * as crypto from "crypto";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

/**
 * Generate a deterministic identicon SVG from a string.
 * Uses a 5x5 grid with symmetric pattern (mirrored left-right).
 */
function generateIdenticon(input: string, size: number): string {
  const hash = crypto.createHash("sha256").update(input).digest("hex");

  // Extract color from hash
  const r = parseInt(hash.slice(0, 2), 16);
  const g = parseInt(hash.slice(2, 4), 16);
  const b = parseInt(hash.slice(4, 6), 16);
  const color = `rgb(${r}, ${g}, ${b})`;

  // Background is a lighter version
  const bgR = Math.min(255, r + 180);
  const bgG = Math.min(255, g + 180);
  const bgB = Math.min(255, b + 180);
  const bgColor = `rgb(${bgR}, ${bgG}, ${bgB})`;

  // Generate 5x5 grid (only compute left half + center, mirror for right)
  const cellSize = size / 5;
  const cells: boolean[][] = [];

  for (let row = 0; row < 5; row++) {
    cells[row] = [];
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const byte = parseInt(hash.slice(6 + idx * 2, 8 + idx * 2), 16);
      cells[row][col] = byte > 127;
    }
    // Mirror
    cells[row][3] = cells[row][1];
    cells[row][4] = cells[row][0];
  }

  // Build SVG
  let rects = "";
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (cells[row][col]) {
        rects += `  <rect x="${col * cellSize}" y="${row * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}"/>\n`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="100%" height="100%" fill="${bgColor}"/>
${rects}</svg>`;
}

router.get("/api/avatar", (req: Request, res: Response) => {
  const input = (req.query.input as string) || (req.query.name as string) || (req.query.email as string);
  const size = Math.min(Math.max(parseInt((req.query.size as string) || "256", 10), 32), 512);

  if (!input) return res.status(400).json({ error: "Provide ?input=name-or-email" });
  if (input.length > 500) return res.status(400).json({ error: "Input must be under 500 characters" });

  const svg = generateIdenticon(input, size);
  const hash = crypto.createHash("sha256").update(input).digest("hex");

  // Return as JSON or raw SVG
  if (req.headers.accept?.includes("application/json")) {
    return res.json({
      input: input.slice(0, 50),
      hash: hash.slice(0, 16),
      size,
      format: "svg",
      svg,
      payment: formatPayment(getX402Context(req)),
    });
  }

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(svg);
});

export default router;
