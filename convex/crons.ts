import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up expired rate limit records every 10 minutes
// Prevents unbounded growth of the rateLimits table
crons.interval(
  "cleanup rate limits",
  { minutes: 10 },
  internal.rateLimit.cleanupExpired,
);

export default crons;
