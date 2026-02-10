import { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}

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

/** Verify the authenticated user owns this organization. */
export async function requireOrgAccess(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">
) {
  const identity = await requireAuth(ctx);
  const org = await ctx.db.get(orgId);
  if (!org) {
    throw new Error("Organization not found");
  }
  if (org.clerkUserId && org.clerkUserId !== identity.subject) {
    throw new Error("Unauthorized: you do not own this organization");
  }
  return { identity, org };
}

/** Verify the authenticated user owns this agent via org membership. */
export async function requireAgentAccess(
  ctx: QueryCtx | MutationCtx,
  agentId: Id<"agents">
) {
  const identity = await requireAuth(ctx);
  const agent = await ctx.db.get(agentId);
  if (!agent) {
    throw new Error("Agent not found");
  }
  const org = await ctx.db.get(agent.orgId);
  if (!org || (org.clerkUserId && org.clerkUserId !== identity.subject)) {
    throw new Error("Unauthorized: you do not own this agent");
  }
  return { identity, agent, org };
}

export async function requireSellerAccess(
  ctx: QueryCtx | MutationCtx,
  sellerId: Id<"sellers">
) {
  const identity = await requireAuth(ctx);
  const seller = await ctx.db.get(sellerId);
  if (!seller) {
    throw new Error("Seller not found");
  }
  if (seller.orgId) {
    const org = await ctx.db.get(seller.orgId);
    if (!org || (org.clerkUserId && org.clerkUserId !== identity.subject)) {
      throw new Error("Unauthorized: you do not own this seller");
    }
  }
  return { identity, seller };
}

/**
 * Timing-safe string comparison for Convex's V8 runtime (no Buffer/crypto).
 * Always compares full length to avoid length oracles.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let result = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    result |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
  }
  return result === 0;
}
