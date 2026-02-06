'use client'

import { cn, formatUSD, shortenAddress, timeAgo } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'

export interface TransactionRow {
  _id: string
  txHash?: string | null
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

interface TransactionTableProps {
  transactions: TransactionRow[]
  showAgent?: boolean
}

const statusStyles = {
  settled: 'bg-success/10 text-success',
  pending: 'bg-warning/10 text-warning',
  failed: 'bg-destructive/10 text-destructive',
  refunded: 'bg-muted text-muted-foreground',
}

const chainColors = {
  base: 'bg-blue-100 text-blue-800',
  solana: 'bg-purple-100 text-purple-800',
}

export function TransactionTable({
  transactions,
  showAgent = true,
}: TransactionTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-sm text-muted-foreground">
            <th className="pb-3 font-medium">Time</th>
            {showAgent && <th className="pb-3 font-medium">Agent</th>}
            <th className="pb-3 font-medium">Endpoint</th>
            <th className="pb-3 font-medium">Seller</th>
            <th className="pb-3 font-medium">Amount</th>
            <th className="pb-3 font-medium">Chain</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium">Latency</th>
            <th className="pb-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx._id} className="border-b text-sm">
              <td className="py-3 text-muted-foreground">
                {timeAgo(typeof tx.requestedAt === 'number' ? new Date(tx.requestedAt) : tx.requestedAt)}
              </td>
              {showAgent && (
                <td className="py-3 font-medium">{tx.agentName}</td>
              )}
              <td className="py-3">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {tx.method} {tx.endpointPath}
                </code>
              </td>
              <td className="py-3">{tx.sellerName}</td>
              <td className="py-3 font-medium">{formatUSD(tx.amount)}</td>
              <td className="py-3">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                    chainColors[tx.chain]
                  )}
                >
                  {tx.chain}
                </span>
              </td>
              <td className="py-3">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                    statusStyles[tx.status]
                  )}
                >
                  {tx.status}
                </span>
              </td>
              <td className="py-3 text-muted-foreground">{tx.latencyMs}ms</td>
              <td className="py-3">
                {tx.txHash && (
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    title="View on explorer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
