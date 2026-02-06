import express, { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { LLMCouncil } from "./orchestrator.js";
import { RequestSchema, LLMRequest, HealthStatus } from "./types.js";
import { ZodError } from "zod";
import dotenv from "dotenv";

dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.PORT || 3001;
const LLM_PROVIDER = (process.env.LLM_PROVIDER || "openai") as
  | "openai"
  | "anthropic"
  | "local";
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4";
const ENABLE_CACHING = process.env.ENABLE_CACHING !== "false";

// Initialize orchestrator
const council = new LLMCouncil({
  llm: {
    provider: LLM_PROVIDER,
    apiKey: LLM_API_KEY,
    model: LLM_MODEL,
  },
  defaultTemperature: 0.7,
  defaultMaxTokens: 2000,
  timeout: 30000,
  enableCaching: ENABLE_CACHING,
});

// ============================================================================
// Express App Setup
// ============================================================================

const app = express();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });
  next();
});

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /orchestrate
 * Main orchestration endpoint
 */
app.post("/orchestrate", async (req: Request, res: Response) => {
  try {
    const input: LLMRequest = {
      id: uuidv4(),
      query: req.body.query,
      context: req.body.context,
      config: req.body.config,
    };

    // Validate input
    const validated = RequestSchema.parse(input);

    // Orchestrate
    const result = await council.orchestrate(validated);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }

    console.error("Orchestration error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /analyze
 * Run only the analysis stage
 */
app.post("/analyze", async (req: Request, res: Response) => {
  try {
    const input: LLMRequest = {
      id: uuidv4(),
      query: req.body.query,
      context: req.body.context,
      config: req.body.config,
    };

    const validated = RequestSchema.parse(input);

    // For demo, we orchestrate and return only the analysis stage
    const result = await council.orchestrate(validated);
    const analysisStage = result.stages.find((s) => s.stage === "analysis");

    res.json({
      success: true,
      data: analysisStage,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }

    console.error("Analysis error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get("/health", (req: Request, res: Response) => {
  const metrics = council.getMetrics();

  const health: HealthStatus = {
    status:
      metrics.successRate > 95
        ? "healthy"
        : metrics.successRate > 80
          ? "degraded"
          : "unhealthy",
    uptime: metrics.uptime,
    requestsProcessed: metrics.totalRequests,
    averageLatencyMs: Math.round(metrics.averageLatencyMs),
    lastCheck: new Date().toISOString(),
  };

  res.json(health);
});

/**
 * GET /metrics
 * Detailed metrics endpoint
 */
app.get("/metrics", (req: Request, res: Response) => {
  res.json({
    metrics: council.getMetrics(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /clear-cache
 * Clear request cache
 */
app.post("/clear-cache", (req: Request, res: Response) => {
  council.clearCache();
  res.json({
    success: true,
    message: "Cache cleared",
  });
});

/**
 * GET /
 * Service info
 */
app.get("/", (req: Request, res: Response) => {
  res.json({
    name: "LLM Council Orchestrator",
    version: "1.0.0",
    description:
      "3-stage LLM orchestration service for AgentCommerce marketplace",
    endpoints: {
      orchestrate: {
        method: "POST",
        path: "/orchestrate",
        description:
          "Full 3-stage orchestration (analyze, execute, synthesize)",
      },
      analyze: {
        method: "POST",
        path: "/analyze",
        description: "Run only the analysis stage",
      },
      health: {
        method: "GET",
        path: "/health",
        description: "Health check endpoint",
      },
      metrics: {
        method: "GET",
        path: "/metrics",
        description: "Detailed service metrics",
      },
      clearCache: {
        method: "POST",
        path: "/clear-cache",
        description: "Clear request cache",
      },
    },
    config: {
      llmProvider: LLM_PROVIDER,
      llmModel: LLM_MODEL,
      cachingEnabled: ENABLE_CACHING,
    },
  });
});

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "Not found",
    path: req.path,
  });
});

/**
 * Error handler
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ============================================================================
// Server Startup
// ============================================================================

const server = app.listen(PORT, () => {
  console.log("\n");
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║     🧠 LLM Council Orchestrator - Now Running            ║");
  console.log("╠═══════════════════════════════════════════════════════════╣");
  console.log(`║ Port:             ${String(PORT).padEnd(45)}║`);
  console.log(
    `║ LLM Provider:     ${LLM_PROVIDER.padEnd(45)}║`
  );
  console.log(
    `║ LLM Model:        ${LLM_MODEL.padEnd(45)}║`
  );
  console.log(
    `║ Caching:          ${String(ENABLE_CACHING).padEnd(45)}║`
  );
  console.log("╠═══════════════════════════════════════════════════════════╣");
  console.log("║ Available Endpoints:                                       ║");
  console.log("║  POST   /orchestrate     - Full 3-stage orchestration     ║");
  console.log("║  POST   /analyze         - Analysis stage only            ║");
  console.log("║  GET    /health          - Health check                   ║");
  console.log("║  GET    /metrics         - Detailed metrics               ║");
  console.log("║  POST   /clear-cache     - Clear request cache            ║");
  console.log("╠═══════════════════════════════════════════════════════════╣");
  console.log(
    `║ API Docs:  http://localhost:${PORT}                          ║`
  );
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export { app, council };
