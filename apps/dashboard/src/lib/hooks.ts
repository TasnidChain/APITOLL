'use client'

import { useState, useEffect } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Id } from '../../../../convex/_generated/dataModel'
import {
  getOverviewStats as getMockOverviewStats,
  mockDailyStats,
  mockTransactions,
  mockAgents,
  mockSellers,
} from './mock-data'

// ═══════════════════════════════════════════════════
// Shared types for dashboard data (Convex + mock)
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
// Org context — In production, this would come from auth.
// For now, use the first org or a configured env var.
// Falls back to mock data when Convex is unavailable.
// ═══════════════════════════════════════════════════

const CONVEX_TIMEOUT_MS = 3000

function useMockFallback<T>(convexData: T | undefined, mockData: T): T | undefined {
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (convexData !== undefined) return
    const timer = setTimeout(() => setTimedOut(true), CONVEX_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [convexData])

  if (convexData !== undefined) return convexData
  if (timedOut) return mockData
  return undefined
}

export function useOrgId(): Id<"organizations"> | null {
  const orgs = useQuery(api.organizations.list, { limit: 1 })
  return orgs?.[0]?._id ?? null
}

// ═══════════════════════════════════════════════════
// Dashboard queries (with mock data fallback)
// ═══════════════════════════════════════════════════

export function useOverviewStats(orgId: Id<"organizations"> | null) {
  const convexData = useQuery(
    api.dashboard.getOverviewStats,
    orgId ? { orgId } : "skip"
  )
  return useMockFallback(convexData, getMockOverviewStats())
}

export function useDailyStats(orgId: Id<"organizations"> | null, days?: number) {
  const convexData = useQuery(
    api.dashboard.getDailyStats,
    orgId ? { orgId, days } : "skip"
  )
  return useMockFallback(convexData, mockDailyStats.slice(-(days ?? 30)))
}

export function useTransactions(
  orgId: Id<"organizations"> | null,
  options?: { limit?: number; status?: string; chain?: string }
): DashboardTransaction[] | undefined {
  const convexData = useQuery(
    api.dashboard.listTransactions,
    orgId ? { orgId, ...options } : "skip"
  )
  let filtered = [...mockTransactions]
  if (options?.status) {
    filtered = filtered.filter((t) => t.status === options.status)
  }
  if (options?.chain) {
    filtered = filtered.filter((t) => t.chain === options.chain)
  }
  const mockTxs: DashboardTransaction[] = filtered
    .slice(0, options?.limit ?? 100)
    .map((tx) => ({
      _id: tx.id,
      txHash: tx.txHash,
      agentName: tx.agentName,
      sellerName: tx.sellerName,
      endpointPath: tx.endpointPath,
      method: tx.method,
      amount: tx.amount,
      chain: tx.chain,
      status: tx.status,
      latencyMs: tx.latencyMs,
      requestedAt: tx.requestedAt.getTime(),
    }))
  return useMockFallback(
    convexData as DashboardTransaction[] | undefined,
    mockTxs
  )
}

export function useAgents(
  orgId: Id<"organizations"> | null
): DashboardAgent[] | undefined {
  const convexData = useQuery(
    api.dashboard.listAgents,
    orgId ? { orgId } : "skip"
  )
  const mockAgentsWithId: DashboardAgent[] = mockAgents.map((a) => ({
    _id: a.id,
    name: a.name,
    walletAddress: a.walletAddress,
    chain: a.chain,
    balance: a.balance,
    status: a.status,
    dailySpend: a.dailySpend,
    dailyLimit: a.dailyLimit,
    totalTransactions: a.totalTransactions,
  }))
  return useMockFallback(
    convexData as DashboardAgent[] | undefined,
    mockAgentsWithId
  )
}

export function useSellers(
  orgId: Id<"organizations"> | null
): DashboardSeller[] | undefined {
  const convexData = useQuery(
    api.dashboard.listSellers,
    orgId ? { orgId } : "skip"
  )
  const mockSellersWithId: DashboardSeller[] = mockSellers.map((s) => ({
    _id: s.id,
    name: s.name,
    walletAddress: s.walletAddress,
    totalRevenue: s.totalRevenue,
    totalPlatformFees: Math.round(s.totalRevenue * 0.029 * 100) / 100,
    totalCalls: s.totalCalls,
    endpoints: s.endpoints,
  }))
  return useMockFallback(
    convexData as DashboardSeller[] | undefined,
    mockSellersWithId
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
