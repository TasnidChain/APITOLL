// Mock data for development - replace with real API calls later

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

export interface Seller {
  id: string
  name: string
  walletAddress: string
  totalRevenue: number
  totalCalls: number
  endpoints: number
}

export interface DailyStats {
  date: string
  spend: number
  transactions: number
}

// Generate mock agents
export const mockAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'ResearchBot',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    chain: 'base',
    balance: 145.50,
    status: 'active',
    dailySpend: 12.45,
    dailyLimit: 50,
    totalTransactions: 1247,
    createdAt: new Date('2024-12-01'),
  },
  {
    id: 'agent-2',
    name: 'DataCollector',
    walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    chain: 'base',
    balance: 89.20,
    status: 'active',
    dailySpend: 28.90,
    dailyLimit: 100,
    totalTransactions: 3421,
    createdAt: new Date('2024-11-15'),
  },
  {
    id: 'agent-3',
    name: 'PriceTracker',
    walletAddress: 'So1anaAddress1234567890abcdef1234567890abc',
    chain: 'solana',
    balance: 5.10,
    status: 'depleted',
    dailySpend: 0,
    dailyLimit: 25,
    totalTransactions: 892,
    createdAt: new Date('2025-01-10'),
  },
  {
    id: 'agent-4',
    name: 'ContentAnalyzer',
    walletAddress: '0x9876543210fedcba9876543210fedcba98765432',
    chain: 'base',
    balance: 234.00,
    status: 'paused',
    dailySpend: 0,
    dailyLimit: 75,
    totalTransactions: 567,
    createdAt: new Date('2025-01-20'),
  },
]

// Generate mock transactions
const endpoints = [
  { path: '/api/forecast', method: 'GET', seller: 'WeatherAPI' },
  { path: '/api/historical', method: 'GET', seller: 'WeatherAPI' },
  { path: '/api/prices', method: 'GET', seller: 'CryptoData' },
  { path: '/api/analyze', method: 'POST', seller: 'TextAnalytics' },
  { path: '/api/search', method: 'GET', seller: 'SearchEngine' },
]

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

export const mockTransactions: Transaction[] = Array.from({ length: 100 }, (_, i) => {
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)]
  const agent = mockAgents[Math.floor(Math.random() * mockAgents.length)]
  const statuses: Transaction['status'][] = ['settled', 'settled', 'settled', 'settled', 'pending', 'failed']

  return {
    id: `tx-${i + 1}`,
    txHash: Math.random() > 0.1 ? `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}` : null,
    agentId: agent.id,
    agentName: agent.name,
    sellerName: endpoint.seller,
    endpointPath: endpoint.path,
    method: endpoint.method,
    amount: Math.round((Math.random() * 0.05 + 0.001) * 1000) / 1000,
    chain: agent.chain,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    latencyMs: Math.floor(Math.random() * 500 + 50),
    requestedAt: randomDate(new Date('2025-01-01'), new Date()),
  }
}).sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())

export const mockSellers: Seller[] = [
  { id: 's-1', name: 'WeatherAPI', walletAddress: '0xweather123...', totalRevenue: 1245.67, totalCalls: 45230, endpoints: 3 },
  { id: 's-2', name: 'CryptoData', walletAddress: '0xcrypto456...', totalRevenue: 892.34, totalCalls: 28901, endpoints: 5 },
  { id: 's-3', name: 'TextAnalytics', walletAddress: '0xtext789...', totalRevenue: 567.89, totalCalls: 12456, endpoints: 2 },
  { id: 's-4', name: 'SearchEngine', walletAddress: '0xsearch012...', totalRevenue: 2103.45, totalCalls: 67890, endpoints: 4 },
]

// Generate daily stats for the last 30 days
export const mockDailyStats: DailyStats[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (29 - i))
  return {
    date: date.toISOString().split('T')[0],
    spend: Math.round((Math.random() * 50 + 10) * 100) / 100,
    transactions: Math.floor(Math.random() * 200 + 50),
  }
})

// Aggregated stats
export function getOverviewStats() {
  const totalSpend = mockTransactions
    .filter(t => t.status === 'settled')
    .reduce((sum, t) => sum + t.amount, 0)

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const todaySpend = mockTransactions
    .filter(t => t.status === 'settled' && t.requestedAt >= todayStart)
    .reduce((sum, t) => sum + t.amount, 0)

  const activeAgents = mockAgents.filter(a => a.status === 'active').length

  const avgLatency = mockTransactions
    .filter(t => t.status === 'settled')
    .reduce((sum, t) => sum + t.latencyMs, 0) / mockTransactions.filter(t => t.status === 'settled').length

  const totalPlatformFees = totalSpend * 0.029 // 2.9% platform fee

  return {
    totalSpend,
    todaySpend,
    totalTransactions: mockTransactions.length,
    activeAgents,
    totalAgents: mockAgents.length,
    avgLatency: Math.round(avgLatency),
    successRate: (mockTransactions.filter(t => t.status === 'settled').length / mockTransactions.length) * 100,
    totalPlatformFees: Math.round(totalPlatformFees * 100) / 100,
    plan: 'free' as const,
  }
}
