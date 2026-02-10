import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { enrichCache } from "../cache";

const router = Router();
const CACHE_TTL = 3_600_000; // 1 hour

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// Open Library book search (free, no key)
router.get("/api/books/search", async (req: Request, res: Response) => {
  const query = req.query.q as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 25);

  if (!query) {
    return res.status(400).json({ error: "Provide ?q= search query", example: "/api/books/search?q=machine+learning" });
  }

  try {
    const cacheKey = `books:search:${query}:${limit}`;
    const cached = enrichCache.get<Record<string, unknown>>(cacheKey);
    if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

    const resp = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=key,title,author_name,first_publish_year,number_of_pages_median,isbn,subject,cover_i,ratings_average,ratings_count`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!resp.ok) {
      return res.status(502).json({ error: "Open Library API unavailable" });
    }

    const data = await resp.json() as {
      numFound: number;
      docs: Array<{
        key: string; title: string; author_name?: string[]; first_publish_year?: number;
        number_of_pages_median?: number; isbn?: string[]; subject?: string[];
        cover_i?: number; ratings_average?: number; ratings_count?: number;
      }>;
    };

    const books = data.docs.map((b) => ({
      title: b.title,
      authors: b.author_name || [],
      firstPublished: b.first_publish_year || null,
      pages: b.number_of_pages_median || null,
      isbn: b.isbn?.[0] || null,
      subjects: (b.subject || []).slice(0, 5),
      coverUrl: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : null,
      rating: b.ratings_average ? { average: Math.round(b.ratings_average * 100) / 100, count: b.ratings_count || 0 } : null,
      openLibraryUrl: `https://openlibrary.org${b.key}`,
    }));

    const payload = {
      totalResults: data.numFound,
      books,
      source: "openlibrary.org",
    };

    enrichCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Open Library API unavailable", details: (err as Error).message });
  }
});

// Get book details by ISBN
router.get("/api/books/isbn/:isbn", async (req: Request, res: Response) => {
  const { isbn } = req.params;

  try {
    const cacheKey = `books:isbn:${isbn}`;
    const cached = enrichCache.get<Record<string, unknown>>(cacheKey);
    if (cached) return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });

    const resp = await fetch(
      `https://openlibrary.org/isbn/${isbn}.json`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!resp.ok) {
      return res.status(404).json({ error: `Book not found for ISBN: ${isbn}` });
    }

    const data = await resp.json() as {
      title: string; subtitle?: string; number_of_pages?: number;
      publish_date?: string; publishers?: string[]; subjects?: Array<{ name: string }>;
      covers?: number[]; description?: string | { value: string };
    };

    const payload = {
      title: data.title,
      subtitle: data.subtitle || null,
      pages: data.number_of_pages || null,
      publishDate: data.publish_date || null,
      publishers: data.publishers || [],
      subjects: (data.subjects || []).slice(0, 10).map((s) => typeof s === "string" ? s : s.name),
      coverUrl: data.covers?.[0] ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg` : null,
      description: typeof data.description === "string" ? data.description : data.description?.value || null,
      isbn,
      source: "openlibrary.org",
    };

    enrichCache.set(cacheKey, payload, CACHE_TTL);
    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Open Library API unavailable", details: (err as Error).message });
  }
});

export default router;
