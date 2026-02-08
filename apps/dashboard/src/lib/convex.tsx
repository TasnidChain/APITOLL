'use client'

import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { ReactNode } from 'react'

// NEXT_PUBLIC_CONVEX_URL is baked into the JS bundle at build time.
// During SSR/prerendering it may not exist yet, so we fall back to
// a dummy URL that gets replaced when the real env var is set at build.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://placeholder.convex.cloud'

const convex = new ConvexReactClient(convexUrl)

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}

export { convex }
