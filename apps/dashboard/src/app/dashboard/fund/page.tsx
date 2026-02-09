'use client'

import { useState } from 'react'
import { useOrgId, useOrg } from '@/lib/hooks'
import { PageLoading } from '@/components/loading'
import { cn } from '@/lib/utils'
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
} from 'lucide-react'

const QUICK_AMOUNTS = [5, 10, 25, 50, 100]
const COST_PER_CALL = 0.001

function estimateCalls(amount: number): string {
  const calls = Math.floor(amount / COST_PER_CALL)
  return new Intl.NumberFormat('en-US').format(calls)
}

export default function FundWalletPage() {
  const orgId = useOrgId()
  const org = useOrg(orgId)
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [copiedAddress, setCopiedAddress] = useState(false)

  if (!orgId || !org) return <PageLoading />

  const walletAddress = org.billingWallet ?? ''
  const hasWallet = walletAddress.length > 0
  const activeAmount = selectedAmount ?? (parseFloat(customAmount) || 0)

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

  const coinbaseUrl = hasWallet
    ? `https://pay.coinbase.com/buy/select-asset?appId=apitoll&addresses=${encodeURIComponent(JSON.stringify({ [walletAddress]: ['base'] }))}&assets=${encodeURIComponent(JSON.stringify(['USDC']))}`
    : ''

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
              before you can fund your account. This is the Base address where your USDC will be held.
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

        {activeAmount > 0 && (
          <div className="mt-4 rounded-lg bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">
                ${activeAmount.toLocaleString()} USDC{' '}
                <span className="text-foreground font-medium">
                  ~ {estimateCalls(activeAmount)} API calls
                </span>{' '}
                at $0.001 avg per call
              </span>
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

          <p className="text-sm text-muted-foreground mb-6 flex-1">
            Fund with credit card, debit card, or bank transfer via Coinbase
          </p>

          {hasWallet ? (
            <button
              onClick={() => window.open(coinbaseUrl, '_blank')}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Buy USDC
              <ExternalLink className="h-4 w-4" />
            </button>
          ) : (
            <a
              href="/dashboard/settings"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              Set wallet in Settings first
            </a>
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
            Send USDC on Base directly to your organization wallet
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
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500">
                USDC
              </span>
            </div>
          </div>
        </div>

        {/* Bridge from Other Chains */}
        <div className="relative rounded-xl border bg-card p-6 flex flex-col opacity-60">
          <div className="absolute -top-3 right-4">
            <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">
              Coming Soon
            </span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-muted-foreground">
              Bridge from Other Chains
            </h3>
          </div>

          <p className="text-sm text-muted-foreground mb-6 flex-1">
            Bridge USDC from Ethereum, Polygon, or Arbitrum
          </p>

          <button
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-muted-foreground cursor-not-allowed"
          >
            Coming Soon
          </button>
        </div>
      </div>

      {/* Security Note */}
      <div className="mt-8 rounded-xl border bg-card p-6">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold mb-1">Security Note</h3>
            <p className="text-sm text-muted-foreground">
              All funds are held in USDC on the Base network. USDC is a regulated stablecoin
              pegged 1:1 to the US Dollar, issued by Circle. Your wallet address is unique to
              your organization ({org.name}). Only send USDC on the Base network to this
              address — sending other tokens or using other networks may result in permanent
              loss of funds.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
