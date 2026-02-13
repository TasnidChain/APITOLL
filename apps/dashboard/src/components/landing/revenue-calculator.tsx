'use client'

import { useState } from 'react'
import { DollarSign, TrendingUp } from 'lucide-react'

const CALL_STEPS = [100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000]
const PLATFORM_FEE = 0.03

function formatCalls(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}K`
  return n.toLocaleString()
}

function formatUsd(n: number): string {
  if (n >= 1_000) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(3)}`
}

export function RevenueCalculator() {
  const [priceIndex, setPriceIndex] = useState(4) // $0.005 default
  const [callsIndex, setCallsIndex] = useState(5) // 5,000 default

  // Price: 0.001 to 0.050 in steps of 0.001
  const pricePerCall = (priceIndex + 1) * 0.001
  const dailyCalls = CALL_STEPS[callsIndex]

  const dailyGross = dailyCalls * pricePerCall
  const dailyNet = dailyGross * (1 - PLATFORM_FEE)
  const monthlyNet = dailyNet * 30
  const annualNet = dailyNet * 365

  return (
    <section className="relative bg-slate-950 py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Seller Economics
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            See what you could earn
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Your API, your price. Agents pay per call in USDC. You keep 97%.
          </p>
        </div>

        {/* Calculator */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left — Controls */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
              {/* Price slider */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-400">Price per call</label>
                  <span className="font-mono text-lg font-bold text-emerald-400">
                    ${pricePerCall.toFixed(3)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={49}
                  value={priceIndex}
                  onChange={(e) => setPriceIndex(Number(e.target.value))}
                  className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-emerald-500"
                />
                <div className="mt-1 flex justify-between text-xs text-slate-600">
                  <span>$0.001</span>
                  <span>$0.050</span>
                </div>
              </div>

              {/* Calls slider */}
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-400">Daily agent calls</label>
                  <span className="font-mono text-lg font-bold text-blue-400">
                    {formatCalls(dailyCalls)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={CALL_STEPS.length - 1}
                  value={callsIndex}
                  onChange={(e) => setCallsIndex(Number(e.target.value))}
                  className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-blue-500"
                />
                <div className="mt-1 flex justify-between text-xs text-slate-600">
                  <span>100</span>
                  <span>100K</span>
                </div>
              </div>

              {/* Scenario text */}
              <div className="mt-8 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                <p className="text-sm leading-relaxed text-slate-400">
                  Wrap any API &rarr; charge{' '}
                  <span className="font-semibold text-emerald-400">${pricePerCall.toFixed(3)}</span>
                  /call &rarr;{' '}
                  <span className="font-semibold text-blue-400">{formatCalls(dailyCalls)}</span>{' '}
                  agent calls/day ={' '}
                  <span className="font-semibold text-white">{formatUsd(monthlyNet)}/mo</span>
                </p>
              </div>
            </div>

            {/* Right — Results */}
            <div className="flex flex-col justify-center rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
              <div className="text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                  <TrendingUp className="h-6 w-6 text-emerald-400" />
                </div>

                {/* Monthly — hero number */}
                <div className="mt-6">
                  <p className="text-sm font-medium text-slate-400">Monthly revenue</p>
                  <p className="mt-1 text-5xl font-bold text-emerald-400">
                    {formatUsd(monthlyNet)}
                  </p>
                </div>

                {/* Daily + Annual */}
                <div className="mt-8 grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-slate-500">Daily</p>
                    <p className="mt-1 text-xl font-bold text-white">{formatUsd(dailyNet)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Annual</p>
                    <p className="mt-1 text-xl font-bold text-white">{formatUsd(annualNet)}</p>
                  </div>
                </div>

                {/* Fee note */}
                <p className="mt-6 text-xs text-slate-500">
                  After 3% platform fee &middot; You keep 97% of every payment
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
