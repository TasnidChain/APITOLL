'use client'

import { useState } from 'react'
import {
  Trophy,
  Medal,
  TrendingUp,
  Flame,
  Crown,
  Star,
  ArrowUp,
  ArrowDown,
  Minus,
  Zap,
  DollarSign,
  Users,
} from 'lucide-react'
import { StatCard } from '@/components/stat-card'
import { formatUSD, formatCompact, shortenAddress } from '@/lib/utils'

type TimeRange = '24h' | '7d' | '30d' | 'all'
type Tab = 'sellers' | 'agents' | 'tools'

const mockSellerLeaderboard = [
  { rank: 1, name: 'LLM Proxy Inc', wallet: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12', revenue: 48200, calls: 284500, avgRating: 4.8, change: 'up' as const, streak: 12 },
  { rank: 2, name: 'DeFi Oracles', wallet: '0x2b3c4d5e6f7890abcdef1234567890abcdef1234', revenue: 31400, calls: 1240000, avgRating: 4.9, change: 'up' as const, streak: 8 },
  { rank: 3, name: 'SearchAPI.io', wallet: '0x3c4d5e6f7890abcdef1234567890abcdef123456', revenue: 22100, calls: 156200, avgRating: 4.6, change: 'same' as const, streak: 5 },
  { rank: 4, name: 'AgentCloud Storage', wallet: '0x4d5e6f7890abcdef1234567890abcdef12345678', revenue: 18700, calls: 432000, avgRating: 4.5, change: 'down' as const, streak: 3 },
  { rank: 5, name: 'ComputeMarket', wallet: '0x5e6f7890abcdef1234567890abcdef1234567890', revenue: 14300, calls: 67800, avgRating: 4.3, change: 'up' as const, streak: 2 },
  { rank: 6, name: 'EmailTools AI', wallet: '0x6f7890abcdef1234567890abcdef123456789012', revenue: 11800, calls: 198000, avgRating: 4.7, change: 'same' as const, streak: 7 },
  { rank: 7, name: 'NLP Services', wallet: '0x7890abcdef1234567890abcdef12345678901234', revenue: 9200, calls: 112000, avgRating: 4.5, change: 'up' as const, streak: 1 },
  { rank: 8, name: 'ImageGen Pro', wallet: '0x890abcdef1234567890abcdef1234567890123456', revenue: 7600, calls: 89400, avgRating: 4.4, change: 'down' as const, streak: 0 },
]

const mockAgentLeaderboard = [
  { rank: 1, name: 'Research-Bot-Alpha', wallet: '0xaaaa1234567890abcdef1234567890abcdef1234', spend: 12400, transactions: 18200, successRate: 99.2, change: 'up' as const },
  { rank: 2, name: 'Trading-Agent-v3', wallet: '0xbbbb1234567890abcdef1234567890abcdef1234', spend: 9800, transactions: 42100, successRate: 98.8, change: 'up' as const },
  { rank: 3, name: 'Data-Crawler-Pro', wallet: '0xcccc1234567890abcdef1234567890abcdef1234', spend: 7200, transactions: 31500, successRate: 97.5, change: 'same' as const },
  { rank: 4, name: 'ContentGen-v2', wallet: '0xdddd1234567890abcdef1234567890abcdef1234', spend: 5100, transactions: 8900, successRate: 99.1, change: 'down' as const },
  { rank: 5, name: 'Monitor-Sentinel', wallet: '0xeeee1234567890abcdef1234567890abcdef1234', spend: 3800, transactions: 156000, successRate: 99.8, change: 'up' as const },
]

const mockToolLeaderboard = [
  { rank: 1, name: 'Price Oracle', calls: 1240000, revenue: 620, rating: 4.9, category: 'Finance', change: 'up' as const },
  { rank: 2, name: 'S3-Compatible Storage', calls: 432000, revenue: 43.2, rating: 4.5, category: 'Storage', change: 'same' as const },
  { rank: 3, name: 'GPT-4o Proxy', calls: 284500, revenue: 853.5, rating: 4.8, category: 'AI / ML', change: 'up' as const },
  { rank: 4, name: 'Email Verification', calls: 198000, revenue: 158.4, rating: 4.7, category: 'Identity', change: 'up' as const },
  { rank: 5, name: 'Web Search API', calls: 156200, revenue: 156.2, rating: 4.6, category: 'Search', change: 'down' as const },
]

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-amber-400" />
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />
  return <span className="text-sm font-mono text-muted-foreground">#{rank}</span>
}

function ChangeIndicator({ change }: { change: 'up' | 'down' | 'same' }) {
  if (change === 'up') return <ArrowUp className="h-3.5 w-3.5 text-emerald-500" />
  if (change === 'down') return <ArrowDown className="h-3.5 w-3.5 text-red-400" />
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('sellers')
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')

  const totalRevenue = mockSellerLeaderboard.reduce((s, x) => s + x.revenue, 0)
  const totalCalls = mockSellerLeaderboard.reduce((s, x) => s + x.calls, 0)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          Top performers on the Apitoll network. Rankings update in real-time.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total Sellers" value={String(mockSellerLeaderboard.length)} icon={Users} />
        <StatCard title="Network Revenue" value={formatUSD(totalRevenue)} icon={DollarSign} />
        <StatCard title="Total API Calls" value={formatCompact(totalCalls)} icon={Zap} />
        <StatCard title="Top Streak" value="12 days" icon={Flame} />
      </div>

      {/* Tabs + Time Range */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(['sellers', 'agents', 'tools'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(['24h', '7d', '30d', 'all'] as TimeRange[]).map((t) => (
            <button
              key={t}
              onClick={() => setTimeRange(t)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                timeRange === t
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Sellers Tab */}
      {tab === 'sellers' && (
        <div className="rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Rank</th>
                  <th className="px-4 py-3 text-left font-medium">Seller</th>
                  <th className="px-4 py-3 text-right font-medium">Revenue</th>
                  <th className="px-4 py-3 text-right font-medium">API Calls</th>
                  <th className="px-4 py-3 text-right font-medium">Rating</th>
                  <th className="px-4 py-3 text-right font-medium">Streak</th>
                  <th className="px-4 py-3 text-center font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {mockSellerLeaderboard.map((seller) => (
                  <tr key={seller.rank} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <RankBadge rank={seller.rank} />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{seller.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {shortenAddress(seller.wallet)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatUSD(seller.revenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatCompact(seller.calls)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {seller.avgRating}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {seller.streak > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-500">
                          <Flame className="h-3 w-3" />
                          {seller.streak}d
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ChangeIndicator change={seller.change} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Agents Tab */}
      {tab === 'agents' && (
        <div className="rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Rank</th>
                  <th className="px-4 py-3 text-left font-medium">Agent</th>
                  <th className="px-4 py-3 text-right font-medium">Total Spend</th>
                  <th className="px-4 py-3 text-right font-medium">Transactions</th>
                  <th className="px-4 py-3 text-right font-medium">Success Rate</th>
                  <th className="px-4 py-3 text-center font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {mockAgentLeaderboard.map((agent) => (
                  <tr key={agent.rank} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <RankBadge rank={agent.rank} />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{agent.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {shortenAddress(agent.wallet)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatUSD(agent.spend)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatCompact(agent.transactions)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={agent.successRate >= 99 ? 'text-emerald-500' : 'text-foreground'}>
                        {agent.successRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ChangeIndicator change={agent.change} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tools Tab */}
      {tab === 'tools' && (
        <div className="rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Rank</th>
                  <th className="px-4 py-3 text-left font-medium">Tool</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">API Calls</th>
                  <th className="px-4 py-3 text-right font-medium">Revenue</th>
                  <th className="px-4 py-3 text-right font-medium">Rating</th>
                  <th className="px-4 py-3 text-center font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {mockToolLeaderboard.map((tool) => (
                  <tr key={tool.rank} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <RankBadge rank={tool.rank} />
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{tool.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {tool.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatCompact(tool.calls)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatUSD(tool.revenue)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {tool.rating}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ChangeIndicator change={tool.change} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
