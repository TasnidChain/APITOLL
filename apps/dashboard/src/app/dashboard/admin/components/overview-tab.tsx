'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../../../../../convex/_generated/api'
import { useRevenueOverview } from '@/lib/hooks'
import { PageLoading } from '@/components/loading'
import { formatUSD } from '@/lib/utils'
import { MetricCard, ProgressBar, Section } from './shared'
import {
  DollarSign,
  TrendingUp,
  Building2,
  BarChart3,
  Bot,
  Store,
  Wrench,
  ArrowRightLeft,
  Globe,
  Database,
  Server,
  FileCode,
  ExternalLink,
} from 'lucide-react'

export function OverviewTab() {
  const stats = useQuery(api.admin.getPlatformStats)
  const revenue = useRevenueOverview()

  if (!stats) return <PageLoading />

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Platform Revenue"
          value={formatUSD(revenue?.totalRevenue ?? stats.transactions.totalFees)}
          icon={DollarSign}
          color="text-emerald-400"
          sub="All-time fees collected"
        />
        <MetricCard
          label="Today&apos;s Volume"
          value={formatUSD(stats.transactions.todayVolume)}
          icon={TrendingUp}
          color="text-emerald-400"
          sub={`${stats.transactions.todayCount} transactions`}
        />
        <MetricCard
          label="Total Orgs"
          value={stats.orgs.total}
          icon={Building2}
          color="text-blue-400"
        />
        <MetricCard
          label="Total Volume"
          value={formatUSD(stats.transactions.totalVolume)}
          icon={BarChart3}
          color="text-cyan-400"
          sub="Gross processed"
        />
        <MetricCard
          label="Active Agents"
          value={stats.agents.active}
          icon={Bot}
          color="text-pink-400"
          sub={`${stats.agents.total} total`}
        />
        <MetricCard
          label="Sellers"
          value={stats.sellers.total}
          icon={Store}
          color="text-orange-400"
        />
        <MetricCard
          label="Marketplace Tools"
          value={stats.marketplace.activeTools}
          icon={Wrench}
          color="text-violet-400"
          sub={`${stats.marketplace.totalTools} total`}
        />
        <MetricCard
          label="Transactions"
          value={stats.transactions.total}
          icon={ArrowRightLeft}
          color="text-amber-400"
          sub={`${stats.transactions.settled} settled`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Plan distribution */}
        <Section title="Plan Distribution">
          <div className="space-y-3">
            <ProgressBar
              label="Free"
              value={stats.orgs.planDistribution.free}
              max={stats.orgs.total || 1}
              color="bg-zinc-500"
            />
            <ProgressBar
              label="Pro"
              value={stats.orgs.planDistribution.pro}
              max={stats.orgs.total || 1}
              color="bg-blue-500"
            />
            <ProgressBar
              label="Enterprise"
              value={stats.orgs.planDistribution.enterprise}
              max={stats.orgs.total || 1}
              color="bg-purple-500"
            />
          </div>
        </Section>

        {/* Transaction status */}
        <Section title="Transaction Status">
          <div className="space-y-3">
            <ProgressBar
              label="Settled"
              value={stats.transactions.settled}
              max={stats.transactions.total || 1}
              color="bg-emerald-500"
            />
            <ProgressBar
              label="Pending"
              value={stats.transactions.pending}
              max={stats.transactions.total || 1}
              color="bg-amber-500"
            />
            <ProgressBar
              label="Failed"
              value={stats.transactions.failed}
              max={stats.transactions.total || 1}
              color="bg-red-500"
            />
          </div>
        </Section>

        {/* Quick links */}
        <Section title="Quick Links">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Basescan', url: 'https://basescan.org', icon: Globe },
              { label: 'Convex', url: 'https://dashboard.convex.dev', icon: Database },
              { label: 'Vercel', url: 'https://vercel.com/dashboard', icon: Server },
              { label: 'GitHub', url: 'https://github.com/TasnidChain/APITOLL', icon: FileCode },
            ].map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
              >
                <link.icon className="h-4 w-4" />
                {link.label}
                <ExternalLink className="ml-auto h-3 w-3" />
              </a>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Agent status */}
        <Section title="Agent Status">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active</span>
              <span className="font-medium text-emerald-400">{stats.agents.active}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Paused</span>
              <span className="font-medium text-amber-400">{stats.agents.paused}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Depleted</span>
              <span className="font-medium text-red-400">{stats.agents.depleted}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{stats.agents.total}</span>
            </div>
          </div>
        </Section>

        {/* Marketplace health */}
        <Section title="Marketplace Health">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Listed Tools</span>
              <span className="font-medium">{stats.marketplace.totalTools}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active</span>
              <span className="font-medium text-emerald-400">{stats.marketplace.activeTools}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Verified</span>
              <span className="font-medium text-blue-400">{stats.marketplace.verifiedTools}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Featured</span>
              <span className="font-medium text-purple-400">{stats.marketplace.featuredTools}</span>
            </div>
          </div>
        </Section>

        {/* Webhook health */}
        <Section title="Webhook Health">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Webhooks</span>
              <span className="font-medium">{stats.webhooks.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active</span>
              <span className="font-medium text-emerald-400">{stats.webhooks.active}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Failing</span>
              <span className="font-medium text-red-400">{stats.webhooks.failing}</span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
