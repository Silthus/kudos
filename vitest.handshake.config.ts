import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "handshake",
    include: ["testing/handshake/**/*.handshake.ts"],
    globalSetup: ["testing/handshake/disposableBackend.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
