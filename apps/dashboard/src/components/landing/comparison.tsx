import { Check, X, Minus } from 'lucide-react'

const rows = [
  {
    feature: 'Settlement speed',
    apitoll: '2 seconds',
    stripe: '2-7 days',
    paypal: '3-5 days',
  },
  {
    feature: 'Micropayments (<$0.01)',
    apitoll: true,
    stripe: false,
    paypal: false,
  },
  {
    feature: 'Chargebacks',
    apitoll: 'None',
    stripe: 'Yes',
    paypal: 'Yes',
  },
  {
    feature: 'Agent-native (no human)',
    apitoll: true,
    stripe: false,
    paypal: false,
  },
  {
    feature: 'On-chain settlement',
    apitoll: true,
    stripe: false,
    paypal: false,
  },
  {
    feature: 'Multi-chain support',
    apitoll: true,
    stripe: false,
    paypal: false,
  },
]

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-emerald-400" />
  if (value === false) return <X className="mx-auto h-4 w-4 text-slate-600" />
  return <span>{value}</span>
}

export function Comparison() {
  return (
    <section className="relative bg-slate-950 py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <div className="mx-auto max-w-4xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Why API Toll
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Built for machines, not humans
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Traditional payment processors weren&apos;t designed for autonomous agents
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                <th className="px-6 py-4 text-left font-medium text-slate-400" />
                <th className="px-6 py-4 text-center font-semibold text-white">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-blue-400">
                    API Toll
                  </span>
                </th>
                <th className="px-6 py-4 text-center font-medium text-slate-500">Stripe</th>
                <th className="px-6 py-4 text-center font-medium text-slate-500">PayPal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={i < rows.length - 1 ? 'border-b border-slate-800/50' : ''}
                >
                  <td className="px-6 py-3.5 text-slate-300">{row.feature}</td>
                  <td className="px-6 py-3.5 text-center font-medium text-white">
                    <CellValue value={row.apitoll} />
                  </td>
                  <td className="px-6 py-3.5 text-center text-slate-500">
                    <CellValue value={row.stripe} />
                  </td>
                  <td className="px-6 py-3.5 text-center text-slate-500">
                    <CellValue value={row.paypal} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
