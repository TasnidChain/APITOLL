'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../../../../convex/_generated/api'
import { Id } from '../../../../../../../convex/_generated/dataModel'
import { PageLoading } from '@/components/loading'
import { formatUSD, cn } from '@/lib/utils'
import { Badge, Section } from './shared'
import {
  Store,
  Star,
  ShieldCheck,
  Sparkles,
  BadgeCheck,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

interface AdminTool {
  _id: Id<'tools'>
  name: string
  sellerName: string
  method: string
  path: string
  price: number
  currency: string
  category: string
  totalCalls: number
  rating: number
  isActive: boolean
  isVerified: boolean
  isFeatured?: boolean
}

export function MarketplaceTab() {
  const tools = useQuery(api.admin.listAllTools)
  const updateTool = useMutation(api.admin.adminUpdateTool)

  if (!tools) return <PageLoading />

  const handleToggle = async (toolId: Id<'tools'>, field: string, current: boolean) => {
    try {
      await updateTool({ toolId, [field]: !current } as Parameters<typeof updateTool>[0])
    } catch (err: unknown) {
      console.error('Failed to update tool:', err instanceof Error ? err.message : err)
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
          {tools.map((tool: AdminTool) => (
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
