'use client'

import { useRevenueOverview, useDailyRevenue } from '@/lib/hooks'
import { PageLoading, StatCardSkeleton, ChartSkeleton } from '@/components/loading'
import { formatUSD, formatCompact } from '@/lib/utils'
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  Globe,
  ArrowLeftRight,
} from 'lucide-react'

export default function RevenuePage() {
  const overview = useRevenueOverview()
  const dailyRevenue = useDailyRevenue(30)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Platform Revenue</h1>
        <p className="text-muted-foreground">
          Track platform fee earnings from the 3% transaction fee
        </p>
      </div>

      {/* Revenue Stats */}
      {!overview ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">
              {formatUSD(overview.totalRevenue)}
            </p>
            <p className="text-xs text-muted-foreground">All time earnings</p>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Today's Revenue
              </p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">
              {formatUSD(overview.todayRevenue)}
            </p>
            <p className="text-xs text-muted-foreground">Current day</p>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                30-Day Revenue
              </p>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">
              {formatUSD(overview.monthRevenue)}
            </p>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Total Entries
              </p>
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">
              {formatCompact(overview.totalEntries)}
            </p>
            <p className="text-xs text-muted-foreground">Fee collections</p>
          </div>
        </div>
      )}

      {/* Revenue Chart */}
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!dailyRevenue ? (
            <ChartSkeleton />
          ) : (
            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-lg font-semibold">Daily Revenue</h3>
              <p className="text-sm text-muted-foreground">Last 30 days</p>

              {dailyRevenue.length === 0 ||
              dailyRevenue.every((d) => d.revenue === 0) ? (
                <div className="flex h-48 items-center justify-center text-muted-foreground">
                  <p className="text-sm">No revenue data yet</p>
                </div>
              ) : (
                <>
                  <div className="mt-6 flex h-48 items-end gap-1">
                    {dailyRevenue.map((day) => {
                      const maxRev = Math.max(
                        ...dailyRevenue.map((d) => d.revenue)
                      )
                      const height =
                        maxRev > 0 ? (day.revenue / maxRev) * 100 : 0
                      return (
                        <div
                          key={day.date}
                          className="group relative flex-1"
                          title={`${day.date}: ${formatUSD(day.revenue)}`}
                        >
                          <div
                            className="w-full rounded-t bg-success/80 transition-colors hover:bg-success"
                            style={{
                              height: `${Math.max(height, 1)}%`,
                            }}
                          />
                          <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                            {formatUSD(day.revenue)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>{dailyRevenue[0]?.date}</span>
                    <span>{dailyRevenue[dailyRevenue.length - 1]?.date}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Chain Breakdown */}
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold">Revenue by Chain</h3>
          <p className="text-sm text-muted-foreground">Breakdown by network</p>

          {!overview ? (
            <PageLoading />
          ) : (
            <div className="mt-6 space-y-4">
              <ChainBar
                name="Base"
                amount={overview.byChain.base}
                total={overview.totalRevenue}
                color="bg-blue-500"
              />
              <ChainBar
                name="Solana"
                amount={overview.byChain.solana}
                total={overview.totalRevenue}
                color="bg-purple-500"
              />
            </div>
          )}

          {/* Fee Info */}
          <div className="mt-6 border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Fee Structure</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Transaction Fee</span>
                <span className="font-medium text-foreground">3% (300 bps)</span>
              </div>
              <div className="flex justify-between">
                <span>On-ramp Fee</span>
                <span className="font-medium text-foreground">1.5% (150 bps)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Attribution Info */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Revenue Sources</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm font-medium">Transaction Fees</p>
            <p className="text-xs text-muted-foreground mt-1">
              3% collected on every settled agent-to-seller payment via x402
              protocol
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm font-medium">Fiat On-ramp</p>
            <p className="text-xs text-muted-foreground mt-1">
              1.5% fee when users deposit fiat to fund their agent wallets with
              USDC
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm font-medium">Subscriptions</p>
            <p className="text-xs text-muted-foreground mt-1">
              Monthly Pro ($49) and Enterprise ($499) plans for premium features
              and higher limits
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChainBar({
  name,
  amount,
  total,
  color,
}: {
  name: string
  amount: number
  total: number
  color: string
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0

  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-medium">{name}</span>
        <span className="text-muted-foreground">
          {formatUSD(amount)} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="h-3 rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
    </div>
  )
}
