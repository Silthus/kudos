// PROTOTYPE (Silthus/personal#172): builds and previews the quests prototype behind the Coder proxy. Never merge.
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

export default mergeConfig(base, defineConfig({ build: { outDir: "dist-prototype-quests" }, preview: { allowedHosts: [".coder.dev.posthog.dev"] } }));
