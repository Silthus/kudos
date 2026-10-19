import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures, type MemberProfile } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum } from "./albumFixtures";
import type { BoardsRead, BoardsShown } from "./answer";
import { boardsFixtures, fixedBoards } from "./boardsFixtures";

const memberWithTheAlbum: MemberProfile = { ...shellFixtures.memberWithEveryFeatureOpen, album: true };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

function visit(boards: BoardsShown = boardsFixtures.week) {
  window.history.replaceState(null, "", "/leaderboard");
  return renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { boards: fixedBoards(boards) });
}

async function board(name: "People" | "Teams") {
  return within(await screen.findByRole("region", { name }));
}

const albumCss = readFileSync(join(__dirname, "album.css"), "utf8");

function declarationsOf(selector: string) {
  const rule = [...albumCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, selectors]) => selectors!.split(",").some((each) => each.trim() === selector));
  if (rule === undefined) throw new Error(`${selector} has no rule in album.css`);
  return Object.fromEntries([...rule[2]!.matchAll(/([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value!.trim()]));
}

function rowsOf(list: ReturnType<typeof within>) {
  return list.getAllByRole("listitem").map(spokenTextOf);
}

function spokenTextOf(element: Element): string {
  const parts = [...element.childNodes].map((node) => (node instanceof Element ? (node.getAttribute("aria-hidden") === "true" ? "" : spokenTextOf(node)) : (node.textContent ?? "")));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

describe("AL49: the Leaderboard shows people and teams side by side by thoughtful kudos this week", { timeout: 30_000 }, () => {
  it("ranks the givers and the teams in their own boards, ties sharing a rank", async () => {
    visit();

    expect(await screen.findByRole("heading", { level: 1, name: "Who said thanks, and why" })).toBeInTheDocument();
    expect(rowsOf(await board("People"))).toEqual([
      "Rank 1: Wren Alder Kettle Works 6 thoughtful kudos",
      "Rank 2: Ines Okafor Lanterns, Kettle Works 5 thoughtful kudos",
      "Rank 3, tied: Fen Marlowe Paper Moons 4 thoughtful kudos",
      "Rank 3, tied: Perrin Holt Quiet Harbour 4 thoughtful kudos",
      "Rank 5: Sam Example You Lanterns 3 thoughtful kudos",
      "Rank 6: Oren Pike Salt and Sparrow 2 thoughtful kudos",
      "Rank 7: Della Crane Brass Tidings 1 thoughtful kudos",
    ]);
    expect(rowsOf(await board("Teams"))).toEqual([
      "Rank 1: Kettle Works Who gave 11 thoughtful kudos",
      "Rank 2: Lanterns Your team Who gave 8 thoughtful kudos",
      "Rank 3, tied: Paper Moons Who gave 4 thoughtful kudos",
      "Rank 3, tied: Quiet Harbour Who gave 4 thoughtful kudos",
      "Rank 5: Salt and Sparrow Who gave 2 thoughtful kudos",
      "Rank 6: Brass Tidings Who gave 1 thoughtful kudos",
    ]);
  });

  it("names who leads each board and where the member and their team stand", async () => {
    visit();

    const people = await board("People");
    expect(people.getByText("Wren Alder leads with 6.")).toBeInTheDocument();
    expect(people.getByText("25 thoughtful kudos given this week. You're No. 5 with 3.")).toBeInTheDocument();
    const teams = await board("Teams");
    expect(teams.getByText("Kettle Works leads with 11.")).toBeInTheDocument();
    expect(teams.getByText("Lanterns sits at No. 2.")).toBeInTheDocument();
  });

  it("marks the member's own row and team, and links everyone else to their page", async () => {
    visit();

    const people = await board("People");
    const myRow = people.getByText("Sam Example").closest("li")!;
    expect(myRow).toHaveAttribute("data-you");
    expect(within(myRow).queryByRole("link")).not.toBeInTheDocument();
    expect(people.getByRole("link", { name: "Ines Okafor" })).toHaveAttribute("href", "/book#people/ines-okafor");
    const teams = await board("Teams");
    expect(teams.getByRole("link", { name: "Lanterns" })).toHaveAttribute("href", "/");
    expect(teams.getByRole("link", { name: "Kettle Works" })).toHaveAttribute("href", "/book#teams/kettle-works");
    expect(teams.getByRole("link", { name: "Lanterns" }).closest("li")).toHaveAttribute("data-you");
  });

  it("keeps the member's own row and teams in view while a long board scrolls: each board scrolls inside itself and their rows stick to its edges", () => {
    expect(declarationsOf(".al-board-rows"), "each board scrolls inside a bounded height").toMatchObject({ "overflow-y": "auto", "max-height": expect.any(String) });
    expect(declarationsOf(".al-board-row[data-pinned]"), "the pinned rows stick to the top and bottom edge of their board").toMatchObject({ position: "sticky", top: "0", bottom: "0" });
    expect(declarationsOf(".al-board-row[data-pinned]").background, "a stuck row is opaque, so rows scrolling under it don't show through").toMatch(/var\(--card\)/);
  });

  it("names everyone who shares the lead", async () => {
    const [first, second] = boardsFixtures.week.people;
    visit({ ...boardsFixtures.week, people: [{ ...first!, rank: 1, tied: true }, { ...second!, rank: 1, tied: true, thoughtful: 6 }, ...boardsFixtures.week.people.slice(2)] });

    expect((await board("People")).getByText("Wren Alder and Ines Okafor lead with 6.")).toBeInTheDocument();
    expect((await board("Teams")).getByText("Kettle Works leads with 11.")).toBeInTheDocument();
  });

  it("pins a member on two teams to both, and lists both teams on their row", async () => {
    visit(boardsFixtures.twoTeams);

    const teams = await board("Teams");
    const mine = teams.getAllByText("Your team").map((tag) => spokenTextOf(tag.closest("li")!));
    expect(mine).toEqual(["Rank 2: Lanterns Your team Who gave 8 thoughtful kudos", "Rank 5: Tin Orchard Your team Who gave 3 thoughtful kudos"]);
    expect(teams.getByText("Lanterns sits at No. 2. Tin Orchard sits at No. 5.")).toBeInTheDocument();
    expect(spokenTextOf((await board("People")).getByText("Sam Example").closest("li")!)).toBe("Rank 5: Sam Example You Lanterns, Tin Orchard 3 thoughtful kudos");
  });

  it("pins one row per board, the member's own and their home team's, so two stuck rows never cover each other", async () => {
    visit(boardsFixtures.twoTeams);

    const pinnedIn = async (name: "People" | "Teams") => (await board(name)).getAllByRole("listitem").filter((row) => row.hasAttribute("data-pinned")).map(spokenTextOf);
    expect(await pinnedIn("People")).toEqual(["Rank 5: Sam Example You Lanterns, Tin Orchard 3 thoughtful kudos"]);
    expect(await pinnedIn("Teams")).toEqual(["Rank 2: Lanterns Your team Who gave 8 thoughtful kudos"]);
  });

  it("links only the member's home team to the home page, and their other team to its own page", async () => {
    visit(boardsFixtures.twoTeams);

    const teams = await board("Teams");
    expect(teams.getByRole("link", { name: "Lanterns" })).toHaveAttribute("href", "/");
    expect(teams.getByRole("link", { name: "Tin Orchard" })).toHaveAttribute("href", "/book#teams/tin-orchard");
  });

  it("pins the member's row after the board while they haven't given one this week", async () => {
    visit(boardsFixtures.quiet);

    const people = await board("People");
    expect(people.getByText("Nobody has said thanks with a why yet this week.")).toBeInTheDocument();
    expect(people.getByText("You haven't given one yet. Thank someone and say why to lead the board.")).toBeInTheDocument();
    expect(rowsOf(people)).toEqual(["Not ranked: Sam Example You Lanterns, Tin Orchard 0 thoughtful kudos"]);
    const teams = await board("Teams");
    expect(teams.getByText("No team has said thanks with a why yet this week.")).toBeInTheDocument();
    expect(teams.getByText("Lanterns hasn't given one yet. Tin Orchard hasn't given one yet.")).toBeInTheDocument();
    expect(rowsOf(teams)).toEqual(["Not ranked: Lanterns Your team Who gave 0 thoughtful kudos", "Not ranked: Tin Orchard Your team Who gave 0 thoughtful kudos"]);
  });

  it("Who gave keeps only that team's givers with their ranks, the member's own row still pinned, until Show everyone", async () => {
    const { user } = visit();

    await user.click((await board("Teams")).getByRole("button", { name: "Who gave in Kettle Works" }));

    const people = await board("People");
    expect(people.getByText("Only Kettle Works")).toBeInTheDocument();
    expect(rowsOf(people)).toEqual(["Rank 1: Wren Alder Kettle Works 6 thoughtful kudos", "Rank 2: Ines Okafor Lanterns, Kettle Works 5 thoughtful kudos", "Rank 5: Sam Example You Lanterns 3 thoughtful kudos"]);
    expect((await board("Teams")).getByRole("button", { name: "Who gave in Kettle Works" })).toHaveAttribute("aria-pressed", "true");

    await user.click(people.getByRole("button", { name: "Show everyone" }));

    expect(rowsOf(await board("People"))).toHaveLength(7);
    const pick = (await board("Teams")).getByRole("button", { name: "Who gave in Kettle Works" });
    expect(pick).toHaveAttribute("aria-pressed", "false");
    expect(pick, "focus returns to the team's Who gave once Show everyone goes").toHaveFocus();
  });

  it("pressing Who gave on the picked team again shows everyone", async () => {
    const { user } = visit(boardsFixtures.twoTeams);

    await user.click((await board("Teams")).getByRole("button", { name: "Who gave in Tin Orchard" }));
    expect(rowsOf(await board("People"))).toEqual(["Rank 5: Sam Example You Lanterns, Tin Orchard 3 thoughtful kudos"]);

    await user.click((await board("Teams")).getByRole("button", { name: "Who gave in Tin Orchard" }));
    expect(rowsOf(await board("People"))).toHaveLength(7);
  });

  it("Who gave on a team nobody gave for says so, keeping the member's own row", async () => {
    const { user } = visit(boardsFixtures.quiet);

    await user.click((await board("Teams")).getByRole("button", { name: "Who gave in Tin Orchard" }));

    const people = await board("People");
    expect(people.getByText("Nobody in Tin Orchard has given one yet this week.")).toBeInTheDocument();
    expect(rowsOf(people)).toEqual(["Not ranked: Sam Example You Lanterns, Tin Orchard 0 thoughtful kudos"]);
  });

  it("Show me on the leaderboards switched off leaves the member's row off the people board, and says where to switch it back on", async () => {
    visit(boardsFixtures.hidden);

    const people = await board("People");
    expect(people.queryByText("Sam Example")).not.toBeInTheDocument();
    expect(people.getByText("22 thoughtful kudos given this week.")).toBeInTheDocument();
    const line = screen.getByText(/You're off the boards by choice/);
    expect(line).toHaveTextContent(`You're off the boards by choice. Switch on "Show me on the leaderboards" in Settings to come back.`);
    expect(within(line).getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("a member on the boards gets no line about being off them", async () => {
    visit();
    await board("People");
    expect(screen.queryByText(/off the boards/)).not.toBeInTheDocument();
  });
});

describe("AL40: the Leaderboard reads getThoughtfulBoards only while it is open", () => {
  it("never asks for the boards away from /leaderboard", async () => {
    const asked: string[] = [];
    const read: BoardsRead = (asking) => {
      asked.push(`${window.location.pathname}:${asking}`);
      return asking ? boardsFixtures.week : undefined;
    };
    window.history.replaceState(null, "", "/");
    renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { boards: read });
    await screen.findByRole("navigation", { name: "Album" });

    expect(asked.filter((entry) => entry.endsWith(":true"))).toEqual([]);
  });

  it("shows the page busy while the boards load", async () => {
    window.history.replaceState(null, "", "/leaderboard");
    renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { boards: () => undefined });
    expect(await screen.findByRole("main")).toHaveAttribute("aria-busy", "true");
  });

  it("says the boards didn't load when the read fails", async () => {
    visit({ kind: "broken" });
    expect(await screen.findByRole("heading", { level: 1, name: "Something went wrong" })).toBeInTheDocument();
  });

  it("shows today's answer page when the read denies the member, inside the album's frame", async () => {
    visit({ kind: "not-a-member" });
    expect(await screen.findByRole("heading", { level: 1, name: "Members only" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Album" })).toBeInTheDocument();
  });
});
