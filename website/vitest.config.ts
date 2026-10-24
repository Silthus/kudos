import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { emojiCharacters } from "./emojiCharacters.ts";
import { postHogLogo } from "./postHogLogo.ts";

export default defineConfig({
  plugins: [react(), emojiCharacters(), postHogLogo()],
  test: {
    name: "website",
    include: ["src/**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: { include: [/quill-scroll-area-shadows-[^/]+\.css/] },
    retry: process.env.CI ? 1 : 0,
  },
});
