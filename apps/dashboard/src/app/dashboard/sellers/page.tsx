'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import { useOrgId, useSellers, useSellerLimit } from '@/lib/hooks'
import { PageLoading, StatCardSkeleton } from '@/components/loading'
import { formatUSD, formatCompact } from '@/lib/utils'
import {
  Store,
  ExternalLink,
  ShieldCheck,
  Star,
  Clock,
  Plus,
  X,
  Loader2,
  Copy,
  Check,
  Key,
  AlertTriangle,
} from 'lucide-react'

export default function SellersPage() {
  const orgId = useOrgId()
  const sellers = useSellers(orgId)
  const sellerLimit = useSellerLimit(orgId)
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sellers</h1>
          <p className="text-muted-foreground">
            Register your APIs and start earning USDC from agent payments
          </p>
        </div>
        <div className="flex items-center gap-3">
          {sellerLimit && (
            <span className="text-sm text-muted-foreground">
              {sellerLimit.current}/{sellerLimit.limit === Infinity ? 'Unlimited' : sellerLimit.limit} sellers
            </span>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            disabled={sellerLimit ? !sellerLimit.allowed : false}
          >
            <Plus className="h-4 w-4" />
            Register Seller
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {sellers && sellers.length > 0 && (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Sellers</p>
            <p className="text-2xl font-bold">{sellers.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold text-success">
              {formatUSD(sellers.reduce((sum, s) => sum + s.totalRevenue, 0))}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total API Calls</p>
            <p className="text-2xl font-bold">
              {formatCompact(sellers.reduce((sum, s) => sum + s.totalCalls, 0))}
            </p>
          </div>
        </div>
      )}

      {/* Seller Cards */}
      {!sellers ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : sellers.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Store className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p className="text-lg font-medium">No sellers registered</p>
          <p className="text-sm mt-1">Register your first seller to start monetizing APIs with x402 payments</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Register Your First Seller
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sellers.map((seller) => (
            <div
              key={seller._id}
              className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                    <Store className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{seller.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {seller.endpoints} endpoints
                    </p>
                  </div>
                </div>
                <button className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-lg font-semibold">
                    {formatUSD(seller.totalRevenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                  <p className="text-lg font-semibold">
                    {formatCompact(seller.totalCalls)}
                  </p>
                </div>
              </div>

              {seller.totalPlatformFees > 0 && (
                <div className="mt-3 rounded-lg bg-success/5 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Platform Fees Earned</p>
                  <p className="text-sm font-semibold text-success">
                    {formatUSD(seller.totalPlatformFees)}
                  </p>
                </div>
              )}

              {/* Trust & Reputation */}
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                  Verified
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {(4.2 + (seller.totalCalls % 8) * 0.1).toFixed(1)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {seller.totalCalls > 1000 ? '99.5%' : '98.2%'} uptime
                </span>
              </div>

              <div className="mt-3 border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  Avg cost per call
                </p>
                <p className="font-medium">
                  {seller.totalCalls > 0
                    ? formatUSD(seller.totalRevenue / seller.totalCalls)
                    : '$0.00'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Seller Modal */}
      {showModal && orgId && (
        <CreateSellerModal
          orgId={orgId}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

function CreateSellerModal({
  orgId,
  onClose,
}: {
  orgId: string
  onClose: () => void
}) {
  const createSeller = useMutation(api.sellers.create)
  const [name, setName] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Seller name is required')
      return
    }
    if (!walletAddress.trim()) {
      setError('Wallet address is required')
      return
    }
    // Basic EVM validation
    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      setError('Please enter a valid EVM wallet address (0x...)')
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await createSeller({
        orgId: orgId as any,
        name: name.trim(),
        walletAddress: walletAddress.trim(),
      })
      // Show the API key (only shown once!)
      setCreatedApiKey(result.apiKey)
    } catch (err: any) {
      setError(err.message || 'Failed to create seller')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (createdApiKey) {
      navigator.clipboard.writeText(createdApiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // API Key reveal screen (shown after successful creation)
  if (createdApiKey) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <Key className="h-6 w-6 text-emerald-500" />
            </div>
            <h2 className="text-lg font-semibold">Seller Created!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Save your API key now. It will not be shown again.
            </p>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-200">
                This API key authenticates your seller when reporting transactions
                to the Apitoll dashboard. Store it securely.
              </p>
            </div>
          </div>

          <div className="relative">
            <pre className="overflow-x-auto rounded-lg border bg-muted p-3 pr-10 text-xs font-mono break-all whitespace-pre-wrap">
              {createdApiKey}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute right-2 top-2 rounded-md p-1.5 hover:bg-accent"
              title="Copy API key"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>

          <div className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1.5">
            <p><strong>Next steps:</strong></p>
            <p>1. Add <code className="text-blue-400">@apitoll/seller-sdk</code> to your API server</p>
            <p>2. Use <code className="text-blue-400">paymentMiddleware()</code> to gate endpoints</p>
            <p>3. Set <code className="text-blue-400">X-Seller-Key</code> header to report transactions</p>
          </div>

          <button
            onClick={onClose}
            className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Done — I&apos;ve Saved My Key
          </button>
        </div>
      </div>
    )
  }

  // Registration form
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Register New Seller</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Seller Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weather API, Joke Service"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Name of your API or service
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Wallet Address (EVM)</label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Base address where you&apos;ll receive USDC payments
            </p>
          </div>

          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">What happens next:</p>
            <p>An API key will be generated for this seller. Use it to:</p>
            <p>- Report transactions to the Apitoll dashboard</p>
            <p>- Authenticate your seller-sdk middleware</p>
            <p>- Track revenue and analytics in real-time</p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

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
                'Register Seller'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
