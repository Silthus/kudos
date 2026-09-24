import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts", "tests/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
