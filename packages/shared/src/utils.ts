import type { SupportedChain, BudgetPolicy, Policy, Transaction } from "./types";

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

  // Check weekly cap
  if (policy.weeklyCap) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekSpend = recentTransactions
      .filter((tx) => new Date(tx.requestedAt) >= weekStart)
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
