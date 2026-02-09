import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// Simple cron parser — handles standard 5-field cron expressions
// minute (0-59) hour (0-23) day-of-month (1-31) month (1-12) day-of-week (0-6)

function parseCronField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();

  for (const part of field.split(",")) {
    if (part === "*") {
      for (let i = min; i <= max; i++) values.add(i);
    } else if (part.includes("/")) {
      const [range, step] = part.split("/");
      const stepNum = parseInt(step, 10);
      const start = range === "*" ? min : parseInt(range, 10);
      for (let i = start; i <= max; i += stepNum) values.add(i);
    } else if (part.includes("-")) {
      const [a, b] = part.split("-").map(Number);
      for (let i = a; i <= b; i++) values.add(i);
    } else {
      values.add(parseInt(part, 10));
    }
  }

  return [...values].filter((v) => v >= min && v <= max).sort((a, b) => a - b);
}

function getNextRuns(expression: string, count: number): Date[] {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error("Expected 5-field cron expression: minute hour day month weekday");

  const minutes = parseCronField(parts[0], 0, 59);
  const hours = parseCronField(parts[1], 0, 23);
  const daysOfMonth = parseCronField(parts[2], 1, 31);
  const months = parseCronField(parts[3], 1, 12);
  const daysOfWeek = parseCronField(parts[4], 0, 6);

  const results: Date[] = [];
  const now = new Date();
  const cursor = new Date(now);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  const maxIterations = 525600; // 1 year of minutes
  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    iterations++;
    const m = cursor.getMinutes();
    const h = cursor.getHours();
    const dom = cursor.getDate();
    const mon = cursor.getMonth() + 1;
    const dow = cursor.getDay();

    if (
      minutes.includes(m) &&
      hours.includes(h) &&
      months.includes(mon) &&
      (daysOfMonth.includes(dom) || daysOfWeek.includes(dow))
    ) {
      results.push(new Date(cursor));
    }

    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return results;
}

function describeCron(expression: string): string {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return "Invalid expression";

  const [min, hour, dom, mon, dow] = parts;

  if (expression === "* * * * *") return "Every minute";
  if (min === "0" && hour === "*" && dom === "*" && mon === "*" && dow === "*") return "Every hour";
  if (min === "0" && hour === "0" && dom === "*" && mon === "*" && dow === "*") return "Every day at midnight";
  if (min === "0" && hour === "0" && dom === "*" && mon === "*" && dow === "1") return "Every Monday at midnight";

  const pieces: string[] = [];
  if (min !== "*") pieces.push(`at minute ${min}`);
  if (hour !== "*") pieces.push(`at hour ${hour}`);
  if (dom !== "*") pieces.push(`on day ${dom}`);
  if (mon !== "*") pieces.push(`in month ${mon}`);
  if (dow !== "*") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const indices = parseCronField(dow, 0, 6);
    pieces.push(`on ${indices.map((i) => days[i]).join(", ")}`);
  }

  return pieces.join(", ") || "Complex expression";
}

router.post("/api/cron", (req: Request, res: Response) => {
  const { expression, count = 5 } = req.body || {};

  if (!expression || typeof expression !== "string") return res.status(400).json({ error: 'Provide { expression: "*/5 * * * *", count?: 5 }' });
  if (expression.length > 100) return res.status(400).json({ error: "Expression too long" });

  const n = Math.min(Math.max(parseInt(count, 10) || 5, 1), 25);

  try {
    const nextRuns = getNextRuns(expression, n);
    const description = describeCron(expression);

    res.json({
      expression,
      description,
      nextRuns: nextRuns.map((d) => d.toISOString()),
      count: nextRuns.length,
      timezone: "UTC",
      payment: formatPayment(getX402Context(req)),
    });
  } catch (err) {
    res.status(400).json({ error: "Failed to parse cron expression", details: (err as Error).message });
  }
});

export default router;
