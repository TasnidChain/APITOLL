import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Performance monitoring — sample 20% of transactions in production
  tracesSampleRate: 0.2,

  // Session replay — capture 10% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Filter out noise
  ignoreErrors: [
    // Browser extensions
    "ResizeObserver loop",
    // Network errors from ad blockers
    "Failed to fetch",
    "Load failed",
    // Clerk auth redirects (expected behavior)
    "CLERK_",
  ],

  // Tag all events with the app
  initialScope: {
    tags: {
      app: "dashboard",
      platform: "apitoll",
    },
  },
});
