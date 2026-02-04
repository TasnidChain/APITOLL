import {
  type Policy,
  type BudgetPolicy,
  type VendorAclPolicy,
  type RateLimitPolicy,
  type Transaction,
  checkBudgetPolicy,
  findBudgetPolicy,
  isVendorAllowed,
} from "@agentcommerce/shared";

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  policyType?: string;
}

/**
 * In-memory rate limiter using sliding window.
 */
class RateLimiter {
  private windows: Map<string, number[]> = new Map();

  check(key: string, maxPerMinute: number, maxPerHour?: number): PolicyCheckResult {
    const now = Date.now();
    const timestamps = this.windows.get(key) || [];

    // Clean old entries (keep last hour)
    const hourAgo = now - 3600_000;
    const cleaned = timestamps.filter((t) => t > hourAgo);
    this.windows.set(key, cleaned);

    // Check per-minute
    const minuteAgo = now - 60_000;
    const minuteCount = cleaned.filter((t) => t > minuteAgo).length;
    if (minuteCount >= maxPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${minuteCount}/${maxPerMinute} requests per minute`,
        policyType: "rate_limit",
      };
    }

    // Check per-hour
    if (maxPerHour && cleaned.length >= maxPerHour) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${cleaned.length}/${maxPerHour} requests per hour`,
        policyType: "rate_limit",
      };
    }

    return { allowed: true };
  }

  record(key: string): void {
    const timestamps = this.windows.get(key) || [];
    timestamps.push(Date.now());
    this.windows.set(key, timestamps);
  }
}

/**
 * Policy engine that evaluates all policies before allowing a payment.
 */
export class PolicyEngine {
  private policies: Policy[];
  private rateLimiter: RateLimiter;
  private recentTransactions: Transaction[] = [];

  constructor(policies: Policy[]) {
    this.policies = policies;
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Evaluate whether a payment should be allowed.
   */
  evaluate(params: {
    amount: number;
    sellerId: string;
    endpoint: string;
  }): PolicyCheckResult {
    const { amount, sellerId, endpoint } = params;

    // 1. Check vendor ACL
    if (!isVendorAllowed(this.policies, sellerId)) {
      return {
        allowed: false,
        reason: `Vendor "${sellerId}" is not in the approved vendor list`,
        policyType: "vendor_acl",
      };
    }

    // 2. Check budget policies
    const budgetPolicy = findBudgetPolicy(this.policies);
    if (budgetPolicy) {
      const violation = checkBudgetPolicy(
        budgetPolicy,
        amount,
        this.recentTransactions
      );
      if (violation) {
        return {
          allowed: false,
          reason: violation,
          policyType: "budget",
        };
      }
    }

    // 3. Check rate limits
    const rateLimitPolicies = this.policies.filter(
      (p): p is RateLimitPolicy => p.type === "rate_limit"
    );
    for (const ratePolicy of rateLimitPolicies) {
      const result = this.rateLimiter.check(
        endpoint,
        ratePolicy.maxPerMinute,
        ratePolicy.maxPerHour
      );
      if (!result.allowed) return result;
    }

    return { allowed: true };
  }

  /**
   * Record a completed transaction (for budget tracking).
   */
  recordTransaction(tx: Transaction): void {
    this.recentTransactions.push(tx);

    // Keep only last 7 days of transactions in memory
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    this.recentTransactions = this.recentTransactions.filter(
      (t) => new Date(t.requestedAt) > weekAgo
    );
  }

  /**
   * Record a rate limit hit.
   */
  recordRequest(endpoint: string): void {
    this.rateLimiter.record(endpoint);
  }

  /**
   * Get current spend summary.
   */
  getSpendSummary(): { today: number; thisWeek: number; transactionCount: number } {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const todayTxns = this.recentTransactions.filter(
      (tx) => new Date(tx.requestedAt) >= dayStart
    );
    const weekTxns = this.recentTransactions.filter(
      (tx) => new Date(tx.requestedAt) >= weekStart
    );

    return {
      today: todayTxns.reduce((sum, tx) => sum + parseFloat(tx.amount), 0),
      thisWeek: weekTxns.reduce((sum, tx) => sum + parseFloat(tx.amount), 0),
      transactionCount: this.recentTransactions.length,
    };
  }

  /**
   * Update policies at runtime.
   */
  updatePolicies(policies: Policy[]): void {
    this.policies = policies;
  }
}
