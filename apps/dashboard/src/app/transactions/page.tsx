'use client'

import { useState } from 'react'
import { TransactionTable } from '@/components/transaction-table'
import { mockTransactions } from '@/lib/mock-data'
import { Search, Filter } from 'lucide-react'

type StatusFilter = 'all' | 'settled' | 'pending' | 'failed'
type ChainFilter = 'all' | 'base' | 'solana'

export default function TransactionsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [chainFilter, setChainFilter] = useState<ChainFilter>('all')

  const filteredTransactions = mockTransactions.filter((tx) => {
    const matchesSearch =
      tx.agentName.toLowerCase().includes(search.toLowerCase()) ||
      tx.sellerName.toLowerCase().includes(search.toLowerCase()) ||
      tx.endpointPath.toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' || tx.status === statusFilter

    const matchesChain = chainFilter === 'all' || tx.chain === chainFilter

    return matchesSearch && matchesStatus && matchesChain
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-muted-foreground">
          View all agent payment transactions
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by agent, seller, or endpoint..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Status</option>
            <option value="settled">Settled</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={chainFilter}
            onChange={(e) => setChainFilter(e.target.value as ChainFilter)}
            className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Chains</option>
            <option value="base">Base</option>
            <option value="solana">Solana</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="mb-4 text-sm text-muted-foreground">
        Showing {filteredTransactions.length} of {mockTransactions.length}{' '}
        transactions
      </p>

      {/* Table */}
      <div className="rounded-xl border bg-card p-6">
        <TransactionTable transactions={filteredTransactions} />
      </div>
    </div>
  )
}
