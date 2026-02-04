import {
  DollarSign,
  ArrowLeftRight,
  Bot,
  Clock,
  TrendingUp,
  CheckCircle,
} from 'lucide-react'
import { StatCard } from '@/components/stat-card'
import { SpendChart } from '@/components/spend-chart'
import { TransactionTable } from '@/components/transaction-table'
import {
  getOverviewStats,
  mockDailyStats,
  mockTransactions,
} from '@/lib/mock-data'
import { formatUSD, formatCompact } from '@/lib/utils'

export default function OverviewPage() {
  const stats = getOverviewStats()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground">
          Monitor your agent payments and API spending
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Spend"
          value={formatUSD(stats.totalSpend)}
          subtitle="All time"
          icon={DollarSign}
          trend={{ value: 12.5, label: 'vs last week' }}
        />
        <StatCard
          title="Today's Spend"
          value={formatUSD(stats.todaySpend)}
          icon={TrendingUp}
        />
        <StatCard
          title="Transactions"
          value={formatCompact(stats.totalTransactions)}
          subtitle={`${stats.successRate.toFixed(1)}% success rate`}
          icon={ArrowLeftRight}
        />
        <StatCard
          title="Active Agents"
          value={`${stats.activeAgents}/${stats.totalAgents}`}
          subtitle={`${stats.avgLatency}ms avg latency`}
          icon={Bot}
        />
      </div>

      {/* Charts Row */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <SpendChart data={mockDailyStats} />

        {/* Quick Stats */}
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold">Performance</h3>
          <p className="text-sm text-muted-foreground">Real-time metrics</p>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-success" />
                <span>Success Rate</span>
              </div>
              <span className="text-xl font-bold">
                {stats.successRate.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <span>Avg Latency</span>
              </div>
              <span className="text-xl font-bold">{stats.avgLatency}ms</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-primary" />
                <span>Active Agents</span>
              </div>
              <span className="text-xl font-bold">
                {stats.activeAgents} / {stats.totalAgents}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-xl border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
            <p className="text-sm text-muted-foreground">
              Latest agent payments
            </p>
          </div>
          <a
            href="/transactions"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </a>
        </div>
        <TransactionTable transactions={mockTransactions.slice(0, 10)} />
      </div>
    </div>
  )
}
