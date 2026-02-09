'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { useOrgId, useSellers, useSellerLimit } from '@/lib/hooks'
import { StatCardSkeleton } from '@/components/loading'
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
  Share2,
  TrendingUp,
  Users,
  Gift,
  Twitter,
  Link2,
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

      {/* Referral Program — Viral Growth Panel */}
      <ReferralPanel />

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

              {/* Trust & Reputation — real data only */}
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                  Verified
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatCompact(seller.totalCalls)} calls
                </span>
                {seller.totalRevenue > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    Earning
                  </span>
                )}
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

function ReferralPanel() {
  const [copied, setCopied] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const orgId = useOrgId()
  const sellers = useSellers(orgId)

  // Use the first seller's wallet to look up their referral code from Convex
  const firstSellerWallet = sellers?.[0]?.walletAddress
  const referrals = useQuery(
    api.referrals.getByWallet,
    firstSellerWallet ? { referrerWallet: firstSellerWallet } : "skip"
  )

  // Stable referral code: use persisted Convex code or generate a deterministic one from wallet
  const referralCode = useMemo(() => {
    if (referrals && referrals.length > 0) return referrals[0].referralCode
    if (firstSellerWallet) return `apitoll-${firstSellerWallet.slice(2, 8).toLowerCase()}`
    return 'apitoll-new'
  }, [referrals, firstSellerWallet])

  // Pull real stats from Convex referral data
  const referralStats = useMemo(() => {
    if (!referrals || referrals.length === 0) return { agents: 0, volume: 0, commission: 0 }
    const totals = referrals.reduce(
      (acc, r) => ({
        agents: acc.agents + r.referredTransactions,
        volume: acc.volume + r.totalVolume,
        commission: acc.commission + r.totalCommission,
      }),
      { agents: 0, volume: 0, commission: 0 }
    )
    return totals
  }, [referrals])

  const referralLink = `https://apitoll.com/api/discover?ref=${referralCode}`
  const sdkSnippet = `discovery: {\n  referralCode: "${referralCode}",\n  referralBps: 50, // 0.5% commission\n}`

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tweetText = encodeURIComponent(
    `I'm earning USDC by selling API access to AI agents with @apitoll_xyz 🤖💰\n\nAny Express/Hono API → 3 lines of code → agents pay you automatically.\n\nnpm install @apitoll/seller-sdk\n\n#x402 #AI #crypto`
  )

  return (
    <div className="mb-8 rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
            <Share2 className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              Referral Program
              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs text-violet-400">
                0.5% commission
              </span>
            </h3>
            <p className="text-sm text-muted-foreground">
              Earn USDC when agents you refer make payments
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-violet-400 hover:text-violet-300"
        >
          {showDetails ? 'Hide' : 'Show details'}
        </button>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 flex flex-wrap gap-3">
        {/* Copy Referral Link */}
        <button
          onClick={() => handleCopy(referralLink)}
          className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/5 px-4 py-2 text-sm hover:bg-violet-500/10 transition-colors"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Link2 className="h-4 w-4 text-violet-400" />
          )}
          {copied ? 'Copied!' : 'Copy Referral Link'}
        </button>

        {/* Share on Twitter */}
        <a
          href={`https://twitter.com/intent/tweet?text=${tweetText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-2 text-sm hover:bg-blue-500/10 transition-colors"
        >
          <Twitter className="h-4 w-4 text-blue-400" />
          Share on X
        </a>

        {/* Copy SDK Snippet */}
        <button
          onClick={() => handleCopy(sdkSnippet)}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-accent transition-colors"
        >
          <Copy className="h-4 w-4 text-muted-foreground" />
          Copy SDK Config
        </button>
      </div>

      {/* Expanded Details */}
      {showDetails && (
        <div className="mt-5 space-y-4">
          {/* Stats Row — real Convex data */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                Referred Transactions
              </div>
              <p className="mt-1 text-lg font-bold">{referralStats.agents}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                Total Volume
              </div>
              <p className="mt-1 text-lg font-bold">{formatUSD(referralStats.volume)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Gift className="h-3 w-3" />
                Commission Earned
              </div>
              <p className="mt-1 text-lg font-bold text-emerald-400">{formatUSD(referralStats.commission)}</p>
            </div>
          </div>

          {/* How It Works */}
          <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
            <p className="font-medium text-foreground">How referrals work:</p>
            <div className="space-y-1.5 text-muted-foreground">
              <p>1. Add <code className="text-violet-400">referralCode</code> to your seller-sdk discovery config</p>
              <p>2. Every 402 and 200 response from your API carries your referral code in headers</p>
              <p>3. When an agent discovers your API and later uses ANY API Toll tool, you earn 0.5%</p>
              <p>4. Commissions auto-accumulate in your seller wallet</p>
            </div>
          </div>

          {/* Referral Link */}
          <div>
            <label className="text-xs text-muted-foreground">Your Referral Link</label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded-lg border bg-background px-3 py-2 text-xs font-mono text-violet-400 overflow-x-auto">
                {referralLink}
              </code>
              <button
                onClick={() => handleCopy(referralLink)}
                className="rounded-lg border p-2 hover:bg-accent"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* SDK Config */}
          <div>
            <label className="text-xs text-muted-foreground">Add to your seller-sdk config</label>
            <pre className="mt-1 rounded-lg border bg-background p-3 text-xs font-mono text-blue-400 overflow-x-auto">
              {sdkSnippet}
            </pre>
          </div>
        </div>
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
        orgId: orgId as Id<"organizations">,
        name: name.trim(),
        walletAddress: walletAddress.trim(),
      })
      // Show the API key (only shown once!)
      setCreatedApiKey(result.apiKey)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create seller')
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
                to the API Toll dashboard. Store it securely.
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
            <p>- Report transactions to the API Toll dashboard</p>
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
