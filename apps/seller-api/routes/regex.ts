import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { Worker } from "worker_threads";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// ── ReDoS-safe regex execution in a worker thread with strict timeout ──
function safeRegexExec(
  pattern: string,
  flags: string,
  text: string,
  replaceStr?: string,
  timeoutMs = 3000
): Promise<{ matches: { match: string; index: number; groups?: Record<string, string> }[]; replaced?: string }> {
  return new Promise((resolve, reject) => {
    const workerCode = `
      const { parentPort, workerData } = require("worker_threads");
      const { pattern, flags, text, replaceStr } = workerData;
      try {
        const regex = new RegExp(pattern, flags);
        const matches = [];
        if (flags.includes("g")) {
          let m;
          while ((m = regex.exec(text)) !== null && matches.length < 100) {
            matches.push({ match: m[0], index: m.index, groups: m.groups || undefined });
            if (m[0].length === 0) regex.lastIndex++;
          }
        } else {
          const m = regex.exec(text);
          if (m) matches.push({ match: m[0], index: m.index, groups: m.groups || undefined });
        }
        const result = { matches };
        if (typeof replaceStr === "string") {
          result.replaced = text.replace(regex, replaceStr);
        }
        parentPort.postMessage(result);
      } catch (err) {
        parentPort.postMessage({ error: err.message });
      }
    `;

    const worker = new Worker(workerCode, {
      eval: true,
      workerData: { pattern, flags, text, replaceStr },
    });

    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error("Regex execution timed out (possible catastrophic backtracking)"));
    }, timeoutMs);

    worker.on("message", (msg) => {
      clearTimeout(timer);
      if (msg.error) {
        reject(new Error(msg.error));
      } else {
        resolve(msg);
      }
    });

    worker.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

router.post("/api/regex", async (req: Request, res: Response) => {
  const { pattern, flags = "", text, replace } = req.body || {};

  if (!pattern || typeof pattern !== "string") return res.status(400).json({ error: 'Provide { pattern: string, text: string, flags?: string, replace?: string }' });
  if (!text || typeof text !== "string") return res.status(400).json({ error: "text is required" });
  if (pattern.length > 500) return res.status(400).json({ error: "Pattern must be under 500 characters" });
  if (text.length > 10000) return res.status(400).json({ error: "Text must be under 10,000 characters" });

  // Validate flags
  const validFlags = new Set(["g", "i", "m", "s", "u"]);
  const flagChars: string[] = flags.split("");
  const cleanFlags = flagChars.filter((f) => validFlags.has(f)).filter((f, i, a) => a.indexOf(f) === i).join("");

  // Validate regex can be compiled
  try {
    new RegExp(pattern, cleanFlags);
  } catch (err) {
    return res.status(400).json({ error: "Invalid regex pattern", details: (err as Error).message });
  }

  try {
    // Execute in worker thread with 3s timeout — prevents ReDoS from blocking event loop
    const result = await safeRegexExec(pattern, cleanFlags, text, typeof replace === "string" ? replace : undefined);

    const response: Record<string, unknown> = {
      pattern,
      flags: cleanFlags,
      isMatch: result.matches.length > 0,
      matchCount: result.matches.length,
      matches: result.matches,
      payment: formatPayment(getX402Context(req)),
    };

    if (result.replaced !== undefined) {
      response.replaced = result.replaced;
    }

    res.json(response);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes("timed out")) {
      return res.status(408).json({ error: "Regex execution timed out — pattern may cause catastrophic backtracking" });
    }
    res.status(500).json({ error: "Regex execution failed" });
  }
});

export default router;
