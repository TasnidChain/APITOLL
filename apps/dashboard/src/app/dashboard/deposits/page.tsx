'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import type { Id } from '../../../../../../convex/_generated/dataModel'
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
  Copy,
  Check,
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

// Base USDC contract address — canonical source: @apitoll/shared
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

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
            Fund your agent wallets with USDC on Base
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
              Platform Fees
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
              <p className="font-medium">Send USDC</p>
              <p className="text-sm text-muted-foreground">
                Transfer USDC on Base to your agent&apos;s wallet
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              2
            </div>
            <div>
              <p className="font-medium">Record Deposit</p>
              <p className="text-sm text-muted-foreground">
                Log the deposit here with amount and tx hash
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              3
            </div>
            <div>
              <p className="font-medium">Agent Funded</p>
              <p className="text-sm text-muted-foreground">
                Balance updated, agent ready to pay for APIs
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Base USDC Contract (reference only)</p>
          <p className="text-xs font-mono text-muted-foreground">{USDC_CONTRACT}</p>
          <p className="mt-1 text-xs text-amber-600">
            ⚠ Do NOT send funds to this contract address. Send USDC to your agent&apos;s wallet address instead.
          </p>
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
            Send USDC to your agent wallet, then record it here
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-sm font-medium text-primary hover:underline"
          >
            Record your first deposit
          </button>
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
                        href={`https://basescan.org/tx/${deposit.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        title="View on BaseScan"
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
  const agents = useAgents(orgId as Id<"organizations">)
  const createDeposit = useMutation(api.deposits.createDeposit)
  const [amount, setAmount] = useState('')
  const [selectedAgent, setSelectedAgent] = useState('')
  const [txHash, setTxHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const fiatAmount = parseFloat(amount) || 0
  const fee = fiatAmount * 0.015
  const usdcAmount = fiatAmount - fee

  const selectedAgentData = agents?.find((a) => a._id === selectedAgent)

  const handleCopyAddress = () => {
    if (selectedAgentData?.walletAddress) {
      navigator.clipboard.writeText(selectedAgentData.walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (fiatAmount < 0.01) {
      setError('Minimum deposit is $0.01')
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
      const paymentId = txHash || `manual_${Date.now()}`

      await createDeposit({
        orgId: orgId as Id<"organizations">,
        fiatAmount,
        chain: 'base',
        walletAddress: agent.walletAddress,
        stripePaymentIntentId: paymentId,
        agentId: selectedAgent as Id<"agents">,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record deposit')
    } finally {
      setLoading(false)
    }
  }

  const presets = [10, 50, 100, 500]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Record Deposit</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Amount (USDC)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0.01"
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
                  {agent.name} ({agent.chain}) — ${agent.balance.toFixed(2)} balance
                </option>
              ))}
            </select>
          </div>

          {selectedAgentData && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Send USDC to this address on Base:
              </p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-foreground flex-1 truncate">
                  {selectedAgentData.walletAddress}
                </code>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Transaction Hash (optional)</label>
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x..."
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Paste the BaseScan tx hash after sending USDC
            </p>
          </div>

          {fiatAmount > 0 && (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{formatUSD(fiatAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform Fee (1.5%)</span>
                <span className="text-muted-foreground">-{formatUSD(fee)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Agent Balance Credit</span>
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
                  Recording...
                </>
              ) : (
                'Record Deposit'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
