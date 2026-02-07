'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import {
  Search,
  Star,
  Zap,
  Globe,
  ExternalLink,
  BadgeCheck,
  TrendingUp,
  ChevronDown,
  Plus,
  X,
  Loader2,
  Crown,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  Rocket,
  Shield,
  Clock,
  Eye,
} from 'lucide-react'
import { StatCard } from '@/components/stat-card'
import { formatUSD, formatCompact } from '@/lib/utils'
import { useOrgId, useSellers } from '@/lib/hooks'

// Categories for filtering
const categories = [
  'All',
  'AI / ML',
  'Data',
  'Finance',
  'Search',
  'Storage',
  'Compute',
  'Identity',
  'Messaging',
]

// Featured listing pricing tiers
const featuredTiers = [
  {
    name: 'Featured',
    price: 29,
    period: '/mo',
    description: 'Stand out in search results',
    color: 'amber',
    features: [
      'Featured badge on listing',
      'Priority in search results',
      '2x visibility boost',
      '30-day featured placement',
    ],
    boostScore: 50,
    tier: 'featured' as const,
  },
  {
    name: 'Premium',
    price: 79,
    period: '/mo',
    description: 'Maximum visibility & trust',
    color: 'violet',
    popular: true,
    features: [
      'Everything in Featured',
      'Spotlight carousel placement',
      '5x visibility boost',
      'Verified badge included',
      'Analytics insights',
    ],
    boostScore: 90,
    tier: 'premium' as const,
  },
]

// Fallback so page is never empty
const seedTools = [
  {
    _id: 'seed-1',
    name: 'Joke API',
    slug: 'joke-api',
    description: 'Get a random programming joke. First live x402-paid API on Apitoll. $0.001 per call on Base.',
    baseUrl: 'https://seller-api-production.up.railway.app',
    method: 'GET',
    path: '/api/joke',
    price: 0.001,
    currency: 'USDC',
    chains: ['base'],
    category: 'Data',
    tags: ['joke', 'demo', 'x402', 'live'],
    totalCalls: 1,
    avgLatencyMs: 320,
    rating: 5.0,
    ratingCount: 1,
    isVerified: true,
    isFeatured: true,
    listingTier: 'verified' as const,
    boostScore: 50,
    isActive: true,
  },
]

type Tool = {
  _id: string
  name: string
  slug: string
  description: string
  baseUrl: string
  method: string
  path: string
  price: number
  currency: string
  chains: string[]
  category: string
  tags: string[]
  totalCalls: number
  avgLatencyMs: number
  rating: number
  ratingCount: number
  isVerified: boolean
  isFeatured?: boolean
  listingTier?: 'free' | 'featured' | 'verified' | 'premium'
  boostScore?: number
  isActive: boolean
}

// ═══════════════════════════════════════════════════
// Featured Spotlight Carousel
// ═══════════════════════════════════════════════════
function FeaturedSpotlight({ tools }: { tools: Tool[] }) {
  if (tools.length === 0) return null

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-card to-violet-500/5 p-6">
      {/* Decorative glow */}
      <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
            <Crown className="h-4 w-4 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold">Featured APIs</h2>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-500 uppercase tracking-wider">
            Spotlight
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <FeaturedToolCard key={tool._id} tool={tool} />
          ))}
        </div>
      </div>
    </div>
  )
}

function FeaturedToolCard({ tool }: { tool: Tool }) {
  const tierColors = {
    premium: 'from-violet-500/20 to-violet-500/5 border-violet-500/30',
    verified: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
    featured: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
    free: 'from-zinc-500/10 to-zinc-500/5 border-zinc-500/20',
  }
  const tierColor = tierColors[(tool.listingTier as keyof typeof tierColors) ?? 'free']

  return (
    <div className={`group relative rounded-xl border bg-gradient-to-b ${tierColor} p-5 transition-all hover:shadow-lg hover:shadow-amber-500/5`}>
      {/* Tier badge */}
      {(tool.listingTier === 'premium' || tool.listingTier === 'featured') && (
        <div className="absolute -top-2 -right-2">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
            tool.listingTier === 'premium' ? 'bg-violet-500' : 'bg-amber-500'
          } shadow-lg`}>
            {tool.listingTier === 'premium' ? (
              <Sparkles className="h-3 w-3 text-white" />
            ) : (
              <Star className="h-3 w-3 text-white fill-white" />
            )}
          </div>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-foreground truncate">{tool.name}</h3>
            {tool.isVerified && (
              <BadgeCheck className="h-4 w-4 shrink-0 text-blue-500" />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {tool.description}
          </p>
        </div>
      </div>

      {/* Price highlight */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-mono font-bold text-muted-foreground">
            {tool.method}
          </span>
          <span className="text-xs font-mono text-muted-foreground truncate">
            {tool.path}
          </span>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-lg font-bold text-foreground">{formatUSD(tool.price)}</span>
          <span className="text-[10px] text-muted-foreground">/call</span>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {tool.rating.toFixed(1)}
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {formatCompact(tool.totalCalls)} calls
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {tool.avgLatencyMs}ms
        </span>
      </div>

      {/* Chain badges */}
      <div className="mt-3 flex items-center gap-1.5">
        {tool.chains.map((chain) => (
          <span
            key={chain}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              chain === 'base'
                ? 'bg-blue-500/10 text-blue-500'
                : 'bg-purple-500/10 text-purple-500'
            }`}
          >
            {chain}
          </span>
        ))}
        <a
          href={`${tool.baseUrl}${tool.path}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Try it <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// Regular Tool Card
// ═══════════════════════════════════════════════════
function ToolCard({ tool, onFeature }: { tool: Tool; onFeature?: (tool: Tool) => void }) {
  return (
    <div className="group rounded-xl border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{tool.name}</h3>
            {tool.isVerified && (
              <BadgeCheck className="h-4 w-4 text-blue-500" />
            )}
            {tool.isFeatured && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                FEATURED
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
            {tool.description}
          </p>
        </div>
        {onFeature && !tool.isFeatured && (
          <button
            onClick={() => onFeature(tool)}
            className="ml-2 shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1 text-[10px] font-semibold text-amber-500 hover:bg-amber-500/10 transition-colors"
          >
            <Rocket className="inline h-3 w-3 mr-0.5" />
            Boost
          </button>
        )}
      </div>

      {/* Method + Path */}
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-mono font-semibold text-muted-foreground">
          {tool.method}
        </span>
        <span className="text-xs font-mono text-muted-foreground truncate">
          {tool.path}
        </span>
      </div>

      {/* Tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(tool.tags ?? []).slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
          >
            {tag}
          </span>
        ))}
        {tool.chains.map((chain) => (
          <span
            key={chain}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              chain === 'base'
                ? 'bg-blue-500/10 text-blue-500'
                : 'bg-purple-500/10 text-purple-500'
            }`}
          >
            {chain}
          </span>
        ))}
      </div>

      {/* Stats row */}
      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {tool.rating.toFixed(1)} ({tool.ratingCount})
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {formatCompact(tool.totalCalls)} calls
          </span>
          <span>{tool.avgLatencyMs}ms</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {formatUSD(tool.price)}
          </span>
          <span className="text-[10px] text-muted-foreground">/call</span>
        </div>
      </div>

      {/* Base URL link */}
      <div className="mt-3 flex items-center gap-1.5">
        <a
          href={`${tool.baseUrl}${tool.path}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 truncate"
        >
          {tool.baseUrl}
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// Feature My API Modal (Upgrade Flow)
// ═══════════════════════════════════════════════════
function FeatureModal({
  tool,
  onClose,
}: {
  tool: Tool
  onClose: () => void
}) {
  const setFeatured = useMutation(api.tools.setFeatured)
  const [selectedTier, setSelectedTier] = useState<'featured' | 'premium'>('featured')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const tier = featuredTiers.find((t) => t.tier === selectedTier)!
      await setFeatured({
        id: tool._id as any,
        isFeatured: true,
        featuredDurationDays: 30,
        listingTier: selectedTier,
        boostScore: tier.boostScore,
      })
      setSuccess(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-2xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 to-violet-500/20">
            <Sparkles className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold">Your API is Now Featured!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{tool.name}</span> now appears in the
            Featured Spotlight and gets priority in search results for 30 days.
          </p>
          <button
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
      <div className="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Feature Your API</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Boost <span className="font-medium text-foreground">{tool.name}</span> to get more visibility and calls
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tier selection */}
        <div className="grid gap-4 sm:grid-cols-2">
          {featuredTiers.map((tier) => (
            <button
              key={tier.tier}
              onClick={() => setSelectedTier(tier.tier)}
              className={`relative rounded-xl border-2 p-5 text-left transition-all ${
                selectedTier === tier.tier
                  ? tier.tier === 'premium'
                    ? 'border-violet-500 bg-violet-500/5 shadow-lg shadow-violet-500/10'
                    : 'border-amber-500 bg-amber-500/5 shadow-lg shadow-amber-500/10'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-violet-500 px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  Most Popular
                </span>
              )}

              <div className="flex items-center gap-2 mb-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  tier.tier === 'premium' ? 'bg-violet-500/10' : 'bg-amber-500/10'
                }`}>
                  {tier.tier === 'premium' ? (
                    <Sparkles className={`h-4 w-4 ${tier.tier === 'premium' ? 'text-violet-500' : 'text-amber-500'}`} />
                  ) : (
                    <Star className={`h-4 w-4 text-amber-500 fill-amber-500`} />
                  )}
                </div>
                <span className="font-bold text-lg">{tier.name}</span>
              </div>

              <div className="mb-3">
                <span className="text-3xl font-bold">${tier.price}</span>
                <span className="text-sm text-muted-foreground">{tier.period}</span>
              </div>

              <p className="text-sm text-muted-foreground mb-4">{tier.description}</p>

              <ul className="space-y-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className={`h-3.5 w-3.5 shrink-0 ${
                      tier.tier === 'premium' ? 'text-violet-500' : 'text-amber-500'
                    }`} />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {/* Benefits */}
        <div className="mt-6 rounded-xl bg-muted/50 p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <Eye className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
              <p className="text-sm font-semibold">{selectedTier === 'premium' ? '5x' : '2x'}</p>
              <p className="text-[10px] text-muted-foreground">More Views</p>
            </div>
            <div>
              <TrendingUp className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
              <p className="text-sm font-semibold">Top Results</p>
              <p className="text-[10px] text-muted-foreground">Priority Ranking</p>
            </div>
            <div>
              <Shield className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
              <p className="text-sm font-semibold">30 Days</p>
              <p className="text-[10px] text-muted-foreground">Featured Period</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border px-4 py-3 text-sm font-medium hover:bg-accent transition-colors"
          >
            Maybe Later
          </button>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition-all ${
              selectedTier === 'premium'
                ? 'bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 shadow-lg shadow-violet-500/20'
                : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-500/20'
            } disabled:opacity-50`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                Upgrade for ${featuredTiers.find(t => t.tier === selectedTier)?.price}/mo
              </>
            )}
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Featured status activates instantly. Cancel anytime.
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// Add Tool Modal
// ═══════════════════════════════════════════════════
function AddToolModal({ onClose }: { onClose: () => void }) {
  const createTool = useMutation(api.tools.create)
  const orgId = useOrgId()
  const sellers = useSellers(orgId)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [method, setMethod] = useState('GET')
  const [path, setPath] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('Data')
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleNameChange = (val: string) => {
    setName(val)
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !description || !baseUrl || !path || !price) {
      setError('All fields are required')
      return
    }

    setLoading(true)
    setError('')
    try {
      await createTool({
        name,
        slug,
        description,
        baseUrl,
        method,
        path,
        price: parseFloat(price),
        chains: ['base'],
        category,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      })
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to list tool')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-2xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <BadgeCheck className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold">API Listed!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your API is now in the discovery directory. Agents can find and pay for it.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">List Your API</h2>
            <p className="text-sm text-muted-foreground">
              Add your x402-enabled endpoint to the marketplace
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">API Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Weather API"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="weather-api"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does your API do? Be specific — agents read this to decide if they should use your API."
              rows={3}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>DELETE</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Base URL</label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Path</label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/v1/endpoint"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Price per call (USDC)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.001"
                step="0.0001"
                min="0.0001"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {categories.filter(c => c !== 'All').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Tags (comma-separated)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="api, data, live"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Listing...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  List API
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// Main Discovery Page
// ═══════════════════════════════════════════════════
export default function DiscoveryPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'price_low' | 'price_high'>('popular')
  const [showAddTool, setShowAddTool] = useState(false)
  const [featureTool, setFeatureTool] = useState<Tool | null>(null)
  const orgId = useOrgId()

  // Query Convex for real tools
  const convexTools = useQuery(api.tools.search, {
    query: search || undefined,
    category: selectedCategory !== 'All' ? selectedCategory : undefined,
    limit: 50,
  })

  // Query featured tools separately
  const convexFeatured = useQuery(api.tools.getFeatured, { limit: 6 })

  // Use Convex tools if available, otherwise seed tools
  const tools: Tool[] = (convexTools && convexTools.length > 0
    ? convexTools
    : seedTools) as Tool[]

  const featuredTools: Tool[] = (convexFeatured && convexFeatured.length > 0
    ? convexFeatured
    : tools.filter((t) => t.isFeatured)) as Tool[]

  const filtered = tools
    .filter((t) => {
      if (selectedCategory !== 'All' && t.category !== selectedCategory) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.tags ?? []).some((tag: string) => tag.includes(q))
        )
      }
      return true
    })
    .sort((a, b) => {
      // Featured always first
      const aFeatured = a.isFeatured ? 1 : 0
      const bFeatured = b.isFeatured ? 1 : 0
      if (aFeatured !== bFeatured) return bFeatured - aFeatured

      switch (sortBy) {
        case 'rating': return b.rating - a.rating
        case 'price_low': return a.price - b.price
        case 'price_high': return b.price - a.price
        default: return b.totalCalls - a.totalCalls
      }
    })

  const totalCalls = tools.reduce((sum, t) => sum + t.totalCalls, 0)
  const avgRating = tools.length > 0
    ? tools.reduce((sum, t) => sum + t.rating, 0) / tools.length
    : 0

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Discovery</h1>
          <p className="text-sm text-muted-foreground">
            Browse and connect to paid APIs. Every endpoint accepts x402 micropayments.
          </p>
        </div>
        <button
          onClick={() => setShowAddTool(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          List Your API
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total APIs" value={String(tools.length)} icon={Globe} />
        <StatCard title="Total Calls" value={formatCompact(totalCalls)} icon={Zap} />
        <StatCard title="Avg Rating" value={avgRating.toFixed(1)} icon={Star} />
        <StatCard title="Featured" value={String(featuredTools.length)} icon={Crown} />
      </div>

      {/* Featured Spotlight */}
      <FeaturedSpotlight tools={featuredTools} />

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search APIs, tools, or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="appearance-none rounded-xl border bg-background px-4 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
              selectedCategory === cat
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* All APIs heading */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">All APIs</h2>
        <span className="text-sm text-muted-foreground">{filtered.length} results</span>
      </div>

      {/* Tool Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((tool) => (
          <ToolCard
            key={tool._id}
            tool={tool}
            onFeature={(t) => setFeatureTool(t)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border bg-card py-16 text-center">
          <Search className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">
            No APIs found matching your search
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Try different keywords or browse all categories
          </p>
        </div>
      )}

      {/* Promote Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-card to-violet-500/5 p-6">
        <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Get More Visibility for Your API</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Featured APIs get up to 5x more views and appear in the Spotlight carousel.
            </p>
          </div>
          <button
            onClick={() => {
              const firstNonFeatured = tools.find(t => !t.isFeatured)
              if (firstNonFeatured) setFeatureTool(firstNonFeatured)
            }}
            className="shrink-0 flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20"
          >
            <Crown className="h-4 w-4" />
            Boost Your API
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modals */}
      {showAddTool && <AddToolModal onClose={() => setShowAddTool(false)} />}
      {featureTool && <FeatureModal tool={featureTool} onClose={() => setFeatureTool(null)} />}
    </div>
  )
}
