import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import type { BoardRead } from "./boardRead";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { shellFixtures, type Leaderboard, type MyLeaderboard, type Period, type VisibilityReply } from "./shell";
import { renderApp } from "./test/renderApp";
import { navEntryNames } from "./test/screensNav";
import { fakeSystemTheme } from "./test/systemTheme";
import { watchTheViewerRow } from "./test/viewerRow";

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
  it("shows Profile and Leaderboard in the screen nav while the board is open, with the current one marked", () => {
    visit("/leaderboard");
    renderApp(withTheBoard, fixedLeaderboard(leaderboardFixtures.midBoard));
    const leaderboard = within(screens()).getByRole("link", { name: "Leaderboard" });
    expect(leaderboard).toHaveAttribute("href", "/leaderboard");
    expect(leaderboard).toHaveAttribute("aria-current", "page");
    expect(within(screens()).getByRole("link", { name: "Profile" })).not.toHaveAttribute("aria-current");
    expect(document.title).toBe("HedgeHug · Leaderboard");
  });

  it("marks Profile as current at the root", () => {
    renderApp(withTheBoard);
    expect(within(screens()).getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
    expect(within(screens()).getByRole("link", { name: "Leaderboard" })).not.toHaveAttribute("aria-current");
  });

  it("shows no Leaderboard item while the board is off", () => {
    renderApp(shellFixtures.member);
    expect(navEntryNames()).toEqual(["Profile"]);
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
    const read = vi.fn<BoardRead>(fixedLeaderboard(leaderboardFixtures.midBoard));
    renderApp(withTheBoard, read);
    expect(read).toHaveBeenLastCalledWith(period);
  });

  it("reads any other period as this week and rewrites the address without a reload", () => {
    visit("/leaderboard?period=year");
    const read = vi.fn<BoardRead>(fixedLeaderboard(leaderboardFixtures.midBoard));
    renderApp(withTheBoard, read);
    expect(read).toHaveBeenLastCalledWith("week");
    expect(window.location.pathname + window.location.search).toBe("/leaderboard");
  });

  it("leaves the home's query string alone, so the sign-in code reaches Convex Auth", () => {
    visit("/?code=18437459");
    renderApp(shellFixtures.signedOut);
    expect(window.location.pathname + window.location.search).toBe("/?code=18437459");
  });

  it("leaves a leaderboard address alone while it carries the sign-in code, so Convex Auth redeems it there", () => {
    visit("/leaderboard?period=month&code=18437459");
    renderApp(shellFixtures.loading);
    expect(window.location.pathname + window.location.search).toBe("/leaderboard?period=month&code=18437459");
  });

  it("keeps the sign-in code when it rewrites a leaderboard address", () => {
    visit("/leaderboard?period=year&code=18437459");
    renderApp(shellFixtures.loading);
    expect(window.location.pathname + window.location.search).toBe("/leaderboard?code=18437459");
  });

  it("follows the nav to the leaderboard and back without a reload, moving focus to the page title", async () => {
    const { user } = renderApp(withTheBoard, fixedLeaderboard(leaderboardFixtures.midBoard));
    await user.click(within(screens()).getByRole("link", { name: "Leaderboard" }));
    expect(window.location.pathname).toBe("/leaderboard");
    expect(pageTitle()).toHaveFocus();
    expect(document.title).toBe("HedgeHug · Leaderboard");

    await user.click(within(screens()).getByRole("link", { name: "Profile" }));
    expect(window.location.pathname).toBe("/");
    expect(pageTitle()).toHaveTextContent("Sam Example");
    expect(pageTitle()).toHaveFocus();
  });
});

describe("WS38 WS110: the home's Leaderboard panel", () => {
  function leaderboardPanel() {
    return within(main()).getByRole("region", { name: "Leaderboard" });
  }

  it("is Where you stand, linking to the leaderboard, while the board is open", () => {
    renderApp(withTheBoard, fixedLeaderboard(leaderboardFixtures.midBoard));
    const standing = within(main()).getByRole("region", { name: "Where you stand" });
    expect(within(standing).getByRole("link", { name: "Open the leaderboard" })).toHaveAttribute("href", "/leaderboard");
    expect(standing).not.toHaveTextContent(/Locked/);
  });

  it("stays locked, with the other panels, while the board is off", () => {
    renderApp(shellFixtures.member);
    expect(within(leaderboardPanel()).queryByRole("link")).not.toBeInTheDocument();
    expect(leaderboardPanel()).toHaveTextContent("Locked");
  });
});

describe("WS52: the leaderboard page waits for its unlock", () => {
  it.each([
    { state: "locked", visitor: shellFixtures.memberWaitingForTheBoard, answer: { kind: "locked", level: 3 } as const, says: "Unlocks at level 3", entry: "Leaderboard, locked. Unlocks at level 3" },
    { state: "ready", visitor: shellFixtures.memberWithTheBoardReady, answer: { kind: "ready" } as const, says: "Leaderboard is ready", entry: "Leaderboard: unlock ready. Open its crate" },
  ])("says what the $state leaderboard waits for in place of the board, with its nav entry in that state and no link", ({ visitor, answer, says, entry }) => {
    visit("/leaderboard");
    renderApp(visitor, (period) => (period && answer));
    expect(pageTitle()).toHaveTextContent("Leaderboard");
    expect(document.title).toBe("HedgeHug · Leaderboard");
    expect(main()).toHaveTextContent(says);
    expect(navEntryNames()[1]).toBe(entry);
    expect(within(screens()).queryByRole("link", { name: "Leaderboard" })).not.toBeInTheDocument();
    expect(within(main()).queryByRole("region", { name: /Everyone/ })).not.toBeInTheDocument();
    expect(within(main()).queryByRole("list")).not.toBeInTheDocument();
  });

  it("sends a locked member back to their profile", () => {
    visit("/leaderboard");
    renderApp(shellFixtures.memberWaitingForTheBoard, (period) => (period && { kind: "locked", level: 3 }));
    expect(within(main()).getByRole("link", { name: "Back to your profile" })).toHaveAttribute("href", "/");
  });

  it("moves focus to the board's title when the ready leaderboard opens under the open page", () => {
    visit("/leaderboard");
    let answer: MyLeaderboard = { kind: "ready" };
    const { showVisitor } = renderApp(shellFixtures.memberWithTheBoardReady, (period) => (period && answer));
    within(main()).getByRole("button", { name: "Open" }).focus();

    answer = leaderboardFixtures.midBoard;
    showVisitor(withTheBoard);

    expect(pageTitle()).toHaveTextContent("Ada Lindqvist leads the week.");
    expect(pageTitle()).toHaveFocus();
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
    const read = vi.fn<BoardRead>(fixedLeaderboard(leaderboardFixtures.midBoard));
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

  it("keeps the board and focus on the switch while the next period's board loads", async () => {
    const loaded = new Set<Period | undefined>(["week"]);
    const read: BoardRead = (period) => (loaded.has(period) ? { ...leaderboardFixtures.midBoard, period: period! } : undefined);
    visit("/leaderboard");
    const { user, showVisitor } = renderApp(withTheBoard, read);
    await user.click(within(main()).getByRole("button", { name: "This month" }));

    expect(pageTitle()).toHaveTextContent("Ada Lindqvist leads the week.");
    expect(within(main()).getByRole("button", { name: "This month" })).toHaveFocus();
    expect(within(main()).getByRole("button", { name: "This month" })).toHaveAttribute("aria-pressed", "true");

    loaded.add("month");
    showVisitor(withTheBoard);
    expect(pageTitle()).toHaveTextContent("Ada Lindqvist leads the month.");
    expect(within(main()).getByRole("button", { name: "This month" })).toHaveAttribute("aria-pressed", "true");
    expect(within(main()).getByRole("button", { name: "This month" })).toHaveFocus();
  });

  it("keeps focus on the switch when the next period's board is empty, and back", async () => {
    const read: BoardRead = (period) => period && (period === "month" ? { ...leaderboardFixtures.empty, period } : { ...leaderboardFixtures.midBoard, period });
    visit("/leaderboard");
    const { user } = renderApp(withTheBoard, read);

    await user.click(within(main()).getByRole("button", { name: "This month" }));
    expect(pageTitle()).toHaveTextContent("Nobody is on this board yet.");
    expect(within(main()).getByRole("button", { name: "This month" })).toHaveFocus();

    await user.click(within(main()).getByRole("button", { name: "This week" }));
    expect(pageTitle()).toHaveTextContent("Ada Lindqvist leads the week.");
    expect(within(main()).getByRole("button", { name: "This week" })).toHaveFocus();
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
    const title = within(main()).getByRole("heading", { level: 2, name: "Everyone" });
    expect(title).not.toHaveClass("hud-display");
    const card = title.closest("section")!;
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

  it("prints the podium's kudos and ranks in the body face with tabular figures, not display type", () => {
    showBoard(leaderboardFixtures.midBoard);
    const ada = podiumSpots()[1]!;
    for (const number of [within(ada).getByText("21"), ada.querySelector("[data-pedestal] span")!]) {
      expect(number).toHaveClass("tabular-nums");
      expect(number.closest(".hud-display")).toBeNull();
    }
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

describe("WS34 V19: teammates show their Slack faces", () => {
  const ada = "https://avatars.slack-edge.com/ada_192.png";
  const ivy = "https://secure.gravatar.com/avatar/ivy.jpg?s=192";

  it("shows a teammate's Slack picture on the podium and in the list, beside their name", () => {
    showBoard(leaderboardFixtures.withTeammatesFaces);
    expect(within(podiumSpots()[1]!).getByText("Ada Lindqvist")).toBeInTheDocument();
    expect(podiumSpots()[1]!.querySelector(`img[src="${ada}"]`)).toHaveAttribute("alt", "");
    expect(within(podiumSpots()[1]!).queryByText("AL")).not.toBeInTheDocument();
    const ivyRow = within(main()).getByText("Ivy Quinn").closest("li")!;
    expect(ivyRow.querySelector(`img[src="${ivy}"]`)).toHaveAttribute("alt", "");
  });

  it("keeps initials for a teammate without a picture", () => {
    showBoard(leaderboardFixtures.withTeammatesFaces);
    expect(within(podiumSpots()[0]!).getByText("BO")).toBeInTheDocument();
    expect(podiumSpots()[0]!.querySelector("img")).toBeNull();
  });

  it("falls back to the teammate's initials when their picture fails to load", () => {
    showBoard(leaderboardFixtures.withTeammatesFaces);

    for (const picture of document.querySelectorAll(`img[src="${ada}"], img[src="${ivy}"]`)) fireEvent.error(picture);

    expect(document.querySelectorAll(`img[src="${ada}"], img[src="${ivy}"]`)).toHaveLength(0);
    expect(within(podiumSpots()[1]!).getByText("AL")).toBeInTheDocument();
    expect(within(within(main()).getByText("Ivy Quinn").closest("li")!).getByText("IQ")).toBeInTheDocument();
  });

  it("shows initials at once for a picture that already failed in the tab, and keeps a picture that already loaded", () => {
    pictureAlreadySettled({ [ada]: "failed", [ivy]: "loaded" });

    showBoard(leaderboardFixtures.withTeammatesFaces);

    expect(document.querySelectorAll(`img[src="${ada}"]`)).toHaveLength(0);
    expect(within(podiumSpots()[1]!).getByText("AL")).toBeInTheDocument();
    const ivyRow = within(main()).getByText("Ivy Quinn").closest("li")!;
    expect(ivyRow.querySelector(`img[src="${ivy}"]`)).toBeInTheDocument();
    expect(within(ivyRow).queryByText("IQ")).not.toBeInTheDocument();
  });
});

function pictureAlreadySettled(pictures: Record<string, "failed" | "loaded">) {
  const settledAs = (image: HTMLImageElement) => pictures[image.getAttribute("src") ?? ""];
  const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockImplementation(function (this: HTMLImageElement) {
    return settledAs(this) !== undefined;
  });
  const naturalWidth = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockImplementation(function (this: HTMLImageElement) {
    return settledAs(this) === "loaded" ? 192 : 0;
  });
  onTestFinished(() => {
    complete.mockRestore();
    naturalWidth.mockRestore();
  });
}

describe("WS42: the list shows the rest of G17's window below the podium", () => {
  it("lists the window after the podium in order, with the skipped positions behind Show more lines", () => {
    showBoard(leaderboardFixtures.midBoard);
    expect(linesOf(boardList())).toEqual([
      "Show 2 more above",
      "Rank 6: 6FMFay Mensah14",
      "Rank 7: 7GPGus Park13",
      "Rank 8: 8HSHal Sato12",
      "Rank 9: 9SESam ExampleYou11",
      "Rank 10: 10IQIvy Quinn10",
      "Rank 11: 11JVJo Vogt9",
      "Rank 12: 12KHKai Hale8",
      "Show 1 more below",
    ]);
  });

  it("prints ranks in the body face with tabular figures, not display type", () => {
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


  it("shows the column header only over lines, never over the join line alone", () => {
    showBoard(leaderboardFixtures.notRanked);
    expect(within(main()).getByText("Give kudos this week to join the board.")).toBeInTheDocument();
    expect(within(main()).queryByText("No. · member")).not.toBeInTheDocument();
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
});

function placeEachLine({ height, scrollerHeight }: { height: number; scrollerHeight: number }) {
  const geometry: Record<string, (this: HTMLElement) => number> = {
    offsetHeight: () => height,
    offsetTop(this: HTMLElement) {
      return this.parentElement === null ? 0 : [...this.parentElement.children].indexOf(this) * height;
    },
    clientHeight: () => scrollerHeight,
  };
  for (const [name, get] of Object.entries(geometry)) {
    const jsdom = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name) ?? Object.getOwnPropertyDescriptor(Element.prototype, name)!;
    Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get });
    onTestFinished(() => {
      Object.defineProperty(HTMLElement.prototype, name, jsdom);
    });
  }
}

function wholeBoard() {
  return within(main()).getByRole("region", { name: "The whole board" });
}

describe("WS43: the whole board and Jump to me", () => {
  let scrolls: ScrollToOptions[];

  beforeEach(() => {
    scrolls = [];
    Element.prototype.scrollTo = function (options?: ScrollToOptions | number) {
      scrolls.push(options as ScrollToOptions);
    } as typeof Element.prototype.scrollTo;
  });

  it("says which positions the list shows, and opens the whole board centred on the viewer by keyboard", async () => {
    watchTheViewerRow();
    placeEachLine({ height: 40, scrollerHeight: 400 });
    const { user } = showBoard(leaderboardFixtures.midBoard);
    expect(within(main()).getByText("No. 6–12 of 13")).toBeInTheDocument();
    within(main()).getByRole("button", { name: "Show the whole board" }).focus();
    await user.keyboard("{Enter}");

    expect(within(main()).queryByRole("list", { name: "No. · member, kudos given" })).not.toBeInTheDocument();
    expect(within(wholeBoard()).getAllByRole("listitem")).toHaveLength(13);
    expect(wholeBoard()).toHaveAttribute("tabindex", "0");
    expect(new Set(scrolls.map((scroll) => scroll.behavior))).toEqual(new Set(["instant"]));
    expect(scrolls.at(-1)).toEqual(expect.objectContaining({ top: 8 * 40 - (400 - 40) / 2 }));
    expect(within(main()).getByRole("button", { name: "Back to my spot" })).toHaveFocus();

    await user.tab({ shift: true });
    expect(wholeBoard()).toHaveFocus();
  });

  it("pins a copy of the viewer's row with Jump to me while it is scrolled away, which brings it back and focuses it", async () => {
    const viewerRow = watchTheViewerRow();
    const { user } = showBoard(leaderboardFixtures.midBoard);
    await user.click(within(main()).getByRole("button", { name: "Show the whole board" }));
    expect(within(main()).queryByRole("button", { name: "Jump to me" })).not.toBeInTheDocument();

    viewerRow.see({ visible: false, edge: "bottom" });
    const jump = within(main()).getByRole("button", { name: "Jump to me" });
    expect(jump.closest("[data-pinned]")).toHaveTextContent("Sam Example");
    expect(jump.closest("[data-pinned]")).toHaveAttribute("data-pinned", "bottom");
    jump.focus();
    await user.keyboard("{Enter}");

    expect(scrolls.at(-1)).toEqual(expect.objectContaining({ behavior: "smooth" }));
    const mine = within(wholeBoard()).getAllByRole("listitem").find((line) => line.hasAttribute("data-you"))!;
    expect(mine).toHaveFocus();
    viewerRow.see({ visible: true });
    expect(within(main()).queryByRole("button", { name: "Jump to me" })).not.toBeInTheDocument();
  });

  it("follows the viewer's row when kudos move them on the open whole board", async () => {
    const viewerRow = watchTheViewerRow();
    let board = leaderboardFixtures.midBoard;
    visit("/leaderboard");
    const { user, showVisitor } = renderApp(withTheBoard, (period) => period && { ...board, period });
    await user.click(within(main()).getByRole("button", { name: "Show the whole board" }));

    board = leaderboardFixtures.midBoardAfterAClimb;
    showVisitor(withTheBoard);
    viewerRow.see({ visible: false, edge: "bottom" });
    expect(within(main()).getByRole("button", { name: "Jump to me" }).closest("[data-pinned]")).toHaveTextContent("Sam Example");
  });

  it("pins the copy to the top edge when the viewer's row is scrolled above, and jumps instantly under reduced motion", async () => {
    const viewerRow = watchTheViewerRow();
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({ ...matchMedia(query), matches: query === "(prefers-reduced-motion: reduce)" })) as typeof window.matchMedia;
    const { user } = showBoard(leaderboardFixtures.midBoard);
    await user.click(within(main()).getByRole("button", { name: "Show the whole board" }));
    viewerRow.see({ visible: false, edge: "top" });
    expect(within(main()).getByRole("button", { name: "Jump to me" }).closest("[data-pinned]")).toHaveAttribute("data-pinned", "top");
    await user.click(within(main()).getByRole("button", { name: "Jump to me" }));
    expect(scrolls.at(-1)).toEqual(expect.objectContaining({ behavior: "instant" }));
  });

  it("goes back to the window from Back to my spot, keeping focus on the footer's button", async () => {
    watchTheViewerRow();
    const { user } = showBoard(leaderboardFixtures.midBoard);
    await user.click(within(main()).getByRole("button", { name: "Show the whole board" }));
    within(main()).getByRole("button", { name: "Back to my spot" }).focus();
    await user.keyboard("{Enter}");
    expect(linesOf(boardList())).toHaveLength(9);
    expect(within(main()).getByRole("button", { name: "Show the whole board" })).toHaveFocus();
  });

  it("offers Show fewer, and never Jump to me, to a viewer who isn't on the board", async () => {
    watchTheViewerRow();
    const { user } = showBoard(leaderboardFixtures.leftALongBoard);
    expect(within(main()).getByText("No. 1–3 of 12")).toBeInTheDocument();
    await user.click(within(main()).getByRole("button", { name: "Show the whole board" }));
    expect(within(wholeBoard()).getAllByRole("listitem")).toHaveLength(12);
    expect(within(main()).queryByRole("button", { name: "Jump to me" })).not.toBeInTheDocument();
    await user.click(within(main()).getByRole("button", { name: "Show fewer" }));
    expect(within(main()).queryByRole("region", { name: "The whole board" })).not.toBeInTheDocument();
    expect(within(main()).getByText("No. 1–3 of 12")).toBeInTheDocument();
  });

  it("tells assistive tech the footer's button shows and hides the whole board", async () => {
    watchTheViewerRow();
    const { user } = showBoard(leaderboardFixtures.midBoard);
    const showWhole = within(main()).getByRole("button", { name: "Show the whole board" });
    expect(showWhole).toHaveAttribute("aria-expanded", "false");
    await user.click(showWhole);
    const backToMySpot = within(main()).getByRole("button", { name: "Back to my spot" });
    expect(backToMySpot).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(backToMySpot.getAttribute("aria-controls")!)).toBe(wholeBoard());
  });

  it("keeps Back to my spot while the whole board is open, even once kudos make the window cover every row", async () => {
    watchTheViewerRow();
    let board: Leaderboard = leaderboardFixtures.midBoard;
    visit("/leaderboard");
    const { user, showVisitor } = renderApp(withTheBoard, (period) => period && { ...board, period });
    await user.click(within(main()).getByRole("button", { name: "Show the whole board" }));

    board = { ...board, window: board.rows.map((row) => row.position) };
    showVisitor(withTheBoard);
    expect(wholeBoard()).toBeInTheDocument();
    await user.click(within(main()).getByRole("button", { name: "Back to my spot" }));

    expect(within(main()).queryByRole("region", { name: "The whole board" })).not.toBeInTheDocument();
    expect(ranksIn(boardList())).toEqual([3, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(pageTitle()).toHaveFocus();
  });

  it("offers no whole board when the window already shows every row", () => {
    showBoard(leaderboardFixtures.viewerLeads);
    expect(within(main()).queryByRole("button", { name: "Show the whole board" })).not.toBeInTheDocument();
  });
});

function ranksIn(list: HTMLElement) {
  return linesOf(list).map((line) => Number(/^Rank (\d+)/.exec(line ?? "")?.[1] ?? line));
}

function showMore(side: "above" | "below") {
  return within(main()).queryByRole("button", { name: new RegExp(`^Show \\d+ more ${side}$`) });
}

function lineAt(position: number) {
  return within(boardList()).getAllByRole("listitem").find((line) => line.textContent?.startsWith(`Rank ${position}:`));
}

describe("WS320: Show 5 more grows the window in place", () => {
  it("offers five more on each side of a viewer in the middle, and fewer once fewer are hidden", async () => {
    const { user } = showBoard(leaderboardFixtures.longBoardViewerInTheMiddle);
    expect(showMore("above")).toHaveAccessibleName("Show 5 more above");
    expect(showMore("below")).toHaveAccessibleName("Show 5 more below");
    expect(within(main()).getByText("No. 12–18 of 30")).toBeInTheDocument();

    await user.click(showMore("above")!);
    expect(ranksIn(boardList())).toEqual([Number.NaN, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, Number.NaN]);
    expect(lineAt(7)).toHaveFocus();
    expect(showMore("above")).toHaveAccessibleName("Show 3 more above");
    expect(within(main()).getByText("No. 7–18 of 30")).toBeInTheDocument();

    await user.click(showMore("above")!);
    expect(lineAt(4)).toHaveFocus();
    expect(showMore("above")).not.toBeInTheDocument();
    expect(ranksIn(boardList()).slice(0, 2)).toEqual([4, 5]);
  });

  it("steps down to the last row, moving focus to the first revealed row each time", async () => {
    const { user } = showBoard(leaderboardFixtures.longBoardViewerInTheMiddle);
    showMore("below")!.focus();
    await user.keyboard("{Enter}");
    expect(lineAt(19)).toHaveFocus();
    expect(showMore("below")).toHaveAccessibleName("Show 5 more below");

    await user.click(showMore("below")!);
    expect(lineAt(24)).toHaveFocus();
    expect(showMore("below")).toHaveAccessibleName("Show 2 more below");

    await user.click(showMore("below")!);
    expect(lineAt(29)).toHaveFocus();
    expect(showMore("below")).not.toBeInTheDocument();
    expect(ranksIn(boardList()).slice(-2)).toEqual([29, 30]);
    expect(within(main()).getByText("No. 12–30 of 30")).toBeInTheDocument();
  });

  it("offers only rows below at the top of the board", () => {
    showBoard(leaderboardFixtures.longBoardViewerAtTheTop);
    expect(showMore("above")).not.toBeInTheDocument();
    expect(showMore("below")).toHaveAccessibleName("Show 5 more below");
    expect(ranksIn(boardList())[0]).toBe(4);
  });

  it("offers only rows above at the bottom of the board", () => {
    showBoard(leaderboardFixtures.longBoardViewerAtTheBottom);
    expect(showMore("above")).toHaveAccessibleName("Show 5 more above");
    expect(showMore("below")).not.toBeInTheDocument();
  });

  it("grows the board below the podium for a viewer who isn't on it", async () => {
    const { user } = showBoard(leaderboardFixtures.leftALongBoard);
    await user.click(showMore("below")!);
    expect(linesOf(boardList())[0]).toContain("Dev Rao");
    expect(ranksIn(boardList())).toEqual([3, 5, 6, 7, 8, Number.NaN]);
    expect(document.activeElement).toBe(within(boardList()).getAllByRole("listitem")[0]);
    expect(within(main()).getByText("No. 4–8 of 12")).toBeInTheDocument();
  });

  it("keeps Show the whole board and Back to my spot once every row is shown", async () => {
    watchTheViewerRow();
    Element.prototype.scrollTo = () => undefined;
    const { user } = showBoard(leaderboardFixtures.midBoard);
    await user.click(showMore("above")!);
    await user.click(showMore("below")!);
    expect(within(main()).getByText("No. 4–13 of 13")).toBeInTheDocument();

    await user.click(within(main()).getByRole("button", { name: "Show the whole board" }));
    await user.click(within(main()).getByRole("button", { name: "Back to my spot" }));
    expect(showMore("above")).toHaveAccessibleName("Show 2 more above");
    expect(within(main()).getByText("No. 6–12 of 13")).toBeInTheDocument();
  });

  it("moves focus only on a press, never when a live update brings a revealed row back", async () => {
    let board: Leaderboard = leaderboardFixtures.longBoardViewerInTheMiddle;
    visit("/leaderboard");
    const { user, showVisitor } = renderApp(withTheBoard, (period) => period && { ...board, period });
    await user.click(showMore("above")!);
    expect(lineAt(7)).toHaveFocus();

    const thisMonth = within(main()).getByRole("button", { name: "This month" });
    thisMonth.focus();
    const firstWindow = board.window;
    board = { ...board, window: [1, 2, 3, 22, 23, 24, 25, 26, 27, 28] };
    showVisitor(withTheBoard);
    board = { ...board, window: firstWindow };
    showVisitor(withTheBoard);
    expect(lineAt(7)).toBeInTheDocument();
    expect(thisMonth).toHaveFocus();
  });

  it("restores the first window from Back to my spot", async () => {
    watchTheViewerRow();
    Element.prototype.scrollTo = () => undefined;
    const { user } = showBoard(leaderboardFixtures.longBoardViewerInTheMiddle);
    await user.click(showMore("above")!);
    await user.click(showMore("below")!);
    await user.click(within(main()).getByRole("button", { name: "Show the whole board" }));
    expect(within(wholeBoard()).getAllByRole("listitem")).toHaveLength(30);

    await user.click(within(main()).getByRole("button", { name: "Back to my spot" }));
    expect(ranksIn(boardList()).slice(1, -1)).toEqual([12, 13, 14, 15, 16, 17, 18]);
    expect(showMore("above")).toHaveAccessibleName("Show 5 more above");
  });
});

describe("WS44: an empty board", () => {
  it("keeps focus on the title when the empty board fills while its title has focus", () => {
    let board: Leaderboard = leaderboardFixtures.empty;
    visit("/leaderboard");
    const { showVisitor } = renderApp(withTheBoard, (period) => period && { ...board, period });
    pageTitle().focus();

    board = leaderboardFixtures.midBoard;
    showVisitor(withTheBoard);

    expect(pageTitle()).toHaveTextContent("Ada Lindqvist leads the week.");
    expect(pageTitle()).toHaveFocus();
  });

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

describe("WS322: how it counts", () => {
  it("says what never ranks anyone, achievements included, and no longer sends anyone to Settings in Slack", () => {
    showBoard(leaderboardFixtures.midBoard);
    const panel = howItCounts();
    expect(panel).toHaveTextContent("Only kudos given count. Kudos received, XP, levels and achievements never rank anyone.");
    expect(main()).not.toHaveTextContent(/Settings in Slack/);
  });
});

describe("WS321: the visibility switch", () => {
  it.each([
    { who: "on the boards", answer: leaderboardFixtures.midBoard, checked: true },
    { who: "off the boards", answer: leaderboardFixtures.left, checked: false },
  ])("is a switch named Show me on the leaderboards, checked from the read for a viewer $who", ({ answer, checked }) => {
    showBoard(answer);
    const visibility = visibilitySwitch();
    expect(visibility).toHaveAccessibleName("Show me on the leaderboards");
    if (checked) expect(visibility).toBeChecked();
    else expect(visibility).not.toBeChecked();
    expect(visibility).not.toHaveAttribute("aria-disabled");
  });

  it("sends the flipped setting once, and is disabled while the call is pending", async () => {
    const pending = answerLater();
    const { user, setBoardVisibility } = switchWith(leaderboardFixtures.midBoard, () => pending.answer);

    await user.click(visibilitySwitch());

    expect(setBoardVisibility).toHaveBeenCalledExactlyOnceWith(false);
    expect(visibilitySwitch()).toHaveAttribute("aria-disabled", "true");
    await user.click(visibilitySwitch());
    expect(setBoardVisibility).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({ kind: "set", visible: false }));
    expect(visibilitySwitch()).not.toHaveAttribute("aria-disabled");
  });

  it("keeps its position from the read, never from the value sent, until the read moves", async () => {
    const { user, showBoardAnswer } = switchWith(leaderboardFixtures.midBoard, async () => ({ kind: "set", visible: false }));

    await user.click(visibilitySwitch());
    await act(async () => undefined);
    expect(visibilitySwitch()).toBeChecked();

    showBoardAnswer(leaderboardFixtures.left);
    expect(visibilitySwitch()).not.toBeChecked();
  });

  it.each<{ answer: VisibilityReply; from: Leaderboard; to: Leaderboard; says: string }>([
    { answer: { kind: "set", visible: false }, from: leaderboardFixtures.midBoard, to: leaderboardFixtures.left, says: "You're off the leaderboards." },
    { answer: { kind: "set", visible: true }, from: leaderboardFixtures.left, to: leaderboardFixtures.midBoard, says: "You're on the leaderboards." },
  ])("says $says politely once the read shows the setting the answer $answer.kind", async ({ answer, from, to, says }) => {
    const { user, showBoardAnswer } = switchWith(from, async () => answer);

    await user.click(visibilitySwitch());
    await act(async () => undefined);
    expect(within(howItCounts()).getByRole("status")).toBeEmptyDOMElement();

    showBoardAnswer(to);
    expect(within(howItCounts()).getByRole("status")).toHaveTextContent(says);
  });

  it("drops the set line once another tab or Slack moves the setting back", async () => {
    const { user, showBoardAnswer } = switchWith(leaderboardFixtures.midBoard, async () => ({ kind: "set", visible: false }));
    await user.click(visibilitySwitch());
    showBoardAnswer(leaderboardFixtures.left);
    expect(within(howItCounts()).getByRole("status")).toHaveTextContent("You're off the leaderboards.");

    showBoardAnswer(leaderboardFixtures.midBoard);

    expect(within(howItCounts()).getByRole("status")).toBeEmptyDOMElement();
    expect(visibilitySwitch()).toBeChecked();
  });

  it("says That couldn't be changed politely after a refusal", async () => {
    const { user } = switchWith(leaderboardFixtures.midBoard, async () => ({ kind: "refused" }));

    await user.click(visibilitySwitch());

    expect(await within(howItCounts()).findByRole("status")).toHaveTextContent("That couldn't be changed.");
  });

  it("says Couldn't reach HedgeHug after an error and never sends again by itself", async () => {
    const { user, setBoardVisibility } = switchWith(leaderboardFixtures.left, async () => Promise.reject(new Error("socket closed")));

    await user.click(visibilitySwitch());

    expect(await within(howItCounts()).findByRole("status")).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    expect(setBoardVisibility).toHaveBeenCalledExactlyOnceWith(true);
    expect(visibilitySwitch()).not.toHaveAttribute("aria-disabled");
    expect(visibilitySwitch()).not.toBeChecked();
  });

  it("drops a failure line once the read shows the setting the member asked for, as when a slow call lands after all", async () => {
    const { user, showBoardAnswer } = switchWith(leaderboardFixtures.midBoard, async () => Promise.reject(new Error("no answer in time")));
    await user.click(visibilitySwitch());
    expect(await within(howItCounts()).findByRole("status")).toHaveTextContent("Couldn't reach HedgeHug. Try again.");

    showBoardAnswer(leaderboardFixtures.left);

    expect(within(howItCounts()).getByRole("status")).toBeEmptyDOMElement();
  });

  it.each<{ answer: () => Promise<VisibilityReply>; says: string; reads: Leaderboard[] }>([
    { answer: async () => Promise.reject(new Error("no answer in time")), says: "Couldn't reach HedgeHug. Try again.", reads: [leaderboardFixtures.left, leaderboardFixtures.midBoard] },
    { answer: async () => ({ kind: "set", visible: false }), says: "You're off the leaderboards.", reads: [leaderboardFixtures.left, leaderboardFixtures.midBoard, leaderboardFixtures.left] },
  ])("retires the line $says once the read has moved past it, so a later change elsewhere never brings it back", async ({ answer, reads }) => {
    const { user, showBoardAnswer } = switchWith(leaderboardFixtures.midBoard, answer);
    await user.click(visibilitySwitch());
    await act(async () => undefined);

    reads.forEach(showBoardAnswer);

    expect(within(howItCounts()).getByRole("status")).toBeEmptyDOMElement();
  });

  it("says nothing after a denial, which the profile's read shows instead", async () => {
    const { user } = switchWith(leaderboardFixtures.midBoard, async () => ({ kind: "signed-out" }));

    await user.click(visibilitySwitch());
    await act(async () => undefined);

    expect(within(howItCounts()).getByRole("status")).toBeEmptyDOMElement();
  });

  it("tells a viewer who left the boards how to come back, in place of their row", () => {
    showBoard(leaderboardFixtures.left);
    expect(within(main()).getByText(`You're off the board by choice. Switch on "Show me on the leaderboards" to come back.`)).toBeInTheDocument();
    expect(within(main()).queryByText("You")).not.toBeInTheDocument();
  });
});

function howItCounts() {
  return within(main()).getByRole("region", { name: "How it counts" });
}

function visibilitySwitch() {
  return within(howItCounts()).getByRole("switch", { name: "Show me on the leaderboards" });
}

function switchWith(answer: Leaderboard, setBoardVisibility: (visible: boolean) => Promise<VisibilityReply>) {
  visit("/leaderboard");
  let shown = answer;
  const spy = vi.fn(setBoardVisibility);
  const view = renderApp(withTheBoard, (period) => (period && shown), { setBoardVisibility: spy });
  const showBoardAnswer = (next: Leaderboard) => {
    shown = next;
    view.showVisitor(withTheBoard);
  };
  return { ...view, setBoardVisibility: spy, showBoardAnswer };
}

function answerLater() {
  let resolve: (answer: VisibilityReply) => void = () => undefined;
  const answer = new Promise<VisibilityReply>((settle) => {
    resolve = settle;
  });
  return { answer, resolve };
}

function crowned(spot: HTMLElement) {
  return spot.querySelector("[data-crown]") !== null;
}

function pedestalOf(spot: HTMLElement) {
  return spot.querySelector("[data-pedestal]")!.getAttribute("data-pedestal");
}

function shellPageTitleOf(kind: "not-a-member") {
  return { "not-a-member": "Members only" }[kind];
}
