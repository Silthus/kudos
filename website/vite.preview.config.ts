// PROTOTYPE preview config: serve a fixture build behind the Coder proxy.
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

export default mergeConfig(base, defineConfig({ preview: { host: "127.0.0.1", allowedHosts: [".coder.dev.posthog.dev"] } }));
