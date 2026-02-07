'use client'

import { useOrgId, useDeposits, useDepositStats } from '@/lib/hooks'
import { PageLoading, StatCardSkeleton } from '@/components/loading'
import { formatUSD, timeAgo, shortenAddress } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Wallet,
  ArrowDown,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  DollarSign,
  TrendingUp,
  ExternalLink,
} from 'lucide-react'

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'bg-warning/10 text-warning',
    label: 'Pending',
  },
  processing: {
    icon: Loader2,
    color: 'bg-blue-100 text-blue-800',
    label: 'Processing',
  },
  completed: {
    icon: CheckCircle,
    color: 'bg-success/10 text-success',
    label: 'Completed',
  },
  failed: {
    icon: XCircle,
    color: 'bg-destructive/10 text-destructive',
    label: 'Failed',
  },
}

export default function DepositsPage() {
  const orgId = useOrgId()
  const deposits = useDeposits(orgId)
  const stats = useDepositStats(orgId)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deposits</h1>
          <p className="text-muted-foreground">
            Fund your agent wallets with USDC via fiat on-ramp
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <ArrowDown className="h-4 w-4" />
          New Deposit
        </button>
      </div>

      {/* Summary Stats */}
      {!stats ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Total Deposited
            </div>
            <p className="text-2xl font-bold mt-1">
              {formatUSD(stats.totalDeposited)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" />
              USDC Received
            </div>
            <p className="text-2xl font-bold mt-1">
              {formatUSD(stats.totalUsdcReceived)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              On-ramp Fees
            </div>
            <p className="text-2xl font-bold mt-1 text-muted-foreground">
              {formatUSD(stats.totalFees)}
            </p>
            <p className="text-xs text-muted-foreground">1.5% fee</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              Completed
            </div>
            <p className="text-2xl font-bold mt-1">
              {stats.completedDeposits}/{stats.totalDeposits}
            </p>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="mb-8 rounded-xl border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">How Deposits Work</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              1
            </div>
            <div>
              <p className="font-medium">Pay with Card</p>
              <p className="text-sm text-muted-foreground">
                Choose an amount and pay via Stripe
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              2
            </div>
            <div>
              <p className="font-medium">Convert to USDC</p>
              <p className="text-sm text-muted-foreground">
                Fiat is converted to USDC (1.5% fee)
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              3
            </div>
            <div>
              <p className="font-medium">Fund Agent Wallet</p>
              <p className="text-sm text-muted-foreground">
                USDC deposited to your agent's wallet
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Deposits List */}
      {!deposits ? (
        <PageLoading />
      ) : deposits.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Wallet className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p className="text-lg font-medium">No deposits yet</p>
          <p className="text-sm">
            Make your first deposit to fund your agent wallets
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h3 className="font-semibold">Deposit History</h3>
          </div>
          <div className="divide-y">
            {deposits.map((deposit) => {
              const config = statusConfig[deposit.status as keyof typeof statusConfig]
              const StatusIcon = config.icon

              return (
                <div
                  key={deposit._id}
                  className="flex items-center justify-between p-4 hover:bg-muted/30"
                >
                  <div className="flex items-center gap-4">
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
                        <p className="font-medium">
                          {formatUSD(deposit.fiatAmount)} USD
                        </p>
                        <span className="text-muted-foreground">{'>'}</span>
                        <p className="font-medium text-success">
                          {formatUSD(deposit.usdcAmount)} USDC
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{shortenAddress(deposit.walletAddress)}</span>
                        <span className="capitalize">({deposit.chain})</span>
                        <span>{timeAgo(new Date(deposit.createdAt))}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        config.color
                      )}
                    >
                      {config.label}
                    </span>
                    {deposit.txHash && (
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        title="View on explorer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
