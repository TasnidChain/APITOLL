/**
 * Migrate tool baseUrls from old Railway URL to canonical api.apitoll.com
 *
 * Usage:
 *   CONVEX_URL=https://your-deployment.convex.cloud npx tsx scripts/migrate-tool-urls.ts
 *
 * Or with explicit args:
 *   npx tsx scripts/migrate-tool-urls.ts \
 *     --old "https://seller-api-production.up.railway.app" \
 *     --new "https://api.apitoll.com"
 */

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error("CONVEX_URL environment variable is required");
  process.exit(1);
}

// Parse args
const args = process.argv.slice(2);
let oldBaseUrl = "https://seller-api-production.up.railway.app";
let newBaseUrl = "https://api.apitoll.com";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--old" && args[i + 1]) oldBaseUrl = args[++i];
  if (args[i] === "--new" && args[i + 1]) newBaseUrl = args[++i];
}

const convex = new ConvexHttpClient(CONVEX_URL);
const migrateRef = makeFunctionReference<"mutation">("tools:migrateBaseUrl");

async function run() {
  console.log(`\nMigrating tool base URLs...`);
  console.log(`  Old: ${oldBaseUrl}`);
  console.log(`  New: ${newBaseUrl}`);
  console.log(`  Convex: ${CONVEX_URL}\n`);

  const result = await convex.mutation(migrateRef, { oldBaseUrl, newBaseUrl });
  console.log(`✅ Updated ${result.updated} tools (of ${result.total} matched)\n`);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
