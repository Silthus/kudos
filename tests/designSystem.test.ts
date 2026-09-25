// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

/**
 * The pixel design system's contract (#126, #127): the dusk-garden palette is the only set of
 * colour tokens, and the app reads in Pixelify Sans (display) and Nunito (everything readable).
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const css = readFileSync(path.join(ROOT, "src/index.css"), "utf8");
const themeBlock = css.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const colorTokens = Object.fromEntries([...themeBlock.matchAll(/--color-([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().toUpperCase()]));

test("the colour tokens are exactly the dusk-garden palette", () => {
  expect(colorTokens).toEqual({
    dusk: "#241E33",
    "dusk-deep": "#161226",
    hedge: "#4F7A3C",
    "hedge-deep": "#2F5128",
    soil: "#5A3B2A",
    bark: "#3A2A22",
    parchment: "#EFE3C4",
    "parchment-deep": "#D9C79C",
    lantern: "#F7A501",
    ember: "#F54E00",
    // The one addition to #126's table: ember's text shade, since ember on parchment is 2.8:1 (fails AA).
    "ember-deep": "#A83800",
    pond: "#2F80FA",
    "pond-deep": "#1E3F7A",
    ink: "#1D1F27",
    cream: "#F6EFE4",
    // Compare's neutral benchmark series (dataviz), unchanged.
    benchmark: "#B3ADA4",
    "r-common": "#A5A19A",
    "r-uncommon": "#6AA84F",
    "r-rare": "#2F80FA",
    "r-epic": "#8567FF",
    "r-legendary": "#F7A501",
  });
});

test("the display face is Pixelify Sans and the reading face is Nunito, with no monospace", () => {
  expect(themeBlock).toMatch(/--font-display:\s*"Pixelify Sans Variable"/);
  expect(themeBlock).toMatch(/--font-sans:\s*"Nunito Variable"/);
  expect(themeBlock).not.toMatch(/--font-mono/);
  expect(css).toContain('@import "@fontsource-variable/pixelify-sans"');
  expect(css).toContain('@import "@fontsource-variable/nunito"');
  const deps = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).dependencies;
  expect(Object.keys(deps).filter((d) => d.startsWith("@fontsource")).sort()).toEqual(["@fontsource-variable/nunito", "@fontsource-variable/pixelify-sans"]);
});

test("the stylesheet has no blur, glass, gradient, grain or shimmer", () => {
  expect(css).not.toMatch(/blur|gradient|grain|shimmer|backdrop/i);
});
