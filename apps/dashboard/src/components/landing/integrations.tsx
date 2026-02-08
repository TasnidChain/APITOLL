import { Bot, Cpu, Wrench, Globe, Code2, Blocks, Zap, Layers, Server, Brain, Sparkles, Network } from 'lucide-react'

const categories = [
  {
    title: 'Agent Frameworks',
    items: [
      { name: 'LangChain', icon: Bot, description: 'Native tool integration' },
      { name: 'CrewAI', icon: Cpu, description: 'Multi-agent payments' },
      { name: 'AutoGen', icon: Blocks, description: 'Agent wallet support' },
      { name: 'OpenAI Agents SDK', icon: Brain, description: 'Built-in tool calling' },
      { name: 'Vercel AI SDK', icon: Sparkles, description: 'Streaming + payments' },
      { name: 'LlamaIndex', icon: Layers, description: 'RAG with paid sources' },
    ],
  },
  {
    title: 'Protocols & Standards',
    items: [
      { name: 'MCP Servers', icon: Wrench, description: 'Tool monetization' },
      { name: 'A2A Protocol', icon: Network, description: 'Agent-to-agent commerce' },
      { name: 'OpenAPI / Swagger', icon: Code2, description: 'Auto-discovery' },
      { name: 'x402 Protocol', icon: Zap, description: 'HTTP native payments' },
    ],
  },
  {
    title: 'Server Frameworks',
    items: [
      { name: 'Express / Hono', icon: Server, description: 'Middleware SDK' },
      { name: 'FastAPI / Flask', icon: Server, description: 'Python middleware' },
      { name: 'Any HTTP Client', icon: Globe, description: 'Fetch, axios, curl' },
    ],
  },
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
            Native support for popular agent frameworks, protocols, and HTTP servers.
            Drop in x402 payments in minutes.
          </p>
        </div>

        <div className="mx-auto mt-16 space-y-12">
          {categories.map((category) => (
            <div key={category.title}>
              <h3 className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-slate-500">
                {category.title}
              </h3>
              <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {category.items.map((fw) => (
                  <div
                    key={fw.name}
                    className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4 transition-all hover:border-slate-700 hover:bg-slate-900/60"
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
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-slate-500">
          Don&apos;t see your framework?{' '}
          <a
            href="https://github.com/TasnidChain/APITOLL/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            Request an integration
          </a>
        </p>
      </div>
    </section>
  )
}
