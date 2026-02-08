import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import Parser from "rss-parser";
import { newsCache } from "../cache";

const router = Router();
const parser = new Parser({ timeout: 8000 });
const CACHE_TTL = 300_000; // 5 minutes

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// RSS feed sources by category
const RSS_FEEDS: Record<string, Array<{ name: string; url: string }>> = {
  general: [
    { name: "Reuters World", url: "https://feeds.reuters.com/reuters/topNews" },
    { name: "AP News", url: "https://rss.app/feeds/v1.1/tSMnYNHVB86Mv9oK.xml" },
    { name: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  technology: [
    { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
    { name: "Hacker News", url: "https://hnrss.org/frontpage" },
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
  ],
  crypto: [
    { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
    { name: "CoinTelegraph", url: "https://cointelegraph.com/rss" },
    { name: "The Block", url: "https://www.theblock.co/rss.xml" },
  ],
  business: [
    { name: "Reuters Business", url: "https://feeds.reuters.com/reuters/businessNews" },
    { name: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147" },
  ],
  science: [
    { name: "Science Daily", url: "https://www.sciencedaily.com/rss/all.xml" },
    { name: "Nature", url: "https://www.nature.com/nature.rss" },
  ],
};

interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  source: string;
  category: string;
  publishedAt: string | null;
}

async function fetchFeed(feedConfig: { name: string; url: string }, category: string): Promise<NewsArticle[]> {
  try {
    const feed = await parser.parseURL(feedConfig.url);
    return (feed.items || []).slice(0, 20).map((item) => ({
      title: (item.title || "").trim(),
      summary: (item.contentSnippet || item.content || "").trim().slice(0, 300),
      url: item.link || "",
      source: feedConfig.name,
      category,
      publishedAt: item.isoDate || item.pubDate || null,
    }));
  } catch {
    return []; // Silently skip failed feeds
  }
}

router.get("/api/news", async (req: Request, res: Response) => {
  const category = ((req.query.category as string) || "general").toLowerCase();
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);
  const query = ((req.query.q as string) || "").toLowerCase().trim();

  const validCategories = Object.keys(RSS_FEEDS);
  if (!validCategories.includes(category)) {
    return res.status(400).json({
      error: `Invalid category. Must be one of: ${validCategories.join(", ")}`,
    });
  }

  const cacheKey = `news:${category}:${query}`;
  const cached = newsCache.get<{ articles: NewsArticle[] }>(cacheKey);
  if (cached) {
    const articles = cached.articles.slice(0, limit);
    return res.json({
      articles,
      articleCount: articles.length,
      category,
      cached: true,
      payment: formatPayment(getX402Context(req)),
    });
  }

  try {
    const feeds = RSS_FEEDS[category] || RSS_FEEDS.general;
    const results = await Promise.all(feeds.map((f) => fetchFeed(f, category)));
    let articles = results.flat();

    // Sort by date (newest first)
    articles.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return dateB - dateA;
    });

    // Filter by keyword if provided
    if (query) {
      articles = articles.filter(
        (a) => a.title.toLowerCase().includes(query) || a.summary.toLowerCase().includes(query)
      );
    }

    // Cache all results, return limited
    newsCache.set(cacheKey, { articles }, CACHE_TTL);
    const limited = articles.slice(0, limit);

    res.json({
      articles: limited,
      articleCount: limited.length,
      category,
      cached: false,
      payment: formatPayment(getX402Context(req)),
    });
  } catch (err) {
    res.status(502).json({ error: "News service unavailable", details: (err as Error).message });
  }
});

export default router;
