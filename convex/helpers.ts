import { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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

// ═══════════════════════════════════════════════════
// SECURITY FIX: Org Ownership Check (CRITICAL-01)
// Verifies the authenticated user owns the specified organization.
// ═══════════════════════════════════════════════════

export async function requireOrgAccess(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">
) {
  const identity = await requireAuth(ctx);
  const org = await ctx.db.get(orgId);
  if (!org) {
    throw new Error("Organization not found");
  }
  // Verify ownership — clerkUserId must match the authenticated user
  if (org.clerkUserId && org.clerkUserId !== identity.subject) {
    throw new Error("Unauthorized: you do not own this organization");
  }
  return { identity, org };
}

// ═══════════════════════════════════════════════════
// SECURITY FIX: Timing-Safe Secret Comparison (HIGH-02/03)
// ═══════════════════════════════════════════════════

/**
 * Timing-safe string comparison without Node.js crypto module.
 * Works in Convex's V8 runtime (no Buffer/crypto available).
 * Even on length mismatch, does full comparison to avoid length oracle.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let result = a.length ^ b.length; // non-zero if lengths differ
  for (let i = 0; i < maxLen; i++) {
    result |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
  }
  return result === 0;
}
