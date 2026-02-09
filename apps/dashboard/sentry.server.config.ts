import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Performance monitoring — sample 20% of transactions
  tracesSampleRate: 0.2,

  // Filter out noise
  ignoreErrors: [
    // Convex WebSocket reconnects (expected)
    "WebSocket",
    // Clerk token refresh (expected)
    "CLERK_",
  ],

  // Tag all events with the app
  initialScope: {
    tags: {
      app: "dashboard-server",
      platform: "apitoll",
    },
  },
});
