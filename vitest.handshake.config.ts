import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "handshake",
    include: ["testing/handshake/**/*.handshake.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
