import { defineConfig } from "vitest/config";

const guardTests = "**/*.guard.test.ts";

const convexRuntime = {
  environment: "edge-runtime",
  server: { deps: { inline: ["convex-test"] } },
  env: { KUDOS_EMOJI: "" },
};

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "guards",
          include: [guardTests],
          exclude: ["node_modules/**"],
          ...convexRuntime,
        },
      },
      {
        test: {
          name: "convex",
          include: ["**/*.test.ts"],
          exclude: ["node_modules/**", "website/**", guardTests],
          ...convexRuntime,
        },
      },
      "website",
      {
        test: {
          name: "website-build",
          include: ["website/src/**/*.test.ts"],
          exclude: [guardTests],
          environment: "node",
        },
      },
    ],
  },
});
