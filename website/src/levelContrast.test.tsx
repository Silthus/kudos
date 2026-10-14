import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "./test/systemTheme";

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
  const fromClasses = [...element.classList].flatMap((name) => /^(?:before:)?(?:bg|border|text)-((?:muted-)?foreground|primary)$/.exec(name)?.[1] ?? []);
  const paints = [...fromStroke, ...fromClasses];
  if (paints.length === 0) throw new Error(`<${element.tagName.toLowerCase()} class="${element.className}"> paints with no theme token`);
  return paints;
}

function heroGraphics() {
  renderApp(shellFixtures.memberAtLevel7);
  const hero = within(screen.getByRole("main")).getByRole("region", { name: "Sam Example" });
  const avatar = screen.getByRole("button", { name: "Account menu for Sam Example" });
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

function bookIndexGraphics() {
  window.history.replaceState(null, "", "/book?page=giving");
  const narrow = renderApp(shellFixtures.memberWithTheBookOpened, undefined, undefined, undefined, fixedBook(bookFixtures.everyLadder));
  const picker = screen.getByRole("combobox", { name: "Book page" });
  const chevron = picker.parentElement!.querySelector("svg[aria-hidden='true']")!;
  const pickerParts = [picker, chevron];
  narrow.unmount();
  preferWideScreen();
  renderApp(shellFixtures.memberWithTheBookOpened, undefined, undefined, undefined, fixedBook(bookFixtures.everyLadder));
  const current = within(screen.getByRole("navigation", { name: "Book pages" })).getByRole("link", { current: "page" });
  return [
    { part: "the picker's border and chevron", surfaces: ["card"], elements: pickerParts },
    { part: "the index's current-page stripe", surfaces: ["card"], elements: [current] },
  ];
}

describe("WS339 V24: the Book index's stripe and the page picker meet 3:1 against their card in both modes", () => {
  beforeEach(() => {
    fakeSystemTheme(false);
  });

  for (const mode of ["light", "dark"] as const) {
    it(`in ${mode}`, () => {
      const measured = bookIndexGraphics().flatMap(({ part, surfaces, elements }) =>
        elements.flatMap((element) => paintsOf(element).flatMap((paint) => surfaces.map((surface) => ({ part, paint, surface, ratio: contrast(mode, paint, surface) })))),
      );
      expect(measured.map(({ paint }) => paint)).toEqual(expect.arrayContaining(["muted-foreground", "primary"]));
      expect(measured.filter(({ ratio }) => ratio < 3)).toEqual([]);
    });
  }
});
