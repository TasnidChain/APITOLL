import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import QRCode from "qrcode";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.get("/api/qr", async (req: Request, res: Response) => {
  const data = req.query.data as string;
  const format = (req.query.format as string) || "svg";
  const size = Math.min(Math.max(parseInt((req.query.size as string) || "256", 10), 64), 1024);

  if (!data) return res.status(400).json({ error: "Provide ?data=text-to-encode" });
  if (data.length > 4000) return res.status(400).json({ error: "Data must be under 4,000 characters" });

  try {
    if (format === "svg") {
      const svg = await QRCode.toString(data, {
        type: "svg",
        width: size,
        margin: 2,
        errorCorrectionLevel: "M",
      });

      // Return as JSON with SVG string for programmatic use
      if (req.headers.accept?.includes("application/json")) {
        return res.json({
          data,
          format: "svg",
          size,
          svg,
          payment: formatPayment(getX402Context(req)),
        });
      }

      // Return raw SVG
      res.setHeader("Content-Type", "image/svg+xml");
      return res.send(svg);
    }

    if (format === "png" || format === "dataurl") {
      const dataUrl = await QRCode.toDataURL(data, {
        width: size,
        margin: 2,
        errorCorrectionLevel: "M",
      });

      return res.json({
        data,
        format: "dataurl",
        size,
        dataUrl,
        payment: formatPayment(getX402Context(req)),
      });
    }

    res.status(400).json({ error: 'format must be "svg", "png", or "dataurl"' });
  } catch (err) {
    res.status(500).json({ error: "QR code generation failed", details: (err as Error).message });
  }
});

export default router;
