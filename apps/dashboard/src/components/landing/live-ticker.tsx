'use client'

import { useState, useEffect } from 'react'
import { Zap, Globe, TrendingUp } from 'lucide-react'

/**
 * Network Stats Ticker — Shows real, verifiable platform stats.
 *
 * Displays live endpoint count, npm package info, and real gossip
 * data when available. No fake agent names or simulated activity.
 *
 * If real gossip data is available from /api/gossip, it shows
 * actual recent transaction stats. Otherwise shows static but
 * verifiable facts (endpoint count, npm packages, chain support).
 */

interface NetworkStats {
  endpoints: number
  recentTxCount: number | null
  recentVolume: string | null
  activeAgents: number | null
}

export function LiveTicker() {
  const [stats, setStats] = useState<NetworkStats>({
    endpoints: 75,
    recentTxCount: null,
    recentVolume: null,
    activeAgents: null,
  })

  // Fetch real stats — only show what we can verify
  useEffect(() => {
    fetch('/api/gossip?limit=10&window=1h')
      .then((r) => {
        if (!r.ok) throw new Error('gossip unavailable')
        return r.json()
      })
      .then((data) => {
        if (data?.meta) {
          setStats((prev) => ({
            ...prev,
            recentTxCount: data.meta.total_transactions_1h ?? null,
            recentVolume: data.meta.total_volume_1h
              ? `$${Number(data.meta.total_volume_1h).toFixed(2)}`
              : null,
            activeAgents: data.meta.active_agents_1h ?? null,
          }))
        }
      })
      .catch(() => {
        // No real data — that's fine, we only show what's verifiable
      })
  }, [])

  const items: { icon: React.ReactNode; label: string; value: string }[] = [
    {
      icon: <Globe className="h-3 w-3 text-emerald-500/80" />,
      label: 'Live endpoints',
      value: `${stats.endpoints}`,
    },
    {
      icon: <Zap className="h-3 w-3 text-blue-400/80" />,
      label: 'Chains',
      value: 'Base · Solana',
    },
    {
      icon: <TrendingUp className="h-3 w-3 text-amber-400/80" />,
      label: 'Price range',
      value: '$0.001 – $0.02 / call',
    },
  ]

  // Only add live stats if we have real data
  if (stats.recentTxCount !== null) {
    items.push({
      icon: <Zap className="h-3 w-3 text-emerald-400/80" />,
      label: 'Transactions (1h)',
      value: `${stats.recentTxCount}`,
    })
  }
  if (stats.recentVolume !== null) {
    items.push({
      icon: <TrendingUp className="h-3 w-3 text-emerald-400/80" />,
      label: 'Volume (1h)',
      value: stats.recentVolume,
    })
  }
  if (stats.activeAgents !== null) {
    items.push({
      icon: <Globe className="h-3 w-3 text-emerald-400/80" />,
      label: 'Active agents (1h)',
      value: `${stats.activeAgents}`,
    })
  }

  return (
    <div className="relative overflow-hidden border-y border-slate-800/50 bg-slate-950/80 py-2.5">
      {/* Network status indicator */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-slate-950 to-transparent z-10 flex items-center pl-4">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Network</span>
        </div>
      </div>

      {/* Right fade */}
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-slate-950 to-transparent z-10" />

      {/* Scrolling stats */}
      <div className="animate-marquee flex items-center gap-10 whitespace-nowrap pl-32">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
            {item.icon}
            <span className="text-slate-400">{item.label}</span>
            <span className="text-emerald-400 font-mono font-bold">{item.value}</span>
          </span>
        ))}
      </div>

      {/* CSS for marquee animation */}
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
