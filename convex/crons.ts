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

// ═══════════════════════════════════════════════════
// Moat Crons
// ═══════════════════════════════════════════════════

// Recalculate all seller trust scores hourly
crons.interval(
  "recalculate seller scores",
  { hours: 1 },
  internal.sellerReputation.recalculateAllScores,
);

// Evaluate alert rules every 5 minutes
crons.interval(
  "evaluate alerts",
  { minutes: 5 },
  internal.alertEvaluator.evaluateAlerts,
);

// Auto-release expired escrow payments every 5 minutes
crons.interval(
  "auto-release expired escrow",
  { minutes: 5 },
  internal.escrow.autoReleaseExpired,
);

export default crons;
