# 📚 LLM Council Examples

Complete examples of how to use the LLM Council Orchestrator.

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Market Research](#market-research)
3. [Technical Analysis](#technical-analysis)
4. [Business Strategy](#business-strategy)
5. [Content Generation](#content-generation)
6. [Integration with AgentCommerce](#integration-with-agentcommerce)

---

## Basic Usage

### cURL

```bash
curl -X POST http://localhost:3001/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the benefits and challenges of remote work?"
  }'
```

### JavaScript/Node.js

```typescript
import axios from "axios";

const response = await axios.post("http://localhost:3001/orchestrate", {
  query: "What are the benefits and challenges of remote work?",
});

console.log("Final Answer:", response.data.data.final.answer);
console.log("Confidence:", response.data.data.final.confidence);
console.log("Total Duration:", response.data.data.metadata.totalDurationMs, "ms");
```

### TypeScript with SDK

```typescript
import { LLMCouncil } from "@agentcommerce/llm-council";

const council = new LLMCouncil({
  llm: {
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4",
  },
  enableCaching: true,
  defaultTemperature: 0.7,
  defaultMaxTokens: 2000,
  timeout: 30000,
});

const response = await council.orchestrate({
  query: "What are the benefits and challenges of remote work?",
});

console.log(response.final);
```

---

## Market Research

### Example 1: Market Opportunity Analysis

```bash
curl -X POST http://localhost:3001/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the untapped market opportunities in the AI infrastructure space for 2024-2025?",
    "context": {
      "focus": "enterprise-ready solutions",
      "geography": "North America and Europe",
      "budget_range": "$10M-$100M",
      "timeline": "18-24 months"
    },
    "config": {
      "model": "gpt-4",
      "temperature": 0.8,
      "maxTokens": 3000
    }
  }'
```

**Expected Analysis Subtasks:**
1. Market size and growth analysis
2. Competitive landscape assessment
3. Technology trend analysis
4. Customer pain point identification
5. Regulatory and compliance landscape
6. Venture capital activity analysis
7. Synthesis of opportunity spaces

### Example 2: Competitive Analysis

```typescript
const response = await council.orchestrate({
  query:
    "Compare the market positioning, product capabilities, pricing strategies, and go-to-market approaches of Figma, Adobe XD, and Penpot.",
  context: {
    industry: "Design Tools",
    perspective: "CTO evaluating for enterprise adoption",
    evaluation_criteria: [
      "scalability",
      "team collaboration",
      "API capabilities",
      "pricing transparency",
    ],
  },
});

const { answer, confidence, sources } = response.final;
console.log(`Assessment (${(confidence * 100).toFixed(1)}% confident):`);
console.log(answer);
console.log("\nBased on analysis of:", sources);
```

---

## Technical Analysis

### Example 1: Architecture Decision Analysis

```bash
curl -X POST http://localhost:3001/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Should we migrate our monolithic Node.js application to microservices with Kubernetes?",
    "context": {
      "current_scale": "1M+ daily active users",
      "current_infrastructure": "single Node.js app on 10 instances",
      "pain_points": ["slow deployments", "scaling bottlenecks", "team coordination"],
      "constraints": ["6-month timeline", "$500K budget", "zero downtime requirement"],
      "team_expertise": ["JavaScript", "AWS", "Docker"]
    }
  }'
```

### Example 2: Technology Stack Evaluation

```typescript
import { LLMCouncil } from "@agentcommerce/llm-council";

const council = new LLMCouncil({
  llm: { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY },
  enableCaching: true,
});

const evaluation = await council.orchestrate({
  query:
    "Evaluate React, Vue, and Svelte for a new greenfield SPA project. Which should we choose?",
  context: {
    project_type: "Real-time collaborative tool",
    team_size: 5,
    team_expertise: ["React (2 developers)", "JavaScript (all)"],
    priorities: ["developer productivity", "bundle size", "performance"],
    constraints: ["no monorepos", "must use existing UI library"],
  },
});

console.log("Recommendation:", evaluation.final.answer);
console.log(
  `Confidence: ${(evaluation.final.confidence * 100).toFixed(1)}%`
);
console.log("Sources:", evaluation.final.sources);

// See detailed analysis
evaluation.stages.forEach((stage) => {
  console.log(
    `${stage.stage}: ${stage.durationMs}ms - ${stage.status}`
  );
});
```

---

## Business Strategy

### Example 1: Product Strategy

```bash
curl -X POST http://localhost:3001/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What should be our product roadmap for the next 12 months?",
    "context": {
      "company": "B2B SaaS startup",
      "current_product": "Project management tool for remote teams",
      "revenue": "$2M ARR",
      "team_size": 20,
      "funding_status": "Series B, $15M raised",
      "market_position": "Growing #5 player in market",
      "core_strengths": ["mobile experience", "API integrations", "customer support"],
      "constraints": ["limited engineering capacity", "must achieve profitability in 18 months"]
    }
  }'
```

### Example 2: Pricing Strategy

```typescript
const pricing = await council.orchestrate({
  query:
    "Design a pricing strategy that balances growth, profitability, and market competitiveness",
  context: {
    product: "Enterprise data analytics platform",
    current_pricing: "seat-based @ $50/user/month",
    current_revenue: "$10M ARR",
    customers: ["500 enterprise customers", "5000 SMB customers"],
    customer_feedback: [
      "pricing too complex",
      "worried about user growth costs",
      "want volume discounts",
    ],
    market: {
      competitors: ["Tableau", "Power BI", "Looker"],
      typical_pricing: ["per-user", "per-computation", "usage-based"],
    },
    goals: [
      "increase revenue 50% YoY",
      "improve net retention 120%+",
      "reduce churn 5%",
    ],
  },
});

console.log("Recommended Strategy:");
console.log(pricing.final.answer);
```

---

## Content Generation

### Example 1: Comprehensive Blog Post Research

```bash
curl -X POST http://localhost:3001/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Research and outline a comprehensive guide to implementing OAuth 2.0 in Node.js applications. Include security best practices, common pitfalls, and real-world examples.",
    "context": {
      "target_audience": "intermediate JavaScript developers",
      "blog_length": "3000 words",
      "include_code_examples": true,
      "target_publication": "technical blog",
      "seo_keywords": ["OAuth 2.0", "Node.js security", "API authentication"]
    }
  }'
```

### Example 2: Whitepaper Structure

```typescript
const whitepaper = await council.orchestrate({
  query:
    "Design the structure and key sections for a whitepaper on 'The Future of AI in Enterprise Software'",
  context: {
    publisher: "B2B SaaS company",
    target_reader: "C-suite executives and technical leaders",
    length: "15-20 pages",
    sections: [
      "executive summary",
      "current state analysis",
      "future trends",
      "strategic implications",
      "recommendations",
    ],
  },
});

console.log("Whitepaper Structure:", whitepaper.final.answer);
console.log("\nResearch Tasks Executed:");
whitepaper.stages.forEach((stage) => {
  if (stage.stage === "execution") {
    const tasks = (stage.result as any).tasks;
    tasks.forEach((task: any) => {
      console.log(`- ${task.title}: ${task.status}`);
    });
  }
});
```

---

## Integration with AgentCommerce

### Example 1: Using LLM Council as a Service

```typescript
// In your AgentCommerce agent
import axios from "axios";

async function analyzeFeedback(userFeedback: string[]) {
  const response = await axios.post(
    "https://api.agentcommerce.dev/llm-council/orchestrate",
    {
      query: `Analyze the following customer feedback and identify key themes, sentiment, and actionable insights: ${userFeedback.join("; ")}`,
      context: {
        product: "SaaS platform",
        feedback_type: "customer support tickets",
      },
      config: {
        model: "gpt-4",
        temperature: 0.5, // Lower temperature for consistency
      },
    },
    {
      headers: {
        "X-Service-Key": process.env.AGENTCOMMERCE_SERVICE_KEY,
      },
    }
  );

  return response.data.data.final;
}
```

### Example 2: Chained Analysis

```typescript
// Use LLM Council output as input to another service

async function researchAndPlan(businessGoal: string) {
  // Step 1: Research the opportunity
  const research = await orchestrator.orchestrate({
    query: `Research the market opportunity for: ${businessGoal}`,
  });

  // Step 2: Use research as context for strategy
  const strategy = await orchestrator.orchestrate({
    query: `Develop a go-to-market strategy based on this research: ${research.final.answer}`,
    context: {
      company_stage: "Series B",
      resources: "$2M budget",
      timeline: "12 months",
      research_confidence: research.final.confidence,
    },
  });

  return {
    research: research.final,
    strategy: strategy.final,
  };
}
```

---

## Advanced Configuration Examples

### Example 1: Custom Temperature & Tokens

```typescript
// For creative/brainstorming: Higher temperature
const brainstorm = await council.orchestrate({
  query: "Generate 10 innovative product ideas for the healthcare space",
  config: {
    model: "gpt-4",
    temperature: 1.2, // Higher = more creative
    maxTokens: 3000,
  },
});

// For technical analysis: Lower temperature
const analysis = await council.orchestrate({
  query: "Analyze these database query performance metrics and recommend optimizations",
  config: {
    model: "gpt-4",
    temperature: 0.3, // Lower = more consistent
    maxTokens: 2000,
  },
});

// For complex reasoning: Balanced
const strategy = await council.orchestrate({
  query: "Develop a 5-year technical roadmap",
  config: {
    model: "gpt-4",
    temperature: 0.7, // Balanced
    maxTokens: 3000,
  },
});
```

### Example 2: With Rich Context

```typescript
const analysis = await council.orchestrate({
  query: "What are our top 3 product priorities?",
  context: {
    company: {
      name: "TechCorp",
      stage: "Series B",
      employees: 50,
      revenue: "$3M ARR",
    },
    market: {
      tam: "$10B",
      competitors: ["CompA", "CompB", "CompC"],
      growth_rate: "40% YoY",
    },
    customers: {
      count: 200,
      nps: 42,
      churn_rate: 0.05,
      top_complaints: [
        "slow performance",
        "missing integrations",
        "poor mobile experience",
      ],
    },
    team: {
      engineering: 12,
      product: 2,
      sales: 8,
      capacity_constraint: true,
    },
    goals: {
      revenue_target: "$5M ARR",
      growth_rate: "67%",
      nps_target: 50,
      profitability_timeline: "24 months",
    },
  },
});
```

### Example 3: Monitoring & Health Checks

```typescript
// Check service health
const health = await axios.get("http://localhost:3001/health");
console.log(health.data);
// Output: { status: "healthy", uptime: 7200.5, requestsProcessed: 142, ... }

// Get detailed metrics
const metrics = await axios.get("http://localhost:3001/metrics");
console.log("Success Rate:", metrics.data.metrics.successRate, "%");
console.log("Average Latency:", metrics.data.metrics.averageLatencyMs, "ms");

// Clear cache if needed
await axios.post("http://localhost:3001/clear-cache");
```

---

## Best Practices

1. **Use Context Wisely**: More relevant context = better results
2. **Adjust Temperature**: Higher for creative tasks, lower for analytical ones
3. **Monitor Latency**: Plan for 4-13 second response times
4. **Handle Caching**: Leverage caching for repeated queries
5. **Batch Analysis**: Group related queries to reduce API calls
6. **Check Health**: Monitor service health before important operations
7. **Log Confidence**: Track confidence scores to identify uncertain results

---

## Troubleshooting

### Slow Responses

```typescript
// Check what's taking time
const response = await council.orchestrate(request);
response.stages.forEach((stage) => {
  console.log(`${stage.stage}: ${stage.durationMs}ms`);
});

// Typically: Synthesis is slowest (1-2s), Execution varies based on complexity
```

### Low Confidence

```typescript
const response = await council.orchestrate(request);

if (response.final.confidence < 0.7) {
  console.warn("Low confidence result, consider:");
  console.log("1. Providing more context");
  console.log("2. Reducing temperature for more focus");
  console.log("3. Rephrasing the query more clearly");
}
```

### Memory Issues

```typescript
// Clear cache periodically
setInterval(() => {
  council.clearCache();
  console.log("Cache cleared");
}, 3600000); // Every hour
```

---

## More Examples

For additional examples and use cases, see:
- 📖 [Full Documentation](https://docs.agentcommerce.dev/llm-council)
- 🧪 [Test Suite](./src/orchestrator.test.ts)
- 📊 [Sample Datasets](./examples/)
