'use client'

import { useState } from 'react'
import { useOrgId, useOrg } from '@/lib/hooks'
import { PageLoading } from '@/components/loading'
import { cn } from '@/lib/utils'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import {
  Wallet,
  CreditCard,
  ArrowRightLeft,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Coins,
  Info,
  Zap,
  Settings,
} from 'lucide-react'

const QUICK_AMOUNTS = [5, 10, 25, 50, 100]
const COST_PER_CALL = 0.001
const ON_RAMP_FEE_BPS = 150 // 1.5%

function estimateCalls(amount: number): string {
  const calls = Math.floor(amount / COST_PER_CALL)
  return new Intl.NumberFormat('en-US').format(calls)
}

function calculateFee(amount: number): { fee: number; net: number } {
  const fee = (amount * ON_RAMP_FEE_BPS) / 10000
  return { fee: parseFloat(fee.toFixed(4)), net: parseFloat((amount - fee).toFixed(4)) }
}

export default function FundWalletPage() {
  const orgId = useOrgId()
  const org = useOrg(orgId)
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [showAutoTopUp, setShowAutoTopUp] = useState(false)
  const [autoTopUpThreshold, setAutoTopUpThreshold] = useState('1')
  const [autoTopUpAmount, setAutoTopUpAmount] = useState('25')
  const [autoTopUpMaxMonthly, setAutoTopUpMaxMonthly] = useState('500')
  const [savingAutoTopUp, setSavingAutoTopUp] = useState(false)

  const autoTopUpConfig = useQuery(
    api.deposits.getAutoTopUp,
    orgId ? { orgId } : 'skip'
  )
  const setAutoTopUpMutation = useMutation(api.deposits.setAutoTopUp)

  if (!orgId || !org) return <PageLoading />

  const walletAddress = org.billingWallet ?? ''
  const hasWallet = walletAddress.length > 0
  const activeAmount = selectedAmount ?? (parseFloat(customAmount) || 0)
  const feeBreakdown = activeAmount > 0 ? calculateFee(activeAmount) : null

  const handleQuickAmount = (amount: number) => {
    setSelectedAmount(amount)
    setCustomAmount('')
  }

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value)
    setSelectedAmount(null)
  }

  const handleCopyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    }
  }

  const handleSaveAutoTopUp = async (enabled: boolean) => {
    setSavingAutoTopUp(true)
    try {
      await setAutoTopUpMutation({
        orgId,
        enabled,
        thresholdUSDC: parseFloat(autoTopUpThreshold) || 1,
        topUpAmountUSDC: parseFloat(autoTopUpAmount) || 25,
        maxMonthlyUSD: parseFloat(autoTopUpMaxMonthly) || 500,
        chain: 'base',
      })
    } catch (e) {
      console.error('Failed to save auto top-up:', e)
    }
    setSavingAutoTopUp(false)
  }

  // Coinbase direct buy link — works without session token / CDP keys
  // Users buy USDC on Coinbase, then send to their org wallet
  const coinbaseUrl = 'https://www.coinbase.com/price/usd-coin'

  return (
    <div className="p-8">
      {/* No Wallet Warning */}
      {!hasWallet && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <Info className="mt-0.5 h-5 w-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Wallet not configured</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You need to set a billing wallet address in{' '}
              <a href="/dashboard/settings" className="font-medium text-primary hover:underline">
                Settings
              </a>{' '}
              before you can fund your account.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Fund Wallet</h1>
        <p className="text-muted-foreground">
          Add USDC to your organization wallet to pay for API calls
        </p>
      </div>

      {/* Amount Selector */}
      <div className="mb-8 rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Select Amount</h2>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          {QUICK_AMOUNTS.map((amount) => (
            <button
              key={amount}
              onClick={() => handleQuickAmount(amount)}
              className={cn(
                'rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors',
                selectedAmount === amount
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'hover:bg-accent'
              )}
            >
              ${amount}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
            <input
              type="number"
              value={customAmount}
              onChange={(e) => handleCustomAmountChange(e.target.value)}
              placeholder="Custom amount"
              min="1"
              step="1"
              className="w-full rounded-lg border pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <span className="text-sm text-muted-foreground">USDC</span>
        </div>

        {feeBreakdown && (
          <div className="mt-4 rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="text-foreground font-medium">${activeAmount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Platform fee (1.5%)</span>
              <span className="text-muted-foreground">-${feeBreakdown.fee}</span>
            </div>
            <div className="border-t pt-2 flex items-center justify-between text-sm">
              <span className="text-foreground font-medium">USDC received</span>
              <span className="text-foreground font-semibold">${feeBreakdown.net}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              ~ {estimateCalls(feeBreakdown.net)} API calls at $0.001 avg
            </div>
          </div>
        )}
      </div>

      {/* Funding Methods */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coinbase Onramp */}
        <div className="relative rounded-xl border bg-card p-6 flex flex-col">
          <div className="absolute -top-3 left-4">
            <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
              Recommended
            </span>
          </div>

          <div className="flex items-center gap-3 mb-3 mt-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Coinbase Onramp</h3>
          </div>

          <p className="text-sm text-muted-foreground mb-4 flex-1">
            Buy USDC on Coinbase, then send it to your organization wallet on Base or Solana.
          </p>

          <div className="flex items-center gap-2 mb-4">
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-500">
              Base
            </span>
            <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-500">
              Solana
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500">
              USDC
            </span>
          </div>

          <a
            href={coinbaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Buy USDC on Coinbase
            <ExternalLink className="h-4 w-4" />
          </a>
          {hasWallet && (
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Then send USDC to{' '}
              <button onClick={handleCopyAddress} className="font-mono text-primary hover:underline">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </button>
              {' '}on Base
            </p>
          )}
        </div>

        {/* Direct USDC Transfer */}
        <div className="rounded-xl border bg-card p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Wallet className="h-5 w-5 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold">Direct USDC Transfer</h3>
          </div>

          <p className="text-sm text-muted-foreground mb-4 flex-1">
            Send USDC on Base or Solana directly to your organization wallet
          </p>

          <div className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Wallet Address
              </p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-foreground flex-1 truncate">
                  {walletAddress || 'No wallet configured'}
                </code>
                {walletAddress && (
                  <button
                    onClick={handleCopyAddress}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="Copy address"
                  >
                    {copiedAddress ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-500">
                Base (Mainnet)
              </span>
              <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-500">
                Solana (Mainnet)
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500">
                USDC
              </span>
            </div>
          </div>
        </div>

        {/* Stripe Card Payment */}
        <div className="rounded-xl border bg-card p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              <CreditCard className="h-5 w-5 text-violet-500" />
            </div>
            <h3 className="text-lg font-semibold">Card Payment</h3>
          </div>

          <p className="text-sm text-muted-foreground mb-4 flex-1">
            Pay with credit or debit card via Stripe. Funds are automatically converted to USDC.
          </p>

          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Processing fee</span>
              <span>1.5%</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Settlement</span>
              <span>~2 minutes</span>
            </div>
          </div>

          <a
            href={`/dashboard/deposits?amount=${activeAmount || 25}`}
            className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            Pay with Card
            <ArrowRightLeft className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Auto Top-Up */}
      <div className="mt-8 rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-amber-500" />
            <div>
              <h3 className="text-sm font-semibold">Auto Top-Up</h3>
              <p className="text-xs text-muted-foreground">
                Automatically fund your wallet when balance drops below a threshold
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAutoTopUp(!showAutoTopUp)}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            {showAutoTopUp ? 'Hide' : 'Configure'}
          </button>
        </div>

        {autoTopUpConfig && (
          <div className="flex items-center gap-2 text-sm">
            <span className={cn(
              'inline-flex h-2 w-2 rounded-full',
              autoTopUpConfig.enabled ? 'bg-emerald-500' : 'bg-muted-foreground'
            )} />
            <span className="text-muted-foreground">
              {autoTopUpConfig.enabled
                ? `Active: Top up $${autoTopUpConfig.topUpAmount} when balance < $${autoTopUpConfig.threshold} (max $${autoTopUpConfig.maxMonthly}/mo)`
                : 'Disabled'}
            </span>
          </div>
        )}

        {showAutoTopUp && (
          <div className="mt-4 border-t pt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Low balance threshold ($)
                </label>
                <input
                  type="number"
                  value={autoTopUpThreshold}
                  onChange={(e) => setAutoTopUpThreshold(e.target.value)}
                  min="0.1"
                  step="0.5"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Top-up amount ($)
                </label>
                <input
                  type="number"
                  value={autoTopUpAmount}
                  onChange={(e) => setAutoTopUpAmount(e.target.value)}
                  min="5"
                  step="5"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Monthly cap ($)
                </label>
                <input
                  type="number"
                  value={autoTopUpMaxMonthly}
                  onChange={(e) => setAutoTopUpMaxMonthly(e.target.value)}
                  min="5"
                  step="25"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSaveAutoTopUp(true)}
                disabled={savingAutoTopUp}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {savingAutoTopUp ? 'Saving...' : 'Enable Auto Top-Up'}
              </button>
              {autoTopUpConfig?.enabled && (
                <button
                  onClick={() => handleSaveAutoTopUp(false)}
                  disabled={savingAutoTopUp}
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Disable
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Security Note */}
      <div className="mt-6 rounded-xl border bg-card p-6">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold mb-1">Security Note</h3>
            <p className="text-sm text-muted-foreground">
              Funds are held in USDC on Base and Solana networks. USDC is a regulated stablecoin
              pegged 1:1 to the US Dollar, issued by Circle. Your wallet address is unique to
              your organization ({org.name}). Ensure you send USDC on the correct network.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
