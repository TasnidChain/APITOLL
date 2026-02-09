import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import * as tls from "tls";
import { webCache } from "../cache";
import { validateDomainWithDNS } from "../safe-fetch";

const router = Router();
const CACHE_TTL = 3600_000;

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

function getSSLCert(hostname: string, port = 443): Promise<tls.PeerCertificate> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: hostname, port, servername: hostname, rejectUnauthorized: false, timeout: 10000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      if (cert && Object.keys(cert).length > 0) {
        resolve(cert);
      } else {
        reject(new Error("No certificate returned"));
      }
    });
    socket.on("error", (err) => { socket.destroy(); reject(err); });
    socket.on("timeout", () => { socket.destroy(); reject(new Error("Connection timed out")); });
  });
}

router.get("/api/ssl", async (req: Request, res: Response) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).json({ error: "Provide ?domain=example.com" });

  let cleanDomain: string;
  try { cleanDomain = await validateDomainWithDNS(domain); } catch (err) { return res.status(400).json({ error: (err as Error).message }); }

  const cacheKey = `ssl:${cleanDomain}`;
  const cached = webCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    const cert = await getSSLCert(cleanDomain);

    const validFrom = new Date(cert.valid_from);
    const validTo = new Date(cert.valid_to);
    const now = new Date();
    const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / 86400000);

    const payload = {
      domain: cleanDomain,
      subject: cert.subject,
      issuer: cert.issuer,
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString(),
      daysRemaining,
      isExpired: daysRemaining < 0,
      isExpiringSoon: daysRemaining >= 0 && daysRemaining < 30,
      serialNumber: cert.serialNumber,
      fingerprint: cert.fingerprint,
      fingerprint256: cert.fingerprint256,
      subjectAltNames: cert.subjectaltname?.split(", ").map((s: string) => s.replace("DNS:", "")) || [],
      protocol: "TLS",
    };
    webCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Failed to retrieve SSL certificate" });
  }
});

export default router;
