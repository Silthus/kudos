import { act, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures, type MemberProfile } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/");
});

function main() {
  return screen.getByRole("main");
}

function panel(name: string) {
  return within(main()).getByRole("region", { name });
}

function hero() {
  return panel("Sam Example");
}

function profileCard() {
  return panel("Your profile card");
}

function panelsBeside(anchor: HTMLElement) {
  return within(anchor.parentElement!)
    .queryAllByRole("region")
    .filter((region) => region.parentElement === anchor.parentElement && region !== anchor)
    .map((region) => region.getAttribute("aria-label") ?? document.getElementById(region.getAttribute("aria-labelledby")!)!.textContent);
}

function comesBefore(first: Element, second: Element) {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function openLinksIn(region: HTMLElement) {
  return within(region)
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);
}

describe("WS97 WS102: one panel per shipped feature, in its slot", () => {
  it("puts the Book and the Skill tree in the main column under the hero, and Quests then the Leaderboard in the rail under the profile card", () => {
    renderApp(shellFixtures.memberAcrossTheSheet);
    expect(panelsBeside(hero())).toEqual(["Book", "Skill tree"]);
    expect(panelsBeside(profileCard())).toEqual(["Quests", "Leaderboard"]);
  });

  it("keeps the Journey in the main column, between the hero and the Book", () => {
    renderApp({ ...shellFixtures.memberAcrossTheSheet, journey: shellFixtures.memberWithQuests.journey });
    expect(panelsBeside(hero())).toEqual(["Journey", "Book", "Skill tree"]);
  });

  it("reads the main column first, then the rail, for narrow screens", () => {
    renderApp(shellFixtures.memberAcrossTheSheet);
    expect(comesBefore(panel("Skill tree"), profileCard())).toBe(true);
  });

  it("shows no panel for a feature that hasn't shipped", () => {
    renderApp(shellFixtures.memberWaitingForTheBoard);
    expect(panelsBeside(hero())).toEqual([]);
    expect(panelsBeside(profileCard())).toEqual(["Leaderboard"]);
  });

  it("shows no panel for Coins, which have no slot until the inventory ships", () => {
    renderApp(shellFixtures.memberWithCoinsOpened);
    expect(panelsBeside(profileCard())).toEqual(["Leaderboard"]);
    expect(main()).not.toHaveTextContent(/Coins/);
  });

  it("drops WS58's Ready for you, Open and Still locked groups", () => {
    renderApp(shellFixtures.memberAcrossTheSheet);
    const headings = within(main())
      .getAllByRole("heading")
      .map((heading) => heading.textContent);
    expect(headings).not.toContain("Ready for you");
    expect(headings).not.toContain("Open");
    expect(headings).not.toContain("Still locked");
  });

  it("walks the keyboard from the hero's action through the main column's panels, then the rail's, in reading order", async () => {
    const { user } = renderApp({ ...shellFixtures.memberWithEveryPanelOpen, chatUrl: "https://app.slack.com/client/T1" });
    within(hero()).getByRole("link", { name: /Thank someone in Slack/ }).focus();
    const path = [];
    for (let step = 0; step < 4; step++) {
      await user.tab();
      path.push(document.activeElement?.textContent);
    }
    expect(path).toEqual(["Open the Book", "Open the Skill tree", "See all quests", "Open the leaderboard"]);
  });

  it("leaves the nav unchanged: Home and each open feature with a web page", () => {
    renderApp(shellFixtures.memberAcrossTheSheet);
    const nav = within(screen.getByRole("navigation", { name: "Screens" })).getAllByRole("link");
    expect(nav.map((link) => link.textContent)).toEqual(["Home", "Quests", "Book"]);
  });
});

describe("WS103: a locked panel", () => {
  it.each([
    ["Quests", 2, "Weekly quests of your own."],
    ["Leaderboard", 3, "See where you and your group stand."],
    ["Book", 4, "Achievements you earn as you thank colleagues and they thank you."],
    ["Skill tree", 5, "Perks you choose with skill points."],
  ])("shows %s's level and its one sentence, with no progress, action or game frame", (name, level, sentence) => {
    renderApp(shellFixtures.memberWithEveryPanelLocked);
    const locked = panel(name);
    expect(locked).toHaveTextContent(`Unlocks at level ${level}`);
    expect(locked).toHaveTextContent(sentence);
    expect(locked).not.toHaveTextContent(/to go|ready|open\b/i);
    expect(within(locked).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(within(locked).queryByRole("button")).not.toBeInTheDocument();
    expect(within(locked).queryByRole("link")).not.toBeInTheDocument();
    expect(locked).not.toHaveClass("hud-panel");
  });

  it("shows the feature's hedgehog in silhouette under a padlock, hidden from assistive technology", () => {
    renderApp(shellFixtures.memberWithEveryPanelLocked);
    const art = panel("Book").querySelector("[data-locked-hog]")!;
    expect(art).toHaveAttribute("aria-hidden", "true");
    expect(art.querySelector("svg")).toHaveClass("brightness-0");
    expect(art.querySelector("[data-padlock]")).not.toBeNull();
  });
});

describe("WS104: a ready panel", () => {
  it.each(["Quests", "Leaderboard", "Book", "Skill tree"])("holds %s's crate in place with one outline Open, inside corner marks", (name) => {
    renderApp(shellFixtures.memberWithEveryPanelReady);
    const ready = panel(name);
    expect(ready).toHaveClass("hud-panel");
    expect(within(ready).getByRole("heading", { level: 3, name: `Unlocks: ${name}` })).toBeInTheDocument();
    expect(within(ready).getAllByRole("button")).toEqual([within(ready).getByRole("button", { name: "Open" })]);
    expect(within(ready).getByRole("button", { name: "Open" })).toHaveClass("quill-button--variant-outline");
    expect(ready).not.toHaveTextContent(/Unlocks at level/);
  });

  it("opens the crate in place, then becomes the open panel and takes focus back after the reveal", async () => {
    const { user, showVisitor } = renderApp(shellFixtures.memberWithTheBoardReady, undefined, { openFeature: async () => ({ kind: "opened" }) });
    await user.click(within(panel("Leaderboard")).getByRole("button", { name: "Open" }));
    await act(async () => undefined);
    showVisitor(shellFixtures.memberWithTheBoardOpened);
    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(panelsBeside(profileCard())).toEqual(["Leaderboard"]);
    expect(document.activeElement).toBe(within(panel("Leaderboard")).getByRole("link", { name: "Open the leaderboard" }));
  });
});

describe("WS105: an open panel", () => {
  it.each([
    ["Quests", "Your quests this week.", ["See all quests", "/quests"]],
    ["Leaderboard", "See who's thanking colleagues this week.", ["Open the leaderboard", "/leaderboard"]],
    ["Book", "See the tiers you've earned.", ["Open the Book", "/book"]],
    ["Skill tree", "2 skill points to spend", ["Open the Skill tree", "/skills"]],
  ])("shows %s itself with one link to its page", (name, line, link) => {
    renderApp(shellFixtures.memberWithEveryPanelOpen);
    const open = panel(name);
    expect(within(open).getByText(line)).toBeInTheDocument();
    expect(openLinksIn(open)).toEqual([link]);
    expect(open).not.toHaveTextContent(/Unlocks at level|Locked/);
    expect(open).not.toHaveClass("hud-panel");
  });

  it.each([
    [2, "2 skill points to spend"],
    [1, "1 skill point to spend"],
    [0, "No skill points to spend"],
  ])("words the Skill tree's %i unspent points", (skillPoints, line) => {
    renderApp({ ...shellFixtures.memberWithEveryPanelOpen, skillPoints });
    expect(within(panel("Skill tree")).getByText(line)).toBeInTheDocument();
  });

  it("falls back to the Skill tree's sentence while its points are unknown", () => {
    renderApp({ ...shellFixtures.memberWithEveryPanelOpen, skillPoints: null });
    expect(within(panel("Skill tree")).getByText("Spend skill points on perks you choose.")).toBeInTheDocument();
  });
});

describe("WS106: while unlocks don't apply", () => {
  function plainPanels(member: MemberProfile) {
    renderApp(member);
    return { main: panelsBeside(hero()), rail: panelsBeside(profileCard()) };
  }

  it("shows four plain locked panels in their slots, with no level, and none for Coins or Hedgehogs", () => {
    expect(plainPanels(shellFixtures.member)).toEqual({ main: ["Book", "Skill tree"], rail: ["Quests", "Leaderboard"] });
    for (const name of ["Quests", "Leaderboard", "Book", "Skill tree"]) {
      expect(panel(name)).toHaveTextContent("Locked");
      expect(panel(name).textContent).not.toMatch(/\d|level|ready|crate|xp/i);
      expect(within(panel(name)).queryByRole("link")).not.toBeInTheDocument();
    }
    expect(main()).not.toHaveTextContent(/Coins|Hedgehogs/);
  });

  it("lets the Leaderboard slot follow getMyProfile.leaderboard", () => {
    plainPanels(shellFixtures.memberWithTheBoard);
    expect(openLinksIn(panel("Leaderboard"))).toEqual([["Open the leaderboard", "/leaderboard"]]);
    expect(panel("Quests")).toHaveTextContent("Locked");
  });
});
