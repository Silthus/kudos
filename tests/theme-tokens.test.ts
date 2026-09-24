// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The colour tokens live once, in src/index.css (`--k-*` per theme). This holds the table to WCAG AA:
// every text role is readable on every background it's used on, in both themes.
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

function tokensIn(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in src/index.css`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--k-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2].toLowerCase()]));
}

const THEMES = { light: tokensIn(":root"), dark: tokensIn('[data-theme="dark"]') };

/** WCAG 2.x relative luminance and contrast ratio. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const BACKGROUNDS = ["bg", "sidebar", "surface", "surface-2"];
const TEXT_ROLES = ["text", "text-2", "text-3", "link", "success", "warning", "danger"];
/** Labels on filled faces: [text token, face token]. */
const FACES: [string, string][] = [
  ["btn-primary-text", "btn-primary-face"],
  ["text", "btn-secondary-face"],
  ["on-fill", "cta-face"],
  ["on-fill", "accent"],
];

describe("contrast helper", () => {
  it("matches known WCAG ratios", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrast("#f54e00", "#ffffff")).toBeCloseTo(3.5, 1); // spec #54 §3: why the brand orange never sets text
  });
});

describe.each(Object.entries(THEMES))("%s theme tokens", (name, tokens) => {
  const hex = (token: string) => {
    expect(tokens[token], `--k-${token} is defined as a 6-digit hex in the ${name} theme`).toMatch(/^#[0-9a-f]{6}$/);
    return tokens[token];
  };

  it("define the same roles as the other theme", () => {
    expect(Object.keys(tokens).sort()).toEqual(Object.keys(THEMES.light).sort());
  });

  it.each(TEXT_ROLES)("%s is AA (4.5:1) on every background", (role) => {
    for (const bg of BACKGROUNDS) {
      expect(contrast(hex(role), hex(bg)), `${role} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(FACES)("%s is AA on %s", (text, face) => {
    expect(contrast(hex(text), hex(face))).toBeGreaterThanOrEqual(4.5);
  });

  it("the accent focus ring stands out from the scene (3:1, non-text)", () => {
    for (const bg of ["bg", "sidebar", "surface"]) expect(contrast(hex("accent"), hex(bg)), `accent on ${bg}`).toBeGreaterThanOrEqual(3);
  });
});
