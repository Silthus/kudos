import { screen, within } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it } from "vitest";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { shellFixtures, type Leaderboard } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";
import { contrast, type Mode } from "./test/themeContrast";

beforeEach(() => {
  fakeSystemTheme(false);
});

function visitTheBoard(board: Leaderboard, path = "/leaderboard") {
  window.history.replaceState(null, "", path);
  return renderApp(shellFixtures.memberWithTheBoard, fixedLeaderboard(board));
}

function boardTabs() {
  return within(screen.getByRole("tablist", { name: "Board" })).getAllByRole("tab");
}

function tab(name: string) {
  return screen.getByRole("tab", { name });
}

function selectedTab() {
  return boardTabs().find((each) => each.getAttribute("aria-selected") === "true");
}

function boardPanel() {
  return screen.getByRole("tabpanel");
}

function headline() {
  return screen.getByRole("heading", { level: 1 });
}

function privatePanel() {
  return screen.queryByRole("region", { name: "Only you see these" });
}

describe("WS39 WS344: the board cards become a tab list once the group boards apply", () => {
  it("lists Groups, My group and Everyone in that order, with My group selected for a member who has one", () => {
    visitTheBoard(leaderboardFixtures.withGroupBoards);

    expect(boardTabs().map((each) => each.textContent?.match(/^(Groups|My group|Everyone)/)?.[0])).toEqual(["Groups", "My group", "Everyone"]);
    expect(selectedTab()).toBe(tab("My group"));
    expect(boardPanel()).toHaveAccessibleName("My group");
    expect(within(boardPanel()).getByRole("heading", { name: "Team Ants · This week" })).toBeInTheDocument();
  });

  it("selects Everyone for a member without a group, beside Groups", () => {
    visitTheBoard(leaderboardFixtures.withGroupsAndNoGroupOfMine);

    expect(boardTabs().map((each) => each.getAttribute("aria-controls") !== null)).toEqual([true, true]);
    expect(selectedTab()).toBe(tab("Everyone"));
    expect(screen.queryByRole("tab", { name: "My group" })).not.toBeInTheDocument();
  });

  it("keeps Everyone a single heading card while no group board applies", () => {
    visitTheBoard(leaderboardFixtures.midBoard);

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Everyone", level: 2 })).toBeInTheDocument();
  });

  it("marks only the selected card with V24's signals: a primary border and a visible check mark", () => {
    visitTheBoard(leaderboardFixtures.withGroupBoards);

    expect(boardTabs().map((each) => each.querySelector("[data-selected-mark]") !== null)).toEqual([false, true, false]);
    expect(tab("My group")).toHaveClass("border-primary");
  });

  it.each([
    { case: "each board's standing", board: leaderboardFixtures.withGroupBoards, standings: ["Your group is #2", "You're #1", "You're #9"] },
    { case: "a tied group", board: leaderboardFixtures.withMyGroupTiedOnGroups, standings: ["Your group is tied at #2", "You're #1", "You're #9"] },
    { case: "a group too small to list", board: leaderboardFixtures.withMyGroupUnlisted, standings: ["Not listed yet", "Not ranked yet", "You're #9"] },
    { case: "no group", board: leaderboardFixtures.withGroupsAndNoGroupOfMine, standings: ["No group yet", "You're #9"] },
  ])("describes each card by $case", ({ board, standings }) => {
    visitTheBoard(board);

    expect(boardTabs().map((each) => each.getAttribute("aria-describedby") && document.getElementById(each.getAttribute("aria-describedby")!)?.textContent)).toEqual(standings);
  });

  it("keeps the chosen board when the period changes", async () => {
    const { user } = visitTheBoard(leaderboardFixtures.withGroupBoards);

    await user.click(tab("Groups"));
    await user.click(screen.getByRole("button", { name: "This month" }));

    expect(selectedTab()).toBe(tab("Groups"));
    expect(within(boardPanel()).getByRole("heading", { name: "Groups · This month" })).toBeInTheDocument();
  });
});

describe("WS344 V24: the tab list works by keyboard", () => {
  it("puts only the selected card in the tab order", () => {
    visitTheBoard(leaderboardFixtures.withGroupBoards);

    expect(boardTabs().map((each) => each.tabIndex)).toEqual([-1, 0, -1]);
  });

  it("moves focus and the selection with the arrow keys, wrapping at the ends, and with Home and End", async () => {
    const { user } = visitTheBoard(leaderboardFixtures.withGroupBoards);
    tab("My group").focus();

    const path: string[] = [];
    for (const key of ["{ArrowRight}", "{ArrowRight}", "{ArrowLeft}", "{End}", "{Home}"]) {
      await user.keyboard(key);
      path.push(`${document.activeElement?.textContent?.match(/^(Groups|My group|Everyone)/)?.[0]}:${selectedTab() === document.activeElement}`);
    }

    expect(path).toEqual(["Everyone:true", "Groups:true", "Everyone:true", "Everyone:true", "Groups:true"]);
    expect(boardPanel()).toHaveAccessibleName("Groups");
  });
});

describe("WS344 GB13: the Groups board", () => {
  async function onGroups(board: Leaderboard = leaderboardFixtures.withGroupBoards, path?: string) {
    const view = visitTheBoard(board, path);
    await view.user.click(tab("Groups"));
    return view;
  }

  it("tells the board's story: who leads per person, how many of them gave, and where the viewer's group sits", async () => {
    await onGroups();

    expect(within(boardPanel()).getByRole("heading", { name: "Groups · This week" })).toBeInTheDocument();
    expect(headline()).toHaveTextContent("Thistle leads the week.");
    expect(within(boardPanel()).getByText("3.2 kudos given per person, and 100% of them gave. Team Ants sits at No. 2.")).toBeInTheDocument();
  });

  it("names the viewer's group when it leads", async () => {
    await onGroups({ ...leaderboardFixtures.withGroupBoards, groups: { ...leaderboardFixtures.withGroupBoards.groups!, rows: leaderboardFixtures.withGroupBoards.groups!.rows.slice(1).map((row, index) => ({ ...row, position: index + 1, rank: index + 1 })), window: [1, 2, 3, 4] } });

    expect(headline()).toHaveTextContent("Your group leads the week.");
  });

  it("stands the top three on the podium with their crest, score per person, participation and total", async () => {
    await onGroups();

    const podium = within(boardPanel()).getByRole("list", { name: "Top three" });
    const spots = within(podium).getAllByRole("listitem");
    expect(spots.map((spot) => spot.textContent)).toEqual([
      expect.stringContaining("Team AntsYour group2.0 per person66% gave · 6 total"),
      expect.stringContaining("Thistle3.2 per person100% gave · 16 total"),
      expect.stringContaining("Bees0.8 per person25% gave · 3 total"),
    ]);
    expect(within(podium).getAllByRole("img", { name: /crest$/ })).toHaveLength(3);
  });

  it("lists the rest of the window with each group's crest, participation bar, total and score", async () => {
    await onGroups();

    const lines = within(screen.getByRole("list", { name: "No. · group, kudos per person" })).getAllByRole("listitem");
    expect(lines.map((line) => line.textContent)).toEqual([expect.stringMatching(/^Rank 4: .*Moss.*50% gave · 3 total.*0\.5$/), expect.stringMatching(/^Rank 5: .*Acorn.*33% gave · 1 total.*0\.3$/)]);
    expect(lines[0]!.querySelector('[data-participation="50"]')).toHaveAttribute("aria-hidden", "true");
    expect(within(lines[0]!).getByRole("img", { name: "Moss crest" })).toBeInTheDocument();
  });

  it("marks the viewer's group with a ring and a label, never by colour alone", async () => {
    await onGroups();

    const mine = within(within(boardPanel()).getByRole("list", { name: "Top three" })).getAllByRole("listitem")[0]!;
    expect(within(mine).getByText("Your group")).toBeInTheDocument();
    expect(mine.querySelector("[data-mine-ring]")).not.toBeNull();
  });

  it("says when no group has given kudos yet instead of crowning every group", async () => {
    await onGroups(leaderboardFixtures.withGroupsGivingNothingYet);

    expect(headline()).toHaveTextContent("No group has given kudos this week yet.");
    expect(within(boardPanel()).queryByRole("list", { name: "Top three" })).not.toBeInTheDocument();
  });

  it("explains how groups count", async () => {
    await onGroups();

    expect(screen.getByRole("region", { name: "How it counts" })).toHaveTextContent("Groups score kudos given per person, so a small group can top the board. The share who gave sits beside it.");
  });
});

describe("WS344 WS45 GB14: only the viewer sees their group's line and the most improved group", () => {
  it("shows the most improved group with its crest and the viewer's group's gain on the Groups board", async () => {
    const { user } = visitTheBoard(leaderboardFixtures.withGroupBoards);
    await user.click(tab("Groups"));

    const panel = privatePanel()!;
    expect(within(panel).getByText("Most improved")).toBeInTheDocument();
    expect(within(panel).getByText("Moss")).toBeInTheDocument();
    expect(within(panel).getByRole("img", { name: "Moss crest" })).toBeInTheDocument();
    expect(panel).toHaveTextContent("Team Ants: ▲ 1.5 more per person than this time last week · ▲ 1 place");
  });

  it("names the group's best period when it gained nothing", async () => {
    const board = leaderboardFixtures.withGroupBoards;
    const { user } = visitTheBoard({ ...board, groups: { ...board.groups!, improvement: { best: 2.4 }, mostImproved: null } });
    await user.click(tab("Groups"));

    expect(privatePanel()).toHaveTextContent("Team Ants's best week so far: 2.4 per person.");
  });

  it("shows neither for all time", async () => {
    const { user } = visitTheBoard(leaderboardFixtures.withGroupBoardsAllTime, "/leaderboard?period=all");
    await user.click(tab("Groups"));

    expect(privatePanel()).not.toBeInTheDocument();
  });

  it("keeps the Everyone board's own line off My group", () => {
    visitTheBoard(leaderboardFixtures.withGroupBoards);

    expect(privatePanel()).not.toBeInTheDocument();
  });
});

describe("C7 GB18: a row that climbed shows how many places, and nothing shows a drop", () => {
  it("marks climbed rows on My group", () => {
    visitTheBoard(leaderboardFixtures.withGroupBoards);

    const spots = within(within(boardPanel()).getByRole("list", { name: "Top three" })).getAllByRole("listitem");
    expect(spots.map((spot) => within(spot).queryByText("▲ 2") !== null)).toEqual([false, true]);
    expect(within(spots[1]!).getByText("up 2 places")).toHaveClass("sr-only");
  });

  it("marks climbed rows on Groups and nowhere else", async () => {
    const { user } = visitTheBoard(leaderboardFixtures.withGroupBoards);
    await user.click(tab("Groups"));

    expect(within(boardPanel()).getAllByText(/^▲ \d+$/).map((mark) => mark.textContent)).toEqual(["▲ 1", "▲ 1"]);
    expect(within(boardPanel()).getAllByText("up 1 place", { selector: ".sr-only" })).toHaveLength(2);
  });

  it("marks climbed rows on Everyone", async () => {
    const { user } = visitTheBoard(leaderboardFixtures.withGroupBoards);
    await user.click(tab("Everyone"));

    const line = within(screen.getByRole("list", { name: "No. · member, kudos given" })).getByText("Hal Sato").closest("li")!;
    expect(within(line).getByText("▲ 3")).toBeInTheDocument();
    expect(within(boardPanel()).getAllByText(/^▲ \d+$/)).toHaveLength(1);
  });

  it("shows no mark for all time", async () => {
    visitTheBoard(leaderboardFixtures.withGroupBoardsAllTime, "/leaderboard?period=all");

    expect(within(boardPanel()).queryAllByText(/^▲/)).toEqual([]);
  });
});

describe("WS339 V24: the group boards pass axe and keep their marks at 3:1", () => {
  const wcag22AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

  async function violationsIn(container: Element) {
    const results = await axe.run(container, { runOnly: { type: "tag", values: wcag22AA }, rules: { "color-contrast": { enabled: false } } });
    return results.violations.map((v) => `${v.id}: ${v.help}`);
  }

  describe.each<Mode>(["light", "dark"])("in %s mode", (mode) => {
    it.each(["Groups", "My group"])("the %s board passes axe", async (name) => {
      fakeSystemTheme(mode === "dark");
      const { user, container } = visitTheBoard(leaderboardFixtures.withGroupBoards);
      await user.click(tab(name));

      expect(await violationsIn(container)).toEqual([]);
    }, 30_000);

    it.each([
      { part: "the participation bar's fill on its track", paint: "muted-foreground", surface: "muted" },
      { part: "the participation bar's fill on the card", paint: "muted-foreground", surface: "card" },
      { part: "the selected card's primary border", paint: "primary", surface: "card" },
      { part: "the viewer's group's ring", paint: "primary", surface: "card" },
    ])("keeps $part at 3:1", ({ paint, surface }) => {
      expect(contrast(mode, paint, surface)).toBeGreaterThanOrEqual(3);
    });
  });
});
