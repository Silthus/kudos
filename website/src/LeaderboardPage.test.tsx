import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixedLeaderboard, leaderboardFixtures, type Leaderboard, type LeaderboardRead } from "./leaderboardFixtures";
import { shellFixtures, type Period } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const withTheBoard = shellFixtures.memberWithTheBoard;

beforeEach(() => {
  fakeSystemTheme(false);
});

function visit(path: string) {
  window.history.replaceState(null, "", path);
}

function main() {
  return screen.getByRole("main");
}

function screens() {
  return screen.getByRole("navigation", { name: "Screens" });
}

function pageTitle() {
  return screen.getByRole("heading", { level: 1 });
}

describe("WS37 WS1: the leaderboard lives at /leaderboard, with the period in the query string", () => {
  it("shows Home and Leaderboard in the screen nav while the board is open, with the current one marked", () => {
    visit("/leaderboard");
    renderApp(withTheBoard, fixedLeaderboard(leaderboardFixtures.midBoard));
    const leaderboard = within(screens()).getByRole("link", { name: "Leaderboard" });
    expect(leaderboard).toHaveAttribute("href", "/leaderboard");
    expect(leaderboard).toHaveAttribute("aria-current", "page");
    expect(within(screens()).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    expect(document.title).toBe("HedgeHug · Leaderboard");
  });

  it("marks Home as current at the root", () => {
    renderApp(withTheBoard);
    expect(within(screens()).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(within(screens()).getByRole("link", { name: "Leaderboard" })).not.toHaveAttribute("aria-current");
  });

  it("shows no Leaderboard item while the board is off", () => {
    renderApp(shellFixtures.member);
    expect(within(screens()).getAllByRole("link").map((link) => link.textContent)).toEqual(["Home"]);
  });

  it("renders the not-found page when the read answers not-found", () => {
    visit("/leaderboard");
    renderApp(shellFixtures.member, (period) => (period && { kind: "not-found" }));
    expect(pageTitle()).toHaveTextContent("Page not found");
    expect(document.title).toBe("HedgeHug · Not found");
  });

  it("still renders the not-found page on any other path", () => {
    visit("/leaderboard/groups");
    renderApp(withTheBoard, fixedLeaderboard(leaderboardFixtures.midBoard));
    expect(pageTitle()).toHaveTextContent("Page not found");
  });

  it("renders the page of a denial the read answers, as the home does", () => {
    visit("/leaderboard");
    renderApp(withTheBoard, (period) => (period && { kind: "not-a-member" }));
    expect(pageTitle()).toHaveTextContent(shellPageTitleOf("not-a-member"));
  });

  it.each<{ path: string; period: Period }>([
    { path: "/leaderboard", period: "week" },
    { path: "/leaderboard?period=month", period: "month" },
    { path: "/leaderboard?period=all", period: "all" },
  ])("reads $path as the $period board", ({ path, period }) => {
    visit(path);
    const read = vi.fn<LeaderboardRead>(fixedLeaderboard(leaderboardFixtures.midBoard));
    renderApp(withTheBoard, read);
    expect(read).toHaveBeenLastCalledWith(period);
  });

  it("reads any other period as this week and rewrites the address without a reload", () => {
    visit("/leaderboard?period=year");
    const read = vi.fn<LeaderboardRead>(fixedLeaderboard(leaderboardFixtures.midBoard));
    renderApp(withTheBoard, read);
    expect(read).toHaveBeenLastCalledWith("week");
    expect(window.location.pathname + window.location.search).toBe("/leaderboard");
  });

  it("follows the nav to the leaderboard and back without a reload, moving focus to the page title", async () => {
    const { user } = renderApp(withTheBoard, fixedLeaderboard(leaderboardFixtures.midBoard));
    await user.click(within(screens()).getByRole("link", { name: "Leaderboard" }));
    expect(window.location.pathname).toBe("/leaderboard");
    expect(pageTitle()).toHaveFocus();
    expect(document.title).toBe("HedgeHug · Leaderboard");

    await user.click(within(screens()).getByRole("link", { name: "Home" }));
    expect(window.location.pathname).toBe("/");
    expect(pageTitle()).toHaveTextContent("Thank someone for work you noticed");
    expect(pageTitle()).toHaveFocus();
  });
});

describe("WS38: the home's leaderboard card", () => {
  it("is a plain card linking to the leaderboard while the board is open, with no rank or count", () => {
    renderApp(withTheBoard);
    const card = within(main()).getByRole("link", { name: /Leaderboard/ });
    expect(card).toHaveAttribute("href", "/leaderboard");
    expect(card).toHaveTextContent("See who's thanking colleagues this week.");
    expect(card).not.toHaveTextContent(/\d|Locked/);
  });

  it("stays locked, with the other cards, while the board is off", () => {
    renderApp(shellFixtures.member);
    expect(within(main()).queryByRole("link", { name: /Leaderboard/ })).not.toBeInTheDocument();
    expect(within(main()).getByRole("heading", { level: 3, name: "Leaderboard" }).parentElement).toHaveTextContent("Locked");
  });
});

function showBoard(answer: Leaderboard, path = "/leaderboard") {
  visit(path);
  return renderApp(withTheBoard, fixedLeaderboard(answer));
}

describe("WS39: the board card and the periods", () => {
  it("labels the page and offers the three periods, with this week selected by a border, a check mark and aria-pressed", () => {
    showBoard(leaderboardFixtures.midBoard);
    expect(within(main()).getByText("Leaderboard · kudos given")).toBeInTheDocument();
    const periods = within(main()).getByRole("group", { name: "Period" });
    const buttons = within(periods).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["This week", "This month", "All time"]);
    expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
    expect(buttons[0]).toHaveClass("border-primary");
    expect(buttons[0]!.querySelector("[data-selected-mark]")).not.toBeNull();
    expect(buttons[1]!.querySelector("[data-selected-mark]")).toBeNull();
  });

  it("switches the period from the keyboard and rewrites the address without a reload", async () => {
    const read = vi.fn<LeaderboardRead>(fixedLeaderboard(leaderboardFixtures.midBoard));
    visit("/leaderboard");
    const { user } = renderApp(withTheBoard, read);
    const thisMonth = within(main()).getByRole("button", { name: "This month" });
    thisMonth.focus();
    await user.keyboard("{Enter}");
    expect(window.location.pathname + window.location.search).toBe("/leaderboard?period=month");
    expect(read).toHaveBeenLastCalledWith("month");
    expect(within(main()).getByRole("button", { name: "This month" })).toHaveAttribute("aria-pressed", "true");
    expect(within(main()).getByRole("button", { name: "This month" })).toHaveFocus();
    expect(within(main()).getByText("Everyone · This month")).toBeInTheDocument();

    await user.click(within(main()).getByRole("button", { name: "All time" }));
    expect(window.location.search).toBe("?period=all");
    await user.click(within(main()).getByRole("button", { name: "This week" }));
    expect(window.location.pathname + window.location.search).toBe("/leaderboard");
  });

  it("keeps the selected period when it is chosen again", async () => {
    const { user } = showBoard(leaderboardFixtures.midBoard);
    await user.click(within(main()).getByRole("button", { name: "This week" }));
    expect(within(main()).getByRole("button", { name: "This week" })).toHaveAttribute("aria-pressed", "true");
  });

  it.each([
    { standing: "ranked", answer: leaderboardFixtures.midBoard, says: "You're #9" },
    { standing: "tied", answer: leaderboardFixtures.tiedBelowTheLead, says: "You're tied at #2" },
    { standing: "not ranked", answer: leaderboardFixtures.notRanked, says: "Not ranked yet" },
    { standing: "left", answer: leaderboardFixtures.left, says: "Off the board" },
  ])("shows one Everyone card as a heading with the viewer's standing when $standing", ({ answer, says }) => {
    showBoard(answer);
    const card = within(main()).getByRole("heading", { level: 2, name: "Everyone" }).closest("section")!;
    expect(card).toHaveTextContent("The whole company on one board");
    expect(card).toHaveTextContent(says);
    expect(within(main()).queryByRole("tab")).not.toBeInTheDocument();
  });
});

describe("WS40: the headline names the lead, from the rows only", () => {
  it.each([
    { lead: "one leader", answer: leaderboardFixtures.midBoard, headline: "Ada Lindqvist leads the week.", deck: "21 kudos given. You're No. 9 with 11." },
    { lead: "the viewer", answer: leaderboardFixtures.viewerLeads, headline: "You lead the week.", deck: "12 kudos given." },
    { lead: "a shared lead", answer: leaderboardFixtures.sharedLead, headline: "You and Ada Lindqvist share the lead.", deck: "9 kudos given." },
    { lead: "a viewer tied below the lead", answer: leaderboardFixtures.tiedBelowTheLead, headline: "Ada Lindqvist leads the week.", deck: "9 kudos given. You're No. 2 with 4, tied with Bo Okafor." },
    { lead: "a viewer who isn't ranked", answer: leaderboardFixtures.notRanked, headline: "Ada Lindqvist leads the month.", deck: "30 kudos given." },
    { lead: "a viewer who left", answer: leaderboardFixtures.left, headline: "Ada Lindqvist leads the week.", deck: "21 kudos given. You're off the board by choice." },
  ])("for $lead", ({ answer, headline, deck }) => {
    showBoard(answer, answer.period === "month" ? "/leaderboard?period=month" : "/leaderboard");
    expect(pageTitle()).toHaveTextContent(headline);
    expect(pageTitle()).toHaveClass("hud-display");
    expect(pageTitle().nextElementSibling).toHaveTextContent(deck);
  });

  it("says all time for the all-time board", () => {
    showBoard(leaderboardFixtures.midBoard, "/leaderboard?period=all");
    expect(pageTitle()).toHaveTextContent("Ada Lindqvist leads all time.");
  });
});

function podiumSpots() {
  return within(within(main()).getByRole("list", { name: "Top three" })).getAllByRole("listitem");
}

describe("WS41: the podium stands the top three on neutral pedestals", () => {
  it("orders second, first and third from left to right, each with face, name, kudos and rank read out", () => {
    showBoard(leaderboardFixtures.midBoard);
    const spots = podiumSpots();
    expect(spots.map((spot) => spot.textContent)).toEqual([
      expect.stringContaining("Bo Okafor"),
      expect.stringContaining("Ada Lindqvist"),
      expect.stringContaining("Cleo Marchetti"),
    ]);
    expect(spots[1]).toHaveTextContent("Rank 1");
    expect(spots[1]).toHaveTextContent("21 kudos");
    expect(spots[2]).toHaveTextContent("Rank 3, tied");
    expect(spots[2]).toHaveTextContent("3=");
    expect(within(spots[1]!).getByText("AL")).toBeInTheDocument();
  });

  it("gives the crown and the tallest pedestal to every leader, so tied leaders stand equal", () => {
    showBoard(leaderboardFixtures.sharedLead);
    const [ada, sam, bo] = [podiumSpots()[1]!, podiumSpots()[0]!, podiumSpots()[2]!];
    expect(ada).toHaveTextContent("Ada Lindqvist");
    expect(sam).toHaveTextContent("Sam Example");
    expect(crowned(ada)).toBe(true);
    expect(crowned(sam)).toBe(true);
    expect(crowned(bo)).toBe(false);
    expect(pedestalOf(ada)).toBe(pedestalOf(sam));
    expect(pedestalOf(bo)).not.toBe(pedestalOf(ada));
  });

  it("rings only the viewer's spot and labels it You", () => {
    showBoard(leaderboardFixtures.sharedLead);
    const [sam, ada] = podiumSpots();
    expect(within(sam!).getByText("You")).toBeInTheDocument();
    expect(sam!.querySelector("[data-you-ring]")).not.toBeNull();
    expect(within(ada!).queryByText("You")).not.toBeInTheDocument();
    expect(ada!.querySelector("[data-you-ring]")).toBeNull();
  });

  it("leaves out the empty pedestals when fewer than three are ranked", () => {
    showBoard(leaderboardFixtures.notRanked, "/leaderboard?period=month");
    expect(podiumSpots().map((spot) => spot.textContent)).toEqual([expect.stringContaining("Bo Okafor"), expect.stringContaining("Ada Lindqvist")]);
  });

  it("uses no medal or rarity colour", () => {
    showBoard(leaderboardFixtures.midBoard);
    const podium = within(main()).getByRole("list", { name: "Top three" });
    expect(podium.innerHTML).not.toMatch(/gold|silver|bronze|amber|yellow|orange|rarity/);
  });
});

function boardList() {
  return within(main()).getByRole("list", { name: "No. · member, kudos given" });
}

function linesOf(list: HTMLElement) {
  return within(list)
    .getAllByRole("listitem")
    .map((line) => line.textContent);
}

describe("WS42: the list shows the rest of G17's window below the podium", () => {
  it("lists the window after the podium in order, with one … where positions are skipped", () => {
    showBoard(leaderboardFixtures.midBoard);
    expect(linesOf(boardList())).toEqual([
      "…",
      "Rank 6: 6FMFay Mensah14",
      "Rank 7: 7GPGus Park13",
      "Rank 8: 8HSHal Sato12",
      "Rank 9: 9SESam ExampleYou11",
      "Rank 10: 10IQIvy Quinn10",
      "Rank 11: 11JVJo Vogt9",
      "Rank 12: 12KHKai Hale8",
    ]);
  });

  it("prints ranks in Inter with tabular figures, not display type", () => {
    showBoard(leaderboardFixtures.midBoard);
    const rank = within(boardList()).getByText("6");
    expect(rank).toHaveClass("tabular-nums");
    expect(rank.closest(".hud-display")).toBeNull();
  });

  it("marks the viewer's line with the primary ring, a left primary edge and a You label", () => {
    showBoard(leaderboardFixtures.midBoard);
    const mine = within(boardList()).getAllByRole("listitem").find((line) => line.textContent?.includes("Sam Example"))!;
    expect(within(mine).getByText("You")).toBeInTheDocument();
    expect(mine.querySelector("[data-you-ring]")).not.toBeNull();
    expect(mine).toHaveAttribute("data-you");
    const other = within(boardList()).getAllByRole("listitem").find((line) => line.textContent?.includes("Ivy Quinn"))!;
    expect(other).not.toHaveAttribute("data-you");
    expect(other.querySelector("[data-you-ring]")).toBeNull();
  });

  it("shows no list when the podium holds the whole window", () => {
    showBoard(leaderboardFixtures.viewerLeads);
    expect(within(main()).queryByRole("list", { name: "No. · member, kudos given" })).not.toBeInTheDocument();
  });

  it.each([
    { path: "/leaderboard", says: "Give kudos this week to join the board." },
    { path: "/leaderboard?period=month", says: "Give kudos this month to join the board." },
    { path: "/leaderboard?period=all", says: "Give kudos to join the board." },
  ])("tells a viewer who isn't ranked how to join, with one action to Slack, at $path", ({ path, says }) => {
    showBoard(leaderboardFixtures.notRanked, path);
    expect(within(main()).getByText(says)).toBeInTheDocument();
    const slack = within(main()).getByRole("link", { name: "Thank someone in Slack (opens in a new tab)" });
    expect(slack).toHaveAttribute("href", "https://app.slack.com/client/T1");
    expect(slack).toHaveAttribute("target", "_blank");
  });

  it("tells a viewer who left the boards where to change that, in place of their row", () => {
    showBoard(leaderboardFixtures.left);
    expect(within(main()).getByText("You're not on the leaderboards. You can change that in Settings in Slack.")).toBeInTheDocument();
    expect(within(main()).queryByText("You")).not.toBeInTheDocument();
  });
});

describe("WS44: an empty board", () => {
  it("shows one hedgehog, Max's sentence and one action to thank someone in Slack, with no podium or list", () => {
    showBoard(leaderboardFixtures.empty, "/leaderboard?period=all");
    expect(pageTitle()).toHaveTextContent("Nobody is on this board yet.");
    expect(document.title).toBe("HedgeHug · Leaderboard");
    const board = within(main()).getByRole("region", { name: "Everyone · All time" });
    expect([...board.querySelectorAll("svg")].filter((art) => art.closest("a") === null)).toHaveLength(1);
    expect(within(board).getAllByRole("link")).toEqual([within(board).getByRole("link", { name: "Thank someone in Slack (opens in a new tab)" })]);
    expect(within(main()).queryByRole("list", { name: "Top three" })).not.toBeInTheDocument();
    expect(within(main()).queryByRole("list", { name: "No. · member, kudos given" })).not.toBeInTheDocument();
  });
});

function onlyYou() {
  return within(main()).queryByRole("region", { name: "Only you see these" });
}

describe("WS45: only you see these", () => {
  it.each([
    { line: "a gain with places", answer: leaderboardFixtures.midBoard, path: "/leaderboard", says: "▲ 3 more kudos than this time last week · ▲ 2 places" },
    { line: "a gain without places", answer: leaderboardFixtures.left, path: "/leaderboard", says: "▲ 2 more kudos than this time last week" },
    { line: "a best", answer: leaderboardFixtures.notRanked, path: "/leaderboard?period=month", says: "Your best month so far: 19 kudos." },
  ])("shows G18's line for $line", ({ answer, path, says }) => {
    showBoard(answer, path);
    expect(onlyYou()).toHaveTextContent(says);
    expect(onlyYou()).not.toHaveTextContent(/▼|fewer|lost|dropped/);
  });

  it("is not shown without a line", () => {
    showBoard(leaderboardFixtures.sharedLead);
    expect(onlyYou()).not.toBeInTheDocument();
  });
});

describe("WS46: how it counts", () => {
  it.each([
    { who: "on the boards", answer: leaderboardFixtures.midBoard, status: "You're on the leaderboards." },
    { who: "off the boards", answer: leaderboardFixtures.left, status: "You're off the leaderboards." },
  ])("says what counts and shows the setting as a read-only status for a viewer $who", ({ answer, status }) => {
    showBoard(answer);
    const panel = within(main()).getByRole("region", { name: "How it counts" });
    expect(panel).toHaveTextContent("Only kudos given count. Kudos received, XP and levels never rank anyone.");
    expect(panel).toHaveTextContent(status);
    expect(panel).toHaveTextContent("Settings in Slack's App Home");
    expect(within(panel).queryByRole("switch")).not.toBeInTheDocument();
    expect(within(panel).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button")).not.toBeInTheDocument();
  });
});

function crowned(spot: HTMLElement) {
  return spot.querySelector("[data-crown]") !== null;
}

function pedestalOf(spot: HTMLElement) {
  return spot.querySelector("[data-pedestal]")!.getAttribute("data-pedestal");
}

function shellPageTitleOf(kind: "not-a-member") {
  return { "not-a-member": "Members only" }[kind];
}
