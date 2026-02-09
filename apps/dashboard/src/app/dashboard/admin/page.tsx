'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { PageLoading } from '@/components/loading'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Building2,
  Store,
  AlertTriangle,
  Activity,
  Settings,
  HeartPulse,
  Shield,
} from 'lucide-react'

// Tab components
import { OverviewTab } from './components/overview-tab'
import { OrganizationsTab } from './components/organizations-tab'
import { MarketplaceTab } from './components/marketplace-tab'
import { DisputesTab } from './components/disputes-tab'
import { ActivityTab } from './components/activity-tab'
import { PlatformTab } from './components/platform-tab'
import { HealthTab } from './components/health-tab'

// ═══════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════

const ADMIN_USER_ID = process.env.NEXT_PUBLIC_ADMIN_USER_ID || ''

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
// Access Denied
// ═══════════════════════════════════════════════════

function AccessDenied() {
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

// ═══════════════════════════════════════════════════
// Main Admin Page
// ═══════════════════════════════════════════════════

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const { user, isLoaded } = useUser()

  if (!isLoaded) return <PageLoading />
  if (!user || user.id !== ADMIN_USER_ID) return <AccessDenied />

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
