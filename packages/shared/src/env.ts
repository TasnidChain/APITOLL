// ─── Environment Validation & Health Checks ──────────────────────

/**
 * Validates required environment variables at startup.
 * Throws a clear error if any are missing.
 *
 * Usage:
 * ```ts
 * import { validateEnv } from "@apitoll/shared";
 *
 * validateEnv({
 *   required: ["SELLER_WALLET", "FACILITATOR_URL"],
 *   optional: ["REDIS_URL", "LOG_LEVEL"],
 * });
 * ```
 */

export interface EnvValidationConfig {
  /** Environment variables that MUST be set */
  required: string[];
  /** Optional vars — logged as warnings if missing */
  optional?: string[];
  /** Prefix for logging (e.g. "facilitator", "seller-api") */
  service?: string;
}

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  present: string[];
  warnings: string[];
}

export function validateEnv(config: EnvValidationConfig): EnvValidationResult {
  const { required, optional = [], service = "apitoll" } = config;

  const missing: string[] = [];
  const present: string[] = [];
  const warnings: string[] = [];

  for (const key of required) {
    if (process.env[key]) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  for (const key of optional) {
    if (!process.env[key]) {
      warnings.push(`[${service}] Optional env var ${key} is not set`);
    } else {
      present.push(key);
    }
  }

  const valid = missing.length === 0;

  if (!valid) {
    const msg = `[${service}] Missing required environment variables: ${missing.join(", ")}`;
    throw new Error(msg);
  }

  return { valid, missing, present, warnings };
}

/**
 * Safely reads an env var with a typed default.
 */
export function envString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export function envNumber(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  if (isNaN(parsed)) return defaultValue;
  return parsed;
}

export function envBool(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  return raw === "true" || raw === "1" || raw === "yes";
}

/**
 * Standard health check response shape.
 */
export interface HealthCheckResult {
  status: "ok" | "degraded" | "error";
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  checks: Record<string, { status: "ok" | "warn" | "error"; message?: string }>;
}

const startTime = Date.now();

export function createHealthCheck(
  service: string,
  version: string,
  checks: Record<string, () => { status: "ok" | "warn" | "error"; message?: string }>
): () => HealthCheckResult {
  return () => {
    const checkResults: HealthCheckResult["checks"] = {};
    let overallStatus: HealthCheckResult["status"] = "ok";

    for (const [name, check] of Object.entries(checks)) {
      try {
        const result = check();
        checkResults[name] = result;
        if (result.status === "error") overallStatus = "error";
        else if (result.status === "warn" && overallStatus !== "error") overallStatus = "degraded";
      } catch (err) {
        checkResults[name] = { status: "error", message: err instanceof Error ? err.message : String(err) };
        overallStatus = "error";
      }
    }

    return {
      status: overallStatus,
      service,
      version,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      checks: checkResults,
    };
  };
}
