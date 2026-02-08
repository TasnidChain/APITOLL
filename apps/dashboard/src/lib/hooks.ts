'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Id } from '../../../../convex/_generated/dataModel'

// ═══════════════════════════════════════════════════
// Shared types for dashboard data
// ═══════════════════════════════════════════════════

export interface DashboardAgent {
  _id: string
  name: string
  walletAddress: string
  chain: 'base' | 'solana'
  balance: number
  status: 'active' | 'paused' | 'depleted'
  dailySpend: number
  dailyLimit: number
  totalTransactions: number
}

export interface DashboardSeller {
  _id: string
  name: string
  walletAddress: string
  totalRevenue: number
  totalPlatformFees: number
  totalCalls: number
  endpoints: number
}

export interface DashboardTransaction {
  _id: string
  txHash: string | null
  agentName: string
  sellerName: string
  endpointPath: string
  method: string
  amount: number
  chain: 'base' | 'solana'
  status: 'pending' | 'settled' | 'failed' | 'refunded'
  latencyMs: number
  requestedAt: number | Date
  platformFee?: number
  sellerAmount?: number
}

// ═══════════════════════════════════════════════════
// Org context — Uses first org from Convex.
// Returns undefined while loading, null if no org exists.
// NO MOCK DATA — only real Convex data.
// ═══════════════════════════════════════════════════

export function useOrgId(): Id<"organizations"> | null {
  const orgs = useQuery(api.organizations.list, { limit: 1 })
  return orgs?.[0]?._id ?? null
}

export function useOrg(orgId: Id<"organizations"> | null) {
  return useQuery(
    api.organizations.get,
    orgId ? { id: orgId } : "skip"
  )
}

// ═══════════════════════════════════════════════════
// Dashboard queries — REAL DATA ONLY
// Returns undefined while loading.
// Pages must handle empty/zero states themselves.
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
): DashboardTransaction[] | undefined {
  return useQuery(
    api.dashboard.listTransactions,
    orgId ? { orgId, ...options } : "skip"
  ) as DashboardTransaction[] | undefined
}

export function useAgents(
  orgId: Id<"organizations"> | null
): DashboardAgent[] | undefined {
  return useQuery(
    api.dashboard.listAgents,
    orgId ? { orgId } : "skip"
  ) as DashboardAgent[] | undefined
}

export function useSellers(
  orgId: Id<"organizations"> | null
): DashboardSeller[] | undefined {
  return useQuery(
    api.dashboard.listSellers,
    orgId ? { orgId } : "skip"
  ) as DashboardSeller[] | undefined
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
// Policies queries
// ═══════════════════════════════════════════════════

export function usePolicies(orgId: Id<"organizations"> | null) {
  return useQuery(
    api.policies.listByOrg,
    orgId ? { orgId } : "skip"
  ) as any[] | undefined
}

export function useAlertRules(orgId: Id<"organizations"> | null) {
  return useQuery(
    api.alertRules.listByOrg,
    orgId ? { orgId } : "skip"
  ) as any[] | undefined
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

// ═══════════════════════════════════════════════════
// Webhook queries
// ═══════════════════════════════════════════════════

export function useWebhooks(orgId: Id<"organizations"> | null) {
  return useQuery(
    api.webhooks.listByOrg,
    orgId ? { orgId } : "skip"
  )
}

export function useWebhookStats(orgId: Id<"organizations"> | null) {
  return useQuery(
    api.webhooks.getStats,
    orgId ? { orgId } : "skip"
  )
}
