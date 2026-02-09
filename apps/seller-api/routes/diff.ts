import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  line: string;
  lineNumber: { old?: number; new?: number };
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to find diff
  let i = m, j = n;
  const ops: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ type: "unchanged", line: oldLines[i - 1], lineNumber: { old: i, new: j } });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: "added", line: newLines[j - 1], lineNumber: { new: j } });
      j--;
    } else {
      ops.unshift({ type: "removed", line: oldLines[i - 1], lineNumber: { old: i } });
      i--;
    }
  }

  return ops;
}

router.post("/api/diff", (req: Request, res: Response) => {
  const { old: oldText, new: newText } = req.body || {};

  if (typeof oldText !== "string" || typeof newText !== "string") {
    return res.status(400).json({ error: 'Provide { old: string, new: string }' });
  }
  if (oldText.length > 50000 || newText.length > 50000) {
    return res.status(400).json({ error: "Each text must be under 50,000 characters" });
  }

  // Limit line count to prevent O(n²) memory/CPU exhaustion in LCS algorithm
  const oldLineCount = oldText.split("\n").length;
  const newLineCount = newText.split("\n").length;
  if (oldLineCount > 2000 || newLineCount > 2000) {
    return res.status(400).json({ error: "Each text must have fewer than 2,000 lines" });
  }

  try {
    const diff = computeDiff(oldText, newText);

    const added = diff.filter((d) => d.type === "added").length;
    const removed = diff.filter((d) => d.type === "removed").length;
    const unchanged = diff.filter((d) => d.type === "unchanged").length;

    // Generate unified diff format
    const unified = diff.map((d) => {
      if (d.type === "added") return `+ ${d.line}`;
      if (d.type === "removed") return `- ${d.line}`;
      return `  ${d.line}`;
    }).join("\n");

    res.json({
      identical: added === 0 && removed === 0,
      stats: { added, removed, unchanged, total: diff.length },
      diff: diff.slice(0, 500),
      unified: unified.slice(0, 50000),
      truncated: diff.length > 500,
      payment: formatPayment(getX402Context(req)),
    });
  } catch (err) {
    res.status(500).json({ error: "Diff failed" });
  }
});

export default router;
