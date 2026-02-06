# 🚀 LLM Council - Deployment Guide

Complete guide for deploying LLM Council to production.

## Table of Contents

1. [Local Development](#local-development)
2. [Docker Deployment](#docker-deployment)
3. [Cloud Platforms](#cloud-platforms)
4. [Configuration](#configuration)
5. [Monitoring](#monitoring)
6. [Security](#security)

---

## Local Development

### Prerequisites

- Node.js 20+
- npm or yarn
- API key for OpenAI or Anthropic (optional for local testing)

### Setup

```bash
# Navigate to package
cd packages/llm-council

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit environment variables
# Set LLM_PROVIDER, LLM_API_KEY, etc.
nano .env.local
```

### Environment Variables

```env
# Service
PORT=3001
NODE_ENV=development

# LLM Provider
LLM_PROVIDER=openai                    # openai | anthropic | local
LLM_API_KEY=sk-...                     # Your API key
LLM_MODEL=gpt-4                        # Model to use

# Features
ENABLE_CACHING=true
```

### Development Server

```bash
# Start with hot reload
npm run dev

# Output:
# ╔═══════════════════════════════════════════════════════════╗
# ║     🧠 LLM Council Orchestrator - Now Running            ║
# ╠═══════════════════════════════════════════════════════════╣
# ║ Port:             3001
# ║ LLM Provider:     openai
# ║ LLM Model:        gpt-4
# ║ Caching:          true
```

### Testing

```bash
# Run test suite
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

---

## Docker Deployment

### Build Docker Image

```bash
cd packages/llm-council

# Build image
docker build -t llm-council:latest .

# Or with tag for registry
docker build -t registry.example.com/llm-council:1.0.0 .
```

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source
COPY tsconfig.json .
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "dist/server.js"]
```

### Run Container

```bash
# Basic run
docker run -p 3001:3001 \
  -e LLM_PROVIDER=openai \
  -e LLM_API_KEY=sk-... \
  -e LLM_MODEL=gpt-4 \
  llm-council:latest

# With volume mount for logs
docker run -p 3001:3001 \
  -v $(pwd)/logs:/app/logs \
  -e LLM_PROVIDER=openai \
  -e LLM_API_KEY=sk-... \
  llm-council:latest

# With docker-compose
docker-compose up
```

### docker-compose.yml

```yaml
version: "3.8"

services:
  llm-council:
    build: .
    ports:
      - "3001:3001"
    environment:
      PORT: 3001
      NODE_ENV: production
      LLM_PROVIDER: openai
      LLM_API_KEY: ${LLM_API_KEY}
      LLM_MODEL: gpt-4
      ENABLE_CACHING: "true"
      MARKETPLACE_URL: ${MARKETPLACE_URL}
      MARKETPLACE_API_KEY: ${MARKETPLACE_API_KEY}
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    restart: unless-stopped
    networks:
      - apitoll

networks:
  apitoll:
    external: true
```

---

## Cloud Platforms

### AWS (Elastic Container Service)

```bash
# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

docker tag llm-council:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/llm-council:latest

docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/llm-council:latest

# ECS Task Definition
{
  "family": "llm-council",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "llm-council",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/llm-council:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "hostPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "LLM_PROVIDER",
          "value": "openai"
        }
      ],
      "secrets": [
        {
          "name": "LLM_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:llm-council-api-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/llm-council",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 10
      }
    }
  ]
}
```

### Google Cloud Run

```bash
# Push to Container Registry
docker tag llm-council gcr.io/PROJECT_ID/llm-council:latest
docker push gcr.io/PROJECT_ID/llm-council:latest

# Deploy
gcloud run deploy llm-council \
  --image gcr.io/PROJECT_ID/llm-council:latest \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --cpu 1 \
  --timeout 3600 \
  --set-env-vars LLM_PROVIDER=openai,LLM_MODEL=gpt-4 \
  --set-secrets LLM_API_KEY=llm-council-api-key:latest
```

### Heroku

```bash
# Login
heroku login

# Create app
heroku create llm-council

# Add buildpack
heroku buildpacks:add heroku/nodejs

# Set environment variables
heroku config:set LLM_PROVIDER=openai
heroku config:set LLM_API_KEY=sk-...
heroku config:set LLM_MODEL=gpt-4

# Deploy
git push heroku main

# Check logs
heroku logs --tail
```

### Render.com

Create `render.yaml`:

```yaml
services:
  - type: web
    name: llm-council
    env: node
    plan: starter
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: LLM_PROVIDER
        value: openai
      - key: LLM_MODEL
        value: gpt-4
      - key: LLM_API_KEY
        sync: false
```

Then push to git and deploy through Render dashboard.

---

## Configuration

### Production Environment Variables

```env
# Service
PORT=3001
NODE_ENV=production

# LLM Provider (Required)
LLM_PROVIDER=openai
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4

# Features
ENABLE_CACHING=true

# Marketplace Integration (Optional)
MARKETPLACE_URL=https://api.apitoll.ai
MARKETPLACE_SERVICE_ID=llm-council
MARKETPLACE_API_KEY=...

# Advanced
LLM_REQUEST_TIMEOUT=30000
DEFAULT_TEMPERATURE=0.7
DEFAULT_MAX_TOKENS=2000
```

### Secrets Management

#### Using AWS Secrets Manager

```bash
# Create secret
aws secretsmanager create-secret \
  --name llm-council-api-key \
  --secret-string sk-...

# Reference in application
const secret = await secretsClient.getSecretValue({
  SecretId: 'llm-council-api-key'
});
```

#### Using Azure Key Vault

```bash
# Create secret
az keyvault secret set \
  --vault-name llm-council-kv \
  --name LLM-API-KEY \
  --value sk-...

# Reference in application
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

credential = DefaultAzureCredential()
client = SecretClient(vault_url="https://llm-council-kv.vault.azure.com/", credential=credential)
secret = client.get_secret("LLM-API-KEY")
```

---

## Monitoring

### Application Monitoring

```bash
# Health endpoint (check every 30 seconds)
curl http://localhost:3001/health

# Expected response:
# {
#   "status": "healthy",
#   "uptime": 3600.5,
#   "requestsProcessed": 142,
#   "averageLatencyMs": 2450,
#   "lastCheck": "2024-02-06T..."
# }

# Metrics endpoint
curl http://localhost:3001/metrics

# Expected response:
# {
#   "metrics": {
#     "totalRequests": 142,
#     "successfulRequests": 140,
#     "failedRequests": 2,
#     "averageLatencyMs": 2450,
#     "successRate": 98.59
#   }
# }
```

### Prometheus Integration

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: "llm-council"
    metrics_path: "/metrics"
    static_configs:
      - targets: ["localhost:3001"]
```

### ELK Stack Integration

```javascript
// In server.ts
const winston = require("winston");
const { ElasticsearchTransport } = require("winston-elasticsearch");

const logger = winston.createLogger({
  transports: [
    new ElasticsearchTransport({
      level: "info",
      clientOpts: { node: process.env.ELASTICSEARCH_URL },
      index: "llm-council",
    }),
  ],
});

// Use logger
logger.info("Request processed", { requestId, duration });
```

### Datadog Integration

```bash
# Set environment variable
export DD_TRACE_ENABLED=true
export DD_SERVICE=llm-council
export DD_ENV=production
export DD_VERSION=1.0.0

# Start with Datadog
DD_TRACE_ENABLED=true DD_SERVICE=llm-council npm start
```

---

## Security

### HTTPS Configuration

```typescript
// Using Let's Encrypt with Express
import spdy from "spdy";
import fs from "fs";

const options = {
  key: fs.readFileSync("/etc/letsencrypt/live/example.com/privkey.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/live/example.com/fullchain.pem"),
};

spdy.createServer(options, app).listen(443);
```

### API Key Security

```typescript
// Validate API key on each request
app.use((req, res, next) => {
  const apiKey = req.header("X-Service-Key");

  if (!apiKey || apiKey !== process.env.SERVICE_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
});
```

### Rate Limiting

```typescript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/orchestrate", limiter);
```

### Input Validation

```typescript
import { z } from "zod";

const requestSchema = z.object({
  query: z.string().min(1).max(10000),
  context: z.record(z.unknown()).optional(),
});

// Validates automatically via middleware
```

### Environment Isolation

```bash
# Development
NODE_ENV=development

# Staging
NODE_ENV=staging

# Production
NODE_ENV=production
```

---

## Scaling

### Horizontal Scaling (Multiple Instances)

```yaml
# Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-council
spec:
  replicas: 3
  selector:
    matchLabels:
      app: llm-council
  template:
    metadata:
      labels:
        app: llm-council
    spec:
      containers:
        - name: llm-council
          image: llm-council:latest
          ports:
            - containerPort: 3001
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          env:
            - name: LLM_PROVIDER
              value: openai
            - name: LLM_API_KEY
              valueFrom:
                secretKeyRef:
                  name: llm-council-secrets
                  key: api-key
```

### Load Balancing

```yaml
# Kubernetes service
apiVersion: v1
kind: Service
metadata:
  name: llm-council
spec:
  type: LoadBalancer
  selector:
    app: llm-council
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3001
```

### Caching Strategy

```typescript
// Use Redis for distributed caching
import redis from "redis";

const client = redis.createClient({
  url: process.env.REDIS_URL,
});

// Check cache before processing
const cached = await client.get(`query:${hash(query)}`);
if (cached) {
  return JSON.parse(cached);
}
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
npm run build
npm start

# If build fails, check TypeScript errors
npm run type-check
```

### High Memory Usage

```bash
# Enable caching cleanup
council.clearCache(); // Call periodically

# Monitor memory
process.memoryUsage()
```

### Slow API Calls

```bash
# Check LLM provider status
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Check network latency
curl -w "@curl-format.txt" -o /dev/null https://api.openai.com/v1/models
```

---

## Maintenance

### Backup Strategy

```bash
# Backup configuration
cp .env .env.backup

# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/
```

### Updates

```bash
# Check for dependency updates
npm outdated

# Update dependencies
npm update

# Update to latest majors
npm install --save-latest

# Test after update
npm test
```

### Health Monitoring Schedule

- ✅ Real-time: Health endpoint checks (every 30s)
- ✅ Hourly: Metrics aggregation
- ✅ Daily: Log analysis and alerts
- ✅ Weekly: Performance review
- ✅ Monthly: Dependency updates and security patches

---

For more help, see [README.md](./README.md) or contact support@apitoll.ai
