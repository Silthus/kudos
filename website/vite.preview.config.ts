// PROTOTYPE (throwaway): serves the prototype build behind the Coder proxy.
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config.ts";

export default mergeConfig(base, defineConfig({ preview: { host: "127.0.0.1", allowedHosts: [".coder.dev.posthog.dev"] } }));
