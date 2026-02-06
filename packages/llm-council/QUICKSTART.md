# ⚡ LLM Council - Quick Start Guide

Get up and running in 5 minutes.

## 1. Installation (1 min)

```bash
cd packages/llm-council
npm install
```

## 2. Configuration (1 min)

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
LLM_PROVIDER=openai
LLM_API_KEY=sk-your-key-here
LLM_MODEL=gpt-4
```

## 3. Start Server (1 min)

```bash
npm run dev
```

You'll see:
```
╔═══════════════════════════════════════════════════════════╗
║     🧠 LLM Council Orchestrator - Now Running            ║
╠═══════════════════════════════════════════════════════════╣
║ Port:             3001
║ LLM Provider:     openai
║ LLM Model:        gpt-4
║ Caching:          true
╚═══════════════════════════════════════════════════════════╝
```

## 4. Make Your First Request (1 min)

```bash
curl -X POST http://localhost:3001/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the key factors for SaaS success?"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "query": "What are the key factors for SaaS success?",
    "stages": [ ... ],
    "final": {
      "answer": "The key factors for SaaS success are...",
      "confidence": 0.92,
      "sources": [ ... ]
    },
    "metadata": {
      "totalDurationMs": 4800,
      "model": "gpt-4"
    }
  }
}
```

## 5. Check Health (1 min)

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "uptime": 123.5,
  "requestsProcessed": 5,
  "averageLatencyMs": 4800,
  "lastCheck": "2024-02-06T..."
}
```

---

## Common Patterns

### With Context

```bash
curl -X POST http://localhost:3001/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What should be our product roadmap?",
    "context": {
      "company": "Series B SaaS",
      "industry": "DevTools",
      "revenue": "$3M ARR"
    }
  }'
```

### Custom LLM Settings

```bash
curl -X POST http://localhost:3001/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Generate creative product ideas",
    "config": {
      "model": "gpt-4",
      "temperature": 1.0,
      "maxTokens": 3000
    }
  }'
```

### Analysis Only

```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Analyze this market opportunity"
  }'
```

---

## Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/orchestrate` | POST | Full 3-stage orchestration |
| `/analyze` | POST | Analysis stage only |
| `/health` | GET | Health status |
| `/metrics` | GET | Performance metrics |
| `/clear-cache` | POST | Clear cache |

---

## Using as SDK

```typescript
import { LLMCouncil } from '@agentcommerce/llm-council';

const council = new LLMCouncil({
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4'
  },
  enableCaching: true
});

const response = await council.orchestrate({
  query: 'Analyze this opportunity',
  context: { industry: 'AI' }
});

console.log(response.final.answer);
console.log(`Confidence: ${response.final.confidence}`);
```

---

## Troubleshooting

**Port Already in Use?**
```bash
npm run dev -- --port 3002
```

**Missing API Key?**
```bash
export OPENAI_API_KEY=sk-your-key
npm run dev
```

**TypeScript Errors?**
```bash
npm run type-check
npm run build
```

---

## Next Steps

- 📖 Read [README.md](./README.md) for full API reference
- 📚 See [EXAMPLES.md](./EXAMPLES.md) for real-world use cases
- 🚀 Check [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup
- 🏪 View [MARKETPLACE.md](./MARKETPLACE.md) for marketplace details

---

## LLM Models

### OpenAI
- `gpt-4` (most capable, slower)
- `gpt-4-turbo` (balanced)
- `gpt-3.5-turbo` (fast, good for simple tasks)

### Anthropic
- `claude-3-opus` (most capable)
- `claude-3-sonnet` (balanced)
- `claude-3-haiku` (fast)

### Configuration
```bash
# Change model in .env
LLM_MODEL=gpt-4-turbo
```

---

## Performance Tips

1. **Enable Caching** - ~65% hit rate on repeated queries
```env
ENABLE_CACHING=true
```

2. **Lower Temperature** for consistency
```json
{ "config": { "temperature": 0.5 } }
```

3. **Reduce Max Tokens** if speed is critical
```json
{ "config": { "maxTokens": 1000 } }
```

4. **Use Parallel Tasks** - System automatically optimizes execution

---

## Monitoring

**Real-time Health**
```bash
watch curl -s http://localhost:3001/health | jq
```

**Metrics**
```bash
curl http://localhost:3001/metrics | jq '.metrics.successRate'
```

---

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS (TLS 1.3+)
- [ ] Add API key authentication
- [ ] Enable request rate limiting
- [ ] Set up monitoring/alerts
- [ ] Configure backup/recovery
- [ ] Document runbooks

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full guide.

---

## Support

- 📧 Email: support@agentcommerce.dev
- 💬 Discord: https://discord.gg/agentcommerce
- 📖 Docs: https://docs.agentcommerce.dev/llm-council

---

**Status:** ✅ Ready to use!

Start with: `npm run dev` in this directory.
