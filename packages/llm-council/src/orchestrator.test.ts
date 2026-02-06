import { describe, it, expect, beforeEach } from "vitest";
import { LLMCouncil } from "./orchestrator";
import { LLMRequest } from "./types";

describe("LLMCouncil Orchestrator", () => {
  let council: LLMCouncil;

  beforeEach(() => {
    council = new LLMCouncil({
      llm: {
        provider: "local",
        model: "mock-model",
      },
      defaultTemperature: 0.7,
      defaultMaxTokens: 2000,
      timeout: 30000,
      enableCaching: true,
    });
  });

  describe("Orchestration", () => {
    it("should successfully orchestrate a request through all 3 stages", async () => {
      const request: LLMRequest = {
        query: "What is the best way to optimize database queries?",
      };

      const response = await council.orchestrate(request);

      // Validate response structure
      expect(response).toBeDefined();
      expect(response.id).toBeDefined();
      expect(response.query).toBe(request.query);
      expect(response.stages).toHaveLength(3);
      expect(response.final).toBeDefined();
      expect(response.metadata).toBeDefined();

      // Validate stages
      const stages = response.stages.map((s) => s.stage);
      expect(stages).toContain("analysis");
      expect(stages).toContain("execution");
      expect(stages).toContain("synthesis");

      // Validate final answer
      expect(response.final.answer).toBeTruthy();
      expect(response.final.confidence).toBeGreaterThanOrEqual(0);
      expect(response.final.confidence).toBeLessThanOrEqual(1);
    });

    it("should validate input query is required", async () => {
      const request: any = {
        query: "",
      };

      await expect(council.orchestrate(request)).rejects.toThrow();
    });

    it("should include request configuration in orchestration", async () => {
      const request: LLMRequest = {
        query: "Analyze this data",
        config: {
          temperature: 0.5,
          maxTokens: 1000,
        },
      };

      const response = await council.orchestrate(request);

      expect(response).toBeDefined();
      expect(response.final.answer).toBeTruthy();
    });

    it("should include context in orchestration", async () => {
      const request: LLMRequest = {
        query: "What is the market size?",
        context: {
          industry: "SaaS",
          region: "North America",
        },
      };

      const response = await council.orchestrate(request);

      expect(response).toBeDefined();
      expect(response.final.answer).toBeTruthy();
    });
  });

  describe("Caching", () => {
    it("should cache identical queries", async () => {
      const request: LLMRequest = {
        query: "What is 2+2?",
      };

      const response1 = await council.orchestrate(request);
      const response2 = await council.orchestrate(request);

      expect(response1.final.answer).toEqual(response2.final.answer);
    });

    it("should clear cache on demand", async () => {
      const request: LLMRequest = {
        query: "Test cache clear",
      };

      await council.orchestrate(request);
      council.clearCache();

      // After clearing, a new request should be processed (not from cache)
      const response = await council.orchestrate(request);
      expect(response).toBeDefined();
    });
  });

  describe("Metrics", () => {
    it("should track metrics correctly", async () => {
      const initialMetrics = council.getMetrics();
      expect(initialMetrics.totalRequests).toBe(0);

      const request: LLMRequest = {
        query: "Track metrics",
      };

      await council.orchestrate(request);

      const metricsAfter = council.getMetrics();
      expect(metricsAfter.totalRequests).toBe(1);
      expect(metricsAfter.successfulRequests).toBe(1);
      expect(metricsAfter.averageLatencyMs).toBeGreaterThan(0);
    });

    it("should calculate success rate", async () => {
      const request: LLMRequest = {
        query: "Test success rate",
      };

      await council.orchestrate(request);

      const metrics = council.getMetrics();
      expect(metrics.successRate).toBe(100);
    });

    it("should track uptime", async () => {
      const metrics = council.getMetrics();
      expect(metrics.uptime).toBeGreaterThan(0);
    });
  });

  describe("Analysis Stage", () => {
    it("should decompose complex queries into subtasks", async () => {
      const request: LLMRequest = {
        query: "How to build a successful startup?",
      };

      const response = await council.orchestrate(request);
      const analysisStage = response.stages.find((s) => s.stage === "analysis");

      expect(analysisStage).toBeDefined();
      expect(analysisStage?.result).toBeDefined();

      const analysisResult = analysisStage?.result as any;
      expect(analysisResult.subtasks).toBeDefined();
      expect(Array.isArray(analysisResult.subtasks)).toBe(true);

      if (analysisResult.subtasks.length > 0) {
        const task = analysisResult.subtasks[0];
        expect(task.id).toBeDefined();
        expect(task.title).toBeDefined();
        expect(task.description).toBeDefined();
      }
    });
  });

  describe("Execution Stage", () => {
    it("should execute subtasks from analysis stage", async () => {
      const request: LLMRequest = {
        query: "What are the top 3 cloud providers?",
      };

      const response = await council.orchestrate(request);
      const executionStage = response.stages.find(
        (s) => s.stage === "execution"
      );

      expect(executionStage).toBeDefined();
      expect(executionStage?.result).toBeDefined();

      const executionResult = executionStage?.result as any;
      expect(executionResult.tasks).toBeDefined();
      expect(Array.isArray(executionResult.tasks)).toBe(true);
      expect(executionResult.successCount).toBeGreaterThanOrEqual(0);
      expect(executionResult.failureCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Synthesis Stage", () => {
    it("should synthesize execution results into final answer", async () => {
      const request: LLMRequest = {
        query: "Compare Python and JavaScript",
      };

      const response = await council.orchestrate(request);
      const synthesisStage = response.stages.find(
        (s) => s.stage === "synthesis"
      );

      expect(synthesisStage).toBeDefined();
      expect(synthesisStage?.result).toBeDefined();

      const synthesisResult = synthesisStage?.result as any;
      expect(synthesisResult.answer).toBeDefined();
      expect(synthesisResult.confidence).toBeGreaterThanOrEqual(0);
      expect(synthesisResult.confidence).toBeLessThanOrEqual(1);
    });

    it("should provide confidence scores", async () => {
      const request: LLMRequest = {
        query: "Test confidence",
      };

      const response = await council.orchestrate(request);

      expect(response.final.confidence).toBeGreaterThanOrEqual(0);
      expect(response.final.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle empty queries", async () => {
      const request: any = {
        query: "",
      };

      await expect(council.orchestrate(request)).rejects.toThrow();
    });

    it("should handle very long queries", async () => {
      const request: LLMRequest = {
        query: "A".repeat(10001),
      };

      await expect(council.orchestrate(request)).rejects.toThrow();
    });
  });
});
