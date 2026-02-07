import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Clerk auth is handled client-side via ClerkClientProvider + useClerkReady.
// clerkMiddleware requires CLERK_SECRET_KEY via process.env which is
// unavailable in the Cloudflare Workers runtime, so we skip it here.
export default function middleware(_req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
