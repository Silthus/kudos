import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardAnswer, BoardRead } from "./boardRead";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import type { QuestsRead, QuestsShown } from "./questsRead";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { shellFixtures, type Leaderboard, type MemberProfile } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/");
});

const everyPanelOpen = shellFixtures.memberWithEveryPanelOpen;

function main() {
  return screen.getByRole("main");
}

function panel(name: string) {
  return within(main()).getByRole("region", { name });
}

function queryPanel(name: string) {
  return within(main()).queryByRole("region", { name });
}

function linksIn(region: HTMLElement) {
  return within(region)
    .queryAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);
}

function railOf(member: MemberProfile, { board, quests }: { board?: BoardRead; quests?: QuestsRead } = {}) {
  return renderApp(member, board, undefined, quests);
}

function showingQuests(answer: QuestsShown | undefined, member: MemberProfile = everyPanelOpen) {
  return railOf(member, { quests: (asking) => (asking ? answer : undefined) });
}

function showingBoard(answer: BoardAnswer | undefined, member: MemberProfile = everyPanelOpen) {
  return railOf(member, { board: (period) => (period === undefined ? undefined : answer) });
}

function standingOn(board: Leaderboard) {
  railOf(everyPanelOpen, { board: fixedLeaderboard(board) });
  return panel("Where you stand");
}

describe("WS107: What teammates see", () => {
  it("labels the member's raised profile card as public, with their face, name and level, and what stays with them", () => {
    railOf(shellFixtures.memberAtLevel7);
    const card = panel("What teammates see");
    expect(card).toHaveTextContent("Public");
    expect(within(card).getByText("SE")).toBeInTheDocument();
    expect(within(card).getByText("Sam Example")).toHaveClass("font-semibold");
    expect(within(card).getByText("Lv 7")).toBeInTheDocument();
    expect(card).toHaveTextContent("Everyone can see this card. Your XP and the kudos you receive stay with you.");
  });

  it("shows no received count, team or medals, and no level while progression is absent", () => {
    railOf(shellFixtures.member);
    const card = panel("What teammates see");
    expect(card.textContent).not.toMatch(/\d|Lv|\bteam\b|medal/i);
  });
});

describe("WS108: the recent-kudos slot renders nothing and leaves no gap", () => {
  it("puts the Quests panel directly after What teammates see, then the Leaderboard panel", () => {
    railOf(everyPanelOpen, { quests: fixedQuests(questsFixtures.week), board: fixedLeaderboard(leaderboardFixtures.midBoard) });
    const card = panel("What teammates see");
    expect(card.nextElementSibling).toBe(panel("Quests this week"));
    expect(panel("Quests this week").nextElementSibling).toBe(panel("Where you stand"));
  });
});

describe("WS109 WS315 WS316: Quests this week", () => {
  function questsPanel() {
    showingQuests(questsFixtures.week);
    return panel("Quests this week");
  }

  it("is a game object labelled with the weekly turnover, with a row per slot in slot order and See all quests", () => {
    const quests = questsPanel();
    expect(quests).toHaveClass("hud-panel");
    expect(quests).toHaveTextContent("New quests every Monday.");
    expect(linksIn(quests)).toEqual([
      ["Thank someone and say why, 3 times.", "/quests"],
      ["Thank someone you haven't thanked before. Claim", "/quests?quest=1"],
      ["Thank someone you haven't thanked in the last 30 days.", "/quests"],
      ["See all quests", "/quests"],
    ]);
  });

  it("shows a quest in progress as a neutral progress bar named by its goal, with done over target", () => {
    const quests = questsPanel();
    const bar = within(quests).getByRole("progressbar", { name: "Thank someone and say why, 3 times." });
    expect(bar).toHaveAttribute("aria-valuenow", "1");
    expect(bar).toHaveAttribute("aria-valuemax", "3");
    expect(bar.firstElementChild).toHaveClass("bg-muted-foreground");
    expect(within(quests).getAllByRole("progressbar")).toHaveLength(1);
    expect(quests).toHaveTextContent("1/3");
  });

  it("lets a finished quest read Claim and link to its own card, and an opened quest show a check and Claimed, as /quests does", () => {
    const quests = questsPanel();
    expect(within(quests).getByRole("link", { name: "Thank someone you haven't thanked before. Claim" })).toHaveAttribute("href", "/quests?quest=1");
    expect(quests).not.toHaveTextContent("Reward ready");
    expect(quests).not.toHaveTextContent("Done");
    expect(within(quests).getByText("Claimed")).toBeInTheDocument();
    expect(within(quests).queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows no XP, swap or waiting crates, which /quests shows", () => {
    showingQuests(questsFixtures.weekWithLastWeeksCrate);
    const quests = panel("Quests this week");
    expect(quests.textContent).not.toMatch(/XP|Swap|Waiting|Week of/);
  });

  it("shows an empty week as Max's compact line with an outline Thank someone in Slack", () => {
    showingQuests(questsFixtures.noDraw);
    const quests = panel("Quests this week");
    expect(quests).toHaveTextContent("No quests this week yet. New quests arrive every Monday.");
    const thank = within(quests).getByRole("link", { name: /Thank someone in Slack/ });
    expect(thank).toHaveAttribute("href", "https://app.slack.com/client/T1");
    expect(thank).toHaveClass("quill-button--variant-outline");
    expect(within(quests).queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("WS110: Where you stand", () => {
  it("names the Everyone row by the viewer's rank and links it to the leaderboard, under This week", () => {
    const standing = standingOn(leaderboardFixtures.midBoard);
    expect(standing).toHaveTextContent("This week");
    expect(within(standing).getByRole("link", { name: "Everyone this week: you're #9" })).toHaveAttribute("href", "/leaderboard");
    expect(within(standing).getByText("#9")).toHaveClass("font-semibold", "tabular-nums");
    expect(standing).toHaveTextContent("Everyone");
    expect(standing).toHaveTextContent("The whole company on one board");
    expect(within(standing).getByRole("link", { name: "Open the leaderboard" })).toHaveAttribute("href", "/leaderboard");
  });

  it("gives the faces above, at and below the viewer their words, and rings the viewer's face with a label", () => {
    const standing = standingOn(leaderboardFixtures.midBoard);
    const neighbours = within(standing).getByRole("list", { name: "Your neighbours on the board" });
    expect(within(neighbours).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Above you: Hal Sato, 12 kudos given"),
      expect.stringContaining("You: 11 kudos given"),
      expect.stringContaining("Below you: Ivy Quinn, 10 kudos given"),
    ]);
    expect(neighbours.querySelectorAll("[data-you-ring]")).toHaveLength(1);
    expect(within(neighbours).getByText("You")).toBeInTheDocument();
  });

  it("says tied under the rank when the viewer's row is tied", () => {
    const standing = standingOn(leaderboardFixtures.tiedBelowTheLead);
    expect(within(standing).getByRole("link", { name: "Everyone this week: you're tied at #2" })).toBeInTheDocument();
    expect(within(standing).getByText("tied")).toBeInTheDocument();
  });

  it("leaves the place above empty at the top of the board, and the place below empty at the bottom", () => {
    const top = standingOn(leaderboardFixtures.viewerLeads);
    expect(top.textContent).not.toMatch(/Above you/);
    expect(top).toHaveTextContent("Below you: Ada Lindqvist, 8 kudos given");
  });

  it("leaves the place below empty at the bottom of the board", () => {
    const bottom = standingOn(leaderboardFixtures.longBoardViewerAtTheBottom);
    expect(bottom).toHaveTextContent("Above you: Teammate 29, 71 kudos given");
    expect(bottom.textContent).not.toMatch(/Below you/);
  });

  it("shows a neighbour's Slack picture, and their initials once it fails to load", () => {
    const standing = standingOn(leaderboardFixtures.withTeammatesFaces);
    const picture = standing.querySelector("img")!;
    expect(picture).toHaveAttribute("src", "https://secure.gravatar.com/avatar/ivy.jpg?s=192");
    fireEvent.error(picture);
    expect(standing.querySelector("img")).toBeNull();
    expect(within(standing).getByText("IQ")).toBeInTheDocument();
  });

  it.each([
    ["isn't ranked", leaderboardFixtures.notRanked, "Give kudos this week to join the board."],
    ["left the boards", leaderboardFixtures.left, "You're not on the leaderboards. You can change that in Settings in Slack."],
  ])("uses the page's own line for a viewer who %s, with no rank or faces", (_, board, line) => {
    const standing = standingOn(board);
    expect(standing).toHaveTextContent(line);
    expect(standing.textContent).not.toMatch(/#\d|kudos given/);
    expect(within(standing).getByRole("link", { name: "Open the leaderboard" })).toBeInTheDocument();
  });

  it("asks the board for this week only while the Leaderboard is open", () => {
    const asked = vi.fn<BoardRead>(() => undefined);
    const { showVisitor } = railOf(shellFixtures.memberWithEveryPanelLocked, { board: asked });
    expect(asked.mock.calls.flat().filter((period) => period !== undefined)).toEqual([]);
    showVisitor(everyPanelOpen);
    expect(asked).toHaveBeenLastCalledWith("week");
  });
});

describe("WS111: every answer has one rendering", () => {
  const panels = [
    { name: "Quests this week", feature: "Quests", show: showingQuests, link: ["See all quests", "/quests"], locked: { kind: "locked", level: 2 } as const, showOpen: () => showingQuests(questsFixtures.week), row: "Thank someone and say why, 3 times." },
    { name: "Where you stand", feature: "Leaderboard", show: showingBoard, link: ["Open the leaderboard", "/leaderboard"], locked: { kind: "locked", level: 3 } as const, showOpen: () => showingBoard(leaderboardFixtures.midBoard), row: "Above you: Hal Sato, 12 kudos given" },
  ];

  describe.each(panels)("$name", ({ name, feature, show, link, locked, showOpen, row }) => {
    it.each([["no answer yet", undefined], ["a socket that isn't connected", { kind: "connecting" } as const]])("shows its label busy, with no rows, for %s", (_, answer) => {
      show(answer);
      const busy = panel(name);
      expect(busy).toHaveAttribute("aria-busy", "true");
      expect(within(busy).queryAllByRole("link")).toEqual([]);
    });

    it("shows the locked panel from the read's own answer while getMyProfile catches up", () => {
      show(locked);
      expect(queryPanel(name)).toBeNull();
      expect(panel(feature)).toHaveTextContent(`Unlocks at level ${locked.level}`);
    });

    it("shows the ready panel's crate from the read's own answer while getMyProfile catches up", () => {
      show({ kind: "ready" });
      expect(within(panel(feature)).getByRole("button", { name: "Open" })).toBeInTheDocument();
    });

    it.each([["not-found", { kind: "not-found" } as const], ["a denial", { kind: "not-a-member" } as const]])("renders nothing for %s", (_, answer) => {
      show(answer);
      expect(queryPanel(name)).toBeNull();
      expect(queryPanel(feature)).toBeNull();
    });

    it("keeps only its link to the page when the read fails", () => {
      show({ kind: "broken" });
      expect(linksIn(panel(name))).toEqual([link]);
      expect(panel("What teammates see")).toBeInTheDocument();
    });

    it("clears its rows on sign-out", () => {
      const { showVisitor } = showOpen();
      expect(panel(name)).toHaveTextContent(row);
      showVisitor(shellFixtures.signedOut);
      expect(screen.queryByRole("region", { name })).toBeNull();
      expect(document.body).not.toHaveTextContent(row);
    });
  });

  it("says the Leaderboard is ready in Slack when the board answers ready while unlocks don't apply, with no crate to open", () => {
    showingBoard({ kind: "ready" }, shellFixtures.memberWithTheBoard);
    const ready = panel("Leaderboard");
    expect(ready).toHaveTextContent("Leaderboard is ready for you. Open it in Slack's App Home.");
    expect(within(ready).queryByRole("button")).not.toBeInTheDocument();
  });

  it("follows getMyProfile, never getQuests, for the panel's state", () => {
    railOf(shellFixtures.memberWithEveryPanelLocked, { quests: fixedQuests(questsFixtures.week) });
    expect(queryPanel("Quests this week")).toBeNull();
    expect(panel("Quests")).toHaveTextContent("Unlocks at level 2");
  });
});
