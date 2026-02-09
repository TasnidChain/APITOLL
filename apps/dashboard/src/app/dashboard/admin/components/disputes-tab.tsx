'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../../../../convex/_generated/api'
import { Id } from '../../../../../../../convex/_generated/dataModel'
import { PageLoading } from '@/components/loading'
import { formatUSD } from '@/lib/utils'
import { Badge, Section } from './shared'
import type { DisputeStatus } from '@/lib/types'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'

interface AdminDispute {
  _id: Id<'disputes'>
  orgName: string
  status: DisputeStatus
  reason: string
  createdAt: number
  adminNotes?: string
  transaction: {
    method: string
    endpointPath: string
    amount: number
  } | null
}

export function DisputesTab() {
  const disputes = useQuery(api.admin.listAllDisputes)
  const resolve = useMutation(api.admin.resolveDispute)

  if (!disputes) return <PageLoading />

  const statusVariant = (status: string) => {
    if (status === 'resolved') return 'success' as const
    if (status === 'rejected') return 'error' as const
    if (status === 'under_review') return 'warning' as const
    return 'info' as const
  }

  const handleResolve = async (disputeId: Id<'disputes'>, action: 'resolved' | 'rejected') => {
    try {
      await resolve({
        disputeId,
        status: action,
        resolution: action === 'resolved' ? 'refunded' : 'denied',
      })
    } catch (err: unknown) {
      console.error('Failed to resolve dispute:', err instanceof Error ? err.message : err)
    }
  }

  return (
    <Section>
      {disputes.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <p>No disputes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d: AdminDispute) => (
            <div
              key={d._id}
              className="rounded-xl border bg-muted/30 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{d.orgName}</p>
                    <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{d.reason}</p>
                  {d.transaction && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tx: {d.transaction.method} {d.transaction.endpointPath} &middot;{' '}
                      {formatUSD(d.transaction.amount)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    <Clock className="mr-1 inline h-3 w-3" />
                    {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {(d.status === 'open' || d.status === 'under_review') && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResolve(d._id, 'resolved')}
                      className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
                    >
                      <CheckCircle2 className="mr-1 inline h-3 w-3" />
                      Resolve
                    </button>
                    <button
                      onClick={() => handleResolve(d._id, 'rejected')}
                      className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
                    >
                      <XCircle className="mr-1 inline h-3 w-3" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
              {d.adminNotes && (
                <p className="mt-2 rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                  Admin note: {d.adminNotes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}
