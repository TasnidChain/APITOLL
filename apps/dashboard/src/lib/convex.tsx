'use client'

import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { ReactNode } from 'react'

// NEXT_PUBLIC_CONVEX_URL is baked into the JS bundle at build time.
// Falls back to production Convex deployment if env var is not set.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://cheery-parrot-104.convex.cloud'

const convex = new ConvexReactClient(convexUrl)

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}

export { convex }
