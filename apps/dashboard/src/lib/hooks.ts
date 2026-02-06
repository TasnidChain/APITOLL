'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Id } from '../../../../convex/_generated/dataModel'

// ═══════════════════════════════════════════════════
// Org context — In production, this would come from auth.
// For now, use the first org or a configured env var.
// ═══════════════════════════════════════════════════

export function useOrgId(): Id<"organizations"> | null {
  // In a real app, this would come from authentication context
  // For demo, grab the first org from the list
  const orgs = useQuery(api.organizations.list, { limit: 1 })
  return orgs?.[0]?._id ?? null
}

// ═══════════════════════════════════════════════════
// Dashboard queries
// ═══════════════════════════════════════════════════

export function useOverviewStats(orgId: Id<"organizations"> | null) {
  return useQuery(
    api.dashboard.getOverviewStats,
    orgId ? { orgId } : "skip"
  )
}

export function useDailyStats(orgId: Id<"organizations"> | null, days?: number) {
  return useQuery(
    api.dashboard.getDailyStats,
    orgId ? { orgId, days } : "skip"
  )
}

export function useTransactions(
  orgId: Id<"organizations"> | null,
  options?: { limit?: number; status?: string; chain?: string }
) {
  return useQuery(
    api.dashboard.listTransactions,
    orgId ? { orgId, ...options } : "skip"
  )
}

export function useAgents(orgId: Id<"organizations"> | null) {
  return useQuery(
    api.dashboard.listAgents,
    orgId ? { orgId } : "skip"
  )
}

export function useSellers(orgId: Id<"organizations"> | null) {
  return useQuery(
    api.dashboard.listSellers,
    orgId ? { orgId } : "skip"
  )
}

// ═══════════════════════════════════════════════════
// Billing queries
// ═══════════════════════════════════════════════════

export function useBillingSummary(orgId: Id<"organizations"> | null) {
  return useQuery(
    api.billing.getBillingSummary,
    orgId ? { orgId } : "skip"
  )
}

export function useAgentLimit(orgId: Id<"organizations"> | null) {
  return useQuery(
    api.billing.checkAgentLimit,
    orgId ? { orgId } : "skip"
  )
}

export function useSellerLimit(orgId: Id<"organizations"> | null) {
  return useQuery(
    api.billing.checkSellerLimit,
    orgId ? { orgId } : "skip"
  )
}

// ═══════════════════════════════════════════════════
// Disputes queries
// ═══════════════════════════════════════════════════

export function useDisputes(orgId: Id<"organizations"> | null, status?: string) {
  return useQuery(
    api.disputes.listByOrg,
    orgId ? { orgId, status } : "skip"
  )
}

// ═══════════════════════════════════════════════════
// Deposits queries
// ═══════════════════════════════════════════════════

export function useDeposits(orgId: Id<"organizations"> | null, limit?: number) {
  return useQuery(
    api.deposits.listByOrg,
    orgId ? { orgId, limit } : "skip"
  )
}

export function useDepositStats(orgId: Id<"organizations"> | null) {
  return useQuery(
    api.deposits.getStats,
    orgId ? { orgId } : "skip"
  )
}

// ═══════════════════════════════════════════════════
// Platform Revenue queries
// ═══════════════════════════════════════════════════

export function useRevenueOverview() {
  return useQuery(api.platformRevenue.getOverview)
}

export function useDailyRevenue(days?: number) {
  return useQuery(api.platformRevenue.getDailyRevenue, { days })
}
