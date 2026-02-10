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
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    )
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
