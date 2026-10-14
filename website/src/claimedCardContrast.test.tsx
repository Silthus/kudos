import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";
import { contrastAtOpacity, type Mode } from "./test/themeTokens";

beforeEach(() => {
  fakeSystemTheme(false);
});

function claimedCard() {
  window.history.replaceState(null, "", "/quests");
  renderApp(shellFixtures.memberWithQuests, undefined, undefined, fixedQuests(questsFixtures.week));
  return within(screen.getByRole("main")).getByRole("heading", { name: "Thank someone you haven't thanked in the last 30 days." }).closest("article")!;
}

function opacityOf(card: HTMLElement) {
  const percent = [...card.classList].flatMap((name) => /^opacity-(\d+)$/.exec(name)?.[1] ?? []);
  expect(percent, "the claimed card is muted by one opacity class").toHaveLength(1);
  return Number(percent[0]) / 100;
}

const texts = [
  { part: "the goal", paint: "foreground", surface: "card" },
  { part: "the kind, progress count and reward", paint: "muted-foreground", surface: "card" },
  { part: "Claimed", paint: "success-foreground", surface: "success" },
];

const marks = [{ part: "the check mark", paint: "success-foreground", surface: "success" }];

describe("WS314 WS339 V24: a claimed card is muted, and still readable", () => {
  it("mutes the claimed card below full opacity", () => {
    expect(opacityOf(claimedCard())).toBeLessThan(1);
  });

  describe.each<Mode>(["light", "dark"])("in %s mode", (mode) => {
    it.each(texts)("keeps $part at 4.5:1", ({ paint, surface }) => {
      expect(contrastAtOpacity(mode, paint, surface, { opacity: opacityOf(claimedCard()), backdrop: "background" })).toBeGreaterThanOrEqual(4.5);
    });

    it.each(marks)("keeps $part at 3:1", ({ paint, surface }) => {
      expect(contrastAtOpacity(mode, paint, surface, { opacity: opacityOf(claimedCard()), backdrop: "background" })).toBeGreaterThanOrEqual(3);
    });
  });
});
