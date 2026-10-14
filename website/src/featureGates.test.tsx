import { act, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import type { ComponentType } from "react";
import { HedgehogOrganized, HedgehogReading, HedgehogStar, HedgehogTownCrier, HedgehogWizard } from "@posthog/brand/hoggies";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { perkOf } from "../../convex/progression/tree";
import type { BoardRead } from "./boardRead";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { shellFixtures, type CommandAnswer, type MemberProfile, type OpenAnswer } from "./shell";
import { fixedSkillTree, skillTreeFixtures } from "./skillTreeFixtures";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferReducedMotion } from "./test/systemTheme";
import { contrast, websiteDirectory, type Mode } from "./test/themeContrast";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function ruleOf(file: string, selector: string) {
  const css = readFileSync(join(websiteDirectory, file), "utf8");
  const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, head]) => head!.trim() === selector);
  expect(rule, `${file} has a ${selector} rule`).toBeDefined();
  return rule![2]!;
}

beforeEach(() => {
  fakeSystemTheme(false);
});

type FeaturePage = { name: string; path: string; level: number; sentence: string; Hog: ComponentType<{ title?: string }>; show: (member: MemberProfile, state: "locked" | "ready") => ReturnType<typeof renderApp> };

const lockedBoard: BoardRead = (period) => period && { kind: "locked", level: 3 };

const readyBoard: BoardRead = (period) => period && { kind: "ready" };

const featurePages: FeaturePage[] = [
  {
    name: "Quests",
    path: "/quests",
    level: 2,
    sentence: "Weekly quests of your own.",
    Hog: HedgehogOrganized,
    show: (member, state) => renderApp(member, undefined, opening(), fixedQuests(questsFixtures[state])),
  },
  {
    name: "Leaderboard",
    path: "/leaderboard",
    level: 3,
    sentence: "See where you and your group stand.",
    Hog: HedgehogStar,
    show: (member, state) => renderApp(member, state === "locked" ? lockedBoard : readyBoard, opening()),
  },
  {
    name: "Book",
    path: "/book",
    level: 4,
    sentence: "Achievements you earn as you thank colleagues and they thank you.",
    Hog: HedgehogReading,
    show: (member, state) => renderApp(member, undefined, opening(), undefined, fixedBook(bookFixtures[state])),
  },
  {
    name: "Skill tree",
    path: "/skills",
    level: 5,
    sentence: "Perks you choose with skill points.",
    Hog: HedgehogWizard,
    show: (member, state) => renderApp(member, undefined, opening(), undefined, undefined, fixedSkillTree(skillTreeFixtures[state])),
  },
];

function opening(openFeature = async (): Promise<CommandAnswer> => ({ kind: "opened" })) {
  return { openFeature: vi.fn(openFeature) };
}

function visit(page: FeaturePage, member: MemberProfile, state: "locked" | "ready") {
  window.history.replaceState(null, "", page.path);
  return page.show(member, state);
}

function main() {
  return screen.getByRole("main");
}

function pageTitle() {
  return within(main()).getByRole("heading", { level: 1 });
}

function dialog() {
  return screen.getByRole("dialog");
}

function artOf(Hog: ComponentType<{ title?: string }>) {
  const { container, unmount } = render(<Hog title="" />);
  const markup = container.querySelector("svg")!.innerHTML;
  unmount();
  return markup;
}

function showsArt(Hog: ComponentType<{ title?: string }>) {
  const art = artOf(Hog);
  return [...main().querySelectorAll("svg")].some((svg) => svg.innerHTML === art);
}

describe("WS323: a locked feature page shows the feature's own hedgehog, its level and its sentence", () => {
  describe.each(featurePages)("$name", (page) => {
    beforeEach(() => visit(page, shellFixtures.memberWithEveryPanelLocked, "locked"));

    it("titles the page with the feature's name and the level it unlocks at", () => {
      expect(pageTitle()).toHaveTextContent(page.name);
      expect(pageTitle()).toHaveTextContent(`Unlocks at level ${page.level}`);
      expect(document.title).toBe(`HedgeHug · ${page.name}`);
    });

    it("says the feature's sentence and leads Back to your profile", () => {
      expect(main()).toHaveTextContent(page.sentence);
      expect(within(main()).getByRole("link", { name: "Back to your profile" })).toHaveAttribute("href", "/");
    });

    it("shows the feature's hedgehog in silhouette with a padlock, never generic Max", () => {
      expect(showsArt(page.Hog)).toBe(true);
      expect(main().querySelector("[data-silhouette]")).toContainElement(main().querySelector("svg"));
      expect(main().querySelector("[data-padlock]")).not.toBeNull();
      expect(showsArt(HedgehogTownCrier)).toBe(false);
    });

    it("shows no progress, no bar and no levels to go (D3)", () => {
      expect(within(main()).queryByRole("progressbar")).toBeNull();
      expect(within(main()).queryByRole("meter")).toBeNull();
      expect(main()).not.toHaveTextContent(/to go|You're level|opens at level/);
      expect(within(main()).queryByRole("button", { name: "Open" })).toBeNull();
    });
  });
});

describe("WS324: a ready feature page is E's night band with the crate", () => {
  describe.each(featurePages)("$name", (page) => {
    it("holds the headline, the sentence and the crate's primary Open in a night band", () => {
      visit(page, shellFixtures.memberWithEveryPanelReady, "ready");
      const band = pageTitle().closest<HTMLElement>(".night-band");
      expect(band).not.toBeNull();
      expect(pageTitle()).toHaveTextContent(`${page.name} is ready`);
      expect(band).toHaveTextContent(page.sentence);
      expect(within(band!).getByRole("button", { name: "Open" })).toHaveClass("quill-button--variant-primary");
      expect(band!.querySelector(".crate-art")).not.toBeNull();
      expect(document.title).toBe(`HedgeHug · ${page.name}`);
    });
  });

  it("opens the feature's crate through openFeature and plays the reveal", async () => {
    const page = featurePages[2]!;
    const { user, actions } = visit(page, shellFixtures.memberWithEveryPanelReady, "ready");
    await user.click(within(main()).getByRole("button", { name: "Open" }));
    expect(actions.openFeature).toHaveBeenCalledExactlyOnceWith("book");
    expect(dialog()).toHaveTextContent("Level 4 unlock");
  });

  it("opens the crate when the member taps the crate itself", async () => {
    const { user, actions } = visit(featurePages[3]!, shellFixtures.memberWithEveryPanelReady, "ready");
    await user.click(pageTitle().closest<HTMLElement>(".night-band")!.querySelector<HTMLElement>(".crate-art")!);
    expect(actions.openFeature).toHaveBeenCalledExactlyOnceWith("skillTree");
  });

  it("names what went wrong in the band when the crate can't be opened", async () => {
    window.history.replaceState(null, "", "/book");
    const { user } = renderApp(shellFixtures.memberWithEveryPanelReady, undefined, opening(async () => ({ kind: "refused" })), undefined, fixedBook(bookFixtures.ready));
    await user.click(within(main()).getByRole("button", { name: "Open" }));
    expect(pageTitle().closest(".night-band")).toHaveTextContent("That couldn't be opened.");
  });
});

describe("WS324 WS339 V24: the night band stays dark and readable in both modes", () => {
  function bandOn(dark: boolean) {
    fakeSystemTheme(dark);
    visit(featurePages[1]!, shellFixtures.memberWithEveryPanelReady, "ready");
    return pageTitle().closest<HTMLElement>(".night-band")!;
  }

  it.each<Mode>(["light", "dark"])("keeps the headline at 4.5:1 on the band in %s mode", (mode) => {
    bandOn(mode === "dark");
    expect(contrast(mode, "band-night-ink", "band-night")).toBeGreaterThanOrEqual(4.5);
  });

  it.each<Mode>(["light", "dark"])("keeps the sentence at 4.5:1 on the band in %s mode", (mode) => {
    const band = bandOn(mode === "dark");
    expect(within(band).getByText(featurePages[1]!.sentence)).toHaveClass("night-band-quiet");
    expect(contrast(mode, "band-night-quiet", "band-night")).toBeGreaterThanOrEqual(4.5);
  });

  it("draws the crate's rim in the edge token on the band and in the reveal", () => {
    const band = bandOn(false);
    expect(band.querySelectorAll(".crate-edge")).toHaveLength(2);
    expect(ruleOf("src/crates/crates.css", ".crate-edge")).toMatch(/stroke:\s*var\(--crate-edge,\s*transparent\)/);
    expect(ruleOf("src/index.css", ".night-band")).toMatch(/--crate-edge:\s*var\(--band-night-edge\)/);
    expect(ruleOf("src/crates/crates.css", ".moment-scrim")).toMatch(/--crate-edge:\s*var\(--band-night-edge\)/);
  });

  it.each<Mode>(["light", "dark"])("keeps the crate's border at 3:1 on the band in %s mode", (mode) => {
    bandOn(mode === "dark");
    expect(contrast(mode, "band-night-edge", "band-night")).toBeGreaterThanOrEqual(3);
  });

  it.each<Mode>(["light", "dark"])("keeps the primary Open at 3:1 on the band in %s mode", (mode) => {
    bandOn(mode === "dark");
    expect(contrast(mode, "primary", "band-night")).toBeGreaterThanOrEqual(3);
  });
});

describe("WS339 V24: the locked page's art and the reveal's marks meet 3:1 in both modes", () => {
  const marks = [
    { part: "the hedgehog's silhouette", paint: "muted-foreground", surface: "card" },
    { part: "the padlock", paint: "foreground", surface: "card" },
    { part: "the padlock's glyph", paint: "background", surface: "foreground" },
    { part: "the checklist's check marks", paint: "muted-foreground", surface: "card" },
  ];

  it("paints the silhouette and the padlock from those tokens", () => {
    visit(featurePages[0]!, shellFixtures.memberWithEveryPanelLocked, "locked");
    expect(main().querySelector("[data-silhouette]")).toHaveClass("hog-silhouette");
    expect(main().querySelector("[data-padlock]")).toHaveClass("bg-foreground", "text-background");
  });

  describe.each<Mode>(["light", "dark"])("in %s mode", (mode) => {
    it.each(marks)("keeps $part at 3:1", ({ paint, surface }) => {
      expect(contrast(mode, paint, surface)).toBeGreaterThanOrEqual(3);
    });
  });
});

const waits: Record<string, string[]> = {
  Quests: ["Three quests of your own each week, new every Monday", "Swap one of them once a week", "XP for each quest you finish"],
  Leaderboard: ["Who's thanking colleagues most this week, this month and of all time", "Only kudos given count, never kudos received"],
  Book: ["Achievements for the thanks you give and the thanks you get", "Bronze, silver, gold and diamond tiers on every ladder"],
  "Skill tree": ["Your first skill point to spend, and one more each level", `${perkOf("spark").name}: ${perkOf("spark").copy}`],
};

function answerLater() {
  let settle!: (answer: OpenAnswer) => void;
  const answer = new Promise<OpenAnswer>((resolve) => {
    settle = resolve;
  });
  return { answer, settle: (value: OpenAnswer) => act(() => settle(value)) };
}

async function revealFrom(member: MemberProfile, crateName: string, openFeature: (feature: string) => Promise<OpenAnswer> = async () => ({ kind: "opened" })) {
  window.history.replaceState(null, "", "/");
  const view = renderApp(member, undefined, { openFeature });
  const crate = within(main()).getByRole("heading", { level: 3, name: `Unlocks: ${crateName}` }).closest("article")!;
  await view.user.click(within(crate).getByRole("button", { name: "Open" }));
  await act(async () => undefined);
  await view.user.keyboard("{Escape}");
  return view;
}

function crateNamed(name: string) {
  return within(main()).getByRole("heading", { level: 3, name: `Unlocks: ${name}` }).closest("article")!;
}

function nextCrateButton() {
  return within(dialog()).queryByRole("button", { name: /^Open the next one|^Opening…/ });
}

describe("WS325: the reveal lists what waits", () => {
  it.each(Object.entries(waits))("lists what the %s holds after its crate opens", async (name, lines) => {
    await revealFrom(shellFixtures.memberWithEveryPanelReady, name);
    const list = within(dialog()).getByRole("list", { name: "What waits" });
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual(lines);
  });

  it("quotes P94's copy word for word where it names a perk", async () => {
    await revealFrom(shellFixtures.memberWithEveryPanelReady, "Skill tree");
    expect(within(dialog()).getByRole("list", { name: "What waits" })).toHaveTextContent("Spark: +5 XP the first time each day you thank someone and say why.");
  });

  it("names no fact that hasn't shipped", async () => {
    for (const name of Object.keys(waits)) {
      const { unmount } = await revealFrom(shellFixtures.memberWithEveryPanelReady, name);
      expect(within(dialog()).getByRole("list", { name: "What waits" })).not.toHaveTextContent(/group|sticker|album|coin|hedgehog|emoji/i);
      unmount();
    }
  });

  it("leaves a quest crate's reveal as it was", async () => {
    window.history.replaceState(null, "", "/");
    const { user } = renderApp(shellFixtures.memberWithQuests, undefined, { openQuestCrate: async () => ({ kind: "opened" }) }, fixedQuests(questsFixtures.week));
    await user.click(within(main()).getByRole("button", { name: /^Open/ }));
    await act(async () => undefined);
    await user.keyboard("{Escape}");
    expect(dialog()).toHaveTextContent(/You earned \d+ XP/);
    expect(within(dialog()).queryByRole("list")).toBeNull();
    expect(nextCrateButton()).toBeNull();
  });
});

describe("WS325: the reveal opens the next ready crate", () => {
  it("offers no next crate when none is ready", async () => {
    await revealFrom(shellFixtures.memberWithTheBoardReady, "Leaderboard");
    expect(nextCrateButton()).toBeNull();
    expect(dialog()).not.toHaveTextContent(/more ready/);
  });

  it("offers the next one with 1 more ready", async () => {
    await revealFrom(shellFixtures.memberWithEveryFeatureReady, "Leaderboard");
    expect(nextCrateButton()).toHaveAccessibleName("Open the next one, 1 more ready");
  });

  it("counts every other ready crate, in the ready pill's order", async () => {
    const pending = answerLater();
    const openFeature = vi.fn(async (feature: string) => (feature === "book" ? { kind: "opened" as const } : pending.answer));
    const { user } = await revealFrom(shellFixtures.memberWithEveryPanelReady, "Book", openFeature);
    expect(nextCrateButton()).toHaveAccessibleName("Open the next one, 3 more ready");
    await user.click(nextCrateButton()!);
    expect(openFeature).toHaveBeenLastCalledWith("quests");
  });

  it("keeps focus on the button while the next crate opens, then reveals it and focuses its end state", async () => {
    preferReducedMotion();
    const pending = answerLater();
    const openFeature = vi.fn(async (feature: string) => (feature === "leaderboard" ? { kind: "opened" as const } : pending.answer));
    window.history.replaceState(null, "", "/");
    const { user } = renderApp(shellFixtures.memberWithEveryFeatureReady, undefined, { openFeature });
    const crate = within(main()).getByRole("heading", { level: 3, name: "Unlocks: Leaderboard" }).closest("article")!;
    await user.click(within(crate).getByRole("button", { name: "Open" }));
    await act(async () => undefined);
    await user.click(nextCrateButton()!);
    expect(nextCrateButton()).toHaveAccessibleName("Opening…");
    expect(nextCrateButton()).toHaveAttribute("aria-disabled", "true");
    expect(document.activeElement).toBe(nextCrateButton());
    await pending.settle({ kind: "opened" });
    expect(dialog()).toHaveTextContent("Level 5 unlock");
    expect(dialog()).toHaveTextContent("Skill tree is open");
    expect(document.activeElement).toBe(within(dialog()).getByRole("link", { name: "Go to Skill tree" }));
  });

  it("keeps Tab inside the reveal while the next crate opens", async () => {
    const pending = answerLater();
    const openFeature = vi.fn(async (feature: string) => (feature === "leaderboard" ? { kind: "opened" as const } : pending.answer));
    const { user } = await revealFrom(shellFixtures.memberWithEveryFeatureReady, "Leaderboard", openFeature);
    await user.click(nextCrateButton()!);
    await user.tab();
    expect(dialog()).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).toBe(within(dialog()).getByRole("link", { name: "Go to Leaderboard" }));
    await user.tab({ shift: true });
    expect(dialog()).toContainElement(document.activeElement as HTMLElement);
  });

  it("keeps the button and still advances when the next crate leaves the ready list before its answer", async () => {
    preferReducedMotion();
    const pending = answerLater();
    const openFeature = vi.fn(async (feature: string) => (feature === "leaderboard" ? { kind: "opened" as const } : pending.answer));
    window.history.replaceState(null, "", "/");
    const { user, showVisitor } = renderApp(shellFixtures.memberWithEveryFeatureReady, undefined, { openFeature });
    const crate = within(main()).getByRole("heading", { level: 3, name: "Unlocks: Leaderboard" }).closest("article")!;
    await user.click(within(crate).getByRole("button", { name: "Open" }));
    await act(async () => undefined);
    await user.click(nextCrateButton()!);
    const everyOpen = shellFixtures.memberWithEveryFeatureReady.features!.map((card) => ({ ...card, state: "open" as const, openedAt: Date.now() }));
    showVisitor({ ...shellFixtures.memberWithEveryFeatureReady, features: everyOpen, leaderboard: { kind: "open" } });
    expect(document.activeElement).toBe(nextCrateButton());
    await pending.settle({ kind: "opened" });
    expect(dialog()).toHaveTextContent("Skill tree is open");
  });

  it("advances to a crate whose reveal is already queued without opening it again", async () => {
    preferReducedMotion();
    const answers = { leaderboard: answerLater(), skillTree: answerLater() };
    const openFeature = vi.fn((feature: string) => answers[feature as keyof typeof answers].answer);
    window.history.replaceState(null, "", "/");
    const { user } = renderApp(shellFixtures.memberWithEveryFeatureReady, undefined, { openFeature });
    await user.click(within(crateNamed("Leaderboard")).getByRole("button", { name: "Open" }));
    await user.click(within(crateNamed("Skill tree")).getByRole("button", { name: "Open" }));
    await answers.leaderboard.settle({ kind: "opened" });
    await answers.skillTree.settle({ kind: "opened" });
    await user.click(nextCrateButton()!);
    expect(openFeature).toHaveBeenCalledTimes(2);
    expect(dialog()).toHaveTextContent("Skill tree is open");
    await user.click(within(dialog()).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays on this reveal and says why when the next crate can't be opened", async () => {
    const openFeature = vi.fn(async (feature: string): Promise<OpenAnswer> => (feature === "leaderboard" ? { kind: "opened" } : { kind: "refused" }));
    const { user } = await revealFrom(shellFixtures.memberWithEveryFeatureReady, "Leaderboard", openFeature);
    await user.click(nextCrateButton()!);
    expect(dialog()).toHaveTextContent("Leaderboard is open");
    expect(dialog()).toHaveTextContent("That couldn't be opened.");
    expect(nextCrateButton()).toHaveAccessibleName("Open the next one, 1 more ready");
  });
});

describe("WS339: the reveal's checklist and next crate pass axe in light and dark", () => {
  it.each([false, true])("with dark mode %s", async (dark) => {
    fakeSystemTheme(dark);
    const { container } = await revealFrom(shellFixtures.memberWithEveryPanelReady, "Skill tree");
    nextCrateButton();
    const results = await axe.run(container.ownerDocument.body, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  }, 30_000);
});
