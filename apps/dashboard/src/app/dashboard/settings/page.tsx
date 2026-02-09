'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import { useOrgId, useBillingSummary, useOrg, usePolicies, useAlertRules } from '@/lib/hooks'
import {
  Key,
  Bell,
  Shield,
  Wallet,
  Copy,
  Check,
  ArrowRight,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  const orgId = useOrgId()
  const org = useOrg(orgId)
  const billing = useBillingSummary(orgId)
  const policies = usePolicies(orgId)
  const alertRules = useAlertRules(orgId)
  const orgKeyData = useQuery(
    api.organizations.getApiKey,
    orgId ? { id: orgId } : 'skip'
  )
  const [copied, setCopied] = useState(false)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)

  // Notification toggle states (persisted via alert rules)
  const budgetAlerts = alertRules?.some((r) => r.ruleType === 'budget_threshold' && r.isActive) ?? true
  const lowBalanceWarnings = alertRules?.some((r) => r.ruleType === 'low_balance' && r.isActive) ?? true
  const txFailures = alertRules?.some((r) => r.ruleType === 'high_failure_rate' && r.isActive) ?? false

  // Policy mutations
  const createPolicy = useMutation(api.policies.create)
  const updatePolicy = useMutation(api.policies.update)
  const _removePolicy = useMutation(api.policies.remove)
  const createAlertRule = useMutation(api.alertRules.create)
  const toggleAlertRule = useMutation(api.alertRules.toggleActive)
  const regenerateApiKey = useMutation(api.organizations.regenerateApiKey)
  const updateBillingWallet = useMutation(api.organizations.updateBillingWallet)

  // Policy form states
  const [dailyLimit, setDailyLimit] = useState('50.00')
  const [weeklyLimit, setWeeklyLimit] = useState('200.00')
  const [maxPerRequest, setMaxPerRequest] = useState('0.10')

  // Wallet editing
  const [editingWallet, setEditingWallet] = useState(false)
  const [walletInput, setWalletInput] = useState('')

  // Save states
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)

  const orgApiKey = orgKeyData?.apiKey ?? ''

  const handleCopy = () => {
    if (orgApiKey) {
      navigator.clipboard.writeText(orgApiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const maskedKey = orgApiKey
    ? `${orgApiKey.slice(0, 8)}${'*'.repeat(32)}${orgApiKey.slice(-4)}`
    : 'Loading...'

  const handleRegenerate = async () => {
    if (!orgId) return
    setRegenLoading(true)
    try {
      await regenerateApiKey({ id: orgId })
      setShowRegenConfirm(false)
    } catch (err: unknown) {
      console.error('Failed to regenerate key:', err)
    } finally {
      setRegenLoading(false)
    }
  }

  const handleWalletSave = async () => {
    if (!orgId || !walletInput) return
    if (!/^0x[0-9a-fA-F]{40}$/.test(walletInput)) return
    try {
      await updateBillingWallet({ id: orgId, billingWallet: walletInput })
      setEditingWallet(false)
    } catch (err: unknown) {
      console.error('Failed to update wallet:', err)
    }
  }

  const handleToggleAlert = async (ruleType: string) => {
    if (!orgId) return
    try {
      const existing = alertRules?.find((r) => r.ruleType === ruleType)
      if (existing) {
        await toggleAlertRule({ id: existing._id })
      } else {
        // Create the alert rule
        const thresholds: Record<string, Record<string, number>> = {
          budget_threshold: { percentage: 80 },
          low_balance: { amount: 1.0 },
          high_failure_rate: { rate: 10, windowMinutes: 60 },
        }
        await createAlertRule({
          orgId,
          ruleType: ruleType as "budget_threshold" | "budget_exceeded" | "low_balance" | "high_failure_rate" | "anomalous_spend",
          thresholdJson: thresholds[ruleType] ?? { percentage: 80 },
        })
      }
    } catch (err: unknown) {
      console.error('Failed to toggle alert rule:', err)
    }
  }

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      // Find or create budget policy for org
      const budgetPolicy = policies?.find((p) => p.policyType === 'budget' && !p.agentId)
      const rules = {
        dailyLimit: parseFloat(dailyLimit) || undefined,
        perTransactionLimit: parseFloat(maxPerRequest) || undefined,
        monthlyLimit: parseFloat(weeklyLimit) ? parseFloat(weeklyLimit) * 4 : undefined,
      }

      if (budgetPolicy) {
        await updatePolicy({
          id: budgetPolicy._id,
          rulesJson: rules,
        })
      } else {
        await createPolicy({
          orgId,
          policyType: 'budget',
          rulesJson: rules,
        })
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: unknown) {
      console.error('Failed to save settings:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization settings, policies, and alert rules
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Organization Info */}
        {org && (
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Organization</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Name</label>
                <p className="mt-1 text-sm text-muted-foreground">{org.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Billing Wallet</label>
                {editingWallet ? (
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      value={walletInput}
                      onChange={(e) => setWalletInput(e.target.value)}
                      placeholder="0x..."
                      className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      onClick={handleWalletSave}
                      disabled={!/^0x[0-9a-fA-F]{40}$/.test(walletInput)}
                      className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingWallet(false)}
                      className="rounded-lg border px-3 py-2 text-sm hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-sm font-mono text-muted-foreground">
                      {org.billingWallet || 'Not set'}
                    </p>
                    <button
                      onClick={() => {
                        setWalletInput(org.billingWallet || '')
                        setEditingWallet(true)
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Plan</label>
                <p className="mt-1 text-sm text-muted-foreground capitalize">
                  {org.plan ?? 'free'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* API Keys */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Key className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">API Keys</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Use these keys to authenticate your seller SDK with the platform.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Platform API Key</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={maskedKey}
                  readOnly
                  className="flex-1 rounded-lg border bg-muted px-3 py-2 text-sm font-mono"
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-success" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Keep this key secret. Do not share it in client-side code.
              </p>
            </div>
            <div className="pt-2">
              {showRegenConfirm ? (
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Regenerate API Key?</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This will immediately invalidate your current key. All services using this key will stop working.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={handleRegenerate}
                          disabled={regenLoading}
                          className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                        >
                          {regenLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          Confirm Regenerate
                        </button>
                        <button
                          onClick={() => setShowRegenConfirm(false)}
                          className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowRegenConfirm(true)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate Key
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Notifications / Alert Rules */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>
          <div className="space-y-4">
            <ToggleRow
              title="Budget Alerts"
              description="Get notified when agents reach 80% of budget"
              checked={budgetAlerts}
              onToggle={() => handleToggleAlert('budget_threshold')}
            />
            <ToggleRow
              title="Low Balance Warnings"
              description="Alert when agent balance drops below $1.00"
              checked={lowBalanceWarnings}
              onToggle={() => handleToggleAlert('low_balance')}
            />
            <ToggleRow
              title="Transaction Failures"
              description="Get notified when failure rate exceeds 10%"
              checked={txFailures}
              onToggle={() => handleToggleAlert('high_failure_rate')}
            />
          </div>
        </div>

        {/* Default Policies */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Default Policies</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            These policies apply to new agents by default. Saved to your Convex backend.
          </p>

          {/* Active policies count */}
          {policies && policies.length > 0 && (
            <div className="mb-4 rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                {policies.filter((p) => p.isActive).length} active {policies.filter((p) => p.isActive).length === 1 ? 'policy' : 'policies'} configured
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Daily Spend Limit</label>
              <div className="mt-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  step="0.01"
                  min="0"
                  className="w-full rounded-lg border pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Weekly Spend Limit</label>
              <div className="mt-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  value={weeklyLimit}
                  onChange={(e) => setWeeklyLimit(e.target.value)}
                  step="0.01"
                  min="0"
                  className="w-full rounded-lg border pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Max Per Request</label>
              <div className="mt-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  value={maxPerRequest}
                  onChange={(e) => setMaxPerRequest(e.target.value)}
                  step="0.01"
                  min="0"
                  className="w-full rounded-lg border pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Billing */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Billing</h2>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted p-4">
            <div>
              <p className="font-medium capitalize">
                {billing?.plan ?? 'Free'} Plan
              </p>
              <p className="text-sm text-muted-foreground">
                {billing?.plan === 'enterprise'
                  ? 'Unlimited usage'
                  : billing?.plan === 'pro'
                  ? 'Up to 100,000 API calls/day'
                  : 'Up to 1,000 API calls/day'}
              </p>
            </div>
            <Link
              href="/dashboard/billing"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {billing?.plan === 'free' ? 'Upgrade' : 'Manage'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving to Convex...
            </>
          ) : saved ? (
            <>
              <Check className="h-4 w-4" />
              Saved!
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </div>
  )
}

function ToggleRow({
  title,
  description,
  checked,
  onToggle,
}: {
  title: string
  description: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${
            checked ? 'right-1' : 'left-1'
          }`}
        />
      </button>
    </div>
  )
}
