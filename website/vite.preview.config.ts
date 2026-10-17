// PROTOTYPE (#625): serves the fixture build behind a Coder preview link. Never merge to main.
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

export default mergeConfig(base, defineConfig({ server: { allowedHosts: [".coder.dev.posthog.dev"] }, preview: { allowedHosts: [".coder.dev.posthog.dev"] } }));
