import type { SupportedChain, BudgetPolicy, Policy, Transaction, PlatformFeeConfig, FeeBreakdown, PlanTier, PlanLimits } from "./types";
import { PLAN_LIMITS } from "./types";

/**
 * Convert USDC human-readable amount to smallest unit (6 decimals).
 * e.g., "1.50" → "1500000"
 */
export function usdcToSmallestUnit(amount: string): string {
  const [whole, frac = ""] = amount.split(".");
  const padded = frac.padEnd(6, "0").slice(0, 6);
  return BigInt(whole + padded).toString();
}

/**
 * Convert USDC smallest unit to human-readable.
 * e.g., "1500000" → "1.500000"
 */
export function usdcFromSmallestUnit(amount: string): string {
  const val = BigInt(amount);
  const whole = val / 1000000n;
  const frac = (val % 1000000n).toString().padStart(6, "0");
  return `${whole}.${frac}`;
}

/**
 * Match an HTTP method + path against a route pattern.
 * Supports patterns like "GET /api/data", "POST /inference", "* /any"
 */
export function matchRoute(
  method: string,
  path: string,
  pattern: string
): boolean {
  const [patternMethod, patternPath] = pattern.split(" ");
  if (!patternMethod || !patternPath) return false;

  const methodMatch = patternMethod === "*" || patternMethod.toUpperCase() === method.toUpperCase();
  if (!methodMatch) return false;

  // Exact match
  if (patternPath === path) return true;

  // Wildcard path matching
  const patternParts = patternPath.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) return false;

  return patternParts.every((part, i) => {
    if (part.startsWith(":")) return true; // path param wildcard
    return part === pathParts[i];
  });
}

/**
 * Check if a transaction would violate budget policies.
 * Returns null if OK, or an error message string if violated.
 */
export function checkBudgetPolicy(
  policy: BudgetPolicy,
  amount: number,
  recentTransactions: Pick<Transaction, "amount" | "requestedAt">[]
): string | null {
  // Check per-request limit
  if (amount > policy.maxPerRequest) {
    return `Request amount $${amount} exceeds max per-request limit of $${policy.maxPerRequest}`;
  }

  // Check daily cap
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const todaySpend = recentTransactions
    .filter((tx) => new Date(tx.requestedAt) >= dayStart)
    .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

  if (todaySpend + amount > policy.dailyCap) {
    return `Adding $${amount} would exceed daily cap of $${policy.dailyCap} (already spent $${todaySpend.toFixed(4)} today)`;
  }

  // Check weekly cap (rolling 7-day window)
  if (policy.weeklyCap) {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const weekSpend = recentTransactions
      .filter((tx) => new Date(tx.requestedAt) >= sevenDaysAgo)
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    if (weekSpend + amount > policy.weeklyCap) {
      return `Adding $${amount} would exceed weekly cap of $${policy.weeklyCap} (already spent $${weekSpend.toFixed(4)} this week)`;
    }
  }

  return null;
}

/**
 * Find the first applicable budget policy from a list.
 */
export function findBudgetPolicy(policies: Policy[]): BudgetPolicy | undefined {
  return policies.find((p): p is BudgetPolicy => p.type === "budget");
}

/**
 * Check if a vendor/seller is allowed by vendor ACL policies.
 */
export function isVendorAllowed(policies: Policy[], sellerId: string): boolean {
  const aclPolicies = policies.filter((p) => p.type === "vendor_acl");
  if (aclPolicies.length === 0) return true; // no ACL = allow all

  for (const policy of aclPolicies) {
    if (policy.type !== "vendor_acl") continue;

    // Check blocked first
    if (policy.blockedVendors?.includes(sellerId)) return false;

    // Check allowed
    if (policy.allowedVendors.includes("*")) return true;
    if (policy.allowedVendors.includes(sellerId)) return true;
  }

  return false;
}

/**
 * Generate a unique ID with optional prefix.
 */
export function generateId(prefix: string = ""): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Determine supported chains from endpoint config.
 */
export function resolveChains(chains?: SupportedChain[]): SupportedChain[] {
  return chains && chains.length > 0 ? chains : ["base"];
}

// ─── Platform Fee Utilities ──────────────────────────────────────

/**
 * Calculate fee breakdown for a given price and platform fee config.
 * Fee is deducted from the total — buyer pays the listed price,
 * seller receives price minus fee, platform gets the fee.
 */
export function calculateFeeBreakdown(
  price: string,
  feeConfig?: PlatformFeeConfig
): FeeBreakdown {
  const feeBps = feeConfig?.feeBps ?? 0;
  const totalSmallest = BigInt(usdcToSmallestUnit(price));

  // Calculate platform fee: total * feeBps / 10000
  const platformFeeSmallest = (totalSmallest * BigInt(feeBps)) / 10000n;
  const sellerAmountSmallest = totalSmallest - platformFeeSmallest;

  return {
    totalAmount: price,
    sellerAmount: usdcFromSmallestUnit(sellerAmountSmallest.toString()),
    platformFee: usdcFromSmallestUnit(platformFeeSmallest.toString()),
    feeBps,
  };
}

/**
 * Get the platform wallet address for a given chain.
 */
export function getPlatformWallet(
  chain: SupportedChain,
  feeConfig?: PlatformFeeConfig
): string | undefined {
  if (!feeConfig) return undefined;
  return chain === "base" ? feeConfig.platformWalletBase : feeConfig.platformWalletSolana;
}

// ─── Plan Enforcement Utilities ──────────────────────────────────

/**
 * Get the limits for a given plan tier.
 */
export function getPlanLimits(plan: PlanTier): PlanLimits {
  return PLAN_LIMITS[plan];
}

/**
 * Check if an action is within plan limits.
 * Returns null if OK, or an error message if limit exceeded.
 */
export function checkPlanLimit(
  plan: PlanTier,
  metric: keyof PlanLimits,
  currentValue: number
): string | null {
  const limits = PLAN_LIMITS[plan];
  const limit = limits[metric];

  if (typeof limit === "number" && currentValue >= limit) {
    return `Plan limit exceeded: ${metric} (current: ${currentValue}, limit: ${limit}). Upgrade to a higher plan.`;
  }

  if (typeof limit === "boolean" && !limit) {
    return `Feature not available on ${plan} plan: ${metric}. Upgrade to pro or enterprise.`;
  }

  return null;
}

// ─── Input Validation Utilities ──────────────────────────────────

/**
 * Validate an Ethereum address (0x + 40 hex chars).
 * Does NOT verify checksum — use viem for that.
 */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate a Solana address (base58, 32-44 chars).
 */
export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Validate a payment amount string.
 * Must be a positive numeric string (integer or decimal).
 */
export function isValidPaymentAmount(amount: string): boolean {
  if (!/^\d+(\.\d+)?$/.test(amount)) return false;
  try {
    const smallest = BigInt(usdcToSmallestUnit(amount));
    return smallest > 0n;
  } catch {
    return false;
  }
}

/**
 * Validate a hex nonce (0x + 64 hex chars = 32 bytes).
 */
export function isValidNonce(nonce: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(nonce);
}

/**
 * In-memory nonce tracker for replay protection.
 * For production, replace with a database-backed implementation.
 */
export class NonceTracker {
  private used: Set<string> = new Set();
  private maxSize: number;

  constructor(maxSize: number = 100_000) {
    this.maxSize = maxSize;
  }

  /**
   * Check if a nonce has been used. Returns true if this is a NEW nonce.
   * Returns false if the nonce was already seen (replay attempt).
   */
  tryUse(nonce: string): boolean {
    if (this.used.has(nonce)) return false;

    // Prevent unbounded memory growth
    if (this.used.size >= this.maxSize) {
      // Evict oldest entries (Set maintains insertion order)
      const iter = this.used.values();
      const toDelete = Math.floor(this.maxSize * 0.1); // evict 10%
      for (let i = 0; i < toDelete; i++) {
        const val = iter.next().value;
        if (val !== undefined) this.used.delete(val);
      }
    }

    this.used.add(nonce);
    return true;
  }

  /**
   * Check if a nonce was already used (without consuming it).
   */
  hasBeenUsed(nonce: string): boolean {
    return this.used.has(nonce);
  }

  get size(): number {
    return this.used.size;
  }
}

/**
 * Compute HMAC-SHA256 signature for webhook payloads.
 * Uses Web Crypto API (works in Node 18+, Deno, Cloudflare Workers).
 */
export async function computeHmacSignature(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify an HMAC-SHA256 webhook signature (constant-time comparison).
 */
export async function verifyHmacSignature(
  payload: string,
  secret: string,
  providedSignature: string
): Promise<boolean> {
  const expected = await computeHmacSignature(payload, secret);
  return secureCompare(expected, providedSignature);
}

// ─── Security Utilities ──────────────────────────────────────────

/**
 * Generate a cryptographically secure API key with prefix.
 */
export function generateSecureApiKey(prefix: string): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

/**
 * Constant-time string comparison for API keys.
 * Prevents timing attacks — including length-based leaks.
 */
export function secureCompare(a: string, b: string): boolean {
  // Use the longer length so we always iterate the same amount
  // regardless of which string is shorter — prevents length oracle
  const len = Math.max(a.length, b.length);
  let result = a.length ^ b.length; // non-zero if lengths differ
  for (let i = 0; i < len; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return result === 0;
}

/**
 * Validate an origin against a list of allowed origins.
 */
export function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  return allowedOrigins.some((allowed) => {
    if (allowed === "*") return true;
    return origin === allowed;
  });
}

/**
 * Standard security headers for HTTP responses.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "no-store",
};

/**
 * Sanitize and clamp a numeric query parameter.
 */
export function clampInt(value: string | null, min: number, max: number, defaultVal: number): number {
  if (!value) return defaultVal;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultVal;
  return Math.max(min, Math.min(max, parsed));
}

/**
 * Sanitize and clamp a float query parameter.
 */
export function clampFloat(value: string | null, min: number, max: number, defaultVal: number): number {
  if (!value) return defaultVal;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return defaultVal;
  return Math.max(min, Math.min(max, parsed));
}
