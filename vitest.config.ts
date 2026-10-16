import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";

const everyCoreOnCi = process.env.CI ? availableParallelism() : undefined;

export default defineConfig({
  test: {
    passWithNoTests: true,
    maxWorkers: everyCoreOnCi,
    projects: [
      {
        test: {
          name: "convex",
          include: ["**/*.test.ts"],
          exclude: ["node_modules/**", "website/**"],
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
          env: { KUDOS_EMOJI: "" },
        },
      },
      "website",
      {
        test: {
          name: "website-build",
          include: ["website/src/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
