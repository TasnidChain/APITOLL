import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { domainCache } from "../cache";
import dns from "dns";

const router = Router();
const CACHE_TTL = 3600_000;
const resolver = new dns.promises.Resolver();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

async function safeResolve<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

router.get("/api/domain", async (req: Request, res: Response) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).json({ error: "Provide ?domain=example.com" });

  const cleaned = domain.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
  const cacheKey = `domain:${cleaned}`;
  const cached = domainCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    const [a, aaaa, mx, ns, whoisResp] = await Promise.all([
      safeResolve(() => resolver.resolve4(cleaned)),
      safeResolve(() => resolver.resolve6(cleaned)),
      safeResolve(() => resolver.resolveMx(cleaned)),
      safeResolve(() => resolver.resolveNs(cleaned)),
      safeResolve(() => fetch(`https://rdap.org/domain/${cleaned}`, { signal: AbortSignal.timeout(8000) }).then((r) => r.ok ? r.json() : null)),
    ]);

    const whois = whoisResp as Record<string, unknown> | null;
    const events = (whois?.events as Array<{ eventAction: string; eventDate: string }>) || [];

    const payload = {
      domain: cleaned,
      dns: { a, aaaa, mx, ns },
      whois: {
        status: (whois?.status as string[]) || [],
        created: events.find((e) => e.eventAction === "registration")?.eventDate || null,
        expires: events.find((e) => e.eventAction === "expiration")?.eventDate || null,
        nameservers: ((whois?.nameservers as Array<{ ldhName: string }>) || []).map((n) => n.ldhName),
      },
    };
    domainCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Domain lookup failed", details: (err as Error).message });
  }
});

export default router;
