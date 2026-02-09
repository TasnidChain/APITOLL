'use client'

import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useAuth } from '@clerk/nextjs'
import { ReactNode } from 'react'

// NEXT_PUBLIC_CONVEX_URL is baked into the JS bundle at build time.
// This MUST be set via Railway build args — no hardcoded fallback.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
if (!convexUrl) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL environment variable is required')
}

const convex = new ConvexReactClient(convexUrl)

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}

export { convex }
