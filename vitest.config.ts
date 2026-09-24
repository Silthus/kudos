import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The app's `@/…` imports, as in vite.config.ts, so page components can be tested.
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts", "tests/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
    server: { deps: { inline: ["convex-test"] } },
    // convex-test runs every transaction in-process: CPU-bound integration tests that take a few
    // seconds alone take several times that while all files run in parallel on a busy machine.
    // Vitest's 5 s default then fails them for load alone; a real hang still fails within 30 s.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
