import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// Random facts from multiple free APIs
router.get("/api/fact", async (req: Request, res: Response) => {
  const category = (req.query.category as string)?.toLowerCase() || "random";

  try {
    if (category === "cat" || category === "cats") {
      const resp = await fetch("https://catfact.ninja/fact", { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const data = await resp.json() as { fact: string };
        return res.json({
          fact: data.fact,
          category: "cats",
          source: "catfact.ninja",
          cached: false,
          payment: formatPayment(getX402Context(req)),
        });
      }
    }

    if (category === "number" || category === "math") {
      const number = req.query.number || "random";
      const resp = await fetch(`http://numbersapi.com/${number}/trivia`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const data = await resp.json() as { text: string; number: number; type: string };
        return res.json({
          fact: data.text,
          number: data.number,
          category: "number",
          source: "numbersapi.com",
          cached: false,
          payment: formatPayment(getX402Context(req)),
        });
      }
    }

    if (category === "dog" || category === "dogs") {
      const resp = await fetch("https://dogapi.dog/api/v2/facts?limit=1", { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const data = await resp.json() as { data: Array<{ attributes: { body: string } }> };
        if (data.data?.[0]) {
          return res.json({
            fact: data.data[0].attributes.body,
            category: "dogs",
            source: "dogapi.dog",
            cached: false,
            payment: formatPayment(getX402Context(req)),
          });
        }
      }
    }

    // Default: try uselessfacts for truly random facts
    const resp = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en", {
      signal: AbortSignal.timeout(5000),
    });

    if (resp.ok) {
      const data = await resp.json() as { text: string; source: string; source_url: string };
      return res.json({
        fact: data.text,
        category: "random",
        source: "uselessfacts.jsph.pl",
        sourceUrl: data.source_url || null,
        cached: false,
        payment: formatPayment(getX402Context(req)),
      });
    }
  } catch {
    // Fall through
  }

  res.status(502).json({ error: "Fact services unavailable" });
});

export default router;
