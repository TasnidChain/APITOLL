'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../../../../../convex/_generated/api'
import { Id } from '../../../../../../../convex/_generated/dataModel'
import { PageLoading } from '@/components/loading'
import { formatUSD, cn } from '@/lib/utils'
import { Section } from './shared'
import type { TransactionStatus } from '@/lib/types'
import { Activity, ArrowRightLeft } from 'lucide-react'

interface AdminTransaction {
  _id: Id<'transactions'>
  status: TransactionStatus
  agentName: string
  sellerName: string
  method: string
  endpointPath: string
  amount: number
  requestedAt: number
}

export function ActivityTab() {
  const activity = useQuery(api.admin.getActivityLog)

  if (!activity) return <PageLoading />

  const statusColor = (status: string) => {
    if (status === 'settled') return 'text-emerald-400'
    if (status === 'failed') return 'text-red-400'
    if (status === 'pending') return 'text-amber-400'
    return 'text-muted-foreground'
  }

  return (
    <Section title="Recent Transactions (All Orgs)">
      {activity.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Activity className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <p>No activity yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activity.map((tx: AdminTransaction) => (
            <div
              key={tx._id}
              className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    tx.status === 'settled'
                      ? 'bg-emerald-500/10'
                      : tx.status === 'failed'
                        ? 'bg-red-500/10'
                        : 'bg-amber-500/10'
                  )}
                >
                  <ArrowRightLeft
                    className={cn('h-4 w-4', statusColor(tx.status))}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {tx.agentName} &rarr; {tx.sellerName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.method} {tx.endpointPath}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn('text-sm font-medium', statusColor(tx.status))}>
                  {formatUSD(tx.amount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(tx.requestedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}
