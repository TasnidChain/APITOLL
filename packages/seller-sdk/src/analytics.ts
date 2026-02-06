import { type Transaction, type PaymentReceipt, type FeeBreakdown, generateId, computeHmacSignature } from "@apitoll/shared";

const PLATFORM_API_URL = "https://api.agentcommerce.xyz";

export interface ReporterConfig {
  /** Platform API key for authentication */
  apiKey?: string;
  /** Seller ID on the platform */
  sellerId?: string;
  /** Custom platform API URL */
  platformUrl?: string;
  /** Webhook URL for real-time notifications */
  webhookUrl?: string;
  /** Webhook signing secret for HMAC-SHA256 verification */
  webhookSecret?: string;
  /** Enable local logging */
  verbose?: boolean;
}

export interface TransactionReport {
  /** The endpoint that was called */
  endpoint: string;
  /** HTTP method */
  method: string;
  /** Payment receipt from verification */
  receipt: PaymentReceipt;
  /** Response HTTP status */
  responseStatus: number;
  /** Request-to-response latency in ms */
  latencyMs: number;
  /** Fee breakdown (if platform fee enabled) */
  feeBreakdown?: FeeBreakdown;
}

// Extended transaction with fee data for internal tracking
interface TransactionWithFee extends Transaction {
  platformFee?: string;
  sellerAmount?: string;
  feeBps?: number;
}

/**
 * Analytics reporter that sends transaction data to the Apitoll platform.
 * Now includes platform fee tracking for revenue reporting.
 * Falls back to local logging if no API key is configured.
 */
export class AnalyticsReporter {
  private config: ReporterConfig;
  private queue: TransactionWithFee[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: ReporterConfig = {}) {
    this.config = {
      platformUrl: PLATFORM_API_URL,
      verbose: false,
      ...config,
    };

    // Batch flush every 5 seconds
    if (this.config.apiKey) {
      this.flushTimer = setInterval(() => this.flush(), 5000);
    }
  }

  /**
   * Report a completed transaction (with optional fee breakdown).
   */
  async report(report: TransactionReport): Promise<void> {
    const transaction: TransactionWithFee = {
      id: generateId("tx"),
      txHash: report.receipt.txHash,
      agentAddress: report.receipt.from,
      sellerId: this.config.sellerId || "unknown",
      endpoint: report.endpoint,
      method: report.method,
      amount: report.receipt.amount,
      chain: report.receipt.chain,
      status: report.responseStatus < 400 ? "settled" : "failed",
      requestedAt: report.receipt.timestamp,
      settledAt: report.receipt.timestamp,
      responseStatus: report.responseStatus,
      latencyMs: report.latencyMs,
      // Fee tracking
      platformFee: report.feeBreakdown?.platformFee,
      sellerAmount: report.feeBreakdown?.sellerAmount,
      feeBps: report.feeBreakdown?.feeBps,
    };

    if (this.config.verbose) {
      const feeInfo = report.feeBreakdown
        ? ` fee=$${report.feeBreakdown.platformFee} seller=$${report.feeBreakdown.sellerAmount}`
        : "";
      console.log(
        `[agentcommerce] tx=${transaction.id} endpoint=${transaction.endpoint} amount=$${transaction.amount}${feeInfo} chain=${transaction.chain} status=${transaction.status}`
      );
    }

    // Queue for batch send
    this.queue.push(transaction);

    // Send webhook immediately if configured
    if (this.config.webhookUrl) {
      this.sendWebhook(transaction).catch((err) => {
        if (this.config.verbose) {
          console.error(`[agentcommerce] webhook error:`, err);
        }
      });
    }

    // Flush immediately if queue is large
    if (this.queue.length >= 50) {
      await this.flush();
    }
  }

  /**
   * Report a failed/rejected payment (no receipt).
   */
  async reportRejection(endpoint: string, method: string, reason: string): Promise<void> {
    if (this.config.verbose) {
      console.log(`[agentcommerce] rejected endpoint=${endpoint} reason=${reason}`);
    }
  }

  /**
   * Flush queued transactions to the platform.
   */
  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    if (!this.config.apiKey) {
      this.queue = [];
      return;
    }

    const batch = this.queue.splice(0, this.queue.length);

    try {
      await fetch(`${this.config.platformUrl}/v1/transactions/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({ transactions: batch }),
      });
    } catch (err) {
      // Re-queue on failure (with limit to prevent memory leaks)
      if (this.queue.length < 500) {
        this.queue.unshift(...batch);
      }
      if (this.config.verbose) {
        console.error(`[agentcommerce] flush error:`, err);
      }
    }
  }

  /**
   * Send a real-time webhook notification with optional HMAC-SHA256 signing.
   */
  private async sendWebhook(transaction: TransactionWithFee): Promise<void> {
    if (!this.config.webhookUrl) return;

    const body = JSON.stringify({
      type: "transaction.settled",
      timestamp: transaction.settledAt,
      data: transaction,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Sign webhook payload if secret is configured
    if (this.config.webhookSecret) {
      const signature = await computeHmacSignature(body, this.config.webhookSecret);
      headers["X-Webhook-Signature"] = signature;
    }

    await fetch(this.config.webhookUrl, {
      method: "POST",
      headers,
      body,
    });
  }

  /**
   * Cleanup: flush remaining transactions and clear timer.
   */
  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}
