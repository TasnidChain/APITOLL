import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Clerk auth is handled client-side via ClerkClientProvider + useClerkReady.
// clerkMiddleware requires CLERK_SECRET_KEY via process.env which is
// unavailable in the Cloudflare Workers runtime, so we skip it here.
export default function middleware(_req: NextRequest) {
  const response = NextResponse.next()

  // SECURITY FIX: Add security headers to all responses
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  return response
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
