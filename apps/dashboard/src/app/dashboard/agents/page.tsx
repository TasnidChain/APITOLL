'use client'

import { AgentCard } from '@/components/agent-card'
import { StatCardSkeleton, PageLoading } from '@/components/loading'
import { useOrgId, useAgents, useAgentLimit } from '@/lib/hooks'
import { Plus, Bot } from 'lucide-react'

export default function AgentsPage() {
  const orgId = useOrgId()
  const agents = useAgents(orgId)
  const agentLimit = useAgentLimit(orgId)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground">
            Manage your AI agent wallets and policies
          </p>
        </div>
        <div className="flex items-center gap-3">
          {agentLimit && (
            <span className="text-sm text-muted-foreground">
              {agentLimit.current}/{agentLimit.limit === Infinity ? 'Unlimited' : agentLimit.limit} agents
            </span>
          )}
          <button
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            disabled={agentLimit ? !agentLimit.allowed : false}
          >
            <Plus className="h-4 w-4" />
            New Agent
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {!agents ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Agents</p>
            <p className="text-2xl font-bold">{agents.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-success">
              {agents.filter((a) => a.status === 'active').length}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Need Attention</p>
            <p className="text-2xl font-bold text-destructive">
              {agents.filter((a) => a.status === 'depleted').length}
            </p>
          </div>
        </div>
      )}

      {/* Agent Cards */}
      {!agents ? (
        <PageLoading />
      ) : agents.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Bot className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p className="text-lg font-medium">No agents yet</p>
          <p className="text-sm">Create your first agent to start making API payments</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent._id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  )
}
