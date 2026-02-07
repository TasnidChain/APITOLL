import { Star } from 'lucide-react'

const testimonials = [
  {
    quote: 'We switched from Stripe to Apitoll and our agents now settle payments in under 2 seconds. No more webhook hell.',
    name: 'Alex Chen',
    role: 'CTO, AutoAgent Labs',
    avatar: 'AC',
  },
  {
    quote: 'The x402 protocol is a game-changer. Our LLM proxy earns revenue on every request with zero integration overhead.',
    name: 'Sarah Kim',
    role: 'Founder, LLMProxy.ai',
    avatar: 'SK',
  },
  {
    quote: 'Finally a payment system that understands agents don\'t have credit cards. Micropayments just work.',
    name: 'Marcus Rivera',
    role: 'Lead Engineer, SwarmOps',
    avatar: 'MR',
  },
]

const logos = [
  'AutoAgent Labs',
  'SwarmOps',
  'LLMProxy.ai',
  'AgentCloud',
  'DeFi Oracles',
  'ComputeMarket',
]

export function SocialProof() {
  return (
    <section className="relative bg-slate-950 py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Trusted by builders
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Teams shipping with Apitoll
          </h2>
        </div>

        {/* Logo strip */}
        <div className="mx-auto mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {logos.map((logo) => (
            <span
              key={logo}
              className="text-sm font-semibold text-slate-600 transition-colors hover:text-slate-400"
            >
              {logo}
            </span>
          ))}
        </div>

        {/* Testimonials */}
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
