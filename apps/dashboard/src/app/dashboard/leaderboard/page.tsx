'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import type { Tool } from '@/lib/types'
import {
  Medal,
  TrendingUp,
  Crown,
  Star,
  Zap,
  DollarSign,
  Users,
  Compass,
} from 'lucide-react'
import { StatCard } from '@/components/stat-card'
import { formatUSD, formatCompact, shortenAddress } from '@/lib/utils'
import { useOrgId, useSellers, useAgents } from '@/lib/hooks'

type Tab = 'sellers' | 'agents' | 'tools'

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-amber-400" />
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />
  return <span className="text-sm font-mono text-muted-foreground">#{rank}</span>
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('sellers')
  const orgId = useOrgId()
  const sellers = useSellers(orgId)
  const agents = useAgents(orgId)
  const tools = useQuery(api.tools.search, { limit: 50 })

  // Sort by performance
  const rankedSellers = [...(sellers ?? [])].sort((a, b) => b.totalRevenue - a.totalRevenue)
  const rankedAgents = [...(agents ?? [])].sort((a, b) => b.totalTransactions - a.totalTransactions)
  const rankedTools = [...(tools ?? [])] as Tool[]
  rankedTools.sort((a, b) => b.totalCalls - a.totalCalls)

  const totalRevenue = rankedSellers.reduce((s, x) => s + x.totalRevenue, 0)
  const totalCalls = rankedSellers.reduce((s, x) => s + x.totalCalls, 0)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          Top performers on the API Toll network
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total Sellers" value={String(rankedSellers.length)} icon={Users} />
        <StatCard title="Network Revenue" value={formatUSD(totalRevenue)} icon={DollarSign} />
        <StatCard title="Total API Calls" value={formatCompact(totalCalls)} icon={Zap} />
        <StatCard title="Active Agents" value={String(rankedAgents.length)} icon={TrendingUp} />
      </div>

      {/* Tabs */}
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

      {/* Sellers Tab */}
      {tab === 'sellers' && (
        <div className="rounded-xl border bg-card">
          {rankedSellers.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No sellers registered yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Register a seller on the Sellers page to start earning
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Rank</th>
                    <th className="px-4 py-3 text-left font-medium">Seller</th>
                    <th className="px-4 py-3 text-right font-medium">Revenue</th>
                    <th className="px-4 py-3 text-right font-medium">API Calls</th>
                    <th className="px-4 py-3 text-right font-medium">Endpoints</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedSellers.map((seller, i) => (
                    <tr key={seller._id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3"><RankBadge rank={i + 1} /></td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{seller.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {shortenAddress(seller.walletAddress)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatUSD(seller.totalRevenue)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatCompact(seller.totalCalls)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{seller.endpoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Agents Tab */}
      {tab === 'agents' && (
        <div className="rounded-xl border bg-card">
          {rankedAgents.length === 0 ? (
            <div className="py-16 text-center">
              <Compass className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No agents created yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create an agent on the Agents page to start
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Rank</th>
                    <th className="px-4 py-3 text-left font-medium">Agent</th>
                    <th className="px-4 py-3 text-right font-medium">Balance</th>
                    <th className="px-4 py-3 text-right font-medium">Transactions</th>
                    <th className="px-4 py-3 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedAgents.map((agent, i) => (
                    <tr key={agent._id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3"><RankBadge rank={i + 1} /></td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{agent.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {shortenAddress(agent.walletAddress)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatUSD(agent.balance)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatCompact(agent.totalTransactions)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          agent.status === 'active' ? 'bg-emerald-500/10 text-emerald-500'
                            : agent.status === 'paused' ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-red-500/10 text-red-500'
                        }`}>{agent.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tools Tab */}
      {tab === 'tools' && (
        <div className="rounded-xl border bg-card">
          {rankedTools.length === 0 ? (
            <div className="py-16 text-center">
              <Zap className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No tools listed yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                List your API on the Discovery page to appear here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Rank</th>
                    <th className="px-4 py-3 text-left font-medium">Tool</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">API Calls</th>
                    <th className="px-4 py-3 text-right font-medium">Price</th>
                    <th className="px-4 py-3 text-right font-medium">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedTools.map((tool, i) => (
                    <tr key={tool._id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3"><RankBadge rank={i + 1} /></td>
                      <td className="px-4 py-3 font-medium text-foreground">{tool.name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{tool.category}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatCompact(tool.totalCalls)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatUSD(tool.price)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {tool.rating?.toFixed(1) ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
