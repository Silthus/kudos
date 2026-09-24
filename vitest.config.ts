import path from "node:path";
import { defineConfig } from "vitest/config";
import { TEST_ENV } from "./src/testing/env.ts";

export default defineConfig({
  // The app's `@/…` imports, as in vite.config.ts, so page components can be tested.
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  // Tests never read `.env*` files: a clean clone has none, and a developer's `.env.local` points
  // at their own backend. `test.env` pins the `VITE_*` URLs instead (guarded by src/testing/env.test.ts).
  envDir: false,
  test: {
    env: TEST_ENV,
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
