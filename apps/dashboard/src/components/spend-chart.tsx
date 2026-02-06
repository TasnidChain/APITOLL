'use client'

interface DailyStats {
  date: string
  spend: number
  transactions: number
}
import { formatUSD } from '@/lib/utils'

interface SpendChartProps {
  data: DailyStats[]
}

export function SpendChart({ data }: SpendChartProps) {
  const maxSpend = Math.max(...data.map((d) => d.spend))

  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="text-lg font-semibold">Daily Spend</h3>
      <p className="text-sm text-muted-foreground">Last 30 days</p>

      <div className="mt-6 flex h-48 items-end gap-1">
        {data.map((day, i) => {
          const height = (day.spend / maxSpend) * 100
          return (
            <div
              key={day.date}
              className="group relative flex-1"
              title={`${day.date}: ${formatUSD(day.spend)}`}
            >
              <div
                className="w-full rounded-t bg-primary/80 transition-colors hover:bg-primary"
                style={{ height: `${height}%` }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                {formatUSD(day.spend)}
                <br />
                {day.transactions} txs
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  )
}
