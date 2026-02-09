import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.post("/api/base64", (req: Request, res: Response) => {
  const { text, action = "encode" } = req.body || {};

  if (!text || typeof text !== "string") return res.status(400).json({ error: 'Provide { text: string, action: "encode" | "decode" }' });
  if (text.length > 500000) return res.status(400).json({ error: "Text must be under 500,000 characters" });

  try {
    if (action === "encode") {
      const encoded = Buffer.from(text, "utf8").toString("base64");
      res.json({
        action: "encode",
        input: text.slice(0, 200),
        result: encoded,
        inputLength: text.length,
        resultLength: encoded.length,
        payment: formatPayment(getX402Context(req)),
      });
    } else if (action === "decode") {
      const decoded = Buffer.from(text, "base64").toString("utf8");
      res.json({
        action: "decode",
        input: text.slice(0, 200),
        result: decoded,
        inputLength: text.length,
        resultLength: decoded.length,
        payment: formatPayment(getX402Context(req)),
      });
    } else {
      res.status(400).json({ error: 'action must be "encode" or "decode"' });
    }
  } catch (err) {
    res.status(400).json({ error: "Base64 operation failed", details: (err as Error).message });
  }
});

export default router;
