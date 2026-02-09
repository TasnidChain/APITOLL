const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@apitoll/shared'],
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
