import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Highlight } from "../../../convex/website/leaderboard";
import { albumFixtures, fixedAlbum } from "../album/albumFixtures";
import { boardsFixtures, fixedBoards } from "../album/boardsFixtures";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { fixedHugBoards, hugBoardsFixtures } from "./thisWeekFixtures";

const arrival = { timeout: 10_000 };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

function visit(boards = hugBoardsFixtures.lively, { leaderboardHugs = true } = {}) {
  window.history.replaceState(null, "", "/leaderboard");
  const album = leaderboardHugs ? { ...albumFixtures.midway, leaderboardHugs: true as const } : albumFixtures.midway;
  return renderAlbum(shellFixtures.member, fixedAlbum(album), { hugBoards: fixedHugBoards(boards), boards: fixedBoards(boardsFixtures.week) });
}

async function youCard() {
  return within(await screen.findByRole("region", { name: "You this week" }, arrival));
}

function withHighlight(highlight: Highlight) {
  return { ...hugBoardsFixtures.lively, you: { ...hugBoardsFixtures.lively.you, highlight } };
}

describe("HH69: while leaderboard-hugs is on, the Leaderboard is this week's", { timeout: 30_000 }, () => {
  it("is titled Who's thanking who under the eyebrow Leaderboard · this week, with no period switch", async () => {
    visit();

    expect(await screen.findByRole("heading", { level: 1, name: "Who's thanking who" }, arrival)).toBeInTheDocument();
    expect(screen.getByText("Leaderboard · this week")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Period" })).not.toBeInTheDocument();
  });

  it("records one leaderboard view for this week", async () => {
    const { actions } = visit();
    await youCard();

    expect(actions.viewLeaderboard.mock.calls).toEqual([["week"]]);
  });

  it("HH81: with the flag off it is the kudos boards, as before", async () => {
    visit(hugBoardsFixtures.lively, { leaderboardHugs: false });

    expect(await screen.findByRole("heading", { level: 1, name: "Who said thanks" }, arrival)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "You this week" })).not.toBeInTheDocument();
  });
});

describe("HH70: the you card", { timeout: 30_000 }, () => {
  it("shows the member's face, name, level and the XP to the next level", async () => {
    visit();
    const card = await youCard();

    expect(card.getByText("Sam Example")).toBeInTheDocument();
    expect(card.getByText("Level 6 · 290 XP to level 7")).toBeInTheDocument();
  });

  it("tallies hugs given, hugs received, kudos received and hoggies found, with a green +n only beside a tally that beats last week", async () => {
    visit();
    const card = await youCard();

    expect(card.getAllByRole("term").map((term) => term.textContent)).toEqual(["hugs given", "hugs received", "kudos received", "hoggies found"]);
    expect(card.getAllByRole("definition").map((figure) => figure.textContent)).toEqual(["4+2", "2", "1", "2+2"]);
  });
});

describe("HH71: the you card leads with a positive highlight", { timeout: 30_000 }, () => {
  it.each<[Highlight, string, string]>([
    [{ kind: "best-week", hugsGiven: 4, more: 2, hoggiesFound: 2 }, "Your best week of hugs yet", "4 hugs given, 2 more than last week · 2 new hoggies"],
    [{ kind: "best-week", hugsGiven: 1, more: 1, hoggiesFound: 0 }, "Your best week of hugs yet", "1 hug given, 1 more than last week"],
    [{ kind: "more-hugs", hugsGiven: 3, more: 1 }, "1 more hug than last week", "3 hugs given this week"],
    [{ kind: "thanked", teammates: 2, reach: 14 }, "2 teammates thanked you this week", "Your thanks have reached 14 teammates"],
    [{ kind: "last-week", hugs: 6, best: true, reach: 14 }, "Last week you gave 6 hugs", "Your best week yet. Your thanks have reached 14 teammates so far."],
    [{ kind: "last-week", hugs: 1, best: false, reach: 1 }, "Last week you gave 1 hug", "Your thanks have reached 1 teammate so far."],
    [{ kind: "reach", teammates: 3 }, "Your thanks have reached 3 teammates", "Every hug and kudos you give adds to it."],
  ])("%o reads %s", async (highlight, headline, detail) => {
    visit(withHighlight(highlight));
    const card = await youCard();

    const line = card.getByText(headline).closest("p")!;
    expect(line).toHaveTextContent(`${headline}${detail}`);
    expect(line).toHaveTextContent(/^▲/);
  });
});
