'use client'

import { useState } from 'react'
import {
  Search,
  Filter,
  Star,
  Zap,
  Globe,
  ExternalLink,
  BadgeCheck,
  TrendingUp,
  ChevronDown,
} from 'lucide-react'
import { StatCard } from '@/components/stat-card'
import { formatUSD, formatCompact } from '@/lib/utils'

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

// Mock tools data — will be replaced by Convex query on `tools` table
const mockTools = [
  {
    _id: 't1',
    name: 'GPT-4o Proxy',
    slug: 'gpt-4o-proxy',
    description: 'Pay-per-token access to GPT-4o with no API key required. Agents pay per request via x402.',
    baseUrl: 'https://api.llmproxy.ai',
    method: 'POST',
    path: '/v1/chat/completions',
    price: 0.003,
    currency: 'USDC',
    chains: ['base', 'solana'],
    category: 'AI / ML',
    tags: ['llm', 'openai', 'chat'],
    totalCalls: 284500,
    avgLatencyMs: 1240,
    rating: 4.8,
    ratingCount: 312,
    isVerified: true,
    isFeatured: true,
    listingTier: 'premium' as const,
  },
  {
    _id: 't2',
    name: 'Web Search API',
    slug: 'web-search-api',
    description: 'Real-time web search results with snippets. Perfect for RAG pipelines and research agents.',
    baseUrl: 'https://search.apitoll.com',
    method: 'GET',
    path: '/v1/search',
    price: 0.001,
    currency: 'USDC',
    chains: ['base'],
    category: 'Search',
    tags: ['search', 'web', 'rag'],
    totalCalls: 156200,
    avgLatencyMs: 420,
    rating: 4.6,
    ratingCount: 187,
    isVerified: true,
    isFeatured: false,
    listingTier: 'verified' as const,
  },
  {
    _id: 't3',
    name: 'Image Generation',
    slug: 'image-gen',
    description: 'Generate images from text prompts using Stable Diffusion XL. Returns image URLs.',
    baseUrl: 'https://img.toolpay.ai',
    method: 'POST',
    path: '/v1/generate',
    price: 0.005,
    currency: 'USDC',
    chains: ['base', 'solana'],
    category: 'AI / ML',
    tags: ['image', 'generation', 'sdxl'],
    totalCalls: 89400,
    avgLatencyMs: 3200,
    rating: 4.4,
    ratingCount: 94,
    isVerified: false,
    isFeatured: false,
    listingTier: 'free' as const,
  },
  {
    _id: 't4',
    name: 'Price Oracle',
    slug: 'price-oracle',
    description: 'Real-time crypto and forex price feeds. 500+ pairs with <100ms latency.',
    baseUrl: 'https://oracle.defitools.xyz',
    method: 'GET',
    path: '/v1/prices',
    price: 0.0005,
    currency: 'USDC',
    chains: ['base', 'solana'],
    category: 'Finance',
    tags: ['price', 'oracle', 'defi'],
    totalCalls: 1240000,
    avgLatencyMs: 85,
    rating: 4.9,
    ratingCount: 528,
    isVerified: true,
    isFeatured: true,
    listingTier: 'premium' as const,
  },
  {
    _id: 't5',
    name: 'S3-Compatible Storage',
    slug: 's3-storage',
    description: 'Pay-per-request object storage. Upload, download, and list objects. No account needed.',
    baseUrl: 'https://store.agentcloud.io',
    method: 'PUT',
    path: '/v1/objects/:key',
    price: 0.0001,
    currency: 'USDC',
    chains: ['base'],
    category: 'Storage',
    tags: ['storage', 's3', 'objects'],
    totalCalls: 432000,
    avgLatencyMs: 210,
    rating: 4.5,
    ratingCount: 201,
    isVerified: true,
    isFeatured: false,
    listingTier: 'verified' as const,
  },
  {
    _id: 't6',
    name: 'Code Execution Sandbox',
    slug: 'code-sandbox',
    description: 'Execute Python, JavaScript, or Rust code in isolated sandboxes. Returns stdout/stderr.',
    baseUrl: 'https://exec.computemarket.ai',
    method: 'POST',
    path: '/v1/run',
    price: 0.002,
    currency: 'USDC',
    chains: ['base', 'solana'],
    category: 'Compute',
    tags: ['code', 'execution', 'sandbox'],
    totalCalls: 67800,
    avgLatencyMs: 890,
    rating: 4.3,
    ratingCount: 76,
    isVerified: false,
    isFeatured: false,
    listingTier: 'free' as const,
  },
  {
    _id: 't7',
    name: 'Email Verification',
    slug: 'email-verify',
    description: 'Verify email addresses in real-time. Check deliverability, MX records, and disposable detection.',
    baseUrl: 'https://verify.emailtools.ai',
    method: 'GET',
    path: '/v1/verify',
    price: 0.0008,
    currency: 'USDC',
    chains: ['base'],
    category: 'Identity',
    tags: ['email', 'verification', 'identity'],
    totalCalls: 198000,
    avgLatencyMs: 340,
    rating: 4.7,
    ratingCount: 143,
    isVerified: true,
    isFeatured: false,
    listingTier: 'verified' as const,
  },
  {
    _id: 't8',
    name: 'Sentiment Analysis',
    slug: 'sentiment',
    description: 'Analyze text sentiment with confidence scores. Supports 50+ languages.',
    baseUrl: 'https://nlp.agenttools.com',
    method: 'POST',
    path: '/v1/sentiment',
    price: 0.001,
    currency: 'USDC',
    chains: ['solana'],
    category: 'AI / ML',
    tags: ['nlp', 'sentiment', 'analysis'],
    totalCalls: 112000,
    avgLatencyMs: 180,
    rating: 4.5,
    ratingCount: 98,
    isVerified: false,
    isFeatured: false,
    listingTier: 'free' as const,
  },
]

function ToolCard({ tool }: { tool: typeof mockTools[0] }) {
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
        {tool.tags.slice(0, 3).map((tag) => (
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
            {tool.rating} ({tool.ratingCount})
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
    </div>
  )
}

export default function DiscoveryPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'price_low' | 'price_high' | 'newest'>('popular')

  const filtered = mockTools
    .filter((t) => {
      if (selectedCategory !== 'All' && t.category !== selectedCategory) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q))
        )
      }
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'rating': return b.rating - a.rating
        case 'price_low': return a.price - b.price
        case 'price_high': return b.price - a.price
        case 'newest': return 0
        default: return b.totalCalls - a.totalCalls
      }
    })

  const featured = mockTools.filter((t) => t.isFeatured)
  const totalCalls = mockTools.reduce((sum, t) => sum + t.totalCalls, 0)
  const avgRating = mockTools.reduce((sum, t) => sum + t.rating, 0) / mockTools.length

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Discovery</h1>
        <p className="text-sm text-muted-foreground">
          Browse and connect to paid APIs. Every endpoint accepts x402 micropayments.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total APIs" value={String(mockTools.length)} icon={Globe} />
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
    </div>
  )
}
