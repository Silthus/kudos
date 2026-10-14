import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { contrast, websiteDirectory, type Mode } from "./test/themeContrast";
import { fakeSystemTheme, preferWideScreen } from "./test/systemTheme";

function paintsOf(element: Element) {
  const fromStroke = [...(element.getAttribute("stroke") ?? "").matchAll(/var\(--([\w-]+)\)/g)].map((match) => match[1]!);
  const fromClasses = [...element.classList].flatMap((name) => /^(?:before:)?(?:bg|border|text|ring)-((?:muted-)?foreground|primary)$/.exec(name)?.[1] ?? []);
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
    { part: "the hero ring's arc and track", surfaces: ["background"], elements: [...within(hero).getByRole("img", { name: /^Level 7/ }).querySelectorAll("circle")] },
    { part: "the HUD ring's arc and track", surfaces: ["card", "background"], elements: [...within(avatar).getByRole("img", { name: /^Level 7/ }).querySelectorAll("circle")] },
    { part: "the XP bar's track and fill", surfaces: ["background"], elements: [bar, bar.firstElementChild!] },
    { part: "the pips, left and spent", surfaces: ["background"], elements: [...within(hero).getByRole("img", { name: "1 of 3 kudos left today" }).children] },
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

describe("WS312 WS339 V24: the first-kudos nudge's icon and its frame meet 3:1 in both modes", () => {
  for (const mode of ["light", "dark"] as const) {
    it(`in ${mode}`, () => {
      renderApp(shellFixtures.memberBeforeTheirFirstKudos);
      const nudge = within(screen.getByRole("main")).getByRole("region", { name: "Give your first kudos in Slack" });
      const icon = nudge.querySelector("svg")!;
      const parts = [
        { part: "the message icon", surface: "muted", element: icon },
        { part: "the icon's frame", surface: "card", element: icon.parentElement! },
      ];
      const measured = parts.flatMap(({ part, surface, element }) => paintsOf(element).map((paint) => ({ part, paint, surface, ratio: contrast(mode, paint, surface) })));
      expect(measured.map(({ paint }) => paint)).toEqual(["foreground", "muted-foreground"]);
      expect(measured.filter(({ ratio }) => ratio < 3)).toEqual([]);
    });
  }
});

function railGraphics() {
  renderApp(shellFixtures.memberWithEveryPanelOpen, fixedLeaderboard(leaderboardFixtures.midBoard), undefined, fixedQuests(questsFixtures.week));
  const quests = within(screen.getByRole("main")).getByRole("region", { name: "Quests this week" });
  const standing = within(screen.getByRole("main")).getByRole("region", { name: "Where you stand" });
  const bar = within(quests).getByRole("progressbar");
  return [
    { part: "a quest's progress bar, track and fill", surfaces: ["card"], elements: [bar, bar.firstElementChild!] },
    { part: "the you ring in Where you stand", surfaces: ["card"], elements: [standing.querySelector("[data-you-ring]")!] },
  ];
}

describe("WS112 V24: the rail's progress bars and the you ring meet 3:1 against their card in both modes", () => {
  beforeEach(() => {
    fakeSystemTheme(false);
  });

  for (const mode of ["light", "dark"] as const) {
    it(`in ${mode}`, () => {
      const measured = railGraphics().flatMap(({ part, surfaces, elements }) =>
        elements.flatMap((element) => paintsOf(element).flatMap((paint) => surfaces.map((surface) => ({ part, paint, surface, ratio: contrast(mode, paint, surface) })))),
      );
      expect(measured.map(({ paint }) => paint)).toEqual(["muted-foreground", "muted-foreground", "primary"]);
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

function ladderGraphics() {
  return ["giving", "thanked", "connections", "crowd"].flatMap((page) => {
    cleanup();
    window.history.replaceState(null, "", `/book?page=${page}`);
    renderApp(shellFixtures.memberWithTheBookOpened, undefined, undefined, undefined, fixedBook(bookFixtures.everyLadder));
    const ladders = screen.getByRole("main");
    return [
      { part: "each rosette's rim, ring and sparkle", surfaces: ["card"], elements: [...ladders.querySelectorAll("[data-rosette] [stroke^='var(']")] },
      { part: "each Next cell's ring", surfaces: ["card"], elements: [...ladders.querySelectorAll(".ring-foreground")] },
    ];
  });
}

describe("WS333 WS339 V24: the rosettes and the Next rings meet 3:1 against their card in both modes", () => {
  beforeEach(() => {
    fakeSystemTheme(false);
  });

  for (const mode of ["light", "dark"] as const) {
    it(`in ${mode}`, () => {
      const measured = ladderGraphics().flatMap(({ part, surfaces, elements }) =>
        elements.flatMap((element) => paintsOf(element).flatMap((paint) => surfaces.map((surface) => ({ part, paint, surface, ratio: contrast(mode, paint, surface) })))),
      );
      expect(new Set(measured.map(({ paint }) => paint))).toEqual(new Set(["medal-bronze", "medal-silver", "medal-gold", "medal-diamond", "muted-foreground", "foreground"]));
      expect(measured.filter(({ ratio }) => ratio < 3)).toEqual([]);
    });
  }
});

function overviewGraphics() {
  preferWideScreen();
  window.history.replaceState(null, "", "/book");
  renderApp(shellFixtures.memberWithTheBookOpened, undefined, undefined, undefined, fixedBook(bookFixtures.everyLadder));
  const overview = screen.getByRole("main");
  const shelf = within(overview).getByRole("list", { name: "Recently earned" });
  const bars = [...overview.querySelectorAll("[role='progressbar'], [data-bar]")];
  return [
    { part: "each rosette's rim, ring and sparkle", surfaces: ["card"], elements: [...overview.querySelectorAll("[data-rosette] [stroke^='var(']")] },
    { part: "each bar's track and fill", surfaces: ["card"], elements: bars.flatMap((bar) => [bar, bar.firstElementChild!]) },
    { part: "the shelf's plank", surfaces: ["background"], elements: [shelf.previousElementSibling!] },
    { part: "the Next medal's outline", surfaces: ["card"], elements: [...overview.querySelectorAll("[data-medal='outline'] circle[stroke^='var(']")] },
    { part: "each shelved tier's medal", surfaces: ["background"], elements: [...shelf.querySelectorAll("[data-medal='earned'] circle[stroke^='var(']")] },
  ];
}

describe("WS334 WS339 V24: the overview's rosettes, bars, plank and medals meet 3:1 against their surface in both modes", () => {
  beforeEach(() => {
    fakeSystemTheme(false);
  });

  for (const mode of ["light", "dark"] as const) {
    it(`in ${mode}`, () => {
      const measured = overviewGraphics().flatMap(({ part, surfaces, elements }) =>
        elements.flatMap((element) => paintsOf(element).flatMap((paint) => surfaces.map((surface) => ({ part, paint, surface, ratio: contrast(mode, paint, surface) })))),
      );
      expect(new Set(measured.map(({ part }) => part)).size).toBe(5);
      expect(new Set(measured.map(({ paint }) => paint))).toEqual(new Set(["medal-bronze", "medal-silver", "medal-gold", "medal-diamond", "muted-foreground"]));
      expect(measured.filter(({ ratio }) => ratio < 3)).toEqual([]);
    }, 30_000);
  }
});

const darkModeRule = ":is(.dark,[theme=dark]) ";

function quillBackgroundToken(selector: string, inDarkMode: boolean) {
  const escaped = (inDarkMode ? darkModeRule + selector : selector).replace(/[.[\]():,]/g, (character) => `\\${character}`);
  const rule = new RegExp(`(?<=\\})${escaped}\\{[^}]*?background-color:var\\(--([\\w-]+)\\)`).exec(quillPrimitives);
  return rule?.[1];
}

function quillSwitchPaint(mode: Mode, state: "checked" | "unchecked", part: "" | " .quill-switch__thumb") {
  const selector = `.quill-switch[data-${state}]${part}`;
  const token = (mode === "dark" ? quillBackgroundToken(selector, true) : undefined) ?? quillBackgroundToken(selector, false) ?? (part === "" ? undefined : quillBackgroundToken(".quill-switch__thumb", false));
  if (token === undefined) throw new Error(`${selector} sets no background token in ${mode}`);
  return token;
}

function switchedOffPaints() {
  window.history.replaceState(null, "", "/leaderboard");
  renderApp(shellFixtures.memberWithTheBoard, fixedLeaderboard(leaderboardFixtures.left));
  const visibility = within(screen.getByRole("region", { name: "How it counts" })).getByRole("switch", { name: "Show me on the leaderboards" });
  const paint = (pattern: RegExp) => {
    const tokens = [...visibility.classList].flatMap((name) => pattern.exec(name)?.[1] ?? []);
    expect(tokens).toHaveLength(1);
    return tokens[0]!;
  };
  return { outline: paint(/^data-\[unchecked\]:border-((?:muted-)?foreground)$/), thumb: paint(/^data-\[unchecked\]:\[&_\[data-slot=switch-thumb\]\]:bg-((?:muted-)?foreground)$/), focus: paint(/^focus-visible:outline-((?:muted-)?foreground)$/) };
}

describe("WS339 V24: the visibility switch shows its position at 3:1 in both modes", () => {
  beforeEach(() => {
    fakeSystemTheme(false);
  });

  for (const mode of ["light", "dark"] as const) {
    it(`in ${mode}`, () => {
      const switchedOff = switchedOffPaints();
      const offTrack = quillSwitchPaint(mode, "unchecked", "");
      const onTrack = quillSwitchPaint(mode, "checked", "");
      const measured = [
        { part: "the switched-off outline on the card", ratio: contrast(mode, switchedOff.outline, "card") },
        { part: "the switched-off thumb on its track", ratio: contrast(mode, switchedOff.thumb, offTrack) },
        { part: "the focus outline on the card", ratio: contrast(mode, switchedOff.focus, "card") },
        { part: "the switched-on track on the card", ratio: contrast(mode, onTrack, "card") },
        { part: "the switched-on thumb on its track", ratio: contrast(mode, quillSwitchPaint(mode, "checked", " .quill-switch__thumb"), onTrack) },
      ];
      expect(measured.filter(({ ratio }) => ratio < 3)).toEqual([]);
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
  const later = within(nav).getByRole("link", { name: "Skill tree, locked. Unlocks at level 5" });
  const ready = within(nav).getByRole("button", { name: "Leaderboard: unlock ready. Open its crate" });
  return [
    { part: "the current entry's pill against the bar", paints: tokenOf(pill, "max-lg:bg"), surface: "card", least: 3 },
    { part: "the pill's label and icon on the pill", paints: tokenOf(pill, "max-lg:text"), surface: "primary", least: 4.5 },
    { part: "the next unlock's lock and label", paints: tokenOf(next, "text"), surface: "card", least: 4.5 },
    { part: "a later unlock's lock and label", paints: tokenOf(later, "text"), surface: "card", least: 4.5 },
    { part: "the next unlock's dashed outline", paints: tokenOf(next, "border"), surface: "card", least: 3 },
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
