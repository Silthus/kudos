import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { emojiCharacters } from "./emojiCharacters";

export default defineConfig({
  plugins: [react(), tailwindcss(), emojiCharacters()],
  build: { modulePreload: { polyfill: false } },
});
