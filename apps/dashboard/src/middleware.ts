import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Protected API routes that require authentication
const PROTECTED_API_ROUTES = [
  '/api/stripe/checkout',
  '/api/stripe/portal',
  '/api/agents',
  '/api/playground',
]

// Clerk auth is handled client-side via ClerkClientProvider + useClerkReady.
// Server-side clerkMiddleware can be added here if CLERK_SECRET_KEY is set.
// Below we add a basic guard for API routes that checks for a Clerk session.
export default function middleware(req: NextRequest) {
  // Protect API routes — require Clerk session token
  const isProtectedApi = PROTECTED_API_ROUTES.some(route => req.nextUrl.pathname.startsWith(route))

  if (isProtectedApi) {
    // Check for Clerk session token (cookie-based auth from Clerk)
    const sessionToken = req.cookies.get('__session')?.value
      || req.cookies.get('__clerk_db_jwt')?.value
    // Check for API key auth (for programmatic access)
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('Authorization')?.replace('Bearer ', '')

    if (!sessionToken && !apiKey) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
  }

  // Note: /api/stripe/webhook is NOT protected — it uses Stripe signature verification instead

  const response = NextResponse.next()

  // Add security headers to all responses
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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.dev https://clerk.apitoll.com https://*.convex.cloud https://*.sentry.io",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.clerk.com https://*.clerk.dev https://clerk.apitoll.com https://*.sentry.io https://api.apitoll.com https://pay.apitoll.com",
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
