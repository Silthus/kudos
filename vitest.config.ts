import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**"],
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    passWithNoTests: true,
    env: { KUDOS_EMOJI: "" },
  },
});
