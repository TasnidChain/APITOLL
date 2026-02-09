'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import { useOrgId, useOrg } from '@/lib/hooks'
import { PageLoading } from '@/components/loading'
import {
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Shield,
  AlertTriangle,
  Code2,
  Clock,
} from 'lucide-react'

function ApiKeyDisplay({ label, apiKey }: { label: string; apiKey: string }) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const masked = apiKey.slice(0, 8) + '••••••••••••••••' + apiKey.slice(-4)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 truncate font-mono text-sm">
          {visible ? apiKey : masked}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => setVisible(!visible)}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={visible ? 'Hide API key' : 'Show API key'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button
          onClick={handleCopy}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Copy API key"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  )
}

function CodeBlock({ title, language, code }: { title: string; language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
            {language}
          </span>
          <button
            onClick={handleCopy}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Copy code"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="text-sm font-mono text-foreground">{code}</code>
      </pre>
    </div>
  )
}

export default function ApiKeysPage() {
  const orgId = useOrgId()
  const org = useOrg(orgId)

  const sellers = useQuery(
    api.sellers.listApiKeysByOrg,
    orgId ? { orgId } : 'skip'
  )

  const orgKeyData = useQuery(
    api.organizations.getApiKey,
    orgId ? { id: orgId } : 'skip'
  )

  if (!org || sellers === undefined || orgKeyData === undefined) {
    return <PageLoading />
  }

  const orgApiKey = orgKeyData?.apiKey ?? ''

  const buyerSdkCode = `import { createAgentWallet } from '@apitoll/buyer-sdk'

const wallet = createAgentWallet({
  apiKey: '${orgApiKey ?? 'YOUR_ORG_API_KEY'}',
})

// Fund the wallet
await wallet.deposit({ amount: 10.00, currency: 'USD' })

// Make a payment to a seller
const payment = await wallet.pay({
  sellerId: 'SELLER_ID',
  amount: 0.05,
  description: 'API call - /v1/search',
})`

  const sellerSdkCode = `import express from 'express'
import { paymentMiddleware } from '@apitoll/seller-sdk'

const app = express()

// Protect routes with API Toll payment middleware
app.use('/api/v1', paymentMiddleware({
  apiKey: 'YOUR_SELLER_API_KEY',
  pricePerRequest: 0.01,
  currency: 'USD',
}))

app.get('/api/v1/search', (req, res) => {
  // Your API logic here
  res.json({ results: [] })
})

app.listen(3000)`

  const curlCode = `# Make a paid API request with your org API key
curl -X POST https://api.apitoll.com/v1/pay \\
  -H "Authorization: Bearer ${orgApiKey ?? 'YOUR_ORG_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "seller_id": "SELLER_ID",
    "amount": 0.05,
    "description": "API call"
  }'`

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      {/* Page Header */}
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          <Key className="h-7 w-7 text-primary" />
          API Keys
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage your organization and seller API keys for authenticating with the API Toll platform.
        </p>
      </div>

      {/* Security Warning */}
      <div className="flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
        <div>
          <p className="font-medium text-yellow-600 dark:text-yellow-400">
            Keep your API keys secret
          </p>
          <p className="mt-1 text-sm text-yellow-600/80 dark:text-yellow-400/80">
            Never share your API keys in public repositories, client-side code, or insecure environments.
            Treat them like passwords. If you suspect a key has been compromised, rotate it immediately.
          </p>
        </div>
      </div>

      {/* Organization API Key */}
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Organization API Key</h2>
            <p className="text-sm text-muted-foreground">
              Your primary key for authenticating buyer-side operations.
            </p>
          </div>
        </div>
        {orgApiKey ? (
          <ApiKeyDisplay label="Organization Key" apiKey={orgApiKey} />
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            No API key has been generated for this organization yet.
          </div>
        )}
      </section>

      {/* Seller API Keys */}
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Seller API Keys</h2>
            <p className="text-sm text-muted-foreground">
              Keys for each seller to authenticate and receive payments.
            </p>
          </div>
        </div>
        {sellers && sellers.length > 0 ? (
          <div className="space-y-3">
            {sellers.map((seller) => (
              <ApiKeyDisplay
                key={seller._id}
                label={seller.name}
                apiKey={seller.apiKey}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            No sellers have been created yet. Add a seller to generate API keys.
          </div>
        )}
      </section>

      {/* SDK Quick Start */}
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Code2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">SDK Quick Start</h2>
            <p className="text-sm text-muted-foreground">
              Get started quickly with our SDKs or use the REST API directly.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <CodeBlock
            title="Buyer SDK"
            language="TypeScript"
            code={buyerSdkCode}
          />

          <CodeBlock
            title="Seller SDK (Express Middleware)"
            language="TypeScript"
            code={sellerSdkCode}
          />

          <CodeBlock
            title="Direct API (cURL)"
            language="bash"
            code={curlCode}
          />
        </div>
      </section>
    </div>
  )
}
