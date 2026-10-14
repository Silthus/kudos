import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

type Mode = "light" | "dark";

const websiteDirectory = join(__dirname, "..");
const stylesheets = [
  readFileSync(join(websiteDirectory, "node_modules", "@posthog", "quill", "dist", "tokens.css"), "utf8"),
  readFileSync(join(websiteDirectory, "src", "index.css"), "utf8"),
];

function declarationsIn(mode: Mode) {
  const tokens = new Map<string, string>();
  const cascade: Mode[] = mode === "dark" ? ["light", "dark"] : ["light"];
  for (const layer of cascade) {
    for (const css of stylesheets) {
      for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (selector!.includes("@theme") || selector!.includes(".dark") !== (layer === "dark")) continue;
        for (const [, name, value] of body!.matchAll(/--([\w-]+):\s*([^;]+);/g)) tokens.set(name!, value!.trim());
      }
    }
  }
  return tokens;
}

function resolve(tokens: Map<string, string>, name: string): string {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`--${name} is not a theme token`);
  return value
    .replace(/var\(--([\w-]+)\)/g, (_, inner: string) => resolve(tokens, inner))
    .replace(/calc\(([\d.]+) \* ([\d.]+)\)/g, (_, a: string, b: string) => String(Number(a) * Number(b)));
}

function luminanceOfOklch(colour: string) {
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(colour);
  if (match === null) throw new Error(`${colour} is not an oklch colour`);
  const [lightness, chroma, hue] = match.slice(1).map(Number) as [number, number, number];
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (channel: number) => Math.min(1, Math.max(0, channel));
  const red = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(mode: Mode, paint: string, surface: string) {
  const tokens = declarationsIn(mode);
  const [one, two] = [paint, surface].map((name) => luminanceOfOklch(resolve(tokens, name))) as [number, number];
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

function paintsOf(element: Element) {
  const fromStroke = [...(element.getAttribute("stroke") ?? "").matchAll(/var\(--([\w-]+)\)/g)].map((match) => match[1]!);
  const fromClasses = [...element.classList].flatMap((name) => /^(?:bg|border)-((?:muted-)?foreground)$/.exec(name)?.[1] ?? []);
  const paints = [...fromStroke, ...fromClasses];
  if (paints.length === 0) throw new Error(`<${element.tagName.toLowerCase()} class="${element.className}"> paints with no theme token`);
  return paints;
}

function heroGraphics() {
  renderApp(shellFixtures.memberAtLevel7);
  const hero = within(screen.getByRole("main")).getByRole("region", { name: "Sam Example" });
  const avatar = within(screen.getByRole("banner")).getByRole("link", { name: "Sam Example, level 7" });
  const bar = within(hero).getByRole("progressbar");
  return [
    { part: "the hero ring's arc and track", surfaces: ["card"], elements: [...within(hero).getByRole("img", { name: /^Level 7/ }).querySelectorAll("circle")] },
    { part: "the HUD ring's arc and track", surfaces: ["card", "background"], elements: [...within(avatar).getByRole("img", { name: /^Level 7/ }).querySelectorAll("circle")] },
    { part: "the XP bar's track and fill", surfaces: ["card"], elements: [bar, bar.firstElementChild!] },
    { part: "the pips, left and spent", surfaces: ["card"], elements: [...within(hero).getByRole("img", { name: "1 of 3 kudos left today" }).children] },
  ];
}

describe("WS112 V24: the ring, the XP bar and the pips meet 3:1 against their surface in both modes", () => {
  beforeEach(() => {
    fakeSystemTheme(false);
  });

  for (const mode of ["light", "dark"] as const) {
    it(`in ${mode}`, () => {
      const measured = heroGraphics().flatMap(({ part, surfaces, elements }) =>
        elements.flatMap((element) => paintsOf(element).flatMap((paint) => surfaces.map((surface) => ({ part, paint, surface, ratio: contrast(mode, paint, surface) })))),
      );
      expect(measured.length).toBeGreaterThanOrEqual(12);
      expect(measured.filter(({ ratio }) => ratio < 3)).toEqual([]);
    });
  }
});

const quillPrimitives = readFileSync(join(websiteDirectory, "node_modules", "@posthog", "quill", "dist", "primitives.css"), "utf8");

function colourTokenOfQuillClass(name: string) {
  const rule = new RegExp(`\\.${name}\\{color:var\\(--([\\w-]+)\\)`).exec(quillPrimitives);
  if (rule === null) throw new Error(`.${name} sets no colour token`);
  return rule[1]!;
}

function showMoreChevrons() {
  window.history.replaceState(null, "", "/leaderboard");
  renderApp(shellFixtures.memberWithTheBoard, fixedLeaderboard(leaderboardFixtures.longBoardViewerInTheMiddle));
  return within(screen.getByRole("main"))
    .getAllByRole("button", { name: /^Show \d+ more (above|below)$/ })
    .map((button) => {
      const variant = [...button.classList].find((name) => name.startsWith("quill-button--variant-"))!;
      const chevron = button.querySelector("svg")!;
      expect([...chevron.classList].filter((name) => /^(text|fill|stroke)-/.test(name))).toEqual([]);
      return colourTokenOfQuillClass(variant);
    });
}

describe("WS339 V24: the Show more chevrons meet 3:1 against the board's card in both modes", () => {
  beforeEach(() => {
    fakeSystemTheme(false);
  });

  for (const mode of ["light", "dark"] as const) {
    it(`in ${mode}`, () => {
      const paints = showMoreChevrons();
      expect(paints).toHaveLength(2);
      expect(paints.filter((paint) => contrast(mode, paint, "card") < 3)).toEqual([]);
    });
  }
});

function navMarks() {
  window.history.replaceState(null, "", "/quests");
  renderApp(shellFixtures.memberWithEveryNavState);
  const nav = screen.getByRole("navigation", { name: "Screens" });
  const tokenOf = (element: Element, prefix: string) => [...element.classList].flatMap((name) => new RegExp(`^${prefix}-((?:muted-|primary-)?foreground|primary)$`).exec(name)?.[1] ?? []);
  const pill = within(nav).getByRole("link", { name: "Quests" });
  const next = within(nav).getByRole("link", { name: "Book, locked. Unlocks at level 4" });
  const ready = within(nav).getByRole("button", { name: "Leaderboard: unlock ready. Open its crate" });
  return [
    { part: "the current entry's pill against the bar", paints: tokenOf(pill, "max-lg:bg"), surface: "card", least: 3 },
    { part: "the pill's label and icon on the pill", paints: tokenOf(pill, "max-lg:text"), surface: "primary", least: 4.5 },
    { part: "the next unlock's lock and label", paints: tokenOf(next, "text"), surface: "card", least: 4.5 },
    { part: "the ready entry's crate glyph and label", paints: tokenOf(ready, "text"), surface: "card", least: 4.5 },
  ];
}

describe("WS339 V24: the nav's pill, lock and crate meet their contrast against the bar in both modes", () => {
  beforeEach(() => {
    fakeSystemTheme(false);
  });

  for (const mode of ["light", "dark"] as const) {
    it(`in ${mode}`, () => {
      const measured = navMarks().flatMap(({ part, paints, surface, least }) => {
        expect(paints, part).toHaveLength(1);
        return paints.map((paint) => ({ part, ratio: contrast(mode, paint, surface), least }));
      });
      expect(measured.filter(({ ratio, least }) => ratio < least)).toEqual([]);
    });
  }
});
