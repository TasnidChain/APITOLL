import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { enrichCache } from "../cache";
import { safeFetch } from "../safe-fetch";

const router = Router();

const CACHE_TTL = 3_600_000; // 1 hour — enrichment data changes slowly

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// ─── Domain/Company Enrichment ──────────────────────────────────

interface DomainInfo {
  domain: string;
  title: string | null;
  description: string | null;
  technologies: string[];
  socials: Record<string, string>;
  dnsRecords: { type: string; value: string }[];
}

async function enrichDomain(domain: string): Promise<DomainInfo> {
  // Parallel: fetch website meta + DNS
  const [metaData, dnsData] = await Promise.all([
    fetchSiteMeta(domain),
    fetchDnsRecords(domain),
  ]);

  return {
    domain,
    title: metaData.title,
    description: metaData.description,
    technologies: metaData.technologies,
    socials: metaData.socials,
    dnsRecords: dnsData,
  };
}

async function fetchSiteMeta(domain: string): Promise<{
  title: string | null;
  description: string | null;
  technologies: string[];
  socials: Record<string, string>;
}> {
  try {
    const resp = await safeFetch(`https://${domain}`, {
      headers: {
        "User-Agent": "APIToll-Enrich/1.0 (compatible; bot)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();

    // Extract meta tags
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);

    // Detect technologies from headers and HTML
    const technologies: string[] = [];
    const server = resp.headers.get("server");
    if (server) technologies.push(`Server: ${server}`);
    const poweredBy = resp.headers.get("x-powered-by");
    if (poweredBy) technologies.push(poweredBy);
    if (html.includes("react")) technologies.push("React");
    if (html.includes("next")) technologies.push("Next.js");
    if (html.includes("vue")) technologies.push("Vue.js");
    if (html.includes("angular")) technologies.push("Angular");
    if (html.includes("wordpress") || html.includes("wp-content")) technologies.push("WordPress");
    if (html.includes("shopify")) technologies.push("Shopify");
    if (html.includes("gtag") || html.includes("google-analytics")) technologies.push("Google Analytics");
    if (html.includes("stripe")) technologies.push("Stripe");

    // Extract social links
    const socials: Record<string, string> = {};
    const socialPatterns: [string, RegExp][] = [
      ["twitter", /https?:\/\/(www\.)?(twitter\.com|x\.com)\/[\w-]+/i],
      ["linkedin", /https?:\/\/(www\.)?linkedin\.com\/company\/[\w-]+/i],
      ["github", /https?:\/\/(www\.)?github\.com\/[\w-]+/i],
      ["facebook", /https?:\/\/(www\.)?facebook\.com\/[\w.-]+/i],
      ["instagram", /https?:\/\/(www\.)?instagram\.com\/[\w.-]+/i],
      ["youtube", /https?:\/\/(www\.)?youtube\.com\/(c\/|channel\/|@)[\w-]+/i],
    ];

    for (const [name, pattern] of socialPatterns) {
      const match = html.match(pattern);
      if (match) socials[name] = match[0];
    }

    return {
      title: titleMatch?.[1]?.trim() || null,
      description: descMatch?.[1]?.trim().slice(0, 300) || null,
      technologies: [...new Set(technologies)],
      socials,
    };
  } catch {
    return { title: null, description: null, technologies: [], socials: {} };
  }
}

async function fetchDnsRecords(domain: string): Promise<{ type: string; value: string }[]> {
  try {
    // Use Cloudflare DoH for DNS resolution
    const types = ["A", "AAAA", "MX", "TXT", "NS"];
    const records: { type: string; value: string }[] = [];

    // Fetch A and MX records in parallel
    const [aResp, mxResp] = await Promise.all([
      fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=A`, {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`, {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    if (aResp.ok) {
      const data = (await aResp.json()) as { Answer?: Array<{ type: number; data: string }> };
      for (const ans of data.Answer || []) {
        records.push({ type: "A", value: ans.data });
      }
    }

    if (mxResp.ok) {
      const data = (await mxResp.json()) as { Answer?: Array<{ type: number; data: string }> };
      for (const ans of data.Answer || []) {
        records.push({ type: "MX", value: ans.data });
      }
    }

    return records;
  } catch {
    return [];
  }
}

// ─── GitHub User/Org Enrichment ─────────────────────────────────

interface GitHubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  createdAt: string;
  type: string;
  topRepos: Array<{ name: string; stars: number; language: string | null; description: string | null }>;
}

async function enrichGitHub(username: string): Promise<GitHubProfile | null> {
  const headers: Record<string, string> = {
    "User-Agent": "APIToll-Enrich/1.0",
    Accept: "application/vnd.github.v3+json",
  };

  // Use token if available for higher rate limits
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  const [profileResp, reposResp] = await Promise.all([
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers,
      signal: AbortSignal.timeout(8000),
    }),
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=stars&per_page=5`, {
      headers,
      signal: AbortSignal.timeout(8000),
    }),
  ]);

  if (!profileResp.ok) return null;

  const profile = (await profileResp.json()) as Record<string, unknown>;
  const repos = reposResp.ok
    ? ((await reposResp.json()) as Array<Record<string, unknown>>)
    : [];

  return {
    login: profile.login as string,
    name: (profile.name as string) || null,
    bio: (profile.bio as string) || null,
    company: (profile.company as string) || null,
    location: (profile.location as string) || null,
    blog: (profile.blog as string) || null,
    publicRepos: (profile.public_repos as number) || 0,
    followers: (profile.followers as number) || 0,
    following: (profile.following as number) || 0,
    createdAt: (profile.created_at as string) || "",
    type: (profile.type as string) || "User",
    topRepos: repos.map((r) => ({
      name: r.name as string,
      stars: (r.stargazers_count as number) || 0,
      language: (r.language as string) || null,
      description: (r.description as string) || null,
    })),
  };
}

// ─── Wikipedia Summary ──────────────────────────────────────────

interface WikiSummary {
  title: string;
  extract: string;
  url: string;
  thumbnail: string | null;
}

async function enrichWikipedia(query: string): Promise<WikiSummary | null> {
  const resp = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
    {
      headers: { "User-Agent": "APIToll-Enrich/1.0 (https://apitoll.com)" },
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!resp.ok) return null;

  const data = (await resp.json()) as {
    title: string;
    extract: string;
    content_urls?: { desktop?: { page?: string } };
    thumbnail?: { source?: string };
  };

  if (!data.extract) return null;

  return {
    title: data.title,
    extract: data.extract.slice(0, 1000),
    url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
    thumbnail: data.thumbnail?.source || null,
  };
}

// GET /api/enrich/domain?domain=example.com
router.get("/api/enrich/domain", async (req: Request, res: Response) => {
  const domain = ((req.query.domain as string) || "").trim().toLowerCase();
  if (!domain) {
    return res.status(400).json({
      error: "Missing required parameter: domain",
      example: "/api/enrich/domain?domain=stripe.com",
    });
  }

  // Basic domain validation
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    return res.status(400).json({ error: "Invalid domain format" });
  }

  const cacheKey = `enrich:domain:${domain}`;
  const cached = enrichCache.get<Record<string, unknown>>(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });
  }

  try {
    const info = await enrichDomain(domain);
    const payload = { ...info, source: "apitoll-enrich" };
    enrichCache.set(cacheKey, payload, CACHE_TTL);

    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Domain enrichment failed", details: (err as Error).message });
  }
});

// GET /api/enrich/github?username=torvalds
router.get("/api/enrich/github", async (req: Request, res: Response) => {
  const username = ((req.query.username as string) || "").trim();
  if (!username) {
    return res.status(400).json({
      error: "Missing required parameter: username",
      example: "/api/enrich/github?username=torvalds",
    });
  }

  const cacheKey = `enrich:github:${username.toLowerCase()}`;
  const cached = enrichCache.get<Record<string, unknown>>(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });
  }

  try {
    const profile = await enrichGitHub(username);
    if (!profile) {
      return res.status(404).json({ error: `GitHub user '${username}' not found` });
    }

    const payload = { ...profile, source: "github" };
    enrichCache.set(cacheKey, payload, CACHE_TTL);

    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "GitHub enrichment failed", details: (err as Error).message });
  }
});

// GET /api/enrich/wiki?q=Elon+Musk
router.get("/api/enrich/wiki", async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || "").trim();
  if (!q) {
    return res.status(400).json({
      error: "Missing required parameter: q",
      example: "/api/enrich/wiki?q=OpenAI",
    });
  }

  const cacheKey = `enrich:wiki:${q.toLowerCase()}`;
  const cached = enrichCache.get<Record<string, unknown>>(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });
  }

  try {
    const summary = await enrichWikipedia(q);
    if (!summary) {
      return res.json({
        query: q,
        found: false,
        message: "No Wikipedia article found for this query",
        cached: false,
        payment: formatPayment(getX402Context(req)),
      });
    }

    const payload = { query: q, found: true, ...summary, source: "wikipedia" };
    enrichCache.set(cacheKey, payload, CACHE_TTL);

    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(502).json({ error: "Wikipedia enrichment failed", details: (err as Error).message });
  }
});

export default router;
