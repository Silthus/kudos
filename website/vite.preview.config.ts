import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config.ts";

const allowedHosts = [".coder.dev.posthog.dev"];

export default mergeConfig(base, defineConfig({ server: { allowedHosts }, preview: { allowedHosts } }));
