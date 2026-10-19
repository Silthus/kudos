import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { emojiArt } from "./emojiArt.ts";
import { emojiCharacters } from "./emojiCharacters.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), emojiCharacters(), emojiArt()],
  build: { modulePreload: { polyfill: false }, sourcemap: true },
});
