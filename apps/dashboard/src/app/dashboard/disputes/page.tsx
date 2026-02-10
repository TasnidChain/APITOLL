'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { useOrgId, useDisputes } from '@/lib/hooks'
import { PageLoading } from '@/components/loading'
import { formatUSD, timeAgo } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Lock,
  Unlock,
  ShieldAlert,
  Timer,
} from 'lucide-react'

type StatusFilter = 'all' | 'open' | 'under_review' | 'resolved' | 'rejected'

const statusConfig = {
  open: {
    icon: AlertTriangle,
    color: 'bg-warning/10 text-warning',
    label: 'Open',
  },
  under_review: {
    icon: Clock,
    color: 'bg-blue-100 text-blue-800',
    label: 'Under Review',
  },
  resolved: {
    icon: CheckCircle,
    color: 'bg-success/10 text-success',
    label: 'Resolved',
  },
  rejected: {
    icon: XCircle,
    color: 'bg-destructive/10 text-destructive',
    label: 'Rejected',
  },
}

const resolutionLabels = {
  refunded: 'Full Refund',
  partial_refund: 'Partial Refund',
  denied: 'Denied',
}

type Tab = 'disputes' | 'escrow'

export default function DisputesPage() {
  const orgId = useOrgId()
  const [activeTab, setActiveTab] = useState<Tab>('disputes')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const disputes = useDisputes(
    orgId,
    statusFilter !== 'all' ? statusFilter : undefined
  )

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Disputes & Escrow</h1>
        <p className="text-muted-foreground">
          Track disputes, refunds, and escrowed payment holds
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 border-b">
        <button
          onClick={() => setActiveTab('disputes')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'disputes'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Disputes
          </div>
        </button>
        <button
          onClick={() => setActiveTab('escrow')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'escrow'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Escrow
          </div>
        </button>
      </div>

      {activeTab === 'escrow' && orgId ? (
        <EscrowTab orgId={orgId as Id<'organizations'>} />
      ) : (
        <>
      {/* Disputes content */}

      {/* Summary Stats */}
      {disputes && (
        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Disputes</p>
            <p className="text-2xl font-bold">{disputes.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Open</p>
            <p className="text-2xl font-bold text-warning">
              {disputes.filter((d) => d.status === 'open').length}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Under Review</p>
            <p className="text-2xl font-bold text-primary">
              {disputes.filter((d) => d.status === 'under_review').length}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Resolved</p>
            <p className="text-2xl font-bold text-success">
              {disputes.filter((d) => d.status === 'resolved').length}
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {(['all', 'open', 'under_review', 'resolved', 'rejected'] as const).map(
          (status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                statusFilter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {status === 'all'
                ? 'All'
                : status === 'under_review'
                ? 'Under Review'
                : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          )
        )}
      </div>

      {/* Disputes List */}
      {!disputes ? (
        <PageLoading />
      ) : disputes.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p className="text-lg font-medium">No disputes</p>
          <p className="text-sm">
            {statusFilter === 'all'
              ? 'No disputes have been filed yet'
              : `No ${statusFilter.replace('_', ' ')} disputes`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => {
            const config = statusConfig[dispute.status as keyof typeof statusConfig]
            const StatusIcon = config.icon

            return (
              <div
                key={dispute._id}
                className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        config.color
                      )}
                    >
                      <StatusIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          Dispute #{dispute._id.slice(-6)}
                        </h3>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            config.color
                          )}
                        >
                          {config.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {dispute.reason}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {timeAgo(new Date(dispute.createdAt))}
                  </span>
                </div>

                {/* Transaction Info */}
                {dispute.transaction && (
                  <div className="mt-4 flex items-center gap-6 rounded-lg bg-muted/50 px-4 py-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Amount:</span>{' '}
                      <span className="font-medium">
                        {formatUSD(dispute.transaction.amount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Endpoint:</span>{' '}
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {dispute.transaction.method}{' '}
                        {dispute.transaction.endpointPath}
                      </code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Chain:</span>{' '}
                      <span className="capitalize font-medium">
                        {dispute.transaction.chain}
                      </span>
                    </div>
                  </div>
                )}

                {/* Resolution */}
                {dispute.resolution && (
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">Resolution:</span>
                    <span className="font-medium">
                      {resolutionLabels[dispute.resolution as keyof typeof resolutionLabels]}
                    </span>
                    {dispute.refundAmount && (
                      <span className="text-success font-medium">
                        {formatUSD(dispute.refundAmount)} refunded
                      </span>
                    )}
                  </div>
                )}

                {/* Admin Notes */}
                {dispute.adminNotes && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-sm">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-muted-foreground">{dispute.adminNotes}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// Escrow Tab
// ═══════════════════════════════════════════════════

const escrowStatusConfig = {
  held: { icon: Lock, color: 'bg-amber-500/10 text-amber-500', label: 'Held' },
  released: { icon: Unlock, color: 'bg-emerald-500/10 text-emerald-500', label: 'Released' },
  disputed: { icon: ShieldAlert, color: 'bg-red-500/10 text-red-500', label: 'Disputed' },
  refunded: { icon: CheckCircle, color: 'bg-blue-500/10 text-blue-500', label: 'Refunded' },
} as const

function EscrowTab({ orgId }: { orgId: Id<'organizations'> }) {
  const stats = useQuery(api.escrow.getEscrowStats, { orgId })
  const payments = useQuery(api.escrow.listByOrg, { orgId, limit: 50 })

  return (
    <div className="space-y-6">
      {/* Escrow Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-5">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Currently Held</p>
            <p className="text-2xl font-bold text-amber-500">{stats.held}</p>
            {stats.heldAmount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{formatUSD(stats.heldAmount)}</p>
            )}
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Released</p>
            <p className="text-2xl font-bold text-emerald-500">{stats.released}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Disputed</p>
            <p className="text-2xl font-bold text-red-500">{stats.disputed}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Refunded</p>
            <p className="text-2xl font-bold text-blue-500">{stats.refunded}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
        </div>
      )}

      {/* Escrow Payments List */}
      {!payments ? (
        <PageLoading />
      ) : payments.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Lock className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p className="text-lg font-medium">No escrow payments</p>
          <p className="text-sm mt-1">
            Escrow holds protect buyers with time-locked payments
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h3 className="font-semibold">Escrow Payments</h3>
          </div>
          <div className="divide-y">
            {payments.map((payment) => {
              const config = escrowStatusConfig[payment.status as keyof typeof escrowStatusConfig] ?? escrowStatusConfig.held
              const StatusIcon = config.icon
              const isHeld = payment.status === 'held'
              const holdRemaining = isHeld ? Math.max(0, payment.holdUntil - Date.now()) : 0
              const holdMinutes = Math.ceil(holdRemaining / 60000)

              return (
                <div key={payment._id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', config.color)}>
                      <StatusIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{formatUSD(payment.amount)} {payment.currency}</p>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', config.color)}>
                          {config.label}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono">{payment.agentAddress.slice(0, 6)}...{payment.agentAddress.slice(-4)}</span>
                        <span className="capitalize">{payment.chain}</span>
                        {isHeld && holdRemaining > 0 && (
                          <span className="inline-flex items-center gap-1 text-amber-500">
                            <Timer className="h-3 w-3" />
                            {holdMinutes}m remaining
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(new Date(payment.createdAt))}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
