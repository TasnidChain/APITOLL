'use client'

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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserButton } from '@clerk/nextjs'
import { ApiTollLogo } from '@/components/logo'

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
  { name: 'Admin', href: '/dashboard/admin', icon: Shield },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2.5 border-b px-6">
        <ApiTollLogo size={28} id="sidebar-logo" />
        <span className="text-lg font-semibold">API Toll</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
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

      <div className="border-t p-4 space-y-3">
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
    </div>
  )
}
