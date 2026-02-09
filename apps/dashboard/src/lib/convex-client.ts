import { ConvexHttpClient } from "convex/browser";

/**
 * Shared Convex HTTP client for server-side API routes.
 *
 * Uses NEXT_PUBLIC_CONVEX_URL from environment.
 * All API routes should import this instead of creating their own client.
 */

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.warn(
    "[convex-client] NEXT_PUBLIC_CONVEX_URL is not set. Convex queries will fail."
  );
}

export const convex = new ConvexHttpClient(CONVEX_URL ?? "");
export { CONVEX_URL };
