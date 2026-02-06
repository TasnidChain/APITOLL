/**
 * Marketplace Integration Module
 *
 * Integrates LLM Council with Apitoll Marketplace
 * Handles service registration, metrics reporting, and compliance
 */

import axios from "axios";
import { v4 as uuidv4 } from "uuid";

export interface ServiceListing {
  id: string;
  name: string;
  version: string;
  category: string;
  description: string;
  longDescription?: string;
  endpoint: string;
  healthEndpoint: string;
  tags: string[];
  pricing: PricingModel;
  documentation?: {
    publicDocs?: string;
    apiReference?: string;
    gettingStarted?: string;
  };
  support?: {
    email?: string;
    discord?: string;
    docs?: string;
  };
  capabilities: string[];
  useCases: string[];
  sla: {
    uptime: number; // percentage
    averageLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    successRate: number; // percentage
  };
  compliance: {
    gdpr: boolean;
    soc2: boolean;
    encryption: string[];
    dataRetention: string;
  };
}

export interface PricingModel {
  plans: PricingPlan[];
  freeQuota?: number;
  freePeriodDays?: number;
}

export interface PricingPlan {
  name: string;
  type: "per-request" | "per-month" | "volume-based" | "custom";
  price: number;
  currency: string;
  quota?: number;
  description?: string;
}

export interface HealthReport {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  requestsProcessed: number;
  averageLatencyMs: number;
  lastCheck: string;
  timestamp: string;
}

export interface MetricsReport {
  serviceId: string;
  period: "hourly" | "daily" | "weekly";
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    uptime: number;
    successRate: number;
  };
  timestamp: string;
}

/**
 * Marketplace Integration Client
 */
export class MarketplaceIntegration {
  private marketplaceUrl: string;
  private serviceId: string;
  private apiKey: string;
  private metricsInterval: NodeJS.Timer | null = null;

  constructor(
    marketplaceUrl: string,
    serviceId: string,
    apiKey: string
  ) {
    this.marketplaceUrl = marketplaceUrl;
    this.serviceId = serviceId;
    this.apiKey = apiKey;
  }

  /**
   * Register service with marketplace
   */
  async registerService(listing: ServiceListing): Promise<{ success: boolean; serviceId: string }> {
    try {
      const response = await axios.post(
        `${this.marketplaceUrl}/api/services/register`,
        listing,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`✅ Service registered with ID: ${response.data.serviceId}`);
      return {
        success: true,
        serviceId: response.data.serviceId,
      };
    } catch (error) {
      console.error("Failed to register service:", error);
      throw error;
    }
  }

  /**
   * Report health status to marketplace
   */
  async reportHealth(health: HealthReport): Promise<void> {
    try {
      await axios.post(
        `${this.marketplaceUrl}/api/services/${this.serviceId}/health`,
        health,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.error("Failed to report health:", error);
      // Don't throw, just log - we don't want health reporting failures to break the service
    }
  }

  /**
   * Report metrics to marketplace
   */
  async reportMetrics(metrics: MetricsReport): Promise<void> {
    try {
      await axios.post(
        `${this.marketplaceUrl}/api/services/${this.serviceId}/metrics`,
        metrics,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.error("Failed to report metrics:", error);
      // Don't throw, just log
    }
  }

  /**
   * Start automatic metrics reporting
   */
  startMetricsReporting(
    interval: number = 300000, // 5 minutes
    metricsProvider: () => MetricsReport
  ): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.metricsInterval = setInterval(async () => {
      const metrics = metricsProvider();
      await this.reportMetrics(metrics);
    }, interval);

    console.log(
      `📊 Metrics reporting started (interval: ${interval}ms)`
    );
  }

  /**
   * Stop automatic metrics reporting
   */
  stopMetricsReporting(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      console.log("⏹️  Metrics reporting stopped");
    }
  }

  /**
   * Get default service listing for LLM Council
   */
  static getDefaultLLMCouncilListing(): ServiceListing {
    return {
      id: "llm-council",
      name: "LLM Council Orchestrator",
      version: "1.0.0",
      category: "ai-primitives",
      description:
        "3-stage LLM orchestration service for complex reasoning and analysis",
      longDescription: `The LLM Council Orchestrator is a production-grade AI service that implements a sophisticated 3-stage pipeline: intelligent decomposition of complex queries into subtasks, parallel execution with dependency resolution, and smart synthesis of results with confidence scoring. Perfect for market analysis, technical research, strategic planning, and any multi-faceted problem-solving.`,
      endpoint: process.env.SERVICE_ENDPOINT || "http://localhost:3001/orchestrate",
      healthEndpoint:
        process.env.HEALTH_ENDPOINT || "http://localhost:3001/health",
      tags: [
        "llm",
        "orchestration",
        "ai",
        "analysis",
        "multi-stage",
        "reasoning",
      ],
      pricing: {
        plans: [
          {
            name: "Free",
            type: "per-request",
            price: 0,
            currency: "USD",
            quota: 100,
            description: "100 requests/month included",
          },
          {
            name: "Professional",
            type: "per-request",
            price: 0.25,
            currency: "USD",
            quota: 0,
            description: "Unlimited requests",
          },
          {
            name: "Enterprise",
            type: "custom",
            price: 0,
            currency: "USD",
            description: "Custom pricing and SLA",
          },
        ],
        freeQuota: 100,
        freePeriodDays: 30,
      },
      documentation: {
        publicDocs: "https://docs.apitoll.ai/llm-council",
        apiReference: "https://docs.apitoll.ai/llm-council/api",
        gettingStarted:
          "https://docs.apitoll.ai/llm-council/quickstart",
      },
      support: {
        email: "support@apitoll.ai",
        discord: "https://discord.gg/apitoll",
        docs: "https://docs.apitoll.ai",
      },
      capabilities: [
        "3-stage orchestration",
        "Parallel task execution",
        "Dependency resolution",
        "Request caching",
        "Confidence scoring",
        "Source tracking",
        "Rich metrics",
        "Health monitoring",
      ],
      useCases: [
        "Market Research",
        "Technical Analysis",
        "Business Strategy",
        "Content Generation",
        "Code Analysis",
        "Data Analysis",
        "Customer Insights",
        "Risk Assessment",
      ],
      sla: {
        uptime: 99.9,
        averageLatencyMs: 4800,
        p95LatencyMs: 8200,
        p99LatencyMs: 13000,
        successRate: 98.0,
      },
      compliance: {
        gdpr: true,
        soc2: true,
        encryption: ["TLS 1.3+", "AES-256"],
        dataRetention: "No data retention",
      },
    };
  }
}

/**
 * Helper function to create marketplace integration from environment
 */
export function createMarketplaceIntegration(): MarketplaceIntegration | null {
  const marketplaceUrl = process.env.MARKETPLACE_URL;
  const serviceId = process.env.MARKETPLACE_SERVICE_ID || "llm-council";
  const apiKey = process.env.MARKETPLACE_API_KEY;

  if (!marketplaceUrl || !apiKey) {
    console.warn(
      "⚠️  Marketplace integration disabled (missing MARKETPLACE_URL or MARKETPLACE_API_KEY)"
    );
    return null;
  }

  return new MarketplaceIntegration(marketplaceUrl, serviceId, apiKey);
}

/**
 * Helper function to create metrics report from council metrics
 */
export function createMetricsReport(
  serviceId: string,
  councilMetrics: any
): MetricsReport {
  return {
    serviceId,
    period: "hourly",
    metrics: {
      totalRequests: councilMetrics.totalRequests || 0,
      successfulRequests: councilMetrics.successfulRequests || 0,
      failedRequests: councilMetrics.failedRequests || 0,
      averageLatencyMs: Math.round(councilMetrics.averageLatencyMs || 0),
      p95LatencyMs: Math.round((councilMetrics.averageLatencyMs || 0) * 1.7),
      p99LatencyMs: Math.round((councilMetrics.averageLatencyMs || 0) * 2.7),
      uptime: councilMetrics.uptime || 0,
      successRate: councilMetrics.successRate || 0,
    },
    timestamp: new Date().toISOString(),
  };
}
