'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../../../../convex/_generated/api'
import { Id } from '../../../../../../../convex/_generated/dataModel'
import { PageLoading } from '@/components/loading'
import { Badge, Section } from './shared'
import { Building2 } from 'lucide-react'
import type { PlanTier } from '@/lib/types'

interface AdminOrg {
  _id: Id<'organizations'>
  name: string
  plan: PlanTier
  billingWallet?: string
  agentCount: number
  sellerCount: number
}

export function OrganizationsTab() {
  const orgs = useQuery(api.admin.listAllOrgs)
  const updatePlan = useMutation(api.admin.adminUpdatePlan)

  if (!orgs) return <PageLoading />

  const planVariant = (plan: string) => {
    if (plan === 'enterprise') return 'purple' as const
    if (plan === 'pro') return 'info' as const
    return 'default' as const
  }

  const handlePlanChange = async (orgId: Id<'organizations'>, newPlan: string) => {
    try {
      await updatePlan({ orgId, plan: newPlan as PlanTier })
    } catch (err: unknown) {
      console.error('Failed to update plan:', err instanceof Error ? err.message : err)
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
              {orgs.map((org: AdminOrg) => (
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
                        : '\u2014'}
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
