import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { searchCache } from "../cache";

const router = Router();

const CACHE_TTL = 300_000; // 5 minutes

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// DuckDuckGo Instant Answer API — free, no key
async function searchDuckDuckGo(query: string, limit: number): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "APIToll-Search/1.0" },
    signal: AbortSignal.timeout(8000),
  });

  if (!resp.ok) throw new Error(`DuckDuckGo returned ${resp.status}`);

  const data = await resp.json() as {
    AbstractText?: string;
    AbstractURL?: string;
    AbstractSource?: string;
    Heading?: string;
    RelatedTopics?: Array<{
      Text?: string;
      FirstURL?: string;
      Topics?: Array<{ Text?: string; FirstURL?: string }>;
    }>;
    Results?: Array<{ Text?: string; FirstURL?: string }>;
  };

  const results: SearchResult[] = [];

  // Add abstract if available
  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title: data.Heading || query,
      snippet: data.AbstractText.slice(0, 300),
      url: data.AbstractURL,
      source: data.AbstractSource || "duckduckgo",
    });
  }

  // Add direct results
  if (data.Results) {
    for (const r of data.Results) {
      if (results.length >= limit) break;
      if (r.Text && r.FirstURL) {
        results.push({
          title: r.Text.split(" - ")[0] || r.Text,
          snippet: r.Text,
          url: r.FirstURL,
          source: "duckduckgo",
        });
      }
    }
  }

  // Add related topics
  if (data.RelatedTopics) {
    for (const topic of data.RelatedTopics) {
      if (results.length >= limit) break;
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.split(" - ")[0] || topic.Text.slice(0, 80),
          snippet: topic.Text.slice(0, 300),
          url: topic.FirstURL,
          source: "duckduckgo",
        });
      }
      // Nested topics
      if (topic.Topics) {
        for (const sub of topic.Topics) {
          if (results.length >= limit) break;
          if (sub.Text && sub.FirstURL) {
            results.push({
              title: sub.Text.split(" - ")[0] || sub.Text.slice(0, 80),
              snippet: sub.Text.slice(0, 300),
              url: sub.FirstURL,
              source: "duckduckgo",
            });
          }
        }
      }
    }
  }

  return results.slice(0, limit);
}

// Brave Search API — free tier 2000/month, needs key
async function searchBrave(query: string, limit: number): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) throw new Error("BRAVE_API_KEY not set");

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`;
  const resp = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!resp.ok) throw new Error(`Brave Search returned ${resp.status}`);

  const data = await resp.json() as {
    web?: { results?: Array<{ title: string; description: string; url: string }> };
  };

  return (data.web?.results || []).slice(0, limit).map((r) => ({
    title: r.title,
    snippet: r.description,
    url: r.url,
    source: "brave",
  }));
}

router.get("/api/search", async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || "").trim();
  if (!q) {
    return res.status(400).json({ error: "Missing required parameter: q" });
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 20);
  const cacheKey = `search:${q.toLowerCase()}:${limit}`;

  // Check cache
  const cached = searchCache.get<{ query: string; results: SearchResult[]; source: string }>(cacheKey);
  if (cached) {
    return res.json({ ...cached, resultCount: cached.results.length, cached: true, payment: formatPayment(getX402Context(req)) });
  }

  try {
    let results: SearchResult[];
    let source: string;

    // Prefer Brave if key is set, fall back to DuckDuckGo
    if (process.env.BRAVE_API_KEY) {
      try {
        results = await searchBrave(q, limit);
        source = "brave";
      } catch {
        results = await searchDuckDuckGo(q, limit);
        source = "duckduckgo";
      }
    } else {
      results = await searchDuckDuckGo(q, limit);
      source = "duckduckgo";
    }

    const payload = { query: q, results, source };
    searchCache.set(cacheKey, payload, CACHE_TTL);

    res.json({ ...payload, resultCount: results.length, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Search service unavailable", details: (err as Error).message });
  }
});

export default router;
