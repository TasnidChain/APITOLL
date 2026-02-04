// Data fetching layer - uses API if available, falls back to mock data
// This lets the dashboard work without a database for demo purposes

import * as api from './api'
import * as mock from './mock-data'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true' || !process.env.NEXT_PUBLIC_API_URL

// ═══════════════════════════════════════════════════
// Analytics
// ═══════════════════════════════════════════════════

export async function getOverviewStats() {
  if (USE_MOCK) {
    return mock.getOverviewStats()
  }

  try {
    return await api.fetchOverviewStats()
  } catch (error) {
    console.warn('API unavailable, using mock data:', error)
    return mock.getOverviewStats()
  }
}

export async function getDailyStats(days = 30) {
  if (USE_MOCK) {
    return mock.mockDailyStats.slice(-days)
  }

  try {
    return await api.fetchDailyStats(days)
  } catch (error) {
    console.warn('API unavailable, using mock data:', error)
    return mock.mockDailyStats.slice(-days)
  }
}

// ═══════════════════════════════════════════════════
// Transactions
// ═══════════════════════════════════════════════════

export interface Transaction {
  id: string
  txHash: string | null
  agentId: string
  agentName: string
  sellerName: string
  endpointPath: string
  method: string
  amount: number
  chain: 'base' | 'solana'
  status: 'pending' | 'settled' | 'failed' | 'refunded'
  latencyMs: number
  requestedAt: Date
}

function normalizeTransaction(tx: api.Transaction | mock.Transaction): Transaction {
  // Handle API response format
  if ('tx_hash' in tx) {
    return {
      id: tx.id,
      txHash: tx.tx_hash,
      agentId: tx.agent_id,
      agentName: tx.agent_name,
      sellerName: tx.seller_name,
      endpointPath: tx.endpoint_path,
      method: tx.method,
      amount: tx.amount,
      chain: tx.chain,
      status: tx.status,
      latencyMs: tx.latency_ms,
      requestedAt: new Date(tx.requested_at),
    }
  }
  // Mock data format
  return tx as Transaction
}

export async function getTransactions(options: {
  limit?: number
  status?: string
  chain?: string
  agentId?: string
} = {}): Promise<Transaction[]> {
  if (USE_MOCK) {
    let txs = mock.mockTransactions as Transaction[]
    if (options.status && options.status !== 'all') {
      txs = txs.filter(t => t.status === options.status)
    }
    if (options.chain && options.chain !== 'all') {
      txs = txs.filter(t => t.chain === options.chain)
    }
    if (options.limit) {
      txs = txs.slice(0, options.limit)
    }
    return txs
  }

  try {
    const txs = await api.fetchTransactions(options)
    return txs.map(normalizeTransaction)
  } catch (error) {
    console.warn('API unavailable, using mock data:', error)
    return mock.mockTransactions.slice(0, options.limit || 100) as Transaction[]
  }
}

// ═══════════════════════════════════════════════════
// Agents
// ═══════════════════════════════════════════════════

export interface Agent {
  id: string
  name: string
  walletAddress: string
  chain: 'base' | 'solana'
  balance: number
  status: 'active' | 'paused' | 'depleted'
  dailySpend: number
  dailyLimit: number
  totalTransactions: number
  createdAt: Date
}

function normalizeAgent(agent: api.Agent | mock.Agent): Agent {
  // Handle API response format
  if ('wallet_address' in agent) {
    return {
      id: agent.id,
      name: agent.name,
      walletAddress: agent.wallet_address,
      chain: agent.chain,
      balance: agent.balance,
      status: agent.status,
      dailySpend: 0, // TODO: calculate from transactions
      dailyLimit: 50, // TODO: get from policies
      totalTransactions: 0, // TODO: calculate
      createdAt: new Date(agent.created_at),
    }
  }
  return agent as Agent
}

export async function getAgents(): Promise<Agent[]> {
  if (USE_MOCK) {
    return mock.mockAgents as Agent[]
  }

  try {
    const agents = await api.fetchAgents()
    return agents.map(normalizeAgent)
  } catch (error) {
    console.warn('API unavailable, using mock data:', error)
    return mock.mockAgents as Agent[]
  }
}

// ═══════════════════════════════════════════════════
// Sellers
// ═══════════════════════════════════════════════════

export interface Seller {
  id: string
  name: string
  walletAddress: string
  totalRevenue: number
  totalCalls: number
  endpoints: number
}

export async function getSellers(): Promise<Seller[]> {
  if (USE_MOCK) {
    return mock.mockSellers as Seller[]
  }

  try {
    const sellers = await api.fetchSellers()
    return sellers.map(s => ({
      id: s.id,
      name: s.name,
      walletAddress: s.wallet_address,
      totalRevenue: 0, // TODO: calculate
      totalCalls: 0, // TODO: calculate
      endpoints: 0, // TODO: count
    }))
  } catch (error) {
    console.warn('API unavailable, using mock data:', error)
    return mock.mockSellers as Seller[]
  }
}
