import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";
import { contrast, type Mode } from "./test/themeTokens";

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
