import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Clerk auth is handled client-side via ClerkClientProvider + useClerkReady.
// Server-side clerkMiddleware can be added here if CLERK_SECRET_KEY is set.
export default function middleware(_req: NextRequest) {
  const response = NextResponse.next()

  // SECURITY FIX: Add security headers to all responses
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.dev https://*.convex.cloud https://*.sentry.io",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.clerk.com https://*.clerk.dev https://*.sentry.io https://api.apitoll.com https://pay.apitoll.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  )

  return response
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
