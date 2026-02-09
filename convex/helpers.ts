import { QueryCtx, MutationCtx } from "./_generated/server";

// ═══════════════════════════════════════════════════
// Shared Auth Helpers
// ═══════════════════════════════════════════════════

/**
 * Require a logged-in Clerk user.
 * Returns the user identity or throws if not authenticated.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}

/**
 * Require the caller to be an admin.
 * Checks the Clerk user ID (from JWT identity.subject) against
 * the ADMIN_USER_IDS environment variable (comma-separated list).
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await requireAuth(ctx);
  const adminIds = (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!adminIds.includes(identity.subject)) {
    throw new Error("Not authorized — admin access required");
  }

  return identity;
}
