# API Toll Cloudflare Workers Deployment

Deploy API Toll to Cloudflare Workers + Pages in 10 minutes.

## Prerequisites

1. **Cloudflare Account** (free tier works)
2. **apitoll.com domain** (already registered on Cloudflare)
3. **GitHub repo** (TasnidChain/APITOLL - already pushed)
4. **Environment variables ready** (Stripe keys, executor wallet, etc.)

## Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
```

Verify:
```bash
wrangler --version
```

## Step 2: Authenticate with Cloudflare

```bash
wrangler login
```

Opens browser → Authorize OpenClaw → Returns auth token

## Step 3: Create Cloudflare Resources

### 3a: Create KV Namespaces

```bash
# For caching
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview

# For sessions/payments
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "SESSIONS" --preview
```

Copy the IDs → Update `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "PASTE_ID_HERE"
preview_id = "PASTE_PREVIEW_ID"
```

### 3b: Create D1 Database

```bash
wrangler d1 create apitoll
```

Copy database ID → Update `wrangler.toml`

### 3c: Create R2 Bucket

```bash
wrangler r2 bucket create apitoll-files
```

## Step 4: Update wrangler.toml

Fill in:
```toml
account_id = "YOUR_ACCOUNT_ID" # Get from Cloudflare Dashboard
```

Get account ID:
- Cloudflare Dashboard → Workers & Pages → Right sidebar → "Copy account ID"

## Step 5: Set Environment Variables

```bash
# Production
wrangler secret put STRIPE_SECRET_KEY --env production
wrangler secret put STRIPE_WEBHOOK_SECRET --env production
wrangler secret put EXECUTOR_PRIVATE_KEY --env production
wrangler secret put BASE_RPC_URL --env production

# Staging (optional)
wrangler secret put STRIPE_SECRET_KEY --env staging
# ... repeat for staging
```

Prompts for values → Securely stored in Cloudflare vault

## Step 6: Deploy Worker

```bash
wrangler deploy --env production
```

Output:
```
✨ Deployment complete!
📦 Uploaded worker to apitoll.com
🌍 https://apitoll.com
```

## Step 7: Deploy Dashboard (Cloudflare Pages)

```bash
# Build dashboard
npm run build --workspace=apps/dashboard

# Deploy to Pages
wrangler pages deploy apps/dashboard/.next --project-name=apitoll-dashboard
```

Or use Git integration:
1. Cloudflare Dashboard → Pages → Connect Git
2. Select TasnidChain/APITOLL
3. Build command: `npm run build --workspace=apps/dashboard`
4. Output dir: `apps/dashboard/.next`
5. Deploy

## Step 8: Configure Domain

Cloudflare Dashboard → Domains → apitoll.com

### Route Worker to Domain

Go to **Workers & Pages** → **Routes** → **Create route**

```
Route: apitoll.com/api/*
Service: apitoll (worker)
Zone: apitoll.com
```

### Route Pages to Domain

Go to **Pages** → **apitoll-dashboard** → **Custom domains**

Add: `apitoll.com` (will auto-redirect to www or subdomain)

## Step 9: Enable SSL/TLS

Cloudflare auto-enables SSL for all domains.

Verify:
```bash
curl -I https://apitoll.com/health
```

Should return `HTTP/2 200`

## Step 10: Test Endpoints

### Health check
```bash
curl https://apitoll.com/health
```

### Discovery API
```bash
curl https://apitoll.com/api/discovery/tools
```

### Payment endpoint
```bash
curl -X POST https://apitoll.com/api/pay \
  -H "Content-Type: application/json" \
  -d '{
    "original_url": "https://api.example.com/data",
    "payment_required": {
      "amount": 1000,
      "currency": "USDC",
      "recipient": "0x..."
    },
    "agent_wallet": "0x..."
  }'
```

## Monitoring

View logs:
```bash
wrangler tail --env production
```

View analytics:
- Cloudflare Dashboard → Workers → apitoll → Analytics

## Updating Code

Push to GitHub:
```bash
git add -A
git commit -m "Update Apitoll"
git push origin main
```

Re-deploy:
```bash
wrangler deploy --env production
```

Or enable Git auto-deploy:
- Cloudflare Dashboard → Workers → Settings → Git integration

## Costs

**Cloudflare Workers:**
- First 100,000 requests/day: FREE
- Beyond: $0.50 per million requests

**Cloudflare Pages:**
- 500 builds/month: FREE
- Unlimited bandwidth

**Total for MVP:** FREE tier (generous limits)

## Troubleshooting

**"Worker failed to deploy"**
- Check `wrangler.toml` syntax
- Verify account_id is correct
- Try: `wrangler publish --env production`

**"Routes not matching"**
- Cloudflare uses route patterns: `example.com/api/*`
- Not regex, use `*` for wildcard
- Restart worker: `wrangler deployments list`

**"Database not connecting"**
- Verify D1 database ID in `wrangler.toml`
- Check database exists: `wrangler d1 list`

**"SSL certificate not showing"**
- Cloudflare auto-generates (takes 5-10 min)
- Check: Cloudflare Dashboard → SSL/TLS → Edge Certificates

## Next Steps

1. ✅ Deploy worker (5 min)
2. ✅ Deploy pages (3 min)
3. ✅ Test health endpoints (2 min)
4. 🔜 Wire up Stripe webhooks (set in Stripe dashboard)
5. 🔜 Fund executor wallet ($500 USDC)
6. 🔜 Test payment flow

---

**Deployed to Cloudflare? You're LIVE.** 🚀
