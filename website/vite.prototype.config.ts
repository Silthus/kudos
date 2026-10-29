// PROTOTYPE (Silthus/personal#220): builds and previews the Book prototype behind the Coder proxy. Never merge.
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

export default mergeConfig(base, defineConfig({ build: { outDir: "dist-prototype-book" }, preview: { allowedHosts: [".coder.dev.posthog.dev"] } }));
