# Apitoll Deployment Guide

## Quick Start (Railway - Recommended)

Railway is the fastest path to production. Takes **5-10 minutes**.

### 1. Connect Repository
```bash
# Push to GitHub (if not already)
git remote add origin https://github.com/YOUR_ORG/apitoll
git push -u origin main
```

### 2. Create Railway Project
- Go to [railway.app](https://railway.app)
- Click "New Project" → "Deploy from GitHub"
- Select your apitoll repository
- Railway auto-detects Procfile and railway.json

### 3. Set Environment Variables
In Railway dashboard, add:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
EXECUTOR_PRIVATE_KEY=0x...
ALLOWED_ORIGINS=https://YOUR_DOMAIN.com
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
REDIS_HOST=your-redis.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=... (if needed)
```

### 4. Deploy
- Click "Deploy"
- Monitor build logs (takes 2-3 min)
- Railway gives you a public URL

### 5. Configure Stripe Webhooks
In Stripe Dashboard:
- Go to Developers → Webhooks
- Add endpoint: `https://YOUR_RAILWAY_URL/webhook/stripe`
- Subscribe to events:
  - `payment_intent.succeeded`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

✅ **Done!** Your indexer is live.

---

## Alternative: Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy (first time creates fly.toml)
fly launch

# Set secrets
fly secrets set STRIPE_SECRET_KEY=sk_live_...
fly secrets set EXECUTOR_PRIVATE_KEY=0x...
# ... (repeat for all env vars)

# Deploy
fly deploy
```

---

## Alternative: Render

```bash
# Create render.yaml in repo root (we've provided it)
# Push to GitHub
# Go to render.com → New+ → Web Service
# Connect GitHub repo → select apitoll
# Render auto-detects render.yaml
# Set environment variables in dashboard
# Click "Create Web Service"
```

---

## Post-Deployment Checklist

- [ ] Health check responds: `curl https://YOUR_URL/health`
- [ ] Stripe webhooks configured
- [ ] Redis connected (check logs for connection success)
- [ ] EXECUTOR_PRIVATE_KEY has USDC on Base (fund wallet)
- [ ] Monitoring alerts set up (Sentry/Slack)
- [ ] Logs being captured (CloudWatch/Railway logs)

---

## Monitoring

### View Logs
**Railway:**
```bash
railway logs
```

**Fly.io:**
```bash
fly logs
```

### Health Check
```bash
curl https://YOUR_URL/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2026-02-06T20:00:00Z",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "stripe": "ok"
  }
}
```

---

## Scaling

**Railway:**
- Dashboard → Project → Settings → Replicas
- Set to 2-3 for production

**Fly.io:**
```bash
fly scale count 3
```

---

## Database Migrations

If using PostgreSQL (not Convex):

```bash
# Locally first
npm run db:migrate

# In production (Railway)
railway run npm run db:migrate
```

---

## Troubleshooting

**"Webhook not received"**
- Check Stripe webhook URL is correct
- Verify API key in env var
- Check logs for connection errors

**"USDC transfer failing"**
- Verify EXECUTOR_PRIVATE_KEY is set
- Check wallet has USDC balance on Base
- Verify BASE_RPC_URL is working

**"Redis connection failed"**
- Verify REDIS_HOST and REDIS_PORT
- Check Redis credentials
- Test connection: `redis-cli -h HOST -p PORT`

---

## Cost Estimate

- **Railway:** $5-50/month (depending on usage)
- **Fly.io:** $0-50/month (generous free tier)
- **Redis (Upstash):** $0-20/month

Total: ~$20-70/month for production indexer.
