import { type Transaction, type PaymentReceipt, generateId } from "@agentcommerce/shared";

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
}

/**
 * Analytics reporter that sends transaction data to the AgentCommerce platform.
 * Falls back to local logging if no API key is configured.
 */
export class AnalyticsReporter {
  private config: ReporterConfig;
  private queue: Transaction[] = [];
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
   * Report a completed transaction.
   */
  async report(report: TransactionReport): Promise<void> {
    const transaction: Transaction = {
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
    };

    if (this.config.verbose) {
      console.log(
        `[agentcommerce] tx=${transaction.id} endpoint=${transaction.endpoint} amount=$${transaction.amount} chain=${transaction.chain} status=${transaction.status}`
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
   * Send a real-time webhook notification.
   */
  private async sendWebhook(transaction: Transaction): Promise<void> {
    if (!this.config.webhookUrl) return;

    await fetch(this.config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "transaction.settled",
        timestamp: transaction.settledAt,
        data: transaction,
      }),
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
