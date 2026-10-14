import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { shellFixtures } from "./shell";
import { fixedSkillTree, skillTreeFixtures } from "./skillTreeFixtures";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
});

function visit(path: string) {
  window.history.replaceState(null, "", path);
}

function pageTitle() {
  return screen.getByRole("heading", { level: 1 });
}

describe("WS310: page titles take variant E's display sizes in RoundHog bold", () => {
  it("sets /quests' title at E's text-4xl with no extra leading", () => {
    visit("/quests");
    renderApp(shellFixtures.memberWithQuests, undefined, undefined, fixedQuests(questsFixtures.week));
    expect(pageTitle()).toHaveTextContent("This week");
    expect(pageTitle()).toHaveClass("hud-display", "font-bold", "text-4xl", "leading-none");
  });

  it("sets /skills' title at E's text-4xl with no extra leading", () => {
    visit("/skills");
    renderApp(shellFixtures.memberWithEveryFeatureOpen, undefined, undefined, undefined, undefined, fixedSkillTree(skillTreeFixtures.withPoints));
    expect(pageTitle()).toHaveTextContent("Perks");
    expect(pageTitle()).toHaveClass("hud-display", "font-bold", "text-4xl", "leading-none");
  });

  it("sets /book's title at E's text-4xl with no extra leading", () => {
    visit("/book");
    renderApp(shellFixtures.memberWithTheBookOpened, undefined, undefined, undefined, fixedBook(bookFixtures.book));
    expect(pageTitle()).toHaveTextContent("Achievements");
    expect(pageTitle()).toHaveClass("hud-display", "font-bold", "text-4xl", "leading-none");
  });

  it("sets /leaderboard's headline at E's fluid clamp with a 0.95 line height and balanced wrapping, breaking a long name", () => {
    visit("/leaderboard");
    renderApp(shellFixtures.memberWithTheBoard, fixedLeaderboard(leaderboardFixtures.midBoard));
    expect(pageTitle()).toHaveClass("hud-display", "font-bold", "text-[clamp(1.75rem,5vw,3rem)]", "leading-[0.95]", "text-balance");
    expect(pageTitle()).toHaveClass("wrap-anywhere");
    expect(pageTitle()).not.toHaveClass("text-2xl");
  });
});
