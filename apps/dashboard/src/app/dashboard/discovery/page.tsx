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

// Fallback data so the page is never empty (used while Convex loads / if no tools exist)
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
    isActive: true,
  },
]

type Tool = typeof seedTools[0]

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <div className="group rounded-xl border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
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

export default function DiscoveryPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'price_low' | 'price_high'>('popular')
  const [showAddTool, setShowAddTool] = useState(false)
  const orgId = useOrgId()

  // Query Convex for real tools
  const convexTools = useQuery(api.tools.search, {
    query: search || undefined,
    category: selectedCategory !== 'All' ? selectedCategory : undefined,
    limit: 50,
  })

  // Use Convex tools if available, otherwise seed tools
  const tools: Tool[] = (convexTools && convexTools.length > 0
    ? convexTools
    : seedTools) as Tool[]

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
      switch (sortBy) {
        case 'rating': return b.rating - a.rating
        case 'price_low': return a.price - b.price
        case 'price_high': return b.price - a.price
        default: return b.totalCalls - a.totalCalls
      }
    })

  const featured = tools.filter((t) => t.isFeatured)
  const totalCalls = tools.reduce((sum, t) => sum + t.totalCalls, 0)
  const avgRating = tools.length > 0
    ? tools.reduce((sum, t) => sum + t.rating, 0) / tools.length
    : 0

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Discovery</h1>
          <p className="text-sm text-muted-foreground">
            Browse and connect to paid APIs. Every endpoint accepts x402 micropayments.
          </p>
        </div>
        <button
          onClick={() => setShowAddTool(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
        <StatCard title="Featured" value={String(featured.length)} icon={TrendingUp} />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search APIs, tools, or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="appearance-none rounded-lg border bg-background px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="price_low">Price: Low → High</option>
            <option value="price_high">Price: High → Low</option>
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
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tool Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((tool) => (
          <ToolCard key={tool._id} tool={tool} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border bg-card py-16 text-center">
          <Search className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No APIs found matching your search
          </p>
        </div>
      )}

      {/* Add Tool Modal */}
      {showAddTool && (
        <AddToolModal onClose={() => setShowAddTool(false)} />
      )}
    </div>
  )
}

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

  // Auto-generate slug from name
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <BadgeCheck className="h-6 w-6 text-emerald-500" />
          </div>
          <h2 className="text-lg font-semibold">API Listed!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your API is now in the discovery directory. Agents can find and pay for it.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">List Your API</h2>
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
              placeholder="What does your API do?"
              rows={2}
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
                  Listing...
                </>
              ) : (
                'List API'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
