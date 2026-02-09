import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// Common trigrams per language (top 20 each)
const LANG_PROFILES: Record<string, { name: string; trigrams: string[] }> = {
  en: { name: "English", trigrams: ["the", "and", "ing", "tion", "her", "for", "tha", "hat", "his", "ere", "ent", "ion", "ter", "was", "you", "ith", "ver", "all", "wit", "thi"] },
  es: { name: "Spanish", trigrams: ["que", "de ", "el ", "en ", "la ", "los", "ión", "nte", "con", "ado", "est", "ent", "las", "por", "una", "del", "res", "cia", "par", "era"] },
  fr: { name: "French", trigrams: ["les", "des", "ent", "que", "ion", "de ", "ait", "est", "ous", "par", "une", "com", "sur", "tio", "ont", "men", "qui", "tre", "dan", "pas"] },
  de: { name: "German", trigrams: ["ein", "ich", "und", "der", "die", "den", "sch", "ung", "cht", "ten", "ver", "ber", "eit", "gen", "ist", "des", "ier", "nic", "ges", "hen"] },
  it: { name: "Italian", trigrams: ["che", "ell", "per", "ion", "ent", "con", "ato", "lla", "del", "azi", "one", "men", "sta", "gli", "ale", "non", "era", "nte", "ita", "tat"] },
  pt: { name: "Portuguese", trigrams: ["que", "ção", "ent", "ade", "men", "dos", "est", "com", "par", "uma", "nte", "ido", "con", "tos", "ter", "ões", "era", "res", "sta", "das"] },
  nl: { name: "Dutch", trigrams: ["een", "van", "het", "den", "ver", "oor", "aar", "ing", "and", "erd", "ter", "ijk", "aan", "ede", "die", "sch", "wor", "gen", "ond", "ien"] },
  sv: { name: "Swedish", trigrams: ["och", "för", "att", "det", "som", "ing", "den", "var", "ade", "med", "ter", "era", "nte", "und", "gen", "lig", "ska", "har", "ill", "ett"] },
  da: { name: "Danish", trigrams: ["der", "det", "for", "den", "til", "med", "som", "har", "ere", "ige", "var", "hed", "sig", "kan", "gen", "lig", "ler", "ede", "ine", "ste"] },
  no: { name: "Norwegian", trigrams: ["for", "det", "som", "til", "med", "den", "var", "har", "ere", "ige", "ble", "gen", "lig", "kan", "ede", "ine", "ste", "ner", "ter", "att"] },
};

function getTrigrams(text: string): string[] {
  const clean = text.toLowerCase().replace(/[^a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ\s]/g, "");
  const trigrams: string[] = [];
  for (let i = 0; i < clean.length - 2; i++) trigrams.push(clean.substring(i, i + 3));
  return trigrams;
}

router.get("/api/language", (req: Request, res: Response) => {
  const text = req.query.text as string;
  if (!text) return res.status(400).json({ error: "Provide ?text=Your text here" });

  const inputTrigrams = new Set(getTrigrams(text));
  const scores: Array<{ code: string; name: string; score: number }> = [];

  for (const [code, profile] of Object.entries(LANG_PROFILES)) {
    const matches = profile.trigrams.filter((t) => inputTrigrams.has(t)).length;
    scores.push({ code, name: profile.name, score: matches / profile.trigrams.length });
  }

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  res.json({
    detected: best.code, language: best.name,
    confidence: Math.round(best.score * 100) / 100,
    alternatives: scores.slice(1, 4).map((s) => ({ code: s.code, language: s.name, confidence: Math.round(s.score * 100) / 100 })),
    payment: formatPayment(getX402Context(req)),
  });
});

export default router;
