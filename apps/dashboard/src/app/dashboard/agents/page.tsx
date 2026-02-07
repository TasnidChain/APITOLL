'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import { AgentCard } from '@/components/agent-card'
import { StatCardSkeleton, PageLoading } from '@/components/loading'
import { useOrgId, useAgents, useAgentLimit } from '@/lib/hooks'
import { Plus, Bot, X, Loader2 } from 'lucide-react'

export default function AgentsPage() {
  const orgId = useOrgId()
  const agents = useAgents(orgId)
  const agentLimit = useAgentLimit(orgId)
  const [showModal, setShowModal] = useState(false)

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
            onClick={() => setShowModal(true)}
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

      {/* Create Agent Modal */}
      {showModal && orgId && (
        <CreateAgentModal
          orgId={orgId}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

function CreateAgentModal({
  orgId,
  onClose,
}: {
  orgId: string
  onClose: () => void
}) {
  const createAgent = useMutation(api.agents.create)
  const [name, setName] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [chain, setChain] = useState<'base' | 'solana'>('base')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !walletAddress.trim()) {
      setError('Name and wallet address are required')
      return
    }

    setLoading(true)
    setError('')
    try {
      await createAgent({
        orgId: orgId as any,
        name: name.trim(),
        walletAddress: walletAddress.trim(),
        chain,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create agent')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create New Agent</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Agent Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Research Bot"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Wallet Address</label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x... or So1..."
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Chain</label>
            <div className="mt-1 flex gap-3">
              <button
                type="button"
                onClick={() => setChain('base')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  chain === 'base'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:bg-accent'
                }`}
              >
                Base
              </button>
              <button
                type="button"
                onClick={() => setChain('solana')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  chain === 'solana'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:bg-accent'
                }`}
              >
                Solana
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Agent'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
