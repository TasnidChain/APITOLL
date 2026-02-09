import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { marked } from "marked";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// ── HTML Sanitizer — strip dangerous tags/attributes from marked output ──
function sanitizeHtml(html: string): string {
  // Remove script tags and their content
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // Remove event handlers (onload, onerror, onclick, etc.)
  clean = clean.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  clean = clean.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "");
  // Remove javascript: and data: URIs in href/src/action
  clean = clean.replace(/(href|src|action)\s*=\s*["']\s*(javascript|data|vbscript):/gi, '$1="blocked:');
  // Remove iframe, object, embed, form, input, textarea, select, button, base, applet
  clean = clean.replace(/<\/?(iframe|object|embed|form|input|textarea|select|button|base|applet|link|meta)\b[^>]*>/gi, "");
  // Remove style attributes with expressions
  clean = clean.replace(/\s+style\s*=\s*["'][^"']*expression\s*\([^"']*["']/gi, "");
  return clean;
}

router.post("/api/markdown", async (req: Request, res: Response) => {
  const { text, options } = req.body || {};

  if (!text || typeof text !== "string") return res.status(400).json({ error: 'Provide { text: string, options?: { gfm?: boolean, breaks?: boolean } }' });
  if (text.length > 100000) return res.status(400).json({ error: "Text must be under 100,000 characters" });

  try {
    const markedOptions = {
      gfm: options?.gfm !== false,
      breaks: options?.breaks || false,
    };

    const rawHtml = await marked(text, markedOptions);
    // Sanitize to prevent XSS — marked does NOT sanitize by default
    const html = sanitizeHtml(rawHtml);

    // Extract headings for table of contents
    const headings: { level: number; text: string }[] = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(text)) !== null) {
      headings.push({ level: match[1].length, text: match[2].trim() });
    }

    // Count elements
    const stats = {
      characters: text.length,
      words: text.split(/\s+/).filter(Boolean).length,
      headings: headings.length,
      links: (text.match(/\[([^\]]+)\]\([^)]+\)/g) || []).length,
      images: (text.match(/!\[([^\]]*)\]\([^)]+\)/g) || []).length,
      codeBlocks: (text.match(/```/g) || []).length / 2,
      lists: (text.match(/^[\s]*[-*+]\s|^[\s]*\d+\.\s/gm) || []).length,
    };

    res.json({
      html,
      tableOfContents: headings,
      stats,
      payment: formatPayment(getX402Context(req)),
    });
  } catch (err) {
    res.status(500).json({ error: "Markdown conversion failed" });
  }
});

export default router;
