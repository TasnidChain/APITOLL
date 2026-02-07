'use client'

import { ClerkProvider } from '@clerk/nextjs'

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export function ClerkClientProvider({ children }: { children: React.ReactNode }) {
  if (!publishableKey) {
    return <>{children}</>
  }
  return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>
}
