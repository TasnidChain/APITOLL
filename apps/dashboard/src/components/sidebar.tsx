'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Bot,
  Store,
  Settings,
  CreditCard,
  AlertTriangle,
  Wallet,
  BarChart3,
  Compass,
  Trophy,
  ShieldCheck,
  Webhook,
  Key,
  Shield,
  Play,
  Banknote,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserButton, useUser } from '@clerk/nextjs'
import { ApiTollLogo } from '@/components/logo'

const ADMIN_USER_ID = process.env.NEXT_PUBLIC_ADMIN_USER_ID || ''

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Discovery', href: '/dashboard/discovery', icon: Compass },
  { name: 'Leaderboard', href: '/dashboard/leaderboard', icon: Trophy },
  { name: 'Transactions', href: '/dashboard/transactions', icon: ArrowLeftRight },
  { name: 'Agents', href: '/dashboard/agents', icon: Bot },
  { name: 'Sellers', href: '/dashboard/sellers', icon: Store },
  { name: 'Playground', href: '/dashboard/playground', icon: Play },
  { name: 'Webhooks', href: '/dashboard/webhooks', icon: Webhook },
  { name: 'API Keys', href: '/dashboard/api-keys', icon: Key },
  { name: 'Policies', href: '/dashboard/policies', icon: ShieldCheck },
  { name: 'Fund Wallet', href: '/dashboard/fund', icon: Banknote },
  { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { name: 'Deposits', href: '/dashboard/deposits', icon: Wallet },
  { name: 'Disputes', href: '/dashboard/disputes', icon: AlertTriangle },
  { name: 'Revenue', href: '/dashboard/revenue', icon: BarChart3 },
  { name: 'Admin', href: '/dashboard/admin', icon: Shield, adminOnly: true },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { user } = useUser()
  const isAdmin = user?.id === ADMIN_USER_ID

  return (
    <>
      <Link href="/" className="flex h-16 shrink-0 items-center gap-2.5 border-b px-6 hover:bg-accent/50 transition-colors">
        <ApiTollLogo size={28} id="sidebar-logo" />
        <span className="text-lg font-semibold">API Toll</span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation
          .filter((item) => !('adminOnly' in item && item.adminOnly) || isAdmin)
          .map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="shrink-0 border-t p-4 space-y-3">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium text-muted-foreground">
            x402 Protocol
          </p>
          <p className="text-sm font-semibold text-foreground">
            Base Mainnet
          </p>
        </div>
        <div className="flex items-center gap-3 px-1">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: 'h-8 w-8',
              },
            }}
          />
          <span className="text-sm text-muted-foreground">Account</span>
        </div>
      </div>
    </>
  )
}

/** Desktop sidebar — hidden on mobile */
export function Sidebar() {
  return (
    <div className="hidden md:flex h-full w-64 flex-col border-r bg-card">
      <SidebarContent />
    </div>
  )
}

/** Mobile top bar + slide-out sidebar */
export function MobileHeader() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close sidebar on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex md:hidden h-14 items-center justify-between border-b bg-card px-4">
        <Link href="/" className="flex items-center gap-2">
          <ApiTollLogo size={24} id="mobile-logo" />
          <span className="text-base font-semibold">API Toll</span>
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Overlay + Slide-out drawer */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-card shadow-xl md:hidden">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </>
      )}
    </>
  )
}
