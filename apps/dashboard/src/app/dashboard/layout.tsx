'use client'

import {
  SignedIn,
  SignedOut,
  RedirectToSignIn,
} from '@clerk/nextjs'
import { Sidebar, MobileHeader } from '@/components/sidebar'
import { ConvexClientProvider } from '@/lib/convex'
import { useClerkReady } from '@/components/clerk-provider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const clerkReady = useClerkReady()

  if (!clerkReady) {
    return null
  }

  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <ConvexClientProvider>
          <div className="flex h-screen flex-col md:flex-row bg-background text-foreground">
            <MobileHeader />
            <Sidebar />
            <main className="flex-1 overflow-auto bg-muted/30">
              {children}
            </main>
          </div>
        </ConvexClientProvider>
      </SignedIn>
    </>
  )
}
