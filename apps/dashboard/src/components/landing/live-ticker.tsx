'use client'

import { useState, useEffect } from 'react'
import { Zap } from 'lucide-react'

/**
 * Live Activity Ticker — Shows real agent payments scrolling across the screen.
 *
 * This is the #1 viral social proof element. Visitors see:
 *   "ResearchBot paid $0.001 for /api/joke on Base"
 *   "AnalystAgent paid $0.005 for /api/forecast on Base"
 *
 * Even before real volume, we show realistic demo activity
 * so the platform feels alive. As real gossip data flows in,
 * it seamlessly replaces the demo data.
 */

interface TickerEvent {
  agent: string
  amount: string
  endpoint: string
  chain: string
  timeAgo: string
}

const DEMO_EVENTS: TickerEvent[] = [
  { agent: 'ResearchBot', amount: '0.001', endpoint: '/api/joke', chain: 'Base', timeAgo: '2s ago' },
  { agent: 'DataScout', amount: '0.005', endpoint: '/api/forecast', chain: 'Base', timeAgo: '8s ago' },
  { agent: 'AnalystAgent', amount: '0.002', endpoint: '/api/sentiment', chain: 'Base', timeAgo: '15s ago' },
  { agent: 'CodeHelper', amount: '0.001', endpoint: '/api/joke', chain: 'Base', timeAgo: '23s ago' },
  { agent: 'SwarmWorker-1', amount: '0.003', endpoint: '/api/price/ETH', chain: 'Base', timeAgo: '31s ago' },
  { agent: 'SwarmWorker-2', amount: '0.001', endpoint: '/api/price/BTC', chain: 'Base', timeAgo: '38s ago' },
  { agent: 'ContentBot', amount: '0.010', endpoint: '/api/summarize', chain: 'Base', timeAgo: '45s ago' },
  { agent: 'WeatherAgent', amount: '0.002', endpoint: '/api/forecast', chain: 'Base', timeAgo: '52s ago' },
]

export function LiveTicker() {
  const [events, setEvents] = useState<TickerEvent[]>(DEMO_EVENTS)
  const [liveCount, setLiveCount] = useState(0)

  // Try to fetch real gossip data — fall back to demo if anything is off
  useEffect(() => {
    fetch('/api/gossip?limit=10&window=1h')
      .then((r) => {
        if (!r.ok) throw new Error('gossip unavailable')
        return r.json()
      })
      .then((data) => {
        if (data?.trending?.length > 0) {
          const realEvents: TickerEvent[] = []
          for (const item of data.trending) {
            const volume = Number(item.total_volume_usdc)
            const count = Number(item.discoveries)
            // Skip entries with bad data to avoid $NaN
            if (!volume || !count || isNaN(volume) || isNaN(count)) continue
            const agentName = item.seller_name || item.endpoint?.split('/').pop() || 'Agent'
            realEvents.push({
              agent: agentName,
              amount: (volume / count).toFixed(3),
              endpoint: item.endpoint || '/api/unknown',
              chain: item.chains?.[0] || 'Base',
              timeAgo: 'just now',
            })
          }
          if (realEvents.length > 0) {
            setEvents(
              realEvents.length >= 4
                ? realEvents
                : [...realEvents, ...DEMO_EVENTS.slice(realEvents.length)]
            )
          }
        }
        if (data?.meta?.active_agents_1h) {
          setLiveCount(data.meta.active_agents_1h)
        }
      })
      .catch(() => {
        // Use demo data — it's fine
      })
  }, [])

  return (
    <div className="relative overflow-hidden border-y border-slate-800/50 bg-slate-950/80 py-2.5">
      {/* Live indicator */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-slate-950 to-transparent z-10 flex items-center pl-4">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Right fade */}
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-slate-950 to-transparent z-10" />

      {/* Scrolling ticker */}
      <div className="animate-marquee flex items-center gap-8 whitespace-nowrap pl-32">
        {[...events, ...events].map((event, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
            <Zap className="h-3 w-3 text-emerald-500/60" />
            <span className="text-slate-400 font-medium">{event.agent}</span>
            <span>paid</span>
            <span className="text-emerald-400 font-mono font-bold">${event.amount}</span>
            <span>for</span>
            <span className="text-blue-400 font-mono">{event.endpoint}</span>
            <span>on {event.chain}</span>
            <span className="text-slate-600 ml-1">{event.timeAgo}</span>
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
          animation: marquee 60s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
