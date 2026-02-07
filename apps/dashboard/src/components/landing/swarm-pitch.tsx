import { Bot, ArrowRight, Layers, Repeat, Shield } from 'lucide-react'

const capabilities = [
  {
    icon: Layers,
    title: 'Multi-agent orchestration',
    description: 'Each agent in your swarm gets its own wallet, budget, and policies. Manage 1,000 agents like one.',
  },
  {
    icon: Repeat,
    title: 'Autonomous loops',
    description: 'Agents discover tools, negotiate prices, and pay — all without human intervention. 24/7 commerce.',
  },
  {
    icon: Shield,
    title: 'Guardrails built in',
    description: 'Per-agent daily budgets, vendor allowlists, and anomaly alerts. Stay in control while agents move fast.',
  },
]

export function SwarmPitch() {
  return (
    <section className="relative bg-slate-900/50 py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Left — messaging */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
              For agent swarms
            </p>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              Scale to thousands of agents
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              Whether you run 1 agent or 10,000, Apitoll handles payments, budgets, and compliance at any scale.
            </p>

            <div className="mt-10 space-y-6">
              {capabilities.map((cap) => (
                <div key={cap.title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                    <cap.icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{cap.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{cap.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="/dashboard"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-blue-400 transition-colors hover:text-blue-300"
            >
              Start building <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Right — visual */}
          <div className="relative">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
              {/* Swarm visualization */}
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex h-20 items-center justify-center rounded-xl border transition-all ${
                      i === 4
                        ? 'border-blue-500/50 bg-blue-500/10'
                        : 'border-slate-700 bg-slate-800/50'
                    }`}
                  >
                    <Bot
                      className={`h-6 w-6 ${
                        i === 4 ? 'text-blue-400' : 'text-slate-500'
                      }`}
                    />
                  </div>
                ))}
              </div>

              {/* Labels */}
              <div className="mt-6 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-slate-400">7 active</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-slate-400">1 paused</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-slate-600" />
                  <span className="text-slate-400">1 depleted</span>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-slate-800/50 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Swarm daily spend</span>
                  <span className="font-mono font-semibold text-white">$47.23 / $100.00</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700">
                  <div className="h-full w-[47%] rounded-full bg-gradient-to-r from-blue-500 to-blue-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
