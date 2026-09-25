// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

/**
 * The pixel style holds on every screen (#126, #127): no old dark-UI tokens, no monospace, no
 * soft shadows, blur, glass, gradients or grain, no rounded panels (only `rounded-full`, for
 * avatars, the coin and Slack mocks), no all-caps labels. Pixel-step shadows (no blur) are fine.
 */

const SRC = path.resolve(import.meta.dirname, "../src");
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return p.endsWith(`${path.sep}testing`) ? [] : sources(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const FORBIDDEN: [string, RegExp][] = [
  ["old colour token", /(?<![\w-])(?:[\w-]+:)*(?:text|bg|border|ring|ring-offset|fill|stroke|divide|from|via|to|decoration|outline|accent)-(?:saffron|teal|panel|line|line-strong|muted|faint|up|down)(?:-[23]|-deep|-soft|-strong)?(?:\/[\w.[\]]+)?(?![\w-])/],
  ["old colour variable", /var\(--color-(?:saffron|teal|panel|line|muted|faint|up|down)/],
  ["monospace", /(?<![\w-])font-mono(?![\w-])/],
  ["blur or glass", /(?<![\w-])(?:[\w-]+:)*(?:backdrop-blur|blur)(?:-\w+)?(?![\w-])/],
  ["grain", /(?:className=|clsx\()[^;]*(?<![\w.-])grain(?![\w:-])/],
  ["gradient utility", /(?<![\w-])bg-(?:gradient|linear|radial)-/],
  ["rounded panel", /(?<![\w-])(?:[\w-]+:)*rounded(?:-(?:xs|sm|md|lg|xl|2xl|3xl|[tblr]|[tb][lr]|[tblr]-\w+|\[[^\]]+\]))?(?![\w-])/],
  ["soft shadow", /(?<![\w-])(?:[\w-]+:)*shadow(?:-(?:sm|md|lg|xl|2xl|inner))?(?![\w[-])/],
  ["all-caps label", /(?<![\w-])uppercase(?![\w-])/],
  ["hidden focus ring", /(?<![\w-])(?:[\w-]+:)*outline-none(?![\w-])/],
  ["drop shadow", /(?<![\w-])(?:[\w-]+:)*drop-shadow(?:-\w+)?(?![\w-])/],
  ["looping animation",/(?<![\w-])animate-(?:pulse|float|shimmer|bounce|ping)(?![\w-])/],
];

/** A `shadow-[…]` whose any layer has a non-zero blur: `x y blur spread color`. */
const SOFT_ARBITRARY_SHADOW = /shadow-\[([^\]]+)\]/g;
function hasBlur(value: string) {
  return value.split(/,(?![^(]*\))/).some((layer) => {
    const lengths = layer.replace(/^inset_/, "").split("_").filter((t) => /^-?\d/.test(t));
    return lengths.length >= 3 && parseFloat(lengths[2]) !== 0;
  });
}

test("every screen is drawn with the pixel kit only", () => {
  const offences: string[] = [];
  for (const file of sources(SRC)) {
    const rel = path.relative(SRC, file);
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line)) return; // comments may name what's gone
        for (const [what, re] of FORBIDDEN) {
          const m = line.match(re);
          if (m) offences.push(`${rel}:${i + 1} ${what}: ${m[0]}`);
        }
        for (const m of line.matchAll(SOFT_ARBITRARY_SHADOW)) if (hasBlur(m[1])) offences.push(`${rel}:${i + 1} soft shadow: ${m[0]}`);
      });
  }
  expect(offences).toEqual([]);
});

test("a pixel-step shadow passes and a blurred one doesn't", () => {
  expect(hasBlur("3px_3px_0_0_var(--color-r-epic)")).toBe(false);
  expect(hasBlur("0_0_12px_var(--color-up)")).toBe(true);
  expect(hasBlur("3px_3px_0_0_var(--color-r-legendary),6px_6px_0_0_var(--color-ember)")).toBe(false);
});
