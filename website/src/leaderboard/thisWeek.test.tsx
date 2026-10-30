import { act, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Highlight, HugBoards, HugMeasure } from "../../../convex/website/leaderboard";
import { albumFixtures, fixedAlbum } from "../album/albumFixtures";
import { boardsFixtures, fixedBoards } from "../album/boardsFixtures";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import type { HugBoardsShown } from "../album/answer";
import { byKudosReceived, byLevel, fixedHugBoards, hugBoardsFixtures } from "./thisWeekFixtures";

const arrival = { timeout: 10_000 };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

type Measured = (measure: HugMeasure) => HugBoardsShown | undefined;

function visit(boards: HugBoards | Measured = hugBoardsFixtures.lively, { leaderboardHugs = true } = {}) {
  window.history.replaceState(null, "", "/leaderboard");
  const album = leaderboardHugs ? { ...albumFixtures.midway, leaderboardHugs: true as const } : albumFixtures.midway;
  return renderAlbum(shellFixtures.member, fixedAlbum(album), { hugBoards: fixedHugBoards(boards), boards: fixedBoards(boardsFixtures.week) });
}

async function board(name: string) {
  return within(await screen.findByRole("region", { name }, arrival));
}

function rowsIn(region: ReturnType<typeof within>) {
  return region.getAllByRole("listitem").map((row: HTMLElement) => row.textContent);
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

describe("HH73: the People board", { timeout: 30_000 }, () => {
  it("offers the measures Hugs given, Hugged, Kudos received, Level and Hoggies, with Hugs given chosen", async () => {
    visit();
    const people = await board("People");

    const chips = within(people.getByRole("group", { name: "Rank by" })).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual(["Hugs given", "Hugged", "Kudos received", "Level", "Hoggies"]);
    expect(chips.map((chip) => chip.getAttribute("aria-pressed"))).toEqual(["true", "false", "false", "false", "false"]);
  });

  it("ranks each person with their face, name and figure, equal figures sharing a rank, and tags the member's row You", async () => {
    visit();
    const people = await board("People");

    expect(rowsIn(people)).toEqual(["1WAWren Alder6 hugs", "2IOInes Okafor4 hugs", "2SESam ExampleYou4 hugs", "4FMFen Marlowe1 hug"]);
  });

  it("shows a dash for the member's rank before they have a figure", async () => {
    visit(hugBoardsFixtures.quiet);
    const people = await board("People");

    expect(rowsIn(people)).toEqual(["1WAWren Alder2 hugs", "–SESam ExampleYou0 hugs"]);
  });

  it("asks for the chosen measure and keeps this board until its answer arrives", async () => {
    const asked = vi.fn<Measured>();
    let levelArrived = false;
    asked.mockImplementation((measure) => (measure === "level" && !levelArrived ? undefined : measure === "level" ? byLevel(hugBoardsFixtures.lively) : hugBoardsFixtures.lively));
    const { user, showVisitor } = visit(asked);
    const people = await board("People");

    await user.click(people.getByRole("button", { name: "Level" }));

    expect(people.getByRole("button", { name: "Level" })).toHaveAttribute("aria-pressed", "true");
    expect(asked).toHaveBeenCalledWith("level");
    expect(rowsIn(people)[0]).toBe("1WAWren Alder6 hugs");
    levelArrived = true;
    act(() => showVisitor(shellFixtures.member));
    expect(rowsIn(await board("People"))).toEqual(["1WAWren AlderLv 9", "2IOInes OkaforLv 7", "3SESam ExampleYouLv 6"]);
  });
});

describe("HH74: a fresh week", { timeout: 30_000 }, () => {
  it("says the week starts fresh, how to be first, and last week's top three", async () => {
    visit(hugBoardsFixtures.empty);
    const people = await board("People");

    expect(people.getByText(/This week starts fresh/)).toHaveTextContent("This week starts fresh. React with 🌮 to any message to give the first hug of the week.");
    expect(people.getByText("Last week")).toBeInTheDocument();
    expect(rowsIn(people)).toEqual(["1WAWren Alder9 hugs", "2IOInes Okafor6 hugs", "2SESam ExampleYou6 hugs"]);
  });

  it.each<[HugMeasure, string]>([
    ["hugsReceived", "Hug a teammate's message and they're the first one here."],
    ["kudosReceived", "Write 🌮 @name and what they did, and they lead this one."],
  ])("on %s it tells how to be first there", async (measure, how) => {
    visit({ ...hugBoardsFixtures.empty, measure });

    expect((await board("People")).getByText(/This week starts fresh/)).toHaveTextContent(`This week starts fresh. ${how}`);
  });
});

describe("HH75: You in your team", { timeout: 30_000 }, () => {
  it("ranks the member among the teammates who joined in and says how many more can still join in", async () => {
    visit();
    const team = await board("You in Lanterns");

    expect(team.getByRole("heading", { level: 2, name: "You in Lanterns" })).toBeInTheDocument();
    expect(team.getByText("You lead Lanterns on hugs given this week.")).toBeInTheDocument();
    expect(rowsIn(team)).toEqual(["1IOInes Okafor4 hugs", "1SESam ExampleYou4 hugs", "–OVOona Vasquez0 hugs"]);
    expect(team.getByText("2 more teammates can still join in this week.")).toBeInTheDocument();
  });

  it("gives the member's place below the top, on the chosen measure", async () => {
    visit(byLevel(hugBoardsFixtures.lively));
    const team = await board("You in Lanterns");

    expect(team.getByText("You're No. 2 of 3 in Lanterns on level this week.")).toBeInTheDocument();
    expect(team.queryByText(/can still join in/)).not.toBeInTheDocument();
  });

  it("before the member joins in, their first hug puts them on the team's board, or at the top when nobody started", async () => {
    visit(hugBoardsFixtures.quiet);
    expect((await board("You in Lanterns")).getByText("Your first hug puts you on Lanterns's board.")).toBeInTheDocument();
  });

  it("when nobody in the team started, the first hug puts the member at the top", async () => {
    visit(hugBoardsFixtures.empty);
    expect((await board("You in Lanterns")).getByText("Nobody in Lanterns has started yet. Your first hug puts you at the top.")).toBeInTheDocument();
  });

  it("once the member joined in, a measure they have no figure on yet gives no first-hug line", async () => {
    visit(byKudosReceived(hugBoardsFixtures.lively));
    const team = await board("You in Lanterns");

    expect(rowsIn(team)).toEqual(["1IOInes Okafor1 kudos", "–SESam ExampleYou0 kudos", "–OVOona Vasquez0 kudos"]);
    expect(team.queryByText(/Your first hug|has started yet/)).not.toBeInTheDocument();
  });

  it("without a team there is no team board", async () => {
    visit({ ...hugBoardsFixtures.lively, team: null });
    await board("People");

    expect(screen.queryByRole("region", { name: /^You in/ })).not.toBeInTheDocument();
  });
});

describe("HH79: rows are links", { timeout: 30_000 }, () => {
  it("every person row opens their person page", async () => {
    visit();
    const people = await board("People");

    expect(people.getByRole("link", { name: /Wren Alder/ })).toHaveAttribute("href", "/book#people/wren-alder");
  });
});
