import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// Validate email format
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Rate limiting per sender to prevent abuse
const sendCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_SENDS_PER_HOUR = 50;

function checkRateLimit(from: string): boolean {
  const now = Date.now();
  const entry = sendCounts.get(from);

  if (!entry || now > entry.resetAt) {
    sendCounts.set(from, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }

  if (entry.count >= MAX_SENDS_PER_HOUR) return false;
  entry.count++;
  return true;
}

// Send via Resend API
async function sendViaResend(params: {
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
}): Promise<{ id: string; status: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`Resend API error (${resp.status}): ${error}`);
  }

  const data = (await resp.json()) as { id: string };
  return { id: data.id, status: "sent" };
}

// Send via SMTP (Nodemailer) if configured
async function sendViaSMTP(params: {
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
}): Promise<{ id: string; status: string }> {
  // Dynamic import to avoid requiring nodemailer if not used
  const nodemailer = await import("nodemailer");

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transport.sendMail({
    from: params.from,
    to: params.to.join(", "),
    subject: params.subject,
    text: params.text,
    html: params.html,
  });

  return { id: info.messageId, status: "sent" };
}

// POST /api/email/send
router.post("/api/email/send", async (req: Request, res: Response) => {
  const { to, subject, text, html, from } = req.body || {};

  // Validate required fields
  if (!to) {
    return res.status(400).json({ error: "Missing required field: to" });
  }
  if (!subject || typeof subject !== "string") {
    return res.status(400).json({ error: "Missing required field: subject" });
  }
  if (!text && !html) {
    return res.status(400).json({ error: "Must provide either 'text' or 'html' body" });
  }

  // Normalize recipients
  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length > 10) {
    return res.status(400).json({ error: "Maximum 10 recipients per request" });
  }

  for (const email of recipients) {
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: `Invalid email address: ${email}` });
    }
  }

  // Validate subject length
  if (subject.length > 200) {
    return res.status(400).json({ error: "Subject too long (max 200 characters)" });
  }

  // Validate body size
  const bodySize = (text || "").length + (html || "").length;
  if (bodySize > 100_000) {
    return res.status(400).json({ error: "Email body too large (max 100KB)" });
  }

  // Determine sender
  const senderAddress = from || process.env.DEFAULT_FROM_EMAIL || "noreply@apitoll.com";

  // Rate limit check
  if (!checkRateLimit(senderAddress)) {
    return res.status(429).json({ error: "Rate limit exceeded (50 emails/hour per sender)" });
  }

  try {
    let result: { id: string; status: string };

    if (process.env.RESEND_API_KEY) {
      result = await sendViaResend({
        from: senderAddress,
        to: recipients,
        subject,
        text,
        html,
      });
    } else if (process.env.SMTP_HOST) {
      result = await sendViaSMTP({
        from: senderAddress,
        to: recipients,
        subject,
        text,
        html,
      });
    } else {
      return res.status(503).json({
        error: "Email service not configured. Set RESEND_API_KEY or SMTP_HOST.",
      });
    }

    res.json({
      ...result,
      to: recipients,
      subject,
      from: senderAddress,
      payment: formatPayment(getX402Context(req)),
    });
  } catch (err) {
    res.status(502).json({ error: "Email delivery failed", details: (err as Error).message });
  }
});

// POST /api/email/validate — validate email addresses
router.post("/api/email/validate", async (req: Request, res: Response) => {
  const { emails } = req.body || {};

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: "Missing required field: emails (array of strings)" });
  }

  if (emails.length > 50) {
    return res.status(400).json({ error: "Maximum 50 emails per validation request" });
  }

  const results = await Promise.all(
    emails.map(async (email: string) => {
      const valid = isValidEmail(email);
      if (!valid) {
        return { email, valid: false, reason: "Invalid format" };
      }

      // Check MX records via DNS
      const domain = email.split("@")[1];
      try {
        const resp = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`,
          {
            headers: { Accept: "application/dns-json" },
            signal: AbortSignal.timeout(3000),
          }
        );

        if (resp.ok) {
          const data = (await resp.json()) as { Answer?: unknown[] };
          const hasMX = data.Answer && data.Answer.length > 0;
          return {
            email,
            valid: true,
            deliverable: hasMX ? "likely" : "unknown",
            mxRecords: hasMX,
            domain,
          };
        }
      } catch {
        // DNS check failed, still syntactically valid
      }

      return { email, valid: true, deliverable: "unknown", domain };
    })
  );

  res.json({
    results,
    validCount: results.filter((r) => r.valid).length,
    totalChecked: results.length,
    payment: formatPayment(getX402Context(req)),
  });
});

export default router;
