import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { emojiCharacters } from "./emojiCharacters";

export default defineConfig({
  plugins: [react(), emojiCharacters()],
  test: {
    name: "website",
    include: ["src/**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: { include: [/quill-scroll-area-shadows-[^/]+\.css/] },
  },
});
