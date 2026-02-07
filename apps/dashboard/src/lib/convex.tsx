'use client'

import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { ReactNode } from 'react'

// Fallback to a placeholder URL during static export (SSR prerendering).
// At runtime in the browser, the real NEXT_PUBLIC_CONVEX_URL will be baked
// into the JS bundle by Next.js at build time.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://placeholder.convex.cloud'

const convex = new ConvexReactClient(convexUrl)

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}

export { convex }
