import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Everything you need to get started',
    features: [
      '10,000 API calls / day',
      '3 agent wallets',
      '5 seller integrations',
      '30-day analytics',
      'Custom policies & webhooks',
      'Community support',
    ],
    cta: 'Get Started Free',
    href: '/dashboard',
    popular: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large-scale operations',
    features: [
      'Unlimited API calls',
      'Unlimited agents & sellers',
      '365-day analytics',
      'Revenue dashboard',
      'Custom integrations & SLA',
      'Featured seller listings',
      'Dedicated support',
    ],
    cta: 'Contact Us',
    href: 'mailto:tex@apitoll.com',
    popular: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="relative bg-slate-900/50 py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Start free. 3% transaction fee. Talk to us when you need more.
          </p>
        </div>

        {/* Cards */}
        <div className="mx-auto mt-16 grid max-w-3xl gap-6 lg:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                'relative rounded-2xl border p-8 transition-all',
                plan.popular
                  ? 'border-blue-500/50 bg-slate-900/80 shadow-lg shadow-blue-500/10'
                  : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{plan.description}</p>
              </div>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                {plan.period && <span className="text-sm text-slate-400">{plan.period}</span>}
              </div>

              {plan.href.startsWith('mailto:') ? (
                <a
                  href={plan.href}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800"
                >
                  {plan.cta}
                  <ArrowRight className="h-4 w-4" />
                </a>
              ) : (
                <Link
                  href={plan.href}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition-all hover:bg-slate-200"
                >
                  {plan.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
