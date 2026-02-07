import { Bot, Store, ArrowRight, Check } from 'lucide-react'

const buyerBenefits = [
  'Fund agents with fiat or crypto',
  'Per-agent budgets & spending policies',
  'Discover APIs in the marketplace',
  'Real-time transaction monitoring',
  'Multi-chain: Base & Solana',
]

const sellerBenefits = [
  'Monetize any API with 3 lines of code',
  'Instant USDC settlement, no invoicing',
  'Zero chargebacks, guaranteed revenue',
  'Analytics dashboard with latency metrics',
  'Featured listings in the marketplace',
]

export function DualAudience() {
  return (
    <section className="relative bg-slate-950 py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Two sides, one protocol
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Built for agents & sellers
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Whether you&apos;re building AI agents or selling APIs, API Toll handles the money.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          {/* Buyer / Agent side */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                <Bot className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">For Agent Builders</h3>
                <p className="text-sm text-slate-400">Give your agents the ability to pay</p>
              </div>
            </div>

            <ul className="mt-6 space-y-3">
              {buyerBenefits.map((b) => (
                <li key={b} className="flex items-center gap-3 text-sm text-slate-300">
                  <Check className="h-4 w-4 shrink-0 text-blue-400" />
                  {b}
                </li>
              ))}
            </ul>

            <a
              href="/dashboard/agents"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-blue-400 transition-colors hover:text-blue-300"
            >
              Set up your first agent <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Seller side */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                <Store className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">For API Sellers</h3>
                <p className="text-sm text-slate-400">Turn any endpoint into a revenue stream</p>
              </div>
            </div>

            <ul className="mt-6 space-y-3">
              {sellerBenefits.map((b) => (
                <li key={b} className="flex items-center gap-3 text-sm text-slate-300">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  {b}
                </li>
              ))}
            </ul>

            <a
              href="/dashboard/sellers"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
            >
              List your API <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
