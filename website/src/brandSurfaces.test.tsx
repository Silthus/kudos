import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrast, themeTokenOf, type Mode } from "./test/themeContrast";

const siteCss = readFileSync(join(__dirname, "index.css"), "utf8");

const posthogComSurfaces: Record<Mode, Record<string, string>> = {
  light: { background: "#eeefe9", card: "#fdfdf8", muted: "#e5e7e0", chrome: "#e5e7e0", border: "#bfc1b7" },
  dark: { background: "#1e1f23", card: "#25262b", muted: "#2d2e37", chrome: "#1e1f23", border: "#3e424f", "muted-foreground": "#aeb3c4" },
};

function rulesOf(selector: string) {
  const escaped = selector.replace(/[.*]/g, "\\$&");
  return [...siteCss.matchAll(new RegExp(`^${escaped} \\{([^}]*)\\}`, "gm"))].map(([, body]) => body!);
}

describe.each(["light", "dark"] as const)("#453: the %s surfaces are posthog.com's", (mode) => {
  it.each(Object.entries(posthogComSurfaces[mode]))("sets --%s to %s", (token, hex) => {
    expect(themeTokenOf(mode, token)).toBe(hex);
  });

  it("keeps V24's text contrast on the canvas and on a card", () => {
    expect(contrast(mode, "foreground", "background")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(mode, "foreground", "card")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(mode, "muted-foreground", "card")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(mode, "muted-foreground", "background")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(mode, "ring", "card")).toBeGreaterThanOrEqual(3);
  });
});

describe("#453: the canvas is flat, as posthog.com's is", () => {
  it("paints no glow behind the HUD in either mode", () => {
    expect(rulesOf(".hud-root")).toEqual([]);
    expect(rulesOf(".dark .hud-root")).toEqual([]);
  });
});
