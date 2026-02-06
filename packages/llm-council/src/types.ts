import { z } from "zod";

/**
 * 3-Stage LLM Council Orchestration
 *
 * Stage 1: Analysis - Decompose request into subtasks
 * Stage 2: Execution - Execute subtasks in parallel or sequence
 * Stage 3: Synthesis - Combine results into final response
 */

// ============================================================================
// Request/Response Types
// ============================================================================

export const StageTypeSchema = z.enum(["analysis", "execution", "synthesis"]);
export type StageType = z.infer<typeof StageTypeSchema>;

export const RequestSchema = z.object({
  id: z.string().uuid().optional(),
  query: z.string().min(1).max(10000),
  context: z.record(z.unknown()).optional(),
  config: z
    .object({
      model: z.string().default("gpt-4"),
      temperature: z.number().min(0).max(2).default(0.7),
      maxTokens: z.number().min(100).max(4000).default(2000),
      timeout: z.number().positive().default(30000),
    })
    .optional(),
});

export type LLMRequest = z.infer<typeof RequestSchema>;

export const ResponseSchema = z.object({
  id: z.string().uuid(),
  query: z.string(),
  stages: z.array(
    z.object({
      stage: StageTypeSchema,
      status: z.enum(["pending", "running", "completed", "failed"]),
      result: z.unknown(),
      error: z.string().optional(),
      durationMs: z.number(),
      timestamp: z.string().datetime(),
    })
  ),
  final: z.object({
    answer: z.string(),
    confidence: z.number().min(0).max(1),
    sources: z.array(z.string()).optional(),
  }),
  metadata: z.object({
    totalDurationMs: z.number(),
    requestedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    model: z.string(),
  }),
});

export type LLMResponse = z.infer<typeof ResponseSchema>;

// ============================================================================
// Stage-Specific Types
// ============================================================================

export const AnalysisResultSchema = z.object({
  subtasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      dependencies: z.array(z.string()).default([]),
      reasoning: z.string(),
    })
  ),
  strategy: z.enum(["parallel", "sequential", "hybrid"]),
  estimatedSteps: z.number(),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const ExecutionTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  dependencies: z.array(z.string()).default([]),
  reasoning: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

export type ExecutionTask = z.infer<typeof ExecutionTaskSchema>;

export const ExecutionResultSchema = z.object({
  tasks: z.array(ExecutionTaskSchema),
  parallelExecutions: z.number(),
  sequentialSteps: z.number(),
  successCount: z.number(),
  failureCount: z.number(),
});

export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;

export const SynthesisResultSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  sources: z.array(z.string()).optional(),
  alternativeAnswers: z.array(z.string()).optional(),
});

export type SynthesisResult = z.infer<typeof SynthesisResultSchema>;

// ============================================================================
// Configuration & Service Types
// ============================================================================

export interface LLMProviderConfig {
  provider: "openai" | "anthropic" | "local";
  apiKey?: string;
  model: string;
  baseUrl?: string;
}

export interface OrchestratorConfig {
  llm: LLMProviderConfig;
  defaultTemperature: number;
  defaultMaxTokens: number;
  timeout: number;
  enableCaching: boolean;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  requestsProcessed: number;
  averageLatencyMs: number;
  lastCheck: string;
}
