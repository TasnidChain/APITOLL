import Link from 'next/link'
import { ArrowRight, Zap } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />

      {/* Gradient glow */}
      <div className="absolute left-1/2 top-0 -translate-x-1/2">
        <div className="h-[600px] w-[600px] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-24 sm:pt-32 lg:pt-40">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-4 py-1.5 text-sm text-slate-400 backdrop-blur-sm">
            <Zap className="h-3.5 w-3.5 text-blue-400" />
            Built on the x402 Protocol
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
            The Payment Layer for{' '}
            <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Autonomous AI Agents
            </span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            Enable your AI agents to pay for APIs in real time with USDC
            micropayments. Control spending, enforce policies, and own your
            transaction graph.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/dashboard"
              className="group flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-slate-950 transition-all hover:bg-slate-200 hover:shadow-lg hover:shadow-white/10"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="https://docs.apitoll.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-700 bg-slate-900/50 px-8 py-3.5 text-sm font-semibold text-slate-300 backdrop-blur-sm transition-all hover:border-slate-600 hover:bg-slate-800/50 hover:text-white"
            >
              View Documentation
            </a>
          </div>
        </div>

        {/* Social proof stats */}
        <div className="mx-auto mt-16 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">2s</p>
            <p className="text-xs text-slate-500">Settlement on Base</p>
          </div>
          <div className="h-8 w-px bg-slate-800 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">400ms</p>
            <p className="text-xs text-slate-500">Settlement on Solana</p>
          </div>
          <div className="h-8 w-px bg-slate-800 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">$0.001</p>
            <p className="text-xs text-slate-500">Min payment</p>
          </div>
          <div className="h-8 w-px bg-slate-800 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">0%</p>
            <p className="text-xs text-slate-500">Chargebacks</p>
          </div>
        </div>

        {/* Terminal / Code preview */}
        <div className="mx-auto mt-16 max-w-3xl">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-blue-500/5 backdrop-blur">
            {/* Terminal header */}
            <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-slate-700" />
              <div className="h-3 w-3 rounded-full bg-slate-700" />
              <div className="h-3 w-3 rounded-full bg-slate-700" />
              <span className="ml-2 text-xs text-slate-500">x402 Payment Flow</span>
            </div>
            {/* Terminal body */}
            <div className="p-6 font-mono text-sm leading-relaxed">
              <div className="text-slate-500">{'// Agent requests a paid API endpoint'}</div>
              <div className="mt-1">
                <span className="text-blue-400">GET</span>{' '}
                <span className="text-slate-300">https://api.weather.com/forecast</span>
              </div>
              <div className="mt-4 text-slate-500">{'// Server responds with payment required'}</div>
              <div className="mt-1">
                <span className="text-amber-400">402</span>{' '}
                <span className="text-slate-300">Payment Required</span>
              </div>
              <div className="mt-1 text-slate-500">
                {'  x402-price: '}<span className="text-emerald-400">0.001 USDC</span>
                {'  x402-chain: '}<span className="text-cyan-400">base</span>
              </div>
              <div className="mt-4 text-slate-500">{'// Agent auto-signs payment & retries'}</div>
              <div className="mt-1">
                <span className="text-emerald-400">200</span>{' '}
                <span className="text-slate-300">OK</span>
                <span className="text-slate-500">{' — '}</span>
                <span className="text-slate-400">paid 0.001 USDC in 1.2s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
