import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { fixedRecentKudos, recentKudosFixtures } from "./recentKudosFixtures";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
});

function visit(path: string) {
  window.history.replaceState(null, "", path);
}

function main() {
  return screen.getByRole("main");
}

const nudge = ["transition-transform", "motion-safe:group-hover:translate-x-0.5"];

function expectArrowNudge(link: HTMLElement) {
  expect(link).toHaveClass("group");
  const arrow = [...link.querySelectorAll("svg")].at(-1);
  expect(arrow).toBeDefined();
  expect(arrow).toHaveAttribute("aria-hidden", "true");
  expect(arrow).toHaveClass(...nudge);
}

describe("#481 hover: every arrow link nudges its arrow on hover, and holds still under reduced motion", () => {
  it("on the home's panel links and the recent-kudos card", () => {
    visit("/");
    renderApp(shellFixtures.memberWithEveryPanelOpen, undefined, undefined, fixedQuests(questsFixtures.week), undefined, undefined, undefined, fixedRecentKudos({ received: recentKudosFixtures.threeReceived, given: recentKudosFixtures.threeGiven }));
    for (const name of ["Open the Book", "See all quests", "See all activity"]) expectArrowNudge(within(main()).getByRole("link", { name }));
  });

  it("on the bonus quest's Go to link", () => {
    visit("/quests");
    renderApp(shellFixtures.memberWithEveryPanelOpen, undefined, undefined, fixedQuests(questsFixtures.weekWithABonus));
    expectArrowNudge(within(main()).getByRole("link", { name: "Go to Leaderboard" }));
  });

  it("on the Book overview's closest next tier", () => {
    visit("/book");
    renderApp(shellFixtures.memberWithTheBookOpened, undefined, undefined, undefined, fixedBook(bookFixtures.everyLadder));
    expectArrowNudge(within(main()).getByRole("link", { name: /^Closest next tier/ }));
  });

  it("on the earned page's See achievements", () => {
    visit("/book/earned");
    renderApp(shellFixtures.memberWithTheBookOpened, undefined, undefined, undefined, fixedBook(bookFixtures.everyLadder));
    expectArrowNudge(within(main()).getByRole("link", { name: "See achievements" }));
  });
});
