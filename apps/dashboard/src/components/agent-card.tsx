import { cn, formatUSD, shortenAddress } from '@/lib/utils'
import { Bot, Pause, AlertTriangle } from 'lucide-react'

export interface AgentData {
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

interface AgentCardProps {
  agent: AgentData
}

const statusConfig = {
  active: { color: 'bg-success', icon: null, label: 'Active' },
  paused: { color: 'bg-warning', icon: Pause, label: 'Paused' },
  depleted: { color: 'bg-destructive', icon: AlertTriangle, label: 'Depleted' },
}

export function AgentCard({ agent }: AgentCardProps) {
  const status = statusConfig[agent.status]
  const budgetUsed = agent.dailyLimit > 0 ? (agent.dailySpend / agent.dailyLimit) * 100 : 0

  return (
    <div className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{agent.name}</h3>
            <p className="text-xs text-muted-foreground">
              {shortenAddress(agent.walletAddress)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn('h-2 w-2 rounded-full', status.color)} />
          <span className="text-xs text-muted-foreground">{status.label}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className="text-lg font-semibold">{formatUSD(agent.balance)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Chain</p>
          <span
            className={cn(
              'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              agent.chain === 'base'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-purple-100 text-purple-800'
            )}
          >
            {agent.chain}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Daily Budget</span>
          <span>
            {formatUSD(agent.dailySpend)} / {formatUSD(agent.dailyLimit)}
          </span>
        </div>
        <div className="mt-1.5 h-2 rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              budgetUsed > 90
                ? 'bg-destructive'
                : budgetUsed > 70
                ? 'bg-warning'
                : 'bg-success'
            )}
            style={{ width: `${Math.min(budgetUsed, 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-between border-t pt-4 text-sm">
        <span className="text-muted-foreground">Total Transactions</span>
        <span className="font-medium">
          {agent.totalTransactions.toLocaleString()}
        </span>
      </div>
    </div>
  )
}
