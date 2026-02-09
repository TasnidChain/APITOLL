import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

const COLOR_NAMES: Record<string, string> = {
  "000000": "Black", "ffffff": "White", "ff0000": "Red", "00ff00": "Lime",
  "0000ff": "Blue", "ffff00": "Yellow", "ff00ff": "Magenta", "00ffff": "Cyan",
  "808080": "Gray", "c0c0c0": "Silver", "800000": "Maroon", "808000": "Olive",
  "008000": "Green", "800080": "Purple", "008080": "Teal", "000080": "Navy",
  "ffa500": "Orange", "ffc0cb": "Pink", "a52a2a": "Brown", "f5f5dc": "Beige",
  "e6e6fa": "Lavender", "40e0d0": "Turquoise", "ffd700": "Gold", "4b0082": "Indigo",
  "ff6347": "Tomato", "fa8072": "Salmon", "7fffd4": "Aquamarine", "ff69b4": "Hot Pink",
  "dda0dd": "Plum", "b0e0e6": "Powder Blue", "ffe4c4": "Bisque", "f0e68c": "Khaki",
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;

  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

function findClosestColorName(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  let closest = "Unknown";
  let minDist = Infinity;

  for (const [colorHex, name] of Object.entries(COLOR_NAMES)) {
    const c = hexToRgb(colorHex);
    const dist = Math.sqrt((r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2);
    if (dist < minDist) { minDist = dist; closest = name; }
  }

  return closest;
}

function contrastRatio(hex1: string, hex2: string): number {
  function relativeLuminance(hex: string): number {
    const { r, g, b } = hexToRgb(hex);
    const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    );
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

router.get("/api/color", (req: Request, res: Response) => {
  const hex = ((req.query.hex as string) || "").replace("#", "");
  if (!hex || !/^[0-9a-fA-F]{3,8}$/.test(hex)) {
    return res.status(400).json({ error: "Provide ?hex=ff5500 (3, 6, or 8 digit hex)" });
  }

  const fullHex = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.slice(0, 6);
  const { r, g, b } = hexToRgb(fullHex);
  const hsl = rgbToHsl(r, g, b);
  const hsv = rgbToHsv(r, g, b);
  const name = findClosestColorName(fullHex);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  res.json({
    hex: `#${fullHex}`,
    rgb: { r, g, b },
    rgbString: `rgb(${r}, ${g}, ${b})`,
    hsl: { h: hsl.h, s: hsl.s, l: hsl.l },
    hslString: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    hsv,
    name,
    isDark: luminance < 0.5,
    luminance: Math.round(luminance * 1000) / 1000,
    contrastWithWhite: contrastRatio(fullHex, "ffffff"),
    contrastWithBlack: contrastRatio(fullHex, "000000"),
    complementary: `#${(0xffffff ^ parseInt(fullHex, 16)).toString(16).padStart(6, "0")}`,
    payment: formatPayment(getX402Context(req)),
  });
});

export default router;
