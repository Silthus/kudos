import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/");
});

function main() {
  return screen.getByRole("main");
}

function group(name: string) {
  return within(main()).getByRole("region", { name });
}

function cardNamesIn(name: string) {
  return within(group(name))
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);
}

function cardOf(name: string) {
  return within(main()).getByRole("heading", { level: 3, name }).closest("article")!;
}

function screenNav() {
  return within(screen.getByRole("navigation", { name: "Screens" }))
    .getAllByRole("link")
    .map((link) => link.textContent);
}

function featureGroups() {
  return within(main())
    .queryAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent)
    .filter((name) => ["Ready for you", "Open", "Still locked"].includes(name!));
}

describe("WS58: the home's feature cards read the member's unlock path", () => {
  it("shows a locked shipped feature with Unlocks' name and its level, and no feature that hasn't shipped", () => {
    renderApp(shellFixtures.memberWaitingForTheBoard);
    expect(featureGroups()).toEqual(["Still locked"]);
    expect(cardNamesIn("Still locked")).toEqual(["Leaderboard"]);
    expect(cardOf("Leaderboard")).toHaveTextContent("Unlocks at level 3");
    expect(cardOf("Leaderboard")).toHaveTextContent("See where you and your group stand.");
    expect(main()).not.toHaveTextContent(/Quests|Sticker book|Coins|Hedgehogs/);
  });

  it("teases no progress on a locked card: no levels to go, bar, button or link", () => {
    renderApp(shellFixtures.memberWithTheBoardReady);
    const card = cardOf("Skill tree");
    expect(card).toHaveTextContent("Unlocks at level 5");
    expect(card).not.toHaveTextContent(/to go|ready|open/i);
    expect(within(card).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
    expect(within(card).queryByRole("link")).not.toBeInTheDocument();
  });

  it("puts a ready feature's crate under Ready for you, before what is still locked", () => {
    renderApp(shellFixtures.memberWithTheBoardReady);
    expect(featureGroups()).toEqual(["Ready for you", "Still locked"]);
    expect(cardNamesIn("Ready for you")).toEqual(["Unlocks: Leaderboard"]);
    expect(cardOf("Unlocks: Leaderboard")).not.toHaveTextContent("Open it in Slack's App Home.");
    expect(cardNamesIn("Still locked")).toEqual(["Skill tree"]);
  });

  it("links an open feature with a web page to it, with WS38's sentence and no rank or count", () => {
    renderApp(shellFixtures.memberWithTheBoardOpened);
    expect(featureGroups()).toEqual(["Open", "Still locked"]);
    const card = within(group("Open")).getByRole("link", { name: /Leaderboard/ });
    expect(card).toHaveAttribute("href", "/leaderboard");
    expect(card).toHaveTextContent("See who's thanking colleagues this week.");
    expect(card).not.toHaveTextContent(/\d|Locked/);
  });

  it("points an open feature without a web page to Slack's App Home, with one action that opens the workspace", () => {
    renderApp(shellFixtures.memberWithEveryFeatureOpen);
    expect(cardNamesIn("Open")).toEqual(["Leaderboard", "Skill tree"]);
    const card = cardOf("Skill tree");
    expect(card).toHaveTextContent("Open. Find it in Slack's App Home.");
    const openSlack = within(card).getByRole("link", { name: "Open Slack (opens in a new tab)" });
    expect(openSlack).toHaveAttribute("href", shellFixtures.memberWithEveryFeatureOpen.chatUrl);
    expect(openSlack).toHaveAttribute("target", "_blank");
    expect(featureGroups()).toEqual(["Open"]);
  });

  it("shows no feature group when nothing has shipped, never the plain locked cards", () => {
    renderApp(shellFixtures.memberWithNothingShipped);
    expect(featureGroups()).toEqual([]);
    expect(within(main()).queryAllByRole("article")).toEqual([]);
  });

  it("keeps WS19's six plain locked cards while unlocks don't apply", () => {
    renderApp(shellFixtures.member);
    expect(featureGroups()).toEqual(["Still locked"]);
    expect(cardNamesIn("Still locked")).toEqual(["Quests", "Leaderboard", "Sticker book and achievements", "Skill tree", "Coins", "Hedgehogs"]);
    expect(main()).not.toHaveTextContent(/Unlocks at level/);
  });
});

describe("WS59: the nav lists Home and each open feature with a web page", () => {
  it.each([
    ["locked", shellFixtures.memberWaitingForTheBoard, ["Home"]],
    ["ready", shellFixtures.memberWithTheBoardReady, ["Home"]],
    ["open", shellFixtures.memberWithTheBoardOpened, ["Home", "Leaderboard"]],
    ["open beside an open Skill tree, which has no web page", shellFixtures.memberWithEveryFeatureOpen, ["Home", "Leaderboard"]],
  ])("while the Leaderboard is %s", (_, member, items) => {
    renderApp(member);
    expect(screenNav()).toEqual(items);
    expect(screen.getByRole("navigation", { name: "Screens" })).not.toHaveTextContent(/Lv|level|lock/i);
  });
});
