'use client'

import { useOrgId, useSellers, useSellerLimit } from '@/lib/hooks'
import { PageLoading, StatCardSkeleton } from '@/components/loading'
import { formatUSD, formatCompact } from '@/lib/utils'
import { Store, ExternalLink } from 'lucide-react'

export default function SellersPage() {
  const orgId = useOrgId()
  const sellers = useSellers(orgId)
  const sellerLimit = useSellerLimit(orgId)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sellers</h1>
          <p className="text-muted-foreground">
            APIs and tools your agents have paid for
          </p>
        </div>
        {sellerLimit && (
          <span className="text-sm text-muted-foreground">
            {sellerLimit.current}/{sellerLimit.limit === Infinity ? 'Unlimited' : sellerLimit.limit} sellers
          </span>
        )}
      </div>

      {/* Seller Cards */}
      {!sellers ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : sellers.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Store className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p className="text-lg font-medium">No sellers yet</p>
          <p className="text-sm">Sellers will appear here when your agents interact with paid APIs</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sellers.map((seller) => (
            <div
              key={seller._id}
              className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                    <Store className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{seller.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {seller.endpoints} endpoints
                    </p>
                  </div>
                </div>
                <button className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                  <p className="text-lg font-semibold">
                    {formatUSD(seller.totalRevenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                  <p className="text-lg font-semibold">
                    {formatCompact(seller.totalCalls)}
                  </p>
                </div>
              </div>

              {seller.totalPlatformFees > 0 && (
                <div className="mt-3 rounded-lg bg-success/5 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Platform Fees Earned</p>
                  <p className="text-sm font-semibold text-success">
                    {formatUSD(seller.totalPlatformFees)}
                  </p>
                </div>
              )}

              <div className="mt-4 border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  Avg cost per call
                </p>
                <p className="font-medium">
                  {seller.totalCalls > 0
                    ? formatUSD(seller.totalRevenue / seller.totalCalls)
                    : '$0.00'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
