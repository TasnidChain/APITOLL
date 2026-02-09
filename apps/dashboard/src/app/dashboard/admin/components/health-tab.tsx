'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../../../../../convex/_generated/api'
import { PageLoading } from '@/components/loading'
import { Badge, Section } from './shared'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

export function HealthTab() {
  const stats = useQuery(api.admin.getPlatformStats)

  if (!stats) return <PageLoading />

  const checks = [
    {
      name: 'Database',
      status: 'healthy' as const,
      detail: `${stats.orgs.total} orgs, ${stats.agents.total} agents`,
    },
    {
      name: 'Webhooks',
      status: stats.webhooks.failing > 0 ? ('warning' as const) : ('healthy' as const),
      detail: `${stats.webhooks.active} active, ${stats.webhooks.failing} failing`,
    },
    {
      name: 'Marketplace',
      status: 'healthy' as const,
      detail: `${stats.marketplace.activeTools} active tools`,
    },
    {
      name: 'Transaction Processing',
      status: stats.transactions.failed > stats.transactions.settled * 0.1
        ? ('warning' as const)
        : ('healthy' as const),
      detail: `${stats.transactions.settled} settled, ${stats.transactions.failed} failed`,
    },
  ]

  return (
    <Section title="System Health Checks">
      <div className="space-y-3">
        {checks.map((check) => (
          <div
            key={check.name}
            className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              {check.status === 'healthy' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              )}
              <div>
                <p className="text-sm font-medium">{check.name}</p>
                <p className="text-xs text-muted-foreground">{check.detail}</p>
              </div>
            </div>
            <Badge variant={check.status === 'healthy' ? 'success' : 'warning'}>
              {check.status}
            </Badge>
          </div>
        ))}
      </div>
    </Section>
  )
}
