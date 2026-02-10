import {
  BarChart3,
  Globe,
  ShieldCheck,
  Code2,
  Zap,
  Lock,
  KeyRound,
  Brain,
} from 'lucide-react'

const features = [
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description:
      'Track every transaction as it happens. Live dashboards with spend breakdowns, success rates, and latency metrics.',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
  },
  {
    icon: Globe,
    title: 'Multi-chain Support',
    description:
      'Lightning-fast settlements on Base (2s finality) and Solana (400ms). Pay with USDC stablecoins across chains.',
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/10',
  },
  {
    icon: ShieldCheck,
    title: 'Smart Policies',
    description:
      'Enforce budget caps, vendor allowlists, and per-request limits. Every payment is policy-checked before signing.',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
  },
  {
    icon: KeyRound,
    title: 'Self-Custody Wallets',
    description:
      'Agents hold their own keys and sign locally. Choose custodial, semi-custodial, or fully sovereign signing modes.',
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-500/10',
  },
  {
    icon: Code2,
    title: 'Developer First',
    description:
      'Add 3 lines to monetize any API. TypeScript SDKs for Express, Hono, LangGraph, Semantic Kernel, and MCP.',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10',
  },
  {
    icon: Brain,
    title: 'Agent Evolution',
    description:
      'Self-optimizing agents boost preferences, enable escrow, and optimize chains based on transaction success rates.',
    iconColor: 'text-pink-400',
    iconBg: 'bg-pink-500/10',
  },
  {
    icon: Zap,
    title: 'Instant Settlement',
    description:
      'Non-reversible USDC micropayments with no chargebacks. Sellers get paid the moment the API responds.',
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
  },
  {
    icon: Lock,
    title: 'Open Protocol',
    description:
      'Built on the x402 HTTP standard. Fully interoperable, no vendor lock-in. Any agent, any API, any chain.',
    iconColor: 'text-rose-400',
    iconBg: 'bg-rose-500/10',
  },
]

export function Features() {
  return (
    <section id="features" className="relative bg-slate-900/50 py-24 sm:py-32">
      {/* Top edge gradient */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Everything you need for agent commerce
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            A complete payment infrastructure built for autonomous AI agents
          </p>
        </div>

        {/* Feature grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-sm transition-all hover:border-slate-700 hover:bg-slate-900/70"
            >
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${feature.iconBg}`}>
                <feature.icon className={`h-5 w-5 ${feature.iconColor}`} />
              </div>
              <h3 className="text-base font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
