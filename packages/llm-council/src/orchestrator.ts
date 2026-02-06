import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import {
  LLMRequest,
  LLMResponse,
  AnalysisResult,
  ExecutionResult,
  SynthesisResult,
  OrchestratorConfig,
  RequestSchema,
} from "./types.js";

/**
 * LLM Council Orchestrator
 *
 * Implements 3-stage orchestration:
 * 1. Analysis: Break down the request into subtasks
 * 2. Execution: Execute subtasks in parallel or sequence
 * 3. Synthesis: Combine results into a coherent final answer
 */
export class LLMCouncil {
  private config: OrchestratorConfig;
  private requestCache: Map<string, LLMResponse> = new Map();
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalDurationMs: 0,
    startTime: Date.now(),
  };

  constructor(config: OrchestratorConfig) {
    this.config = config;
  }

  /**
   * Main orchestration entry point
   */
  async orchestrate(input: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const requestId = input.id || uuidv4();

    try {
      // Validate input
      const validatedInput = RequestSchema.parse(input);

      // Check cache
      if (this.config.enableCaching) {
        const cached = this.requestCache.get(validatedInput.query);
        if (cached) {
          return cached;
        }
      }

      const stages = [];

      // ====================================================================
      // STAGE 1: ANALYSIS
      // ====================================================================
      const analysisStart = Date.now();
      const analysisResult = await this.analyze(validatedInput);
      const analysisDuration = Date.now() - analysisStart;

      stages.push({
        stage: "analysis" as const,
        status: "completed" as const,
        result: analysisResult,
        durationMs: analysisDuration,
        timestamp: new Date(analysisStart).toISOString(),
      });

      // ====================================================================
      // STAGE 2: EXECUTION
      // ====================================================================
      const executionStart = Date.now();
      const executionResult = await this.execute(
        analysisResult,
        validatedInput
      );
      const executionDuration = Date.now() - executionStart;

      stages.push({
        stage: "execution" as const,
        status: "completed" as const,
        result: executionResult,
        durationMs: executionDuration,
        timestamp: new Date(executionStart).toISOString(),
      });

      // ====================================================================
      // STAGE 3: SYNTHESIS
      // ====================================================================
      const synthesisStart = Date.now();
      const synthesisResult = await this.synthesize(
        executionResult,
        validatedInput
      );
      const synthesisDuration = Date.now() - synthesisStart;

      stages.push({
        stage: "synthesis" as const,
        status: "completed" as const,
        result: synthesisResult,
        durationMs: synthesisDuration,
        timestamp: new Date(synthesisStart).toISOString(),
      });

      // ====================================================================
      // BUILD RESPONSE
      // ====================================================================
      const totalDuration = Date.now() - startTime;

      const response: LLMResponse = {
        id: requestId,
        query: validatedInput.query,
        stages,
        final: {
          answer: synthesisResult.answer,
          confidence: synthesisResult.confidence,
          sources: synthesisResult.sources,
        },
        metadata: {
          totalDurationMs: totalDuration,
          requestedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          model: this.config.llm.model,
        },
      };

      // Cache the response
      if (this.config.enableCaching) {
        this.requestCache.set(validatedInput.query, response);
      }

      // Update metrics
      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalDurationMs += totalDuration;

      return response;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;

      throw new Error(
        `Orchestration failed for request ${requestId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * STAGE 1: ANALYSIS
   * Decompose the request into logical subtasks
   */
  private async analyze(request: LLMRequest): Promise<AnalysisResult> {
    const analysisPrompt = `
You are an expert at breaking down complex queries into manageable subtasks.

Query: ${request.query}

${request.context ? `Context:\n${JSON.stringify(request.context, null, 2)}` : ""}

Please analyze this query and break it down into logical subtasks. For each subtask, provide:
1. A unique ID (e.g., task_1, task_2)
2. A clear title
3. A detailed description
4. Any dependencies (which other tasks must complete first)
5. Your reasoning for this decomposition

Response format (JSON):
{
  "subtasks": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "dependencies": ["string[]"],
      "reasoning": "string"
    }
  ],
  "strategy": "parallel|sequential|hybrid",
  "estimatedSteps": number
}

Respond with ONLY the JSON object, no additional text.
    `;

    const result = await this.callLLM(analysisPrompt, request.config);

    // Parse and validate the LLM response
    const parsed = JSON.parse(result);

    return {
      subtasks: parsed.subtasks || [],
      strategy: parsed.strategy || "hybrid",
      estimatedSteps: parsed.estimatedSteps || parsed.subtasks?.length || 1,
    };
  }

  /**
   * STAGE 2: EXECUTION
   * Execute the subtasks in parallel or sequential order
   */
  private async execute(
    analysis: AnalysisResult,
    request: LLMRequest
  ): Promise<ExecutionResult> {
    const tasks = analysis.subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      description: subtask.description,
      dependencies: subtask.dependencies,
      reasoning: subtask.reasoning,
      status: "pending" as const,
      result: undefined,
      error: undefined,
    }));

    let parallelCount = 0;
    let sequentialCount = 0;

    // Execute tasks based on strategy
    if (analysis.strategy === "parallel") {
      // Execute all tasks in parallel
      parallelCount = tasks.length;
      await Promise.allSettled(
        tasks.map((task) => this.executeTask(task, request))
      );
    } else if (analysis.strategy === "sequential") {
      // Execute tasks one by one
      sequentialCount = tasks.length;
      for (const task of tasks) {
        await this.executeTask(task, request);
      }
    } else {
      // Hybrid: Execute independent tasks in parallel, dependent ones sequentially
      const taskMap = new Map(tasks.map((t) => [t.id, t]));
      const completed = new Set<string>();

      for (const task of tasks) {
        if (task.dependencies.every((dep) => completed.has(dep))) {
          // Can execute in parallel with other independent tasks
          await this.executeTask(task, request);
          completed.add(task.id);
          parallelCount++;
        }
      }
    }

    return {
      tasks,
      parallelExecutions: parallelCount,
      sequentialSteps: sequentialCount,
      successCount: tasks.filter((t) => t.status === "completed").length,
      failureCount: tasks.filter((t) => t.status === "failed").length,
    };
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    task: any,
    request: LLMRequest
  ): Promise<void> {
    try {
      task.status = "running";

      const executionPrompt = `
You are executing a subtask in a larger query resolution process.

Main Query: ${request.query}
Subtask: ${task.title}
Subtask Description: ${task.description}

${task.reasoning ? `Reasoning:\n${task.reasoning}` : ""}

${request.context ? `Context:\n${JSON.stringify(request.context, null, 2)}` : ""}

Please execute this subtask and provide a detailed result. Be thorough and clear.
      `;

      const result = await this.callLLM(executionPrompt, request.config);
      task.result = { content: result };
      task.status = "completed";
    } catch (error) {
      task.status = "failed";
      task.error = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * STAGE 3: SYNTHESIS
   * Combine execution results into a final, coherent answer
   */
  private async synthesize(
    execution: ExecutionResult,
    request: LLMRequest
  ): Promise<SynthesisResult> {
    const taskSummaries = execution.tasks
      .map((task) => {
        return `Task: ${task.title}\nResult: ${task.result ? JSON.stringify(task.result) : "No result"}`;
      })
      .join("\n\n");

    const synthesisPrompt = `
You are synthesizing results from multiple execution tasks into a final answer.

Original Query: ${request.query}

Task Results:
${taskSummaries}

Please synthesize these results into a comprehensive, coherent final answer to the original query.

Response format (JSON):
{
  "answer": "string (the final synthesized answer)",
  "confidence": number (0-1, how confident you are in this answer),
  "reasoning": "string (explain how you synthesized the results)",
  "sources": ["array of sources or task IDs used"],
  "alternativeAnswers": ["optional array of alternative interpretations"]
}

Respond with ONLY the JSON object, no additional text.
    `;

    const result = await this.callLLM(synthesisPrompt, request.config);
    const parsed = JSON.parse(result);

    return {
      answer: parsed.answer || "Unable to synthesize answer",
      confidence: Math.min(
        1,
        Math.max(0, typeof parsed.confidence === "number" ? parsed.confidence : 0.5)
      ),
      reasoning: parsed.reasoning || "",
      sources: parsed.sources || [],
      alternativeAnswers: parsed.alternativeAnswers,
    };
  }

  /**
   * Call the LLM provider
   */
  private async callLLM(
    prompt: string,
    config?: LLMRequest["config"]
  ): Promise<string> {
    const llmConfig = this.config.llm;
    const temperature = config?.temperature ?? this.config.defaultTemperature;
    const maxTokens = config?.maxTokens ?? this.config.defaultMaxTokens;

    if (llmConfig.provider === "openai") {
      return this.callOpenAI(prompt, llmConfig.model, temperature, maxTokens);
    } else if (llmConfig.provider === "anthropic") {
      return this.callAnthropic(
        prompt,
        llmConfig.model,
        temperature,
        maxTokens
      );
    } else {
      // Fallback for local/mock
      return this.mockLLMResponse(prompt);
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    prompt: string,
    model: string,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    if (!this.config.llm.apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model,
        messages: [{ role: "user", content: prompt }],
        temperature,
        max_tokens: maxTokens,
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.llm.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: this.config.timeout,
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(
    prompt: string,
    model: string,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    if (!this.config.llm.apiKey) {
      throw new Error("Anthropic API key not configured");
    }

    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
        temperature,
      },
      {
        headers: {
          "x-api-key": this.config.llm.apiKey,
          "Content-Type": "application/json",
        },
        timeout: this.config.timeout,
      }
    );

    return response.data.content[0].text;
  }

  /**
   * Mock LLM response for development/testing
   */
  private mockLLMResponse(prompt: string): string {
    // Simple echo + analysis for demo purposes
    if (prompt.includes("analyze")) {
      return JSON.stringify({
        subtasks: [
          {
            id: "task_1",
            title: "Information Gathering",
            description: "Gather relevant information",
            dependencies: [],
            reasoning: "Foundation for analysis",
          },
          {
            id: "task_2",
            title: "Pattern Recognition",
            description: "Identify patterns in the data",
            dependencies: ["task_1"],
            reasoning: "Build on gathered information",
          },
        ],
        strategy: "sequential",
        estimatedSteps: 2,
      });
    } else if (prompt.includes("synthesize")) {
      return JSON.stringify({
        answer: "Based on the analysis, the key findings are...",
        confidence: 0.85,
        reasoning: "Synthesis of all task results",
        sources: ["task_1", "task_2"],
      });
    } else {
      return "Mock execution result for development";
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    const uptimeSeconds = (Date.now() - this.metrics.startTime) / 1000;
    return {
      ...this.metrics,
      uptime: uptimeSeconds,
      averageLatencyMs:
        this.metrics.totalRequests > 0
          ? this.metrics.totalDurationMs / this.metrics.totalRequests
          : 0,
      successRate:
        this.metrics.totalRequests > 0
          ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
          : 0,
    };
  }

  /**
   * Clear cache (useful for memory management)
   */
  clearCache(): void {
    this.requestCache.clear();
  }
}
