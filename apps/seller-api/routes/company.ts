import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { companyCache } from "../cache";

const router = Router();
const CACHE_TTL = 3600_000;

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

router.get("/api/company", async (req: Request, res: Response) => {
  const q = req.query.q as string;
  const jurisdiction = (req.query.jurisdiction as string) || "";

  if (!q) return res.status(400).json({ error: "Provide ?q=company_name", example: "/api/company?q=Apple&jurisdiction=us" });

  const cacheKey = `company:${q}:${jurisdiction}`;
  const cached = companyCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

  try {
    let url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(q)}`;
    if (jurisdiction) url += `&jurisdiction_code=${encodeURIComponent(jurisdiction)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return res.status(502).json({ error: "Company search service unavailable" });
    const data = await resp.json() as { results?: { companies?: Array<{ company: Record<string, unknown> }> } };

    const companies = (data.results?.companies || []).slice(0, 10).map((c) => ({
      name: c.company.name, companyNumber: c.company.company_number,
      jurisdiction: c.company.jurisdiction_code, status: c.company.current_status,
      incorporationDate: c.company.incorporation_date, address: c.company.registered_address_in_full,
      type: c.company.company_type,
    }));

    const payload = { query: q, jurisdiction: jurisdiction || "all", companies, total: companies.length };
    companyCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Company search unavailable", details: (err as Error).message });
  }
});

export default router;
