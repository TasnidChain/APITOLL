import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}


router.get("/api/datetime/between", (req: Request, res: Response) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({
      error: "Missing required parameters: from, to",
      example: "/api/datetime/between?from=2024-01-01&to=2024-12-31",
    });
  }

  const dateFrom = new Date(from as string);
  const dateTo = new Date(to as string);

  if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
    return res.status(400).json({ error: "Invalid date format. Use ISO 8601 (YYYY-MM-DD or full datetime)." });
  }

  const diffMs = dateTo.getTime() - dateFrom.getTime();
  const absDiffMs = Math.abs(diffMs);

  const totalSeconds = Math.floor(absDiffMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const totalWeeks = Math.floor(totalDays / 7);

  // Calculate years, months, days breakdown
  let years = dateTo.getFullYear() - dateFrom.getFullYear();
  let months = dateTo.getMonth() - dateFrom.getMonth();
  let days = dateTo.getDate() - dateFrom.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(dateTo.getFullYear(), dateTo.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  res.json({
    from: dateFrom.toISOString(),
    to: dateTo.toISOString(),
    direction: diffMs >= 0 ? "forward" : "backward",
    breakdown: { years: Math.abs(years), months: Math.abs(months), days: Math.abs(days) },
    total: {
      milliseconds: absDiffMs,
      seconds: totalSeconds,
      minutes: totalMinutes,
      hours: totalHours,
      days: totalDays,
      weeks: totalWeeks,
    },
    payment: formatPayment(getX402Context(req)),
  });
});


router.get("/api/datetime/business-days", (req: Request, res: Response) => {
  const { from, to, add } = req.query;

  if (from && to) {
    // Calculate business days between two dates
    const dateFrom = new Date(from as string);
    const dateTo = new Date(to as string);

    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    let businessDays = 0;
    const current = new Date(dateFrom);
    const end = dateTo.getTime();

    while (current.getTime() <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) businessDays++;
      current.setDate(current.getDate() + 1);
    }

    return res.json({
      from: dateFrom.toISOString().split("T")[0],
      to: dateTo.toISOString().split("T")[0],
      businessDays,
      weekendDays: Math.floor(Math.abs(dateTo.getTime() - dateFrom.getTime()) / 86400000) + 1 - businessDays,
      calendarDays: Math.floor(Math.abs(dateTo.getTime() - dateFrom.getTime()) / 86400000) + 1,
      payment: formatPayment(getX402Context(req)),
    });
  }

  if (from && add) {
    // Add N business days to a date
    const dateFrom = new Date(from as string);
    const daysToAdd = parseInt(add as string, 10);

    if (isNaN(dateFrom.getTime()) || isNaN(daysToAdd) || daysToAdd < 0 || daysToAdd > 10000) {
      return res.status(400).json({ error: "Invalid parameters" });
    }

    let added = 0;
    const current = new Date(dateFrom);

    while (added < daysToAdd) {
      current.setDate(current.getDate() + 1);
      const day = current.getDay();
      if (day !== 0 && day !== 6) added++;
    }

    return res.json({
      from: dateFrom.toISOString().split("T")[0],
      businessDaysAdded: daysToAdd,
      result: current.toISOString().split("T")[0],
      dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][current.getDay()],
      payment: formatPayment(getX402Context(req)),
    });
  }

  res.status(400).json({
    error: "Provide (from + to) to count business days, or (from + add) to add business days",
    examples: [
      "/api/datetime/business-days?from=2024-01-01&to=2024-01-31",
      "/api/datetime/business-days?from=2024-01-01&add=10",
    ],
  });
});


router.get("/api/datetime/unix", (req: Request, res: Response) => {
  const { timestamp, date } = req.query;

  if (timestamp) {
    // Unix timestamp to date
    let ts = parseInt(timestamp as string, 10);
    // Auto-detect seconds vs milliseconds
    if (ts < 1e12) ts *= 1000;

    const d = new Date(ts);
    if (isNaN(d.getTime())) {
      return res.status(400).json({ error: "Invalid timestamp" });
    }

    return res.json({
      timestamp: Math.floor(ts / 1000),
      timestampMs: ts,
      iso: d.toISOString(),
      utc: d.toUTCString(),
      date: d.toISOString().split("T")[0],
      time: d.toISOString().split("T")[1].replace("Z", ""),
      dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()],
      payment: formatPayment(getX402Context(req)),
    });
  }

  if (date) {
    // Date to unix timestamp
    const d = new Date(date as string);
    if (isNaN(d.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    return res.json({
      input: date,
      timestamp: Math.floor(d.getTime() / 1000),
      timestampMs: d.getTime(),
      iso: d.toISOString(),
      payment: formatPayment(getX402Context(req)),
    });
  }

  // Return current time
  const now = new Date();
  res.json({
    now: {
      timestamp: Math.floor(now.getTime() / 1000),
      timestampMs: now.getTime(),
      iso: now.toISOString(),
      utc: now.toUTCString(),
    },
    usage: "Provide ?timestamp=... or ?date=... to convert",
    payment: formatPayment(getX402Context(req)),
  });
});

export default router;
