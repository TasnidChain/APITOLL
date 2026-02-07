import { Bot, Cpu, Wrench, Globe, Code2, Blocks } from 'lucide-react'

const frameworks = [
  { name: 'LangChain', icon: Bot, description: 'Native tool integration' },
  { name: 'CrewAI', icon: Cpu, description: 'Multi-agent payments' },
  { name: 'AutoGen', icon: Blocks, description: 'Agent wallet support' },
  { name: 'MCP Servers', icon: Wrench, description: 'Tool monetization' },
  { name: 'Express / Hono', icon: Code2, description: 'Middleware SDK' },
  { name: 'Any HTTP Client', icon: Globe, description: 'Fetch, axios, curl' },
]

export function Integrations() {
  return (
    <section className="relative bg-slate-900/50 py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Integrations
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Works with your stack
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Native support for popular agent frameworks and HTTP servers
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {frameworks.map((fw) => (
            <div
              key={fw.name}
              className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4 transition-all hover:border-slate-700"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <fw.icon className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{fw.name}</p>
                <p className="text-xs text-slate-500">{fw.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
