import { mockAgents } from '@/lib/mock-data'
import { AgentCard } from '@/components/agent-card'
import { Plus } from 'lucide-react'

export default function AgentsPage() {
  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground">
            Manage your AI agent wallets and policies
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          New Agent
        </button>
      </div>

      {/* Summary Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Agents</p>
          <p className="text-2xl font-bold">{mockAgents.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-success">
            {mockAgents.filter((a) => a.status === 'active').length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Need Attention</p>
          <p className="text-2xl font-bold text-destructive">
            {mockAgents.filter((a) => a.status === 'depleted').length}
          </p>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mockAgents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  )
}
