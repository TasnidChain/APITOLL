'use client'

import { useState } from 'react'
import { useOrgId, useBillingSummary, useOrg } from '@/lib/hooks'
import { Key, Bell, Shield, Wallet, Copy, Check, ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  const orgId = useOrgId()
  const org = useOrg(orgId)
  const billing = useBillingSummary(orgId)
  const [copied, setCopied] = useState(false)

  // Notification toggle states
  const [budgetAlerts, setBudgetAlerts] = useState(true)
  const [lowBalanceWarnings, setLowBalanceWarnings] = useState(true)
  const [txFailures, setTxFailures] = useState(false)

  // Policy states
  const [dailyLimit, setDailyLimit] = useState('50.00')
  const [weeklyLimit, setWeeklyLimit] = useState('200.00')
  const [maxPerRequest, setMaxPerRequest] = useState('0.10')

  // Save states
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleCopy = () => {
    if (org?.apiKey) {
      navigator.clipboard.writeText(org.apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const maskedKey = org?.apiKey
    ? `${org.apiKey.slice(0, 8)}${'*'.repeat(32)}${org.apiKey.slice(-4)}`
    : 'Loading...'

  const handleSave = async () => {
    setSaving(true)
    // Simulate save — in production this would call real mutations
    await new Promise((resolve) => setTimeout(resolve, 800))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization settings
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
              {org.billingWallet && (
                <div>
                  <label className="text-sm font-medium">Billing Wallet</label>
                  <p className="mt-1 text-sm font-mono text-muted-foreground">
                    {org.billingWallet}
                  </p>
                </div>
              )}
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
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>
          <div className="space-y-4">
            <ToggleRow
              title="Budget Alerts"
              description="Get notified when agents reach budget thresholds"
              checked={budgetAlerts}
              onToggle={() => setBudgetAlerts(!budgetAlerts)}
            />
            <ToggleRow
              title="Low Balance Warnings"
              description="Alert when agent balance drops below threshold"
              checked={lowBalanceWarnings}
              onToggle={() => setLowBalanceWarnings(!lowBalanceWarnings)}
            />
            <ToggleRow
              title="Transaction Failures"
              description="Get notified on payment failures"
              checked={txFailures}
              onToggle={() => setTxFailures(!txFailures)}
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
            These policies apply to new agents by default.
          </p>
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
              Saving...
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
