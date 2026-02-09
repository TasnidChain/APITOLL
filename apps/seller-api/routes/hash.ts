import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import * as crypto from "crypto";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

const ALLOWED_ALGORITHMS = ["md5", "sha1", "sha256", "sha512", "sha3-256", "sha3-512"];

router.post("/api/hash", (req: Request, res: Response) => {
  const { text, algorithm = "sha256", encoding = "hex" } = req.body || {};

  if (!text || typeof text !== "string") return res.status(400).json({ error: "Provide { text: string, algorithm?: string }", supported: ALLOWED_ALGORITHMS });
  if (text.length > 100000) return res.status(400).json({ error: "Text must be under 100,000 characters" });

  const algo = algorithm.toLowerCase();
  if (!ALLOWED_ALGORITHMS.includes(algo)) return res.status(400).json({ error: `Unsupported algorithm. Use one of: ${ALLOWED_ALGORITHMS.join(", ")}` });

  const enc = encoding === "base64" ? "base64" : "hex";

  try {
    const hash = crypto.createHash(algo).update(text, "utf8").digest(enc);
    res.json({
      hash,
      algorithm: algo,
      encoding: enc,
      inputLength: text.length,
      payment: formatPayment(getX402Context(req)),
    });
  } catch (err) {
    res.status(500).json({ error: "Hashing failed", details: (err as Error).message });
  }
});

export default router;
