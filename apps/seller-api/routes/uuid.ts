import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import * as crypto from "crypto";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

function uuidV4(): string {
  return crypto.randomUUID();
}

function uuidV7(): string {
  // UUIDv7 — timestamp-based sortable UUID
  const now = Date.now();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Timestamp (48 bits) — first 6 bytes
  bytes[0] = (now / 2 ** 40) & 0xff;
  bytes[1] = (now / 2 ** 32) & 0xff;
  bytes[2] = (now / 2 ** 24) & 0xff;
  bytes[3] = (now / 2 ** 16) & 0xff;
  bytes[4] = (now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;

  // Version 7 (4 bits)
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  // Variant 10 (2 bits)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

router.post("/api/uuid", (req: Request, res: Response) => {
  const { version = "v4", count = 1 } = req.body || {};

  const n = Math.min(Math.max(parseInt(String(count), 10) || 1, 1), 100);

  try {
    let uuids: string[];
    let usedVersion: string;

    if (version === "v7" || version === 7) {
      uuids = Array.from({ length: n }, () => uuidV7());
      usedVersion = "v7";
    } else {
      uuids = Array.from({ length: n }, () => uuidV4());
      usedVersion = "v4";
    }

    res.json({
      version: usedVersion,
      count: uuids.length,
      uuids,
      payment: formatPayment(getX402Context(req)),
    });
  } catch (err) {
    res.status(500).json({ error: "UUID generation failed", details: (err as Error).message });
  }
});

export default router;
