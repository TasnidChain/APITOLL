import { Wallet, Zap, DollarSign, ArrowRight } from 'lucide-react'

const steps = [
  {
    icon: Wallet,
    title: 'Fund',
    subtitle: 'Load Agent Wallets',
    description:
      'Organizations deposit USDC or use the fiat on-ramp. Set daily budgets, vendor allowlists, and spending policies for each agent.',
    color: 'from-blue-500 to-blue-600',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
  },
  {
    icon: Zap,
    title: 'Transact',
    subtitle: 'Agents Pay for APIs',
    description:
      'When an API returns HTTP 402, the agent automatically signs a USDC micropayment. Sub-second settlement on Base and Solana.',
    color: 'from-amber-500 to-orange-500',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
  },
  {
    icon: DollarSign,
    title: 'Earn',
    subtitle: 'Sellers Get Paid',
    description:
      'API providers receive instant USDC payments. No invoicing, no chargebacks, no 30-day net terms. Just revenue.',
    color: 'from-emerald-500 to-green-500',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative bg-slate-950 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            How It Works
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Three steps to autonomous commerce
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            From funding to settlement in under 2 seconds
          </p>
        </div>

        {/* Steps */}
        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="relative">
              {/* Connector line (desktop only) */}
              {i < steps.length - 1 && (
                <div className="absolute right-0 top-16 hidden translate-x-1/2 lg:block">
                  <ArrowRight className="h-6 w-6 text-slate-700" />
                </div>
              )}

              <div className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-8 transition-all hover:border-slate-700 hover:bg-slate-900/60">
                {/* Step number */}
                <div className="mb-6 flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${step.iconBg}`}>
                    <step.icon className={`h-6 w-6 ${step.iconColor}`} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Step {i + 1}
                    </span>
                    <h3 className="text-lg font-bold text-white">{step.title}</h3>
                  </div>
                </div>

                <p className="text-sm font-semibold text-slate-300">{step.subtitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
