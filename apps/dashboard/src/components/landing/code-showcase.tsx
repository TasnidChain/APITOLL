'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

const sellerCode = `// seller.ts — Monetize any Express API
import { paymentMiddleware } from "@apitoll/seller-sdk";

app.use(paymentMiddleware({
  facilitatorUrl: "https://pay.apitoll.com",
  routePricing: {
    "GET /api/joke":    { price: "0.001", network: "base-mainnet" },
    "POST /api/analyze": { price: "0.02",  network: "base-mainnet" },
  },
  sellerWallet: process.env.SELLER_WALLET,
}));`

const buyerCode = `// agent.ts — Agent auto-handles 402 payments
import { createAgentWallet, createFacilitatorSigner }
  from "@apitoll/buyer-sdk";

const wallet = createAgentWallet({
  signer: createFacilitatorSigner({
    facilitatorUrl: "https://pay.apitoll.com",
    apiKey: process.env.FACILITATOR_API_KEY,
  }),
});

// Agent calls paid API — payment handled automatically
const res = await wallet.fetch(
  "https://api.apitoll.com/api/joke"
);
console.log(await res.json()); // { joke: "..." }`

export function CodeShowcase() {
  const [activeTab, setActiveTab] = useState<'seller' | 'buyer'>('seller')
  const [copied, setCopied] = useState(false)

  const code = activeTab === 'seller' ? sellerCode : buyerCode

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="relative bg-slate-950 py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left — text */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
              Real code, real SDK
            </p>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              Ship in minutes,<br />not weeks
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-slate-400">
              Sellers add our Express middleware. Agents use our wallet SDK.
              The 402 handshake handles everything in between.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="h-3 w-3 text-emerald-400" />
                </div>
                <p className="text-sm text-slate-300">
                  <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-blue-400">@apitoll/seller-sdk</code> — Express middleware for payment gating
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="h-3 w-3 text-emerald-400" />
                </div>
                <p className="text-sm text-slate-300">
                  <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-blue-400">@apitoll/buyer-sdk</code> — Agent wallet with auto-pay on 402
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="h-3 w-3 text-emerald-400" />
                </div>
                <p className="text-sm text-slate-300">
                  Facilitator handles USDC transfers on Base — sellers never touch crypto wallets
                </p>
              </div>
            </div>
          </div>

          {/* Right — code block */}
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-blue-500/5">
            {/* Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 px-4">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('seller')}
                  className={`border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
                    activeTab === 'seller'
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  seller.ts
                </button>
                <button
                  onClick={() => setActiveTab('buyer')}
                  className={`border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
                    activeTab === 'buyer'
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  agent.ts
                </button>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>

            {/* Code */}
            <pre className="overflow-x-auto p-6 text-sm leading-relaxed">
              <code>
                {code.split('\n').map((line, i) => (
                  <div key={i} className="whitespace-pre">
                    {colorize(line)}
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Simple keyword-based syntax colorization using Tailwind classes */
function colorize(line: string) {
  if (line.startsWith('//')) {
    return <span className="text-slate-500">{line}</span>
  }

  // Simple approach: just color keywords inline
  const tokens = line.split(/(\s+|[{}(),:;=]|"[^"]*")/g)

  return (
    <>
      {tokens.map((token, idx) => {
        if (token.startsWith('"') && token.endsWith('"')) {
          return <span key={idx} className="text-emerald-400">{token}</span>
        }
        if (/^(import|from|export|const|await|new)$/.test(token)) {
          return <span key={idx} className="text-violet-400">{token}</span>
        }
        if (/^(paymentMiddleware|createAgentWallet|createFacilitatorSigner|fetch|app|wallet|res|console)$/.test(token)) {
          return <span key={idx} className="text-cyan-400">{token}</span>
        }
        if (/^\d+\.?\d*$/.test(token)) {
          return <span key={idx} className="text-amber-400">{token}</span>
        }
        if (/^[{}(),:;=]$/.test(token)) {
          return <span key={idx} className="text-slate-500">{token}</span>
        }
        return <span key={idx} className="text-slate-300">{token}</span>
      })}
    </>
  )
}
