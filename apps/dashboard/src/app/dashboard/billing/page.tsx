'use client'

import { useOrgId, useBillingSummary } from '@/lib/hooks'
import { PageLoading } from '@/components/loading'
import { formatUSD } from '@/lib/utils'
import {
  CreditCard,
  Check,
  Zap,
  Shield,
  BarChart3,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PLANS = [
  {
    id: 'free' as const,
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for getting started',
    features: [
      '1,000 API calls/day',
      '1 agent',
      '2 sellers',
      '7-day analytics',
      'Community support',
    ],
    limits: { calls: '1,000/day', agents: 1, sellers: 2 },
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For growing businesses',
    popular: true,
    features: [
      '100,000 API calls/day',
      '10 agents',
      '25 sellers',
      '90-day analytics',
      'Premium analytics',
      'Featured listings',
      'Custom policies',
      'Webhook alerts',
      'Priority support',
    ],
    limits: { calls: '100K/day', agents: 10, sellers: 25 },
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    price: '$499',
    period: '/month',
    description: 'For large-scale operations',
    features: [
      'Unlimited API calls',
      'Unlimited agents',
      'Unlimited sellers',
      '365-day analytics',
      'Revenue dashboard',
      'Custom integrations',
      'SLA guarantee',
      'Dedicated support',
      'Admin tools',
    ],
    limits: { calls: 'Unlimited', agents: 'Unlimited', sellers: 'Unlimited' },
  },
]

export default function BillingPage() {
  const orgId = useOrgId()
  const billing = useBillingSummary(orgId)

  if (!billing && orgId) return <PageLoading />

  const currentPlan = billing?.plan ?? 'free'

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Billing & Plans</h1>
        <p className="text-muted-foreground">
          Manage your subscription and view usage
        </p>
      </div>

      {/* Current Plan Summary */}
      {billing && (
        <div className="mb-8 rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Current Plan</h2>
              </div>
              <p className="mt-1 text-muted-foreground">
                You're on the{' '}
                <span className="font-semibold capitalize text-foreground">
                  {currentPlan}
                </span>{' '}
                plan
              </p>
            </div>
            {billing.billingPeriodEnd && (
              <div className="text-right text-sm text-muted-foreground">
                <p>Next billing date</p>
                <p className="font-medium text-foreground">
                  {new Date(billing.billingPeriodEnd).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {/* Usage Bars */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <UsageBar
              label="API Calls Today"
              current={billing.usage.dailyCalls}
              limit={
                currentPlan === 'free'
                  ? 1000
                  : currentPlan === 'pro'
                  ? 100000
                  : Infinity
              }
            />
            <UsageBar
              label="Agents"
              current={billing.usage.totalAgents}
              limit={
                currentPlan === 'free'
                  ? 1
                  : currentPlan === 'pro'
                  ? 10
                  : Infinity
              }
            />
            <UsageBar
              label="Sellers"
              current={billing.usage.totalSellers}
              limit={
                currentPlan === 'free'
                  ? 2
                  : currentPlan === 'pro'
                  ? 25
                  : Infinity
              }
            />
          </div>
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan
          const isUpgrade =
            (currentPlan === 'free' && plan.id !== 'free') ||
            (currentPlan === 'pro' && plan.id === 'enterprise')

          return (
            <div
              key={plan.id}
              className={cn(
                'relative rounded-xl border p-6 transition-shadow hover:shadow-md',
                plan.popular && 'border-primary ring-1 ring-primary',
                isCurrent && 'bg-primary/5'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                  Most Popular
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>

              <ul className="mb-6 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                  isCurrent
                    ? 'bg-muted text-muted-foreground cursor-default'
                    : isUpgrade
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border bg-background text-foreground hover:bg-accent'
                )}
                disabled={isCurrent}
              >
                {isCurrent ? (
                  'Current Plan'
                ) : isUpgrade ? (
                  <>
                    Upgrade <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  'Downgrade'
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Feature Comparison */}
      <div className="mt-12 rounded-xl border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Plan Features</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <FeatureHighlight
            icon={Zap}
            title="API Throughput"
            free="1K/day"
            pro="100K/day"
            enterprise="Unlimited"
            current={currentPlan}
          />
          <FeatureHighlight
            icon={Shield}
            title="Custom Policies"
            free="No"
            pro="Yes"
            enterprise="Yes"
            current={currentPlan}
          />
          <FeatureHighlight
            icon={BarChart3}
            title="Analytics Retention"
            free="7 days"
            pro="90 days"
            enterprise="365 days"
            current={currentPlan}
          />
        </div>
      </div>
    </div>
  )
}

function UsageBar({
  label,
  current,
  limit,
}: {
  label: string
  current: number
  limit: number
}) {
  const pct = limit === Infinity ? 0 : Math.min((current / limit) * 100, 100)
  const isNearLimit = pct > 80

  return (
    <div className="rounded-lg bg-muted/50 p-4">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {current.toLocaleString()}/
          {limit === Infinity ? 'Unlimited' : limit.toLocaleString()}
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isNearLimit ? 'bg-destructive' : 'bg-primary'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function FeatureHighlight({
  icon: Icon,
  title,
  free,
  pro,
  enterprise,
  current,
}: {
  icon: React.ElementType
  title: string
  free: string
  pro: string
  enterprise: string
  current: string
}) {
  const value = current === 'enterprise' ? enterprise : current === 'pro' ? pro : free

  return (
    <div className="rounded-lg bg-muted/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}
