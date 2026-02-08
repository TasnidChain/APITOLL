'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useUser } from '@clerk/nextjs'
import { api } from '../../../../../../convex/_generated/api'
import { useRevenueOverview } from '@/lib/hooks'
import { PageLoading } from '@/components/loading'
import { formatUSD, cn } from '@/lib/utils'

const ADMIN_USER_ID = process.env.NEXT_PUBLIC_ADMIN_USER_ID || ''
import {
  LayoutDashboard,
  Building2,
  Store,
  AlertTriangle,
  Activity,
  Settings,
  HeartPulse,
  DollarSign,
  TrendingUp,
  Users,
  ArrowRightLeft,
  BarChart3,
  Bot,
  Wrench,
  Star,
  Shield,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Globe,
  FileCode,
  Database,
  Server,
  Zap,
  Package,
  Eye,
  Sparkles,
  BadgeCheck,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

// ═══════════════════════════════════════════════════
// Tabs
// ═══════════════════════════════════════════════════

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'marketplace', label: 'Marketplace', icon: Store },
  { id: 'disputes', label: 'Disputes', icon: AlertTriangle },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'platform', label: 'Platform', icon: Settings },
  { id: 'health', label: 'Health', icon: HeartPulse },
] as const

type TabId = (typeof TABS)[number]['id']

// ═══════════════════════════════════════════════════
// Shared Components
// ═══════════════════════════════════════════════════

function MetricCard({
  label,
  value,
  icon: Icon,
  sub,
  color = 'text-blue-400',
}: {
  label: string
  value: string | number
  icon: React.ElementType
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function ProgressBar({
  label,
  value,
  max,
  color,
}: {
  label: string
  value: number
  max: number
  color: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">
          {value} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={cn('h-2 rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'
}) {
  const colors: Record<string, string> = {
    default: 'bg-muted text-muted-foreground',
    success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    error: 'bg-red-500/10 text-red-500 border-red-500/20',
    info: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium',
        colors[variant]
      )}
    >
      {children}
    </span>
  )
}

function Section({
  title,
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border bg-card p-5', className)}>
      {title && (
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// TAB: Overview
// ═══════════════════════════════════════════════════

function OverviewTab() {
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

// ═══════════════════════════════════════════════════
// TAB: Organizations
// ═══════════════════════════════════════════════════

function OrganizationsTab() {
  const orgs = useQuery(api.admin.listAllOrgs)
  const updatePlan = useMutation(api.admin.adminUpdatePlan)

  if (!orgs) return <PageLoading />

  const planVariant = (plan: string) => {
    if (plan === 'enterprise') return 'purple' as const
    if (plan === 'pro') return 'info' as const
    return 'default' as const
  }

  const handlePlanChange = async (orgId: any, newPlan: string) => {
    try {
      await updatePlan({ orgId, plan: newPlan as any })
    } catch (err) {
      console.error('Failed to update plan:', err)
    }
  }

  return (
    <Section>
      {orgs.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Building2 className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <p>No organizations yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Plan</th>
                <th className="pb-3 pr-4 text-center">Agents</th>
                <th className="pb-3 pr-4 text-center">Sellers</th>
                <th className="pb-3 pr-4">Wallet</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org: any) => (
                <tr key={org._id} className="border-b border-border/50">
                  <td className="py-3 pr-4 font-medium">{org.name}</td>
                  <td className="py-3 pr-4">
                    <Badge variant={planVariant(org.plan)}>{org.plan}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-center">{org.agentCount}</td>
                  <td className="py-3 pr-4 text-center">{org.sellerCount}</td>
                  <td className="py-3 pr-4">
                    <span className="font-mono text-xs text-muted-foreground">
                      {org.billingWallet
                        ? `${org.billingWallet.slice(0, 6)}...${org.billingWallet.slice(-4)}`
                        : '—'}
                    </span>
                  </td>
                  <td className="py-3">
                    <select
                      value={org.plan}
                      onChange={(e) => handlePlanChange(org._id, e.target.value)}
                      className="rounded-md border bg-background px-2 py-1 text-xs"
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

// ═══════════════════════════════════════════════════
// TAB: Marketplace
// ═══════════════════════════════════════════════════

function MarketplaceTab() {
  const tools = useQuery(api.admin.listAllTools)
  const updateTool = useMutation(api.admin.adminUpdateTool)

  if (!tools) return <PageLoading />

  const handleToggle = async (toolId: any, field: string, current: boolean) => {
    try {
      await updateTool({ toolId, [field]: !current } as any)
    } catch (err) {
      console.error('Failed to update tool:', err)
    }
  }

  return (
    <Section>
      {tools.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Store className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <p>No tools in the marketplace yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tools.map((tool: any) => (
            <div
              key={tool._id}
              className="flex items-center justify-between rounded-xl border bg-muted/30 p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{tool.name}</p>
                  {tool.isVerified && (
                    <BadgeCheck className="h-4 w-4 text-blue-400" />
                  )}
                  {tool.isFeatured && (
                    <Sparkles className="h-4 w-4 text-purple-400" />
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {tool.sellerName} &middot; {tool.method} {tool.path} &middot;{' '}
                  {formatUSD(tool.price)}/{tool.currency}
                </p>
                <div className="mt-1 flex gap-2">
                  <Badge variant={tool.isActive ? 'success' : 'error'}>
                    {tool.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="default">{tool.category}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {tool.totalCalls} calls &middot; {tool.rating.toFixed(1)}
                    <Star className="ml-0.5 inline h-3 w-3 text-amber-400" />
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(tool._id, 'isActive', tool.isActive)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={tool.isActive ? 'Deactivate' : 'Activate'}
                >
                  {tool.isActive ? (
                    <ToggleRight className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={() => handleToggle(tool._id, 'isVerified', tool.isVerified)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={tool.isVerified ? 'Unverify' : 'Verify'}
                >
                  <ShieldCheck
                    className={cn(
                      'h-5 w-5',
                      tool.isVerified ? 'text-blue-400' : ''
                    )}
                  />
                </button>
                <button
                  onClick={() => handleToggle(tool._id, 'isFeatured', !!tool.isFeatured)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={tool.isFeatured ? 'Unfeature' : 'Feature'}
                >
                  <Sparkles
                    className={cn(
                      'h-5 w-5',
                      tool.isFeatured ? 'text-purple-400' : ''
                    )}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ═══════════════════════════════════════════════════
// TAB: Disputes
// ═══════════════════════════════════════════════════

function DisputesTab() {
  const disputes = useQuery(api.admin.listAllDisputes)
  const resolve = useMutation(api.admin.resolveDispute)

  if (!disputes) return <PageLoading />

  const statusVariant = (status: string) => {
    if (status === 'resolved') return 'success' as const
    if (status === 'rejected') return 'error' as const
    if (status === 'under_review') return 'warning' as const
    return 'info' as const
  }

  const handleResolve = async (disputeId: any, action: 'resolved' | 'rejected') => {
    try {
      await resolve({
        disputeId,
        status: action,
        resolution: action === 'resolved' ? 'refunded' : 'denied',
      })
    } catch (err) {
      console.error('Failed to resolve dispute:', err)
    }
  }

  return (
    <Section>
      {disputes.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <p>No disputes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d: any) => (
            <div
              key={d._id}
              className="rounded-xl border bg-muted/30 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{d.orgName}</p>
                    <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{d.reason}</p>
                  {d.transaction && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tx: {d.transaction.method} {d.transaction.endpointPath} &middot;{' '}
                      {formatUSD(d.transaction.amount)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    <Clock className="mr-1 inline h-3 w-3" />
                    {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {(d.status === 'open' || d.status === 'under_review') && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResolve(d._id, 'resolved')}
                      className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
                    >
                      <CheckCircle2 className="mr-1 inline h-3 w-3" />
                      Resolve
                    </button>
                    <button
                      onClick={() => handleResolve(d._id, 'rejected')}
                      className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
                    >
                      <XCircle className="mr-1 inline h-3 w-3" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
              {d.adminNotes && (
                <p className="mt-2 rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                  Admin note: {d.adminNotes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ═══════════════════════════════════════════════════
// TAB: Activity
// ═══════════════════════════════════════════════════

function ActivityTab() {
  const activity = useQuery(api.admin.getActivityLog)

  if (!activity) return <PageLoading />

  const statusColor = (status: string) => {
    if (status === 'settled') return 'text-emerald-400'
    if (status === 'failed') return 'text-red-400'
    if (status === 'pending') return 'text-amber-400'
    return 'text-muted-foreground'
  }

  return (
    <Section title="Recent Transactions (All Orgs)">
      {activity.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Activity className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <p>No activity yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activity.map((tx: any) => (
            <div
              key={tx._id}
              className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    tx.status === 'settled'
                      ? 'bg-emerald-500/10'
                      : tx.status === 'failed'
                        ? 'bg-red-500/10'
                        : 'bg-amber-500/10'
                  )}
                >
                  <ArrowRightLeft
                    className={cn('h-4 w-4', statusColor(tx.status))}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {tx.agentName} &rarr; {tx.sellerName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.method} {tx.endpointPath}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn('text-sm font-medium', statusColor(tx.status))}>
                  {formatUSD(tx.amount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(tx.requestedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ═══════════════════════════════════════════════════
// TAB: Platform
// ═══════════════════════════════════════════════════

function PlatformTab() {
  return (
    <div className="space-y-6">
      <Section title="Platform Configuration">
        <div className="space-y-4">
          {[
            { label: 'Platform Fee', value: '250 bps (2.5%)', icon: DollarSign },
            { label: 'Default Chain', value: 'Base (Mainnet)', icon: Globe },
            { label: 'Supported Chains', value: 'Base, Solana', icon: Zap },
            { label: 'Payment Currency', value: 'USDC', icon: DollarSign },
            { label: 'Protocol', value: 'x402 HTTP Payment Protocol', icon: Shield },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{item.label}</span>
              </div>
              <span className="text-sm font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="NPM Packages">
        <div className="space-y-3">
          {[
            { name: '@apitoll/shared', version: '0.1.0-beta.3', description: 'Shared types & utilities' },
            { name: '@apitoll/seller-sdk', version: '0.1.0-beta.3', description: 'Express/Hono middleware for sellers' },
            { name: '@apitoll/buyer-sdk', version: '0.1.0-beta.3', description: 'Agent wallet & payment SDK' },
          ].map((pkg) => (
            <div
              key={pkg.name}
              className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-mono text-sm font-medium">{pkg.name}</p>
                  <p className="text-xs text-muted-foreground">{pkg.description}</p>
                </div>
              </div>
              <Badge variant="info">v{pkg.version}</Badge>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Infrastructure">
        <div className="space-y-3">
          {[
            { label: 'Dashboard', url: 'https://apitoll.com', status: 'Live' },
            { label: 'Convex Backend', url: 'https://cheery-parrot-104.convex.cloud', status: 'Live' },
            { label: 'Facilitator', url: 'https://facilitator-production-fbd7.up.railway.app', status: 'Live' },
            { label: 'Discovery API', url: 'https://apitoll.com/api/discovery', status: 'Live' },
          ].map((svc) => (
            <div
              key={svc.label}
              className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Server className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{svc.label}</p>
                  <p className="font-mono text-xs text-muted-foreground">{svc.url}</p>
                </div>
              </div>
              <Badge variant="success">{svc.status}</Badge>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// TAB: Health
// ═══════════════════════════════════════════════════

function HealthTab() {
  const stats = useQuery(api.admin.getPlatformStats)

  if (!stats) return <PageLoading />

  const checks = [
    {
      name: 'Database',
      status: 'healthy' as const,
      detail: `${stats.orgs.total} orgs, ${stats.agents.total} agents`,
    },
    {
      name: 'Webhooks',
      status: stats.webhooks.failing > 0 ? ('warning' as const) : ('healthy' as const),
      detail: `${stats.webhooks.active} active, ${stats.webhooks.failing} failing`,
    },
    {
      name: 'Marketplace',
      status: 'healthy' as const,
      detail: `${stats.marketplace.activeTools} active tools`,
    },
    {
      name: 'Transaction Processing',
      status: stats.transactions.failed > stats.transactions.settled * 0.1
        ? ('warning' as const)
        : ('healthy' as const),
      detail: `${stats.transactions.settled} settled, ${stats.transactions.failed} failed`,
    },
  ]

  return (
    <Section title="System Health Checks">
      <div className="space-y-3">
        {checks.map((check) => (
          <div
            key={check.name}
            className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              {check.status === 'healthy' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              )}
              <div>
                <p className="text-sm font-medium">{check.name}</p>
                <p className="text-xs text-muted-foreground">{check.detail}</p>
              </div>
            </div>
            <Badge variant={check.status === 'healthy' ? 'success' : 'warning'}>
              {check.status}
            </Badge>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ═══════════════════════════════════════════════════
// Main Admin Page
// ═══════════════════════════════════════════════════

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const { user, isLoaded } = useUser()

  // Admin gate: only allow the admin user to access this page
  if (!isLoaded) return <PageLoading />
  if (!user || user.id !== ADMIN_USER_ID) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <Shield className="h-16 w-16 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">
          You don&apos;t have admin privileges to access this page.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          <Shield className="h-7 w-7 text-primary" />
          Admin Console
        </h1>
        <p className="mt-1 text-muted-foreground">
          Platform-wide management and monitoring for API Toll.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border bg-muted/30 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'organizations' && <OrganizationsTab />}
        {activeTab === 'marketplace' && <MarketplaceTab />}
        {activeTab === 'disputes' && <DisputesTab />}
        {activeTab === 'activity' && <ActivityTab />}
        {activeTab === 'platform' && <PlatformTab />}
        {activeTab === 'health' && <HealthTab />}
      </div>
    </div>
  )
}
