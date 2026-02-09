import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { whoisCache } from "../cache";

const router = Router();
const CACHE_TTL = 3600_000;

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.get("/api/whois", async (req: Request, res: Response) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).json({ error: "Provide ?domain=example.com" });

  const cleaned = domain.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
  const cacheKey = `whois:${cleaned}`;
  const cached = whoisCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    const resp = await fetch(`https://rdap.org/domain/${encodeURIComponent(cleaned)}`, { signal: AbortSignal.timeout(10000), headers: { Accept: "application/rdap+json" } });
    if (!resp.ok) return res.status(404).json({ error: `WHOIS data not found for ${cleaned}` });
    const data = await resp.json() as Record<string, unknown>;

    const events = (data.events as Array<{ eventAction: string; eventDate: string }>) || [];
    const nameservers = ((data.nameservers as Array<{ ldhName: string }>) || []).map((ns) => ns.ldhName);
    const entities = (data.entities as Array<{ roles: string[]; vcardArray?: unknown[] }>) || [];
    const registrar = entities.find((e) => e.roles?.includes("registrar"));

    const payload = {
      domain: cleaned, status: (data.status as string[]) || [],
      registrar: registrar?.vcardArray ? "Available in RDAP response" : "Unknown",
      created: events.find((e) => e.eventAction === "registration")?.eventDate || null,
      updated: events.find((e) => e.eventAction === "last changed")?.eventDate || null,
      expires: events.find((e) => e.eventAction === "expiration")?.eventDate || null,
      nameservers, handle: data.handle || null,
    };
    whoisCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "WHOIS service unavailable", details: (err as Error).message });
  }
});

export default router;
