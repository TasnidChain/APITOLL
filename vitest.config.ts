import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["packages/**/*.test.ts", "convex/**/*.test.ts"],
    testTimeout: 10000,
    // Use edge-runtime for Convex tests, node for everything else
    environmentMatchGlobs: [
      ["convex/**", "edge-runtime"],
      ["packages/**", "node"],
    ],
    server: { deps: { inline: ["convex-test"] } },
  },
});
