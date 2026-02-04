// API client for the transaction indexer
// Falls back to mock data if API is not available

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body } = options

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

// ═══════════════════════════════════════════════════
// Analytics
// ═══════════════════════════════════════════════════

export interface OverviewStats {
  totalSpend: number
  todaySpend: number
  totalTransactions: number
  activeAgents: number
  totalAgents: number
  avgLatency: number
  successRate: number
}

export async function fetchOverviewStats(): Promise<OverviewStats> {
  return apiFetch('/api/analytics/overview')
}

export interface DailyStats {
  date: string
  spend: number
  transactions: number
}

export async function fetchDailyStats(days = 30): Promise<DailyStats[]> {
  const { data } = await apiFetch<{ data: DailyStats[] }>(`/api/analytics/daily?days=${days}`)
  return data
}

// ═══════════════════════════════════════════════════
// Transactions
// ═══════════════════════════════════════════════════

export interface Transaction {
  id: string
  tx_hash: string | null
  agent_id: string
  agent_name: string
  seller_name: string
  endpoint_path: string
  method: string
  amount: number
  chain: 'base' | 'solana'
  status: 'pending' | 'settled' | 'failed' | 'refunded'
  latency_ms: number
  requested_at: string
}

export async function fetchTransactions(options: {
  limit?: number
  offset?: number
  status?: string
  chain?: string
  agentId?: string
} = {}): Promise<Transaction[]> {
  const params = new URLSearchParams()
  if (options.limit) params.set('limit', String(options.limit))
  if (options.offset) params.set('offset', String(options.offset))
  if (options.status) params.set('status', options.status)
  if (options.chain) params.set('chain', options.chain)
  if (options.agentId) params.set('agentId', options.agentId)

  const { transactions } = await apiFetch<{ transactions: Transaction[] }>(
    `/api/transactions?${params.toString()}`
  )
  return transactions
}

// ═══════════════════════════════════════════════════
// Agents
// ═══════════════════════════════════════════════════

export interface Agent {
  id: string
  name: string
  wallet_address: string
  chain: 'base' | 'solana'
  balance: number
  status: 'active' | 'paused' | 'depleted'
  policies_json: unknown[]
  created_at: string
}

export async function fetchAgents(): Promise<Agent[]> {
  const { agents } = await apiFetch<{ agents: Agent[] }>('/api/agents')
  return agents
}

export async function createAgent(data: {
  name: string
  walletAddress: string
  chain: 'base' | 'solana'
  policies?: unknown[]
}): Promise<Agent> {
  const { agent } = await apiFetch<{ agent: Agent }>('/api/agents', {
    method: 'POST',
    body: data,
  })
  return agent
}

// ═══════════════════════════════════════════════════
// Sellers
// ═══════════════════════════════════════════════════

export interface Seller {
  id: string
  name: string
  wallet_address: string
  created_at: string
}

export async function fetchSellers(): Promise<Seller[]> {
  const { sellers } = await apiFetch<{ sellers: Seller[] }>('/api/sellers')
  return sellers
}
