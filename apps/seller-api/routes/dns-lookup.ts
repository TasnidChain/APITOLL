import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { dnsCache } from "../cache";
import dns from "dns";
import { validateDomain } from "../safe-fetch";

const router = Router();
const CACHE_TTL = 300_000;
const resolver = new dns.promises.Resolver();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.get("/api/dns", async (req: Request, res: Response) => {
  const domain = req.query.domain as string;
  const type = ((req.query.type as string) || "A").toUpperCase();

  if (!domain) return res.status(400).json({ error: "Provide ?domain=example.com&type=A" });

  const validTypes = ["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA"];
  if (!validTypes.includes(type)) return res.status(400).json({ error: `Invalid type. Use: ${validTypes.join(", ")}` });

  let cleaned: string;
  try { cleaned = validateDomain(domain); } catch (err) { return res.status(400).json({ error: (err as Error).message }); }
  const cacheKey = `dns:${cleaned}:${type}`;
  const cached = dnsCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    let records: unknown;
    switch (type) {
      case "A": records = await resolver.resolve4(cleaned); break;
      case "AAAA": records = await resolver.resolve6(cleaned); break;
      case "MX": records = await resolver.resolveMx(cleaned); break;
      case "TXT": records = await resolver.resolveTxt(cleaned); break;
      case "NS": records = await resolver.resolveNs(cleaned); break;
      case "CNAME": records = await resolver.resolveCname(cleaned); break;
      case "SOA": records = await resolver.resolveSoa(cleaned); break;
      default: records = [];
    }

    const payload = { domain: cleaned, type, records };
    dnsCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    const message = (err as NodeJS.ErrnoException).code || (err as Error).message;
    res.status(404).json({ error: `DNS lookup failed: ${message}`, domain: cleaned, type });
  }
});

export default router;
