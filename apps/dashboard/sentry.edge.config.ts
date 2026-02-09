import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 0.2,

  initialScope: {
    tags: {
      app: "dashboard-edge",
      platform: "apitoll",
    },
  },
});
