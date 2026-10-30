import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardsNextStep, Highlight, HugBoards, HugMeasure, WithinReach } from "../../../convex/website/leaderboard";
import { albumFixtures, fixedAlbum } from "../album/albumFixtures";
import { boardsFixtures, fixedBoards } from "../album/boardsFixtures";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import type { HugBoardsShown } from "../album/answer";
import { byHoggies, byKudosReceived, byLevel, fixedHugBoards, hugBoardsFixtures, junosKudos, nextSteps, offTheBoards, slackOfTheWorkspace, withinReach } from "./thisWeekFixtures";

const arrival = { timeout: 10_000 };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

type Measured = (measure: HugMeasure) => HugBoardsShown | undefined;

function visit(boards: HugBoards | Measured = hugBoardsFixtures.lively, { leaderboardHugs = true, shown = albumFixtures.midway } = {}) {
  window.history.replaceState(null, "", "/leaderboard");
  const album = leaderboardHugs ? { ...shown, leaderboardHugs: true as const } : shown;
  return renderAlbum(shellFixtures.member, fixedAlbum(album), { hugBoards: fixedHugBoards(boards), boards: fixedBoards(boardsFixtures.week) });
}

async function board(name: string) {
  return within(await screen.findByRole("region", { name }, arrival));
}

function rowsIn(region: ReturnType<typeof within>) {
  return region.getAllByRole("listitem").map((row: HTMLElement) => row.textContent);
}

function rankedIn(region: ReturnType<typeof within>) {
  return region.queryAllByRole("listitem").filter((row: HTMLElement) => row.closest("details") === null).map((row: HTMLElement) => row.textContent);
}

function startingIn(region: ReturnType<typeof within>) {
  return region.getAllByRole("listitem", { hidden: true }).filter((row: HTMLElement) => row.closest("details") !== null).map((row: HTMLElement) => row.textContent);
}

async function youCard() {
  return within(await screen.findByRole("region", { name: "You this week" }, arrival));
}

async function nextStep() {
  return within(await screen.findByRole("region", { name: "Your next step" }, arrival));
}

async function reach() {
  return within(await screen.findByRole("region", { name: "Emojis within your reach" }, arrival));
}

function linksIn(region: ReturnType<typeof within>) {
  return region.getAllByRole("link").map((link: HTMLElement) => [link.textContent, link.getAttribute("href")]);
}

function withNext(next: BoardsNextStep, team = hugBoardsFixtures.lively.team) {
  return { ...hugBoardsFixtures.lively, next, team };
}

function withReach(reachable: Partial<WithinReach>) {
  return { ...hugBoardsFixtures.lively, withinReach: { hype: null, team: null, level: null, ...reachable } };
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

  it("HH81: with the flag off it is the kudos boards, as before", async () => {
    visit(hugBoardsFixtures.lively, { leaderboardHugs: false });

    expect(await screen.findByRole("heading", { level: 1, name: "Who said thanks" }, arrival)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "You this week" })).not.toBeInTheDocument();
  });
});

describe("HH92: the page records leaderboard viewed with its measure", { timeout: 30_000 }, () => {
  function onEachMeasure(measure: HugMeasure) {
    return { ...hugBoardsFixtures.lively, measure };
  }

  it("records one view with the first measure once the page shows, and a rerender records nothing more", async () => {
    const { actions, showVisitor } = visit(onEachMeasure);
    await youCard();

    act(() => showVisitor({ ...shellFixtures.member }));
    await youCard();

    expect(measuresViewed(actions)).toEqual(["hugsGiven"]);
    expect(actions.viewLeaderboard).not.toHaveBeenCalled();
  });

  it("records one more view each time the member picks another measure", async () => {
    const { actions, user } = visit(onEachMeasure);
    const people = await board("People");

    await user.click(people.getByRole("button", { name: "Level" }));
    await user.click(people.getByRole("button", { name: "Level" }));
    await user.click(people.getByRole("button", { name: "Hugs given" }));

    expect(measuresViewed(actions)).toEqual(["hugsGiven", "level", "hugsGiven"]);
  });

  it("records nothing while the item board covers the page, and one view once it is put away", async () => {
    const { actions, user } = visit(onEachMeasure, { shown: albumFixtures.withItems });
    const items = within(await screen.findByRole("dialog", { name: "Your items" }, arrival));

    expect(measuresViewed(actions)).toEqual([]);
    await user.click(items.getByRole("button", { name: "Later" }));

    await waitFor(() => expect(measuresViewed(actions)).toEqual(["hugsGiven"]));
  });
});

function measuresViewed(actions: { viewThisWeek: ReturnType<typeof vi.fn> }) {
  return actions.viewThisWeek.mock.calls.map(([measure]) => measure);
}

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

  it("on hoggies the whole team is listed, so a member without a hoggie gets no first-hug line, even before joining in", async () => {
    visit(byHoggies(hugBoardsFixtures.quiet));
    const team = await board("You in Lanterns");

    expect(rowsIn(team)).toEqual(["1IOInes Okafor3 hoggies", "–SESam ExampleYou0 hoggies", "–OVOona Vasquez0 hoggies"]);
    expect(team.queryByText(/Your first hug|has started yet/)).not.toBeInTheDocument();
  });

  it("a member who left the boards has no row on their team's board and no standing line", async () => {
    visit(offTheBoards(hugBoardsFixtures.quiet));
    const team = await board("You in Lanterns");

    expect(rowsIn(team)).toEqual(["1IOInes Okafor1 hug"]);
    expect(team.queryByText(/^You lead|^You.re No\.|Your first hug|has started yet/)).not.toBeInTheDocument();
  });

  it("without a team there is no team board", async () => {
    visit({ ...hugBoardsFixtures.lively, team: null });
    await board("People");

    expect(screen.queryByRole("region", { name: /^You in/ })).not.toBeInTheDocument();
  });
});

describe("HH76 HH77: teams joining in", { timeout: 30_000 }, () => {
  it("ranks the teams that brought more teammates in than last week, each with its share joined in and its points, and marks the member's team", async () => {
    visit();
    const teams = await board("Teams joining in");

    expect(teams.getByRole("heading", { level: 2, name: "Teams joining in" })).toBeInTheDocument();
    expect(rankedIn(teams)).toEqual(["1Lanterns3 of 5 joined in · your team+40 pts", "2Kettle Works3 of 3 joined in+33 pts", "3Paper Moons1 of 4 joined in+25 pts"]);
  });

  it("folds every other team under the teams getting started, unranked and with no points", async () => {
    visit();
    const teams = await board("Teams joining in");

    expect(teams.getByText("2 teams getting started")).toBeInTheDocument();
    expect(startingIn(teams)).toEqual(["·Tin Orchard2 of 3 joined in", "·NNight Shift0 of 4 joined in"]);
  });

  it("gives a team where everyone joined in its own line", async () => {
    visit();
    expect((await board("Teams joining in")).getByText("Everyone in Kettle Works joined in this week.")).toBeInTheDocument();
  });

  it("when no team has joined in yet, says how to start the team's week", async () => {
    visit(hugBoardsFixtures.empty);
    const teams = await board("Teams joining in");

    expect(teams.getByText("No team has started yet. Start your team's week with a hug or a kudos.")).toBeInTheDocument();
    expect(teams.queryByText(/joined in this week/)).not.toBeInTheDocument();
  });

  it("when teams joined in but none gained on last week, every team folds", async () => {
    visit(hugBoardsFixtures.quiet);
    const teams = await board("Teams joining in");

    expect(rankedIn(teams)).toEqual([]);
    expect(teams.getByText("2 teams getting started")).toBeInTheDocument();
    expect(teams.queryByText(/No team has started yet/)).not.toBeInTheDocument();
  });

  it("without teams there is no teams joining in", async () => {
    visit({ ...hugBoardsFixtures.lively, joiningIn: null });
    await board("People");

    expect(screen.queryByRole("region", { name: "Teams joining in" })).not.toBeInTheDocument();
  });

  it("an answer from functions deployed before teams joining in shows the page without it", async () => {
    const { joiningIn: _, ...answerFromBefore } = hugBoardsFixtures.lively;
    visit(answerFromBefore as HugBoards);
    await board("People");

    expect(screen.queryByRole("region", { name: "Teams joining in" })).not.toBeInTheDocument();
  });
});

describe("HH72: one next step beside the you card", { timeout: 30_000 }, () => {
  it("asks a member who gave this week to give the named teammate a kudos, with one Open Slack button", async () => {
    visit();
    const card = await nextStep();

    expect(card.getByText("Kudos · a message")).toBeInTheDocument();
    expect(card.getByRole("heading", { level: 2, name: "Give Wren a kudos" })).toBeInTheDocument();
    expect(card.getByText(/what they did/)).toHaveTextContent("Write 🌮 @Wren and what they did. You collect Wren's hype emoji, and kudos are the only way to find epic hoggies.");
    expect(linksIn(card)).toEqual([["Open Slack (opens in a new tab)", slackOfTheWorkspace]]);
  });

  it("sits inside the you card", async () => {
    visit();

    expect((await youCard()).getByRole("region", { name: "Your next step" })).toBeInTheDocument();
  });

  it.each<[Partial<Extract<BoardsNextStep, { kind: "lively" }>>, string]>([
    [{ collectsHype: true, epicHoggiesByKudos: false }, "Write 🌮 @Wren and what they did. You collect Wren's hype emoji."],
    [{ collectsHype: false, epicHoggiesByKudos: true }, "Write 🌮 @Wren and what they did. Kudos are the only way to find epic hoggies."],
    [{ collectsHype: false, epicHoggiesByKudos: false }, "Write 🌮 @Wren and what they did."],
  ])("says only what holds: %o reads %s", async (facts, why) => {
    visit(withNext({ ...nextSteps.lively, ...facts }));

    expect((await nextStep()).getByText(/what they did/)).toHaveTextContent(why);
  });

  it("asks a member who got a kudos they can still hug back to hug it back, its one button opening that kudos", async () => {
    visit(hugBoardsFixtures.quiet);
    const card = await nextStep();

    expect(card.getByText("Hug · a reaction")).toBeInTheDocument();
    expect(card.getByRole("heading", { level: 2, name: "Hug Juno's kudos back" })).toBeInTheDocument();
    expect(card.getByText(/thanked you/)).toHaveTextContent("Juno thanked you on Tuesday. React with 🌮 to their message and they get a hug back.");
    expect(linksIn(card)).toEqual([["Open Juno's message (opens in a new tab)", junosKudos]]);
  });

  it("asks everyone else for the first hug of the week, with one Open Slack button", async () => {
    visit(hugBoardsFixtures.empty);
    const card = await nextStep();

    expect(card.getByText("Hug · a reaction")).toBeInTheDocument();
    expect(card.getByRole("heading", { level: 2, name: "Give the first hug of the week" })).toBeInTheDocument();
    expect(card.getByText(/teammate's message/)).toHaveTextContent("React with 🌮 to a teammate's message. The first hug each day pays extra XP, and the first one this week puts you and Lanterns on the board.");
    expect(linksIn(card)).toEqual([["Open Slack (opens in a new tab)", slackOfTheWorkspace]]);
  });

  it.each<[boolean, boolean, string]>([
    [false, true, "React with 🌮 to a teammate's message. The first one this week puts you and Lanterns on the board."],
    [true, false, "React with 🌮 to a teammate's message. The first hug each day pays extra XP."],
    [false, false, "React with 🌮 to a teammate's message."],
  ])("for the first hug, extra XP %s and a team %s read: %s", async (firstHugPaysExtra, inATeam, why) => {
    visit(withNext({ kind: "empty", firstHugPaysExtra }, inATeam ? hugBoardsFixtures.lively.team : null));

    expect((await nextStep()).getByText(/teammate's message/)).toHaveTextContent(why);
  });
});

describe("HH78: emojis within your reach", { timeout: 30_000 }, () => {
  it("lists the teammate's hype emoji, the team emoji and the next level emoji, each with its picture, name and how to get it", async () => {
    visit();
    const emojis = await reach();

    expect(emojis.getByRole("heading", { level: 2, name: "Emojis within your reach" })).toBeInTheDocument();
    expect(rowsIn(emojis)).toEqual([
      "Wren's hype emoji :wren-alder-hype:Give Wren a kudos",
      "Your team emoji :team-lanterns:Collect 1 more Lanterns sticker",
      "Level 10 emoji :level-10:290 XP to go: a hug a day gets you there",
    ]);
    expect(emojis.getAllByRole("listitem").map((row: HTMLElement) => row.querySelector("img")?.getAttribute("src"))).toEqual(["/emoji/hype.png", "/emoji/team-workflows.png", "/emoji/level-10.png"]);
  });

  it("shows a progress bar for each emoji that takes more than one step", async () => {
    visit();
    const emojis = await reach();

    expect(emojis.getAllByRole("progressbar").map((bar: HTMLElement) => [bar.getAttribute("aria-valuenow"), bar.getAttribute("aria-valuemax")])).toEqual([
      ["4", "5"],
      ["1210", "1500"],
    ]);
  });

  it("counts the stickers to go", async () => {
    visit(withReach({ team: { ...withinReach.team!, progress: { have: 3, need: 5 } } }));

    expect(rowsIn(await reach())).toEqual(["Your team emoji :team-lanterns:Collect 2 more Lanterns stickers"]);
  });

  it("shows only the emojis that exist", async () => {
    visit(withReach({ level: withinReach.level }));

    expect(rowsIn(await reach())).toEqual(["Level 10 emoji :level-10:290 XP to go: a hug a day gets you there"]);
  });

  it("without an emoji within reach there is no section", async () => {
    visit(withReach({}));
    await board("People");

    expect(screen.queryByRole("region", { name: "Emojis within your reach" })).not.toBeInTheDocument();
  });

  it("an answer from functions deployed before the next step and the emojis within reach shows the page without them", async () => {
    const { next: _next, withinReach: _withinReach, slack: _slack, ...answerFromBefore } = hugBoardsFixtures.lively;
    visit(answerFromBefore as HugBoards);
    await board("People");

    expect(screen.queryByRole("region", { name: "Your next step" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Emojis within your reach" })).not.toBeInTheDocument();
  });
});

describe("HH79: rows are links", { timeout: 30_000 }, () => {
  it("every team row with a team page opens it, and a group without one is no link", async () => {
    visit();
    const teams = await board("Teams joining in");

    expect(teams.getByRole("link", { name: /Lanterns/ })).toHaveAttribute("href", "/book#teams/lanterns");
    expect(teams.queryByRole("link", { name: /Night Shift/ })).not.toBeInTheDocument();
  });

  it("every person row opens their person page", async () => {
    visit();
    const people = await board("People");

    expect(people.getByRole("link", { name: /Wren Alder/ })).toHaveAttribute("href", "/book#people/wren-alder");
  });
});
