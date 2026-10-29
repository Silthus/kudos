import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum } from "./albumFixtures";
import type { Album, BoardsShown, HoggiesShown, ProfileShown, ThoughtfulBoards } from "./answer";
import { boardsFixtures, fixedBoards } from "./boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";
import { fixedProfile, profileFixtures } from "./profileFixtures";

const memberWithTheAlbum = shellFixtures.member;

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => vi.restoreAllMocks());

type Visit = { album?: Album; boards?: BoardsShown; profile?: ProfileShown; hoggies?: HoggiesShown };

function visit({ album = albumFixtures.midway, boards = boardsFixtures.week, profile = profileFixtures.noted, hoggies = hoggiesFixtures.glance }: Visit = {}) {
  window.history.replaceState(null, "", "/book#me");
  return renderAlbum(memberWithTheAlbum, fixedAlbum(album), { boards: fixedBoards(boards), profile: fixedProfile(profile), hoggies: fixedHoggies(hoggies) });
}

const arrival = { timeout: 10_000 };

async function section(name: string) {
  return within(await screen.findByRole("region", { name }, arrival));
}

function topBar() {
  return within(screen.getByRole("banner"));
}

function pinnedOf(boards: ThoughtfulBoards) {
  const me = boards.pinned.me!;
  const team = boards.pinned.teams.find(({ team: slug }) => slug === "lanterns")!;
  return { me, team };
}

describe("AL52: the profile page shows you, your week and your album at a glance", { timeout: 30_000 }, () => {
  it("shows your yearbook photo, name, team, level and XP bar", async () => {
    visit();

    expect(await screen.findByRole("heading", { level: 1, name: "Sam Example" }, arrival)).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "Sam Example, Lanterns" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lanterns · 4 of 5 in your album" })).toHaveAttribute("href", "/book#teams/lanterns");
    const bar = screen.getByRole("progressbar", { name: "290 XP to level 7" });
    expect(bar).toHaveAttribute("aria-valuenow", "1210");
    expect(bar).toHaveAttribute("aria-valuemin", "1000");
    expect(bar).toHaveAttribute("aria-valuemax", "1500");
  });

  it("shows the last kind note someone sent you, with who sent it, when, and its Slack link", async () => {
    visit();

    const note = within(await screen.findByRole("figure", { name: "Someone wrote to you" }, arrival));
    expect(note.getByText("Thank you for reviewing my first PR so kindly, I learned a lot from your comments.")).toBeInTheDocument();
    expect(note.getByRole("link", { name: "Ines Okafor, 17 Oct 2026" })).toHaveAttribute("href", "/book#people/ines-okafor");
    expect(note.getByRole("link", { name: /Open in Slack/ })).toHaveAttribute("href", "https://example.slack.com/archives/C1/p2");
  });

  it("shows no note while nobody has sent you a kudos", async () => {
    visit({ profile: profileFixtures.quiet });

    await screen.findByRole("heading", { level: 1, name: "Sam Example" }, arrival);
    expect(screen.queryByRole("figure", { name: "Someone wrote to you" })).toBeNull();
  });

  it("the profile's level and XP are the top bar's, and its ranks are the board's", async () => {
    visit();
    const { me, team } = pinnedOf(boardsFixtures.week);

    const rank = await section("This week's kudos");
    expect(topBar().getByText("Level 6")).toBeInTheDocument();
    expect(topBar().getByText("290 XP to level 7")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent(/Level 6/);
    expect(rank.getByText(`No. ${me.rank}`)).toBeInTheDocument();
    expect(rank.getByText(`${me.thoughtful} kudos given`)).toBeInTheDocument();
    expect(rank.getByText(`Lanterns is No. ${team.rank} with ${team.thoughtful} kudos.`)).toBeInTheDocument();
    expect(rank.getByRole("link", { name: "See the leaderboard" })).toHaveAttribute("href", "/leaderboard");
  });

  it("says a tie as the board does, and names your home team's rank when you are on two", async () => {
    const tied: ThoughtfulBoards = { ...boardsFixtures.twoTeams, pinned: { ...boardsFixtures.twoTeams.pinned, me: { ...boardsFixtures.twoTeams.pinned.me!, rank: 4, tied: true } } };
    visit({ boards: tied });

    const rank = await section("This week's kudos");
    expect(rank.getByText("No. 4, tied")).toBeInTheDocument();
    expect(rank.getByText("Lanterns is No. 2 with 8 kudos.")).toBeInTheDocument();
    expect(rank.queryByText(/Tin Orchard/)).toBeNull();
  });

  it("asks for a first kudos this week while you have none", async () => {
    visit({ boards: boardsFixtures.quiet });
    expect((await section("This week's kudos")).getByText("Give a kudos to join this week's board.")).toBeInTheDocument();
  });

  it("points to Settings while you left the boards by choice", async () => {
    visit({ boards: boardsFixtures.hidden });

    const rank = await section("This week's kudos");
    expect(rank.getByText(/You're off the boards by choice/)).toBeInTheDocument();
    expect(rank.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("your album at a glance counts the people, your team and the hoggies, each leading to its page", async () => {
    visit();

    const glance = await section("Your album at a glance");
    expect(glance.getByRole("link", { name: "People in your album: 18 of 38" })).toHaveAttribute("href", "/book#milestones");
    expect(glance.getByRole("link", { name: "Your team, Lanterns: 4 of 5" })).toHaveAttribute("href", "/book#teams/lanterns");
    expect(glance.getByRole("link", { name: "Hoggies found: 18 of 151" })).toHaveAttribute("href", "/book#hoggies");
    expect(glance.getByText("1 of 13 full teams unlocked")).toBeInTheDocument();
    expect(glance.getByText("1 to go for the seal")).toBeInTheDocument();
    expect(glance.getByText("133 still hiding in packs")).toBeInTheDocument();
  });

  it("leaves your team and the hoggies out of the glance while you have no team and the hoggies are off", async () => {
    visit({ album: albumFixtures.newcomer, hoggies: { kind: "off" } });

    const glance = await section("Your album at a glance");
    expect(glance.getAllByRole("link").map((link) => link.getAttribute("aria-label"))).toEqual(["People in your album: 0 of 13"]);
  });

  it("a home team nobody else is in Slack for says so, with no seal to count toward", async () => {
    const alone = { ...albumFixtures.midway, teams: albumFixtures.midway.teams.map((team) => (team.team === "lanterns" ? { ...team, people: [], held: 0, total: 0 } : team)) };
    visit({ album: alone });

    const glance = await section("Your album at a glance");
    expect(glance.getByText("Nobody else on Lanterns is in Slack yet")).toBeInTheDocument();
    expect(glance.queryByText(/to go for the seal/)).toBeNull();
    expect(glance.getByRole("link", { name: "Your team, Lanterns" })).not.toHaveTextContent(/of 0/);
    expect(screen.getByRole("link", { name: "Lanterns" })).toHaveAttribute("href", "/book#teams/lanterns");
  });

  it("an unlocked home team says when it was unlocked, even with nobody else in Slack", async () => {
    const unlocked = { ...albumFixtures.midway, teams: albumFixtures.midway.teams.map((team) => (team.team === "lanterns" ? { ...team, people: [], held: 0, total: 0, state: "unlocked" as const, unlockedAt: Date.parse("2026-10-15T10:00:00Z") } : team)) };
    visit({ album: unlocked });

    expect((await section("Your album at a glance")).getByText("Unlocked 15 Oct 2026")).toBeInTheDocument();
  });

  it("keeps the page and leaves the hoggies out while the hoggie read fails", async () => {
    visit({ hoggies: { kind: "broken" } });

    const glance = await section("Your album at a glance");
    expect(glance.queryByRole("link", { name: /Hoggies found/ })).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Sam Example" })).toBeInTheDocument();
    expect((await section("Coolest finds")).queryByRole("list", { name: "Your rarest hoggies" })).toBeNull();
  });

  it("coolest finds show your rarest hoggies and the people who joined your album last, each leading to its page", async () => {
    visit();

    const finds = await section("Coolest finds");
    const hoggies = within(finds.getByRole("list", { name: "Your rarest hoggies" }));
    expect(hoggies.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["EpicAngelFirst found 15 Oct 2026", "/book#hoggies/angel"],
      ["RareArt ThiefFirst found 13 Oct 2026", "/book#hoggies/art-thief"],
      ["UncommonBurning MoneyFirst found 10 Oct 2026", "/book#hoggies/burning-money"],
      ["CommonAsleepFirst found 28 Sept 2026", "/book#hoggies/asleep"],
    ]);
    const newest = within(finds.getByRole("list", { name: "New in your album" }));
    expect(newest.getAllByRole("link").map((link) => [link.getAttribute("aria-label"), link.getAttribute("href")])).toEqual([
      ["Perrin Holt, Quiet Harbour, joined 16 Oct 2026", "/book#people/perrin-holt"],
      ["Wren Alder, Kettle Works, joined 14 Oct 2026", "/book#people/wren-alder"],
      ["Fen Marlowe, Paper Moons, joined 12 Oct 2026", "/book#people/fen-marlowe"],
    ]);
    expect(finds.getByRole("link", { name: "All your hoggies" })).toHaveAttribute("href", "/book#hoggies");
  });

  it("coolest finds say how to make the first one while you have none", async () => {
    visit({ album: albumFixtures.newcomer, profile: profileFixtures.quiet, hoggies: hoggiesFixtures.newcomer });

    expect((await section("Coolest finds")).getByText("Give a kudos and open its pack: your first person and hoggie show here.")).toBeInTheDocument();
  });

  it("best milestones show your highest medals, newest first within a metal, and the one you're closest to next", async () => {
    visit();

    const best = await section("Best milestones");
    expect(within(best.getByRole("list", { name: "Your best medals" })).getAllByRole("listitem").map((medal) => medal.textContent)).toEqual([
      "SilverFamiliar facesFaces in the album · 10 people in your albumEarned 16 Oct 2026",
      "BronzeFirst full pageFull pages · 1 full team unlockedEarned 15 Oct 2026",
      "BronzeCuriousHoggie hunter · 10 different hoggies foundEarned 13 Oct 2026",
    ]);
    const next = within(best.getByRole("group", { name: "Closest next" }));
    expect(next.getByText("Bridge builder")).toBeInTheDocument();
    expect(next.getByRole("progressbar", { name: "6 of 10 teams in your album for Bridge builder" })).toHaveAttribute("aria-valuenow", "6");
    expect(next.getByText("4 to go")).toBeInTheDocument();
    expect(best.getByRole("link", { name: "All milestones" })).toHaveAttribute("href", "/book#milestones");
  });

  it("best milestones say no medal is earned yet and still show the closest next", async () => {
    visit({ album: albumFixtures.newcomer });

    const best = await section("Best milestones");
    expect(best.getByText("No medals yet.")).toBeInTheDocument();
    expect(within(best.getByRole("group", { name: "Closest next" })).getByText("First face")).toBeInTheDocument();
  });

  it("waits for its reads, then shows the page", async () => {
    window.history.replaceState(null, "", "/book#me");
    renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { boards: fixedBoards(boardsFixtures.week), hoggies: fixedHoggies(hoggiesFixtures.glance), profile: () => undefined });

    await screen.findByRole("navigation", { name: "Album" }, arrival);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("region", { name: "Coolest finds" })).toBeNull();
  });

  it("a profile read that fails shows the error page in the frame", async () => {
    window.history.replaceState(null, "", "/book#me");
    renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { boards: () => undefined, hoggies: () => undefined, profile: fixedProfile({ kind: "broken" }) });

    expect(await screen.findByRole("heading", { level: 1, name: "Something went wrong" }, arrival)).toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveAttribute("aria-busy");
  });
});
