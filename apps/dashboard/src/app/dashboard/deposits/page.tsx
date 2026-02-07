'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import { useOrgId, useDeposits, useDepositStats, useAgents } from '@/lib/hooks'
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
  X,
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
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deposits</h1>
          <p className="text-muted-foreground">
            Fund your agent wallets with USDC via fiat on-ramp
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
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
                USDC deposited to your agent&apos;s wallet
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
                      <a
                        href={
                          deposit.chain === 'base'
                            ? `https://basescan.org/tx/${deposit.txHash}`
                            : `https://solscan.io/tx/${deposit.txHash}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        title="View on explorer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* New Deposit Modal */}
      {showModal && orgId && (
        <NewDepositModal orgId={orgId} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}

function NewDepositModal({
  orgId,
  onClose,
}: {
  orgId: string
  onClose: () => void
}) {
  const agents = useAgents(orgId as any)
  const createDeposit = useMutation(api.deposits.create)
  const [amount, setAmount] = useState('')
  const [chain, setChain] = useState<'base' | 'solana'>('base')
  const [selectedAgent, setSelectedAgent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fiatAmount = parseFloat(amount) || 0
  const fee = fiatAmount * 0.015
  const usdcAmount = fiatAmount - fee

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (fiatAmount < 1) {
      setError('Minimum deposit is $1.00')
      return
    }
    if (!selectedAgent) {
      setError('Please select an agent wallet')
      return
    }

    const agent = agents?.find((a) => a._id === selectedAgent)
    if (!agent) {
      setError('Invalid agent selected')
      return
    }

    setLoading(true)
    setError('')
    try {
      await createDeposit({
        orgId: orgId as any,
        fiatAmount,
        chain,
        walletAddress: agent.walletAddress,
        stripePaymentIntentId: `pi_demo_${Date.now()}`,
        agentId: selectedAgent as any,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create deposit')
    } finally {
      setLoading(false)
    }
  }

  const presets = [10, 50, 100, 500]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Deposit</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <div>
            <label className="text-sm font-medium">Amount (USD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="1"
              step="0.01"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="mt-2 flex gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(p.toString())}
                  className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-accent"
                >
                  ${p}
                </button>
              ))}
            </div>
          </div>

          {/* Agent wallet */}
          <div>
            <label className="text-sm font-medium">Agent Wallet</label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select an agent...</option>
              {agents?.map((agent) => (
                <option key={agent._id} value={agent._id}>
                  {agent.name} ({agent.chain})
                </option>
              ))}
            </select>
          </div>

          {/* Chain */}
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

          {/* Summary */}
          {fiatAmount > 0 && (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{formatUSD(fiatAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee (1.5%)</span>
                <span className="text-muted-foreground">-{formatUSD(fee)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>USDC Received</span>
                <span className="text-success">{formatUSD(Math.max(0, usdcAmount))}</span>
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
                  Processing...
                </>
              ) : (
                'Deposit'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
