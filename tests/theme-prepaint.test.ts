// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { parseThemePref, resolveTheme, THEME_STORAGE_KEY } from "../src/lib/theme";

// The inline script in index.html paints the theme before React loads (no flash). It can't import
// src/lib/theme.ts, so this runs the real script and holds it to the same rules.
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = html.match(/<script id="theme-prepaint">([\s\S]*?)<\/script>/)?.[1];

function prepaint(stored: string | null, systemDark: boolean, storageThrows = false) {
  const dataset: Record<string, string> = {};
  runInNewContext(script!, {
    localStorage: {
      getItem: (key: string) => {
        if (storageThrows) throw new Error("SecurityError");
        return key === THEME_STORAGE_KEY ? stored : null;
      },
    },
    matchMedia: (query: string) => ({ matches: query === "(prefers-color-scheme: dark)" && systemDark }),
    document: { documentElement: { dataset } },
  });
  return dataset.theme;
}

describe("the pre-paint theme script in index.html", () => {
  it("is in the page head, before the app bundle", () => {
    expect(script).toBeTruthy();
    expect(html.indexOf('id="theme-prepaint"')).toBeLessThan(html.indexOf("/src/main.tsx"));
    expect(html.indexOf('id="theme-prepaint"')).toBeLessThan(html.indexOf("</head>"));
  });

  it("paints the same theme resolveTheme would, for every stored value and system setting", () => {
    for (const stored of [null, "light", "dark", "system", "garbage"]) {
      for (const systemDark of [false, true]) {
        expect(prepaint(stored, systemDark), `${stored} / system dark ${systemDark}`).toBe(resolveTheme(parseThemePref(stored), systemDark));
      }
    }
  });

  it("follows the system when storage is blocked", () => {
    expect(prepaint(null, true, true)).toBe("dark");
    expect(prepaint(null, false, true)).toBe("light");
  });
});
