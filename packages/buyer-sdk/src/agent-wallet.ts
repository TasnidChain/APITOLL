import {
  type AgentConfig,
  type Policy,
  type SupportedChain,
  type Transaction,
  type PaymentRequirement,
  type PaymentReceipt,
  generateId,
  usdcFromSmallestUnit,
} from "@agentcommerce/shared";
import { PolicyEngine, type PolicyCheckResult } from "./policy-engine";

// ─── Types ──────────────────────────────────────────────────────

export interface AgentWalletOptions extends AgentConfig {
  /** Signing function: receives payment requirements, returns signed payment header */
  signer?: PaymentSigner;
  /** Callback when a policy rejects a payment */
  onPolicyRejection?: (result: PolicyCheckResult, url: string) => void;
  /** Callback when a payment is completed */
  onPayment?: (receipt: PaymentReceipt, url: string) => void;
  /** Callback on errors */
  onError?: (error: Error, url: string) => void;
}

export type PaymentSigner = (
  requirements: PaymentRequirement[],
  chain: SupportedChain
) => Promise<string>;

export interface AgentFetchOptions extends RequestInit {
  /** Override policy check for this request */
  skipPolicyCheck?: boolean;
  /** Override max price for this request */
  maxPrice?: number;
  /** Seller ID hint (used for vendor ACL check) */
  sellerId?: string;
}

// ─── Agent Wallet ───────────────────────────────────────────────

/**
 * Agent wallet with built-in x402 payment handling and policy enforcement.
 *
 * Usage:
 * ```ts
 * const agent = createAgentWallet({
 *   name: "ResearchBot",
 *   chain: "base",
 *   policies: [
 *     { type: "budget", dailyCap: 50, maxPerRequest: 0.10 },
 *     { type: "vendor_acl", allowedVendors: ["*"] },
 *   ],
 *   privateKey: process.env.AGENT_PRIVATE_KEY,
 * });
 *
 * // Auto-handles 402 responses
 * const data = await agent.fetch("https://api.weather.pro/forecast");
 * ```
 */
export class AgentWallet {
  readonly name: string;
  readonly chain: SupportedChain;
  private policyEngine: PolicyEngine;
  private signer?: PaymentSigner;
  private options: AgentWalletOptions;
  private transactionLog: Transaction[] = [];

  constructor(options: AgentWalletOptions) {
    this.name = options.name;
    this.chain = options.chain;
    this.policyEngine = new PolicyEngine(options.policies);
    this.signer = options.signer;
    this.options = options;
  }

  /**
   * Fetch a resource, automatically handling x402 payment if required.
   */
  async fetch(url: string, init?: AgentFetchOptions): Promise<Response> {
    const { skipPolicyCheck, maxPrice, sellerId, ...fetchInit } = init || {};

    // Step 1: Make initial request
    const response = await globalThis.fetch(url, fetchInit);

    // Step 2: If not 402, return as-is
    if (response.status !== 402) {
      return response;
    }

    // Step 3: Parse payment requirements from 402 response
    const requirements = await this.parsePaymentRequirements(response);
    if (!requirements || requirements.length === 0) {
      throw new AgentPaymentError("Received 402 but no payment requirements found", url);
    }

    // Step 4: Select the best payment requirement (prefer our chain)
    const selected = this.selectRequirement(requirements);
    if (!selected) {
      throw new AgentPaymentError(
        `No compatible payment requirement found for chain ${this.chain}`,
        url
      );
    }

    const amount = parseFloat(usdcFromSmallestUnit(selected.maxAmountRequired));

    // Step 5: Check policies
    if (!skipPolicyCheck) {
      const policyResult = this.policyEngine.evaluate({
        amount,
        sellerId: sellerId || this.extractSellerId(url),
        endpoint: new URL(url).pathname,
      });

      if (!policyResult.allowed) {
        this.options.onPolicyRejection?.(policyResult, url);
        throw new PolicyViolationError(policyResult.reason || "Policy rejected", url);
      }
    }

    // Step 6: Check max price override
    if (maxPrice !== undefined && amount > maxPrice) {
      throw new AgentPaymentError(
        `Price $${amount} exceeds max price $${maxPrice}`,
        url
      );
    }

    // Step 7: Sign the payment
    if (!this.signer) {
      throw new AgentPaymentError(
        "No signer configured. Provide a signer function or private key.",
        url
      );
    }

    const paymentHeader = await this.signer([selected], this.chain);

    // Step 8: Retry with payment
    const paidResponse = await globalThis.fetch(url, {
      ...fetchInit,
      headers: {
        ...fetchInit?.headers,
        "X-PAYMENT": paymentHeader,
      },
    });

    // Step 9: Record transaction
    const transaction: Transaction = {
      id: generateId("tx"),
      txHash: "", // will be populated by receipt
      agentAddress: "",
      sellerId: sellerId || this.extractSellerId(url),
      endpoint: new URL(url).pathname,
      method: fetchInit?.method || "GET",
      amount: amount.toFixed(6),
      chain: this.chain,
      status: paidResponse.ok ? "settled" : "failed",
      requestedAt: new Date().toISOString(),
      settledAt: new Date().toISOString(),
      responseStatus: paidResponse.status,
    };

    this.transactionLog.push(transaction);
    this.policyEngine.recordTransaction(transaction);
    this.policyEngine.recordRequest(new URL(url).pathname);

    // Step 10: Notify
    if (paidResponse.ok) {
      this.options.onPayment?.(
        {
          txHash: transaction.txHash,
          chain: this.chain,
          amount: transaction.amount,
          from: "",
          to: selected.payTo,
          timestamp: transaction.requestedAt,
        },
        url
      );
    }

    return paidResponse;
  }

  /**
   * Parse payment requirements from a 402 response.
   */
  private async parsePaymentRequirements(
    response: Response
  ): Promise<PaymentRequirement[] | null> {
    // Try PAYMENT-REQUIRED header first
    const headerValue = response.headers.get("payment-required");
    if (headerValue) {
      try {
        return JSON.parse(Buffer.from(headerValue, "base64").toString("utf-8"));
      } catch {}
    }

    // Fall back to JSON body
    try {
      const body = await response.json() as { paymentRequirements?: PaymentRequirement[] }
      if (body.paymentRequirements) {
        return body.paymentRequirements;
      }
    } catch {}

    return null;
  }

  /**
   * Select the best payment requirement based on agent's preferred chain.
   */
  private selectRequirement(
    requirements: PaymentRequirement[]
  ): PaymentRequirement | null {
    const chainPrefix = this.chain === "base" ? "eip155:" : "solana:";

    // Prefer our chain
    const preferred = requirements.find((r) =>
      r.network.startsWith(chainPrefix)
    );
    if (preferred) return preferred;

    // Fall back to any available
    return requirements[0] || null;
  }

  /**
   * Extract a seller ID from a URL (hostname-based).
   */
  private extractSellerId(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return "unknown";
    }
  }

  /**
   * Get current spend summary.
   */
  getSpendSummary() {
    return this.policyEngine.getSpendSummary();
  }

  /**
   * Get full transaction log.
   */
  getTransactions(): Transaction[] {
    return [...this.transactionLog];
  }

  /**
   * Update policies at runtime.
   */
  updatePolicies(policies: Policy[]): void {
    this.policyEngine.updatePolicies(policies);
  }
}

// ─── Factory Function ───────────────────────────────────────────

/**
 * Create a new agent wallet with x402 payment handling.
 */
export function createAgentWallet(options: AgentWalletOptions): AgentWallet {
  return new AgentWallet(options);
}

// ─── Error Classes ──────────────────────────────────────────────

export class AgentPaymentError extends Error {
  constructor(message: string, public url: string) {
    super(message);
    this.name = "AgentPaymentError";
  }
}

export class PolicyViolationError extends Error {
  constructor(message: string, public url: string) {
    super(message);
    this.name = "PolicyViolationError";
  }
}
