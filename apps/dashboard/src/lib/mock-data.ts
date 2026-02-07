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

// Mock deposits
export interface Deposit {
  _id: string
  orgId: string
  fiatAmount: number
  usdcAmount: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  walletAddress: string
  chain: 'base' | 'solana'
  createdAt: number
  txHash?: string
  completedAt?: number
}

export const mockDeposits: Deposit[] = [
  {
    _id: 'dep-1',
    orgId: 'org-1',
    fiatAmount: 500,
    usdcAmount: 492.50,
    status: 'completed',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    chain: 'base',
    createdAt: Date.now() - 86400000 * 2,
    txHash: '0xabc123def456789012345678901234567890abcdef1234567890abcdef123456',
    completedAt: Date.now() - 86400000 * 2 + 60000,
  },
  {
    _id: 'dep-2',
    orgId: 'org-1',
    fiatAmount: 100,
    usdcAmount: 98.50,
    status: 'completed',
    walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    chain: 'base',
    createdAt: Date.now() - 86400000 * 5,
    txHash: '0xdef456abc789012345678901234567890abcdef1234567890abcdef12345678',
    completedAt: Date.now() - 86400000 * 5 + 45000,
  },
  {
    _id: 'dep-3',
    orgId: 'org-1',
    fiatAmount: 250,
    usdcAmount: 246.25,
    status: 'processing',
    walletAddress: 'So1anaAddress1234567890abcdef1234567890abc',
    chain: 'solana',
    createdAt: Date.now() - 3600000,
  },
  {
    _id: 'dep-4',
    orgId: 'org-1',
    fiatAmount: 50,
    usdcAmount: 49.25,
    status: 'pending',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    chain: 'base',
    createdAt: Date.now() - 1800000,
  },
  {
    _id: 'dep-5',
    orgId: 'org-1',
    fiatAmount: 1000,
    usdcAmount: 985.00,
    status: 'completed',
    walletAddress: '0x9876543210fedcba9876543210fedcba98765432',
    chain: 'base',
    createdAt: Date.now() - 86400000 * 10,
    txHash: '0x789012abc345def678901234567890abcdef1234567890abcdef1234567890ab',
    completedAt: Date.now() - 86400000 * 10 + 90000,
  },
]

export function getDepositStats() {
  const completed = mockDeposits.filter(d => d.status === 'completed')
  return {
    totalDeposits: mockDeposits.length,
    completedDeposits: completed.length,
    totalDeposited: mockDeposits.reduce((sum, d) => sum + d.fiatAmount, 0),
    totalUsdcReceived: completed.reduce((sum, d) => sum + d.usdcAmount, 0),
    totalFees: mockDeposits.reduce((sum, d) => sum + (d.fiatAmount - d.usdcAmount), 0),
  }
}

// Mock disputes
export interface Dispute {
  _id: string
  reason: string
  status: 'open' | 'under_review' | 'resolved' | 'rejected'
  createdAt: number
  resolution?: string
  refundAmount?: number
  adminNotes?: string
  transaction?: {
    amount: number
    endpointPath: string
    method: string
    chain: 'base' | 'solana'
  }
}

export const mockDisputes: Dispute[] = [
  {
    _id: 'disp-1',
    reason: 'API returned 500 error but was still charged for the request',
    status: 'open',
    createdAt: Date.now() - 86400000,
    transaction: {
      amount: 0.025,
      endpointPath: '/api/forecast',
      method: 'GET',
      chain: 'base',
    },
  },
  {
    _id: 'disp-2',
    reason: 'Response data was incomplete - missing required fields',
    status: 'under_review',
    createdAt: Date.now() - 86400000 * 3,
    transaction: {
      amount: 0.042,
      endpointPath: '/api/analyze',
      method: 'POST',
      chain: 'base',
    },
    adminNotes: 'Investigating with the seller. Logs confirm partial response was returned.',
  },
  {
    _id: 'disp-3',
    reason: 'Duplicate charge for the same API call',
    status: 'resolved',
    createdAt: Date.now() - 86400000 * 7,
    resolution: 'refunded',
    refundAmount: 0.038,
    transaction: {
      amount: 0.038,
      endpointPath: '/api/prices',
      method: 'GET',
      chain: 'solana',
    },
    adminNotes: 'Confirmed duplicate transaction. Full refund issued.',
  },
  {
    _id: 'disp-4',
    reason: 'Service was unreachable but payment was processed',
    status: 'resolved',
    createdAt: Date.now() - 86400000 * 14,
    resolution: 'partial_refund',
    refundAmount: 0.015,
    transaction: {
      amount: 0.030,
      endpointPath: '/api/search',
      method: 'GET',
      chain: 'base',
    },
    adminNotes: 'Partial refund issued. Seller confirmed intermittent downtime.',
  },
  {
    _id: 'disp-5',
    reason: 'Charged higher amount than listed price',
    status: 'rejected',
    createdAt: Date.now() - 86400000 * 21,
    resolution: 'denied',
    transaction: {
      amount: 0.050,
      endpointPath: '/api/historical',
      method: 'GET',
      chain: 'base',
    },
    adminNotes: 'Price was updated on the seller listing prior to the request. The charge matched the current price at the time of the transaction.',
  },
]

// Mock revenue data
export function getRevenueOverview() {
  const totalRevenue = mockTransactions
    .filter(t => t.status === 'settled')
    .reduce((sum, t) => sum + t.amount * 0.03, 0)

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    todayRevenue: Math.round(totalRevenue * 0.05 * 100) / 100,
    monthRevenue: Math.round(totalRevenue * 0.65 * 100) / 100,
    totalEntries: mockTransactions.filter(t => t.status === 'settled').length,
    byChain: {
      base: Math.round(totalRevenue * 0.72 * 100) / 100,
      solana: Math.round(totalRevenue * 0.28 * 100) / 100,
    },
  }
}

export const mockDailyRevenue: { date: string; revenue: number }[] = Array.from(
  { length: 30 },
  (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (29 - i))
    return {
      date: date.toISOString().split('T')[0],
      revenue: Math.round((Math.random() * 2 + 0.1) * 100) / 100,
    }
  }
)

// Mock billing summary
export function getBillingSummary() {
  return {
    plan: 'free' as const,
    stripeCustomerId: undefined as string | undefined,
    stripeSubscriptionId: undefined as string | undefined,
    billingEmail: undefined as string | undefined,
    billingPeriodEnd: undefined as number | undefined,
    usage: {
      dailyCalls: 342,
      totalAgents: mockAgents.length,
      totalSellers: mockSellers.length,
    },
  }
}

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
