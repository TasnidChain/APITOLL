'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { ClerkProvider } from '@clerk/nextjs'

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''

const ClerkReadyContext = createContext(false)

export function useClerkReady() {
  return useContext(ClerkReadyContext)
}

export function ClerkClientProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !PUBLISHABLE_KEY) {
    return (
      <ClerkReadyContext.Provider value={false}>
        {children}
      </ClerkReadyContext.Provider>
    )
  }

  return (
    <ClerkReadyContext.Provider value={true}>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>{children}</ClerkProvider>
    </ClerkReadyContext.Provider>
  )
}
