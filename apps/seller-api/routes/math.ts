import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}


function evaluate(expr: string): number {
  // Tokenize
  const tokens: (number | string)[] = [];
  let i = 0;
  const s = expr.replace(/\s+/g, "");

  while (i < s.length) {
    if (/\d/.test(s[i]) || (s[i] === "." && /\d/.test(s[i + 1]))) {
      let num = "";
      while (i < s.length && (/\d/.test(s[i]) || s[i] === ".")) {
        num += s[i++];
      }
      tokens.push(parseFloat(num));
    } else if ("+-*/^%()".includes(s[i])) {
      tokens.push(s[i++]);
    } else {
      // Check for functions
      let func = "";
      while (i < s.length && /[a-z]/i.test(s[i])) func += s[i++];
      if (func) tokens.push(func);
      else i++; // skip unknown
    }
  }

  // Recursive descent parser
  let pos = 0;

  function parseExpr(): number {
    let left = parseTerm();
    while (pos < tokens.length && (tokens[pos] === "+" || tokens[pos] === "-")) {
      const op = tokens[pos++];
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parsePower();
    while (pos < tokens.length && (tokens[pos] === "*" || tokens[pos] === "/" || tokens[pos] === "%")) {
      const op = tokens[pos++];
      const right = parsePower();
      if (op === "*") left *= right;
      else if (op === "/") left = right === 0 ? NaN : left / right;
      else left = right === 0 ? NaN : left % right;
    }
    return left;
  }

  function parsePower(): number {
    let base = parseUnary();
    if (pos < tokens.length && tokens[pos] === "^") {
      pos++;
      const exp = parsePower(); // right-associative
      base = Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary(): number {
    if (tokens[pos] === "-") {
      pos++;
      return -parseAtom();
    }
    if (tokens[pos] === "+") pos++;
    return parseAtom();
  }

  function parseAtom(): number {
    const token = tokens[pos];

    if (typeof token === "number") {
      pos++;
      return token;
    }

    if (token === "(") {
      pos++;
      const val = parseExpr();
      if (tokens[pos] === ")") pos++;
      return val;
    }

    // Math functions
    if (typeof token === "string") {
      const funcName = token.toLowerCase();
      pos++;
      if (tokens[pos] === "(") {
        pos++;
        const arg = parseExpr();
        if (tokens[pos] === ")") pos++;

        switch (funcName) {
          case "sqrt": return Math.sqrt(arg);
          case "abs": return Math.abs(arg);
          case "sin": return Math.sin(arg);
          case "cos": return Math.cos(arg);
          case "tan": return Math.tan(arg);
          case "log": return Math.log10(arg);
          case "ln": return Math.log(arg);
          case "ceil": return Math.ceil(arg);
          case "floor": return Math.floor(arg);
          case "round": return Math.round(arg);
          case "exp": return Math.exp(arg);
          default: return NaN;
        }
      }

      // Constants
      if (funcName === "pi") return Math.PI;
      if (funcName === "e") return Math.E;
    }

    return NaN;
  }

  return parseExpr();
}

router.post("/api/math/eval", (req: Request, res: Response) => {
  const { expression } = req.body || {};
  if (!expression || typeof expression !== "string") {
    return res.status(400).json({ error: 'Provide { expression: string } e.g. "sqrt(144) + 2^3"' });
  }
  if (expression.length > 1000) {
    return res.status(400).json({ error: "Expression must be under 1000 characters" });
  }

  try {
    const result = evaluate(expression);
    if (isNaN(result) || !isFinite(result)) {
      return res.json({
        expression,
        result: null,
        error: isNaN(result) ? "Invalid expression" : "Result is infinite",
        payment: formatPayment(getX402Context(req)),
      });
    }

    res.json({
      expression,
      result,
      payment: formatPayment(getX402Context(req)),
    });
  } catch (err) {
    res.status(400).json({ error: "Failed to evaluate expression", details: (err as Error).message });
  }
});


const CONVERSIONS: Record<string, Record<string, number>> = {
  // Length (base: meters)
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254, nm: 1852 },
  // Weight (base: grams)
  weight: { g: 1, kg: 1000, mg: 0.001, lb: 453.592, oz: 28.3495, ton: 1_000_000, st: 6350.29 },
  // Temperature handled separately
  // Volume (base: liters)
  volume: { l: 1, ml: 0.001, gal: 3.78541, qt: 0.946353, pt: 0.473176, cup: 0.236588, floz: 0.0295735 },
  // Speed (base: m/s)
  speed: { "m/s": 1, "km/h": 0.277778, mph: 0.44704, knot: 0.514444, "ft/s": 0.3048 },
  // Data (base: bytes)
  data: { b: 1, kb: 1024, mb: 1048576, gb: 1073741824, tb: 1099511627776 },
  // Time (base: seconds)
  time: { s: 1, ms: 0.001, min: 60, h: 3600, d: 86400, wk: 604800, yr: 31557600 },
};

function convertTemperature(value: number, from: string, to: string): number {
  // Normalize to Celsius first
  let celsius: number;
  switch (from.toLowerCase()) {
    case "c": celsius = value; break;
    case "f": celsius = (value - 32) * 5 / 9; break;
    case "k": celsius = value - 273.15; break;
    default: return NaN;
  }
  // Convert from Celsius to target
  switch (to.toLowerCase()) {
    case "c": return celsius;
    case "f": return celsius * 9 / 5 + 32;
    case "k": return celsius + 273.15;
    default: return NaN;
  }
}

router.get("/api/math/convert", (req: Request, res: Response) => {
  const { value: valueStr, from, to } = req.query;
  if (!valueStr || !from || !to) {
    return res.status(400).json({
      error: "Missing required parameters: value, from, to",
      example: "/api/math/convert?value=100&from=km&to=mi",
      categories: Object.keys(CONVERSIONS).concat(["temperature"]),
    });
  }

  const value = parseFloat(valueStr as string);
  if (isNaN(value)) {
    return res.status(400).json({ error: "Invalid numeric value" });
  }

  const fromUnit = (from as string).toLowerCase();
  const toUnit = (to as string).toLowerCase();

  // Temperature special case
  if (["c", "f", "k"].includes(fromUnit) && ["c", "f", "k"].includes(toUnit)) {
    const result = convertTemperature(value, fromUnit, toUnit);
    return res.json({
      value, from: fromUnit, to: toUnit,
      result: Math.round(result * 10000) / 10000,
      category: "temperature",
      payment: formatPayment(getX402Context(req)),
    });
  }

  // Find matching category
  for (const [category, units] of Object.entries(CONVERSIONS)) {
    if (units[fromUnit] !== undefined && units[toUnit] !== undefined) {
      const baseValue = value * units[fromUnit];
      const result = baseValue / units[toUnit];

      return res.json({
        value, from: fromUnit, to: toUnit,
        result: Math.round(result * 10000) / 10000,
        category,
        payment: formatPayment(getX402Context(req)),
      });
    }
  }

  res.status(400).json({
    error: `Cannot convert from '${fromUnit}' to '${toUnit}'. Units must be in the same category.`,
    categories: Object.fromEntries(
      Object.entries(CONVERSIONS).map(([cat, units]) => [cat, Object.keys(units)])
    ),
  });
});


router.post("/api/math/stats", (req: Request, res: Response) => {
  const { numbers } = req.body || {};
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: "Provide { numbers: number[] } in request body" });
  }
  if (numbers.length > 100000) {
    return res.status(400).json({ error: "Maximum 100,000 numbers" });
  }

  const vals = numbers.map(Number).filter((n: number) => !isNaN(n));
  if (vals.length === 0) {
    return res.status(400).json({ error: "No valid numbers provided" });
  }

  const sorted = [...vals].sort((a: number, b: number) => a - b);
  const sum = vals.reduce((a: number, b: number) => a + b, 0);
  const mean = sum / vals.length;
  const variance = vals.reduce((acc: number, v: number) => acc + (v - mean) ** 2, 0) / vals.length;
  const stdDev = Math.sqrt(variance);

  const median = vals.length % 2 === 0
    ? (sorted[vals.length / 2 - 1] + sorted[vals.length / 2]) / 2
    : sorted[Math.floor(vals.length / 2)];

  // Mode
  const freq = new Map<number, number>();
  for (const v of vals) freq.set(v, (freq.get(v) || 0) + 1);
  const maxFreq = Math.max(...freq.values());
  const mode = [...freq.entries()].filter(([, f]) => f === maxFreq).map(([v]) => v);

  res.json({
    count: vals.length,
    sum: Math.round(sum * 10000) / 10000,
    mean: Math.round(mean * 10000) / 10000,
    median,
    mode: mode.length === vals.length ? null : mode,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    range: sorted[sorted.length - 1] - sorted[0],
    variance: Math.round(variance * 10000) / 10000,
    standardDeviation: Math.round(stdDev * 10000) / 10000,
    percentiles: {
      p25: sorted[Math.floor(vals.length * 0.25)],
      p50: median,
      p75: sorted[Math.floor(vals.length * 0.75)],
      p90: sorted[Math.floor(vals.length * 0.90)],
      p99: sorted[Math.floor(vals.length * 0.99)],
    },
    payment: formatPayment(getX402Context(req)),
  });
});

export default router;
