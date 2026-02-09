import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (padded.length % 4)) % 4);
  return Buffer.from(padded + padding, "base64").toString("utf8");
}

router.post("/api/jwt/decode", (req: Request, res: Response) => {
  const { token } = req.body || {};

  if (!token || typeof token !== "string") return res.status(400).json({ error: 'Provide { token: "eyJ..." }' });
  if (token.length > 10000) return res.status(400).json({ error: "Token must be under 10,000 characters" });

  const parts = token.split(".");
  if (parts.length !== 3) return res.status(400).json({ error: "Invalid JWT format — expected 3 parts separated by dots" });

  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));

    // Extract standard claims
    const now = Math.floor(Date.now() / 1000);
    const claims: Record<string, unknown> = {};
    if (payload.exp) claims.expiresAt = new Date(payload.exp * 1000).toISOString();
    if (payload.iat) claims.issuedAt = new Date(payload.iat * 1000).toISOString();
    if (payload.nbf) claims.notBefore = new Date(payload.nbf * 1000).toISOString();
    if (payload.exp) claims.isExpired = now > payload.exp;
    if (payload.iss) claims.issuer = payload.iss;
    if (payload.sub) claims.subject = payload.sub;
    if (payload.aud) claims.audience = payload.aud;

    res.json({
      header,
      payload,
      claims,
      note: "This endpoint only DECODES the JWT — it does NOT verify the signature.",
      payment: formatPayment(getX402Context(req)),
    });
  } catch (err) {
    res.status(400).json({ error: "Failed to decode JWT", details: (err as Error).message });
  }
});

export default router;
