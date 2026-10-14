import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const websiteDirectory = join(__dirname, "..");
const siteCss = readFileSync(join(websiteDirectory, "src", "index.css"), "utf8");
const quillTokens = readFileSync(join(websiteDirectory, "node_modules", "@posthog", "quill", "dist", "tokens.css"), "utf8");

const tiers = ["bronze", "silver", "gold", "diamond"] as const;

function blockOf(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf("}", start));
}

function metalIn(block: string, tier: string) {
  const hex = new RegExp(`--medal-${tier}: (#[0-9a-f]{6});`).exec(block)?.[1];
  if (hex === undefined) throw new Error(`--medal-${tier} is not defined as a hex colour`);
  return hex;
}

function cardLightness(mode: "light" | "dark") {
  const lightnesses = [...quillTokens.matchAll(/--card: oklch\(([\d.]+) calc/g)].map((match) => Number(match[1]));
  return mode === "light" ? lightnesses[0]! : lightnesses[1]!;
}

function luminanceOfHex(hex: string) {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255).map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function luminanceOfNeutralOklch(lightness: number) {
  return lightness ** 3;
}

function contrast(a: number, b: number) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const modes = [
  { mode: "light", block: blockOf(siteCss, ":root") },
  { mode: "dark", block: blockOf(siteCss, ".dark") },
] as const;

describe("WS94 V24: each medal metal is a token with 3:1 against its card", () => {
  for (const { mode, block } of modes) {
    it.each(tiers)(`%s in ${mode}`, (tier) => {
      const card = luminanceOfNeutralOklch(cardLightness(mode));
      expect(contrast(luminanceOfHex(metalIn(block, tier)), card)).toBeGreaterThanOrEqual(3);
    });
  }
});
