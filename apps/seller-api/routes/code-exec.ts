import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";
import { spawn } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { codeExecCache } from "../cache";
import crypto from "crypto";

const router = Router();

const CACHE_TTL = 0; // No caching — code execution should always be fresh
const MAX_TIMEOUT_MS = 30_000; // 30 second max
const MAX_OUTPUT_SIZE = 100_000; // 100KB max output
const MAX_CODE_SIZE = 50_000; // 50KB max code

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

// Blocked patterns to prevent dangerous operations
const BLOCKED_PATTERNS_PYTHON = [
  /\bos\.system\b/,
  /\bsubprocess\b/,
  /\b__import__\b/,
  /\beval\s*\(/,
  /\bexec\s*\(/,
  /\bopen\s*\(.*(\/etc|\/proc|\/sys|\/dev)/,
  /\bsocket\b/,
  /\bctypes\b/,
  /\bimportlib\b/,
];

const BLOCKED_PATTERNS_JS = [
  /\bchild_process\b/,
  /\brequire\s*\(\s*['"]fs['"]\s*\)/,
  /\brequire\s*\(\s*['"]net['"]\s*\)/,
  /\brequire\s*\(\s*['"]http['"]\s*\)/,
  /\bprocess\.exit\b/,
  /\bprocess\.env\b/,
  /\bglobal\b/,
];

function checkBlocked(code: string, language: string): string | null {
  const patterns = language === "python" ? BLOCKED_PATTERNS_PYTHON : BLOCKED_PATTERNS_JS;
  for (const pattern of patterns) {
    if (pattern.test(code)) {
      return `Blocked: code contains restricted pattern (${pattern.source})`;
    }
  }
  return null;
}

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  executionTimeMs: number;
}

function executeCode(code: string, language: string, timeoutMs: number): Promise<ExecResult> {
  return new Promise((resolve) => {
    const tmpDir = mkdtempSync(join(tmpdir(), "apitoll-exec-"));
    const ext = language === "python" ? ".py" : ".js";
    const filePath = join(tmpDir, `script${ext}`);
    writeFileSync(filePath, code);

    const cmd = language === "python" ? "python3" : "node";
    const args = language === "python" ? ["-u", filePath] : ["--max-old-space-size=128", filePath];

    const startTime = Date.now();
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const proc = spawn(cmd, args, {
      timeout: timeoutMs,
      cwd: tmpDir,
      env: { PATH: process.env.PATH, HOME: tmpDir, TMPDIR: tmpDir },
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdin.end();

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
      if (stdout.length > MAX_OUTPUT_SIZE) {
        stdout = stdout.slice(0, MAX_OUTPUT_SIZE) + "\n[OUTPUT TRUNCATED]";
        proc.kill("SIGKILL");
      }
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
      if (stderr.length > MAX_OUTPUT_SIZE) {
        stderr = stderr.slice(0, MAX_OUTPUT_SIZE) + "\n[OUTPUT TRUNCATED]";
        proc.kill("SIGKILL");
      }
    });

    proc.on("close", (exitCode) => {
      const executionTimeMs = Date.now() - startTime;
      if (executionTimeMs >= timeoutMs - 100) {
        timedOut = true;
      }

      // Cleanup temp files
      try { unlinkSync(filePath); } catch { /* ignore */ }
      try { unlinkSync(tmpDir); } catch { /* ignore */ }

      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode, timedOut, executionTimeMs });
    });

    proc.on("error", (err) => {
      const executionTimeMs = Date.now() - startTime;
      try { unlinkSync(filePath); } catch { /* ignore */ }
      try { unlinkSync(tmpDir); } catch { /* ignore */ }

      resolve({
        stdout: "",
        stderr: `Execution error: ${err.message}`,
        exitCode: 1,
        timedOut: false,
        executionTimeMs,
      });
    });
  });
}

// POST /api/execute
router.post("/api/execute", async (req: Request, res: Response) => {
  const { code, language = "python", timeout = 10000 } = req.body || {};

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing required field: code" });
  }

  if (code.length > MAX_CODE_SIZE) {
    return res.status(400).json({ error: `Code too large (max ${MAX_CODE_SIZE} bytes)` });
  }

  const lang = language.toLowerCase();
  if (!["python", "javascript", "js"].includes(lang)) {
    return res.status(400).json({
      error: "Unsupported language. Supported: python, javascript",
    });
  }

  const normalizedLang = lang === "js" ? "javascript" : lang;
  const timeoutMs = Math.min(Math.max(parseInt(timeout) || 10000, 1000), MAX_TIMEOUT_MS);

  // Check for dangerous patterns
  const blocked = checkBlocked(code, normalizedLang === "javascript" ? "js" : "python");
  if (blocked) {
    return res.status(400).json({ error: blocked });
  }

  // Check cache for identical code (skip re-execution of same code)
  const codeHash = crypto.createHash("sha256").update(`${normalizedLang}:${code}`).digest("hex").slice(0, 16);
  if (CACHE_TTL > 0) {
    const cached = codeExecCache.get<Record<string, unknown>>(`exec:${codeHash}`);
    if (cached) {
      return res.json({ ...cached, cached: true, payment: formatPayment(getX402Context(req)) });
    }
  }

  try {
    const result = await executeCode(code, normalizedLang === "javascript" ? "javascript" : "python", timeoutMs);

    const payload = {
      language: normalizedLang,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      executionTimeMs: result.executionTimeMs,
      codeHash,
    };

    if (CACHE_TTL > 0) {
      codeExecCache.set(`exec:${codeHash}`, payload, CACHE_TTL);
    }

    res.json({ ...payload, cached: false, payment: formatPayment(getX402Context(req)) });
  } catch (err) {
    res.status(500).json({ error: "Execution failed", details: (err as Error).message });
  }
});

export default router;
