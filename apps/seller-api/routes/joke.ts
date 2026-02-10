import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

// Fallback jokes if external APIs are down
const fallbackJokes = [
  "Why do programmers prefer dark mode? Because light attracts bugs!",
  "How many programmers does it take to change a light bulb? None, that's a hardware problem.",
  "Why do Java developers wear glasses? Because they can't C#!",
  "A SQL query walks into a bar, walks up to two tables, and asks: 'Can I join you?'",
  "99 little bugs in the code, 99 little bugs. Take one down, patch it around... 127 little bugs in the code.",
];

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return {
    txHash: ctx.receipt.txHash,
    amount: ctx.receipt.amount,
    from: ctx.receipt.from,
    chain: ctx.receipt.chain,
  };
}

router.get("/api/joke", async (_req: Request, res: Response) => {
  const ctx = getX402Context(_req);
  const category = ((_req.query.category as string) || "programming").toLowerCase();

  try {
    // Try JokeAPI first (free, no key, 1000+ jokes)
    const jokeApiUrl = `https://v2.jokeapi.dev/joke/${category === "programming" ? "Programming" : "Any"}?blacklistFlags=nsfw,racist,sexist&type=single,twopart`;
    const resp = await fetch(jokeApiUrl, {
      signal: AbortSignal.timeout(3000),
    });

    if (resp.ok) {
      const data = await resp.json() as { type: string; setup?: string; delivery?: string; joke?: string; category?: string };
      const joke =
        data.type === "twopart"
          ? `${data.setup} — ${data.delivery}`
          : data.joke;

      return res.json({
        joke,
        category: data.category?.toLowerCase() || category,
        source: "jokeapi.dev",
        cached: false,
        payment: formatPayment(ctx),
      });
    }
  } catch {
    // Fall through to fallback
  }

  try {
    // Try Official Joke API as secondary (free, no key)
    const resp = await fetch(
      "https://official-joke-api.appspot.com/random_joke",
      { signal: AbortSignal.timeout(3000) }
    );

    if (resp.ok) {
      const data = await resp.json() as { setup: string; punchline: string; type?: string };
      return res.json({
        joke: `${data.setup} — ${data.punchline}`,
        category: data.type || "general",
        source: "official-joke-api",
        cached: false,
        payment: formatPayment(ctx),
      });
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback to local jokes
  const joke = fallbackJokes[Math.floor(Math.random() * fallbackJokes.length)];
  res.json({
    joke,
    category: "programming",
    source: "local",
    cached: false,
    payment: formatPayment(ctx),
  });
});

export default router;
