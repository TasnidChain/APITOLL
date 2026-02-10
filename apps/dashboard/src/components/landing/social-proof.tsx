import { CheckCircle, ExternalLink, Zap, Shield } from 'lucide-react'

const facts = [
  {
    icon: CheckCircle,
    title: 'Real USDC on Base Mainnet',
    description: 'Not testnet tokens. Actual USDC micropayments settled on-chain in 2 seconds. Every transaction verifiable on Basescan.',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
  },
  {
    icon: Zap,
    title: 'First x402 facilitator, live now',
    description: 'Our facilitator handles the payment flow between agents and sellers. Running on Railway, processing real transactions today.',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
  },
  {
    icon: Shield,
    title: 'Open-source protocol',
    description: 'Built on the open x402 HTTP payment standard. No vendor lock-in — any agent framework, any HTTP server, any wallet.',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10',
  },
]

const techStack = [
  { name: 'Base (Coinbase L2)', href: 'https://base.org' },
  { name: 'USDC Stablecoin', href: 'https://www.circle.com/en/usdc' },
  { name: 'x402 Protocol', href: 'https://www.x402.org/' },
  { name: 'Convex (Real-time DB)', href: 'https://www.convex.dev/' },
  { name: 'Clerk Auth', href: 'https://clerk.com/' },
  { name: 'Railway (Hosting)', href: 'https://railway.app/' },
]

export function SocialProof() {
  return (
    <section className="relative bg-slate-950 py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Production ready
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Not a demo. Real payments, live now.
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            We already ran our first real USDC transaction on Base mainnet.
            The infrastructure works end-to-end.
          </p>
        </div>

        {/* Facts grid */}
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {facts.map((fact) => (
            <div
              key={fact.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6"
            >
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${fact.iconBg}`}>
                <fact.icon className={`h-5 w-5 ${fact.iconColor}`} />
              </div>
              <h3 className="text-base font-semibold text-white">{fact.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {fact.description}
              </p>
            </div>
          ))}
        </div>

        {/* Tech stack strip */}
        <div className="mx-auto mt-16 max-w-3xl">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
            Built with
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {techStack.map((tech) => (
              <a
                key={tech.name}
                href={tech.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-300"
              >
                {tech.name}
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
