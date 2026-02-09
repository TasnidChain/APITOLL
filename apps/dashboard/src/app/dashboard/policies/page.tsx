'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import { Id } from '../../../../../../convex/_generated/dataModel'
import { useOrgId, usePolicies, useAgents, useAlertRules } from '@/lib/hooks'
import { formatUSD } from '@/lib/utils'
import {
  ShieldCheck,
  DollarSign,
  Users,
  Clock,
  Plus,
  X,
  Loader2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Bell,
  Bot,
} from 'lucide-react'
import type { Policy, PolicyType, BudgetRules, VendorAclRules, RateLimitRules, Agent } from '@/lib/types'

const policyTypeConfig = {
  budget: {
    icon: DollarSign,
    label: 'Budget Cap',
    description: 'Set daily, per-transaction, and monthly spending limits',
    color: 'bg-emerald-500/10 text-emerald-500',
  },
  vendor_acl: {
    icon: Users,
    label: 'Vendor ACL',
    description: 'Control which sellers your agents can pay',
    color: 'bg-blue-500/10 text-blue-500',
  },
  rate_limit: {
    icon: Clock,
    label: 'Rate Limit',
    description: 'Limit requests per minute/hour to prevent runaway spending',
    color: 'bg-amber-500/10 text-amber-500',
  },
}

export default function PoliciesPage() {
  const orgId = useOrgId()
  const policies = usePolicies(orgId)
  const agents = useAgents(orgId)
  const alertRules = useAlertRules(orgId)
  const [showCreate, setShowCreate] = useState(false)
  const [_editingId, _setEditingId] = useState<string | null>(null)

  const _createPolicy = useMutation(api.policies.create)
  const _updatePolicy = useMutation(api.policies.update)
  const togglePolicy = useMutation(api.policies.toggleActive)
  const _removePolicy = useMutation(api.policies.remove)

  const activePolicies = policies?.filter((p: Policy) => p.isActive) ?? []
  const inactivePolicies = policies?.filter((p: Policy) => !p.isActive) ?? []

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Policy Engine</h1>
          <p className="text-sm text-muted-foreground">
            Configure spending limits, vendor allowlists, and rate limits for your agents
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create Policy
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Total Policies
          </div>
          <p className="text-2xl font-bold mt-1">{policies?.length ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ToggleRight className="h-4 w-4" />
            Active
          </div>
          <p className="text-2xl font-bold mt-1 text-emerald-500">{activePolicies.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bell className="h-4 w-4" />
            Alert Rules
          </div>
          <p className="text-2xl font-bold mt-1">{alertRules?.length ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" />
            Protected Agents
          </div>
          <p className="text-2xl font-bold mt-1">{agents?.length ?? 0}</p>
        </div>
      </div>

      {/* Policy Type Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {(Object.entries(policyTypeConfig) as [PolicyType, typeof policyTypeConfig.budget][]).map(
          ([type, config]) => {
            const count = policies?.filter((p: Policy) => p.policyType === type).length ?? 0
            const active = policies?.filter((p: Policy) => p.policyType === type && p.isActive).length ?? 0
            const Icon = config.icon
            return (
              <div key={type} className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{config.label}</h3>
                    <p className="text-xs text-muted-foreground">{count} configured, {active} active</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{config.description}</p>
              </div>
            )
          }
        )}
      </div>

      {/* Active Policies */}
      <div className="rounded-xl border bg-card">
        <div className="border-b p-4 flex items-center justify-between">
          <h3 className="font-semibold">Active Policies</h3>
          <span className="text-xs text-muted-foreground">{activePolicies.length} active</span>
        </div>
        {activePolicies.length === 0 ? (
          <div className="py-12 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No active policies. Create one to protect your agents.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              Create your first policy
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {activePolicies.map((policy: Policy) => (
              <PolicyRow
                key={policy._id}
                policy={policy}
                agents={agents}
                onToggle={() => togglePolicy({ id: policy._id })}
                onDelete={() => removePolicy({ id: policy._id })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inactive Policies */}
      {inactivePolicies.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h3 className="font-semibold text-muted-foreground">Inactive Policies</h3>
          </div>
          <div className="divide-y">
            {inactivePolicies.map((policy: Policy) => (
              <PolicyRow
                key={policy._id}
                policy={policy}
                agents={agents}
                onToggle={() => togglePolicy({ id: policy._id })}
                onDelete={() => removePolicy({ id: policy._id })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Policy Modal */}
      {showCreate && orgId && (
        <CreatePolicyModal
          orgId={orgId}
          agents={agents}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

function PolicyRow({
  policy,
  agents,
  onToggle,
  onDelete,
}: {
  policy: Policy
  agents: Agent[] | undefined
  onToggle: () => void
  onDelete: () => void
}) {
  const config = policyTypeConfig[policy.policyType]
  const Icon = config.icon
  const agent = policy.agentId
    ? agents?.find((a: Agent) => a._id === policy.agentId)
    : null

  const renderRules = () => {
    const rules = policy.rulesJson
    switch (policy.policyType) {
      case 'budget':
        return (
          <div className="flex gap-4 text-xs text-muted-foreground">
            {rules.dailyLimit && <span>Daily: {formatUSD(rules.dailyLimit)}</span>}
            {rules.perTransactionLimit && <span>Per tx: {formatUSD(rules.perTransactionLimit)}</span>}
            {rules.monthlyLimit && <span>Monthly: {formatUSD(rules.monthlyLimit)}</span>}
          </div>
        )
      case 'vendor_acl':
        return (
          <div className="flex gap-4 text-xs text-muted-foreground">
            {rules.allowedVendors?.length && (
              <span>{rules.allowedVendors.length} allowed vendors</span>
            )}
            {rules.blockedVendors?.length && (
              <span>{rules.blockedVendors.length} blocked vendors</span>
            )}
          </div>
        )
      case 'rate_limit':
        return (
          <div className="flex gap-4 text-xs text-muted-foreground">
            {rules.maxRequestsPerMinute && <span>{rules.maxRequestsPerMinute}/min</span>}
            {rules.maxRequestsPerHour && <span>{rules.maxRequestsPerHour}/hr</span>}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex items-center justify-between p-4 hover:bg-muted/30">
      <div className="flex items-center gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{config.label}</p>
            {agent && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                {agent.name}
              </span>
            )}
            {!agent && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                All Agents
              </span>
            )}
          </div>
          {renderRules()}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground p-1"
          title={policy.isActive ? 'Disable' : 'Enable'}
        >
          {policy.isActive ? (
            <ToggleRight className="h-5 w-5 text-primary" />
          ) : (
            <ToggleLeft className="h-5 w-5" />
          )}
        </button>
        <button
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive p-1"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function CreatePolicyModal({
  orgId,
  agents,
  onClose,
}: {
  orgId: Id<'organizations'>
  agents: Agent[] | undefined
  onClose: () => void
}) {
  const createPolicy = useMutation(api.policies.create)
  const [policyType, setPolicyType] = useState<PolicyType>('budget')
  const [agentId, setAgentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Budget fields
  const [dailyLimit, setDailyLimit] = useState('')
  const [perTxLimit, setPerTxLimit] = useState('')
  const [monthlyLimit, setMonthlyLimit] = useState('')

  // Vendor ACL fields
  const [allowedVendors, setAllowedVendors] = useState('')
  const [blockedVendors, setBlockedVendors] = useState('')

  // Rate limit fields
  const [maxPerMinute, setMaxPerMinute] = useState('')
  const [maxPerHour, setMaxPerHour] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      let rulesJson: BudgetRules | VendorAclRules | RateLimitRules

      switch (policyType) {
        case 'budget':
          rulesJson = {
            dailyLimit: parseFloat(dailyLimit) || undefined,
            perTransactionLimit: parseFloat(perTxLimit) || undefined,
            monthlyLimit: parseFloat(monthlyLimit) || undefined,
          } as BudgetRules
          if (!(rulesJson as BudgetRules).dailyLimit && !(rulesJson as BudgetRules).perTransactionLimit && !(rulesJson as BudgetRules).monthlyLimit) {
            throw new Error('Set at least one budget limit')
          }
          break
        case 'vendor_acl':
          rulesJson = {
            allowedVendors: allowedVendors ? allowedVendors.split(',').map(v => v.trim()).filter(Boolean) : undefined,
            blockedVendors: blockedVendors ? blockedVendors.split(',').map(v => v.trim()).filter(Boolean) : undefined,
          } as VendorAclRules
          if (!(rulesJson as VendorAclRules).allowedVendors?.length && !(rulesJson as VendorAclRules).blockedVendors?.length) {
            throw new Error('Add at least one vendor to allow or block')
          }
          break
        case 'rate_limit':
          rulesJson = {
            maxRequestsPerMinute: parseInt(maxPerMinute) || undefined,
            maxRequestsPerHour: parseInt(maxPerHour) || undefined,
          } as RateLimitRules
          if (!(rulesJson as RateLimitRules).maxRequestsPerMinute && !(rulesJson as RateLimitRules).maxRequestsPerHour) {
            throw new Error('Set at least one rate limit')
          }
          break
      }

      await createPolicy({
        orgId,
        agentId: agentId ? (agentId as Id<'agents'>) : undefined,
        policyType,
        rulesJson,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create policy')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create Policy</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Policy Type */}
          <div>
            <label className="text-sm font-medium">Policy Type</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(Object.entries(policyTypeConfig) as [PolicyType, typeof policyTypeConfig.budget][]).map(
                ([type, config]) => {
                  const Icon = config.icon
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPolicyType(type)}
                      className={`rounded-lg border p-3 text-center transition-colors ${
                        policyType === type
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <Icon className={`mx-auto h-5 w-5 mb-1 ${policyType === type ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="text-xs font-medium">{config.label}</p>
                    </button>
                  )
                }
              )}
            </div>
          </div>

          {/* Agent scope */}
          <div>
            <label className="text-sm font-medium">Apply to</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Agents (org-wide)</option>
              {agents?.map((agent: Agent) => (
                <option key={agent._id} value={agent._id}>
                  {agent.name} ({agent.chain})
                </option>
              ))}
            </select>
          </div>

          {/* Budget fields */}
          {policyType === 'budget' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Daily Spend Limit (USDC)</label>
                <div className="mt-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    placeholder="50.00"
                    step="0.01"
                    min="0"
                    className="w-full rounded-lg border pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Max Per Transaction (USDC)</label>
                <div className="mt-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={perTxLimit}
                    onChange={(e) => setPerTxLimit(e.target.value)}
                    placeholder="0.10"
                    step="0.01"
                    min="0"
                    className="w-full rounded-lg border pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Monthly Spend Limit (USDC)</label>
                <div className="mt-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={monthlyLimit}
                    onChange={(e) => setMonthlyLimit(e.target.value)}
                    placeholder="500.00"
                    step="0.01"
                    min="0"
                    className="w-full rounded-lg border pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Vendor ACL fields */}
          {policyType === 'vendor_acl' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Allowed Vendors</label>
                <p className="text-xs text-muted-foreground mb-1">Comma-separated wallet addresses or seller names</p>
                <textarea
                  value={allowedVendors}
                  onChange={(e) => setAllowedVendors(e.target.value)}
                  placeholder="0x1234..., 0xabcd..."
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Blocked Vendors</label>
                <p className="text-xs text-muted-foreground mb-1">These sellers will be rejected</p>
                <textarea
                  value={blockedVendors}
                  onChange={(e) => setBlockedVendors(e.target.value)}
                  placeholder="0x5678..."
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </div>
          )}

          {/* Rate limit fields */}
          {policyType === 'rate_limit' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Max Requests per Minute</label>
                <input
                  type="number"
                  value={maxPerMinute}
                  onChange={(e) => setMaxPerMinute(e.target.value)}
                  placeholder="60"
                  min="1"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Max Requests per Hour</label>
                <input
                  type="number"
                  value={maxPerHour}
                  onChange={(e) => setMaxPerHour(e.target.value)}
                  placeholder="1000"
                  min="1"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

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
                'Create Policy'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
