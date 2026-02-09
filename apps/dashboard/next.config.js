const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@apitoll/shared'],
  // SECURITY FIX: Add security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
}

module.exports = withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps for better stack traces in production
  sourcemaps: {
    // Only upload source maps in CI/production builds
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },

  // Suppress noisy Sentry build logs
  silent: !process.env.CI,

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,

  // Route handler and middleware auto-instrumentation
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
  autoInstrumentAppRouter: true,

  // Hide source maps from client bundles (security)
  hideSourceMaps: true,

  // Tunnel Sentry events through Next.js to avoid ad blockers
  tunnelRoute: "/monitoring",
});
