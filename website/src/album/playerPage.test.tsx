import { screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum, fixedPeople, fixturePersonOf } from "./albumFixtures";
import type { Album, PersonPage, PersonRead, PlayerCardRead } from "./answer";
import { boardsFixtures, fixedBoards } from "./boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";
import { fixedPlayerCards, playerCardFixtures } from "./playerCardFixtures";
import { fixedProfile, profileFixtures } from "./profileFixtures";
import { fixtureWeeks } from "./weekFixtures";

const withPageD: Album = { ...albumFixtures.midway, personPageD: true, linkPreviews: true };

const arrival = { timeout: 10_000 };

beforeAll(async () => {
  await import("./AlbumApp");
});

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => vi.restoreAllMocks());

type Reads = { playerCards?: PlayerCardRead; people?: PersonRead };

function visit(address: string, album: Album = withPageD, { playerCards = fixedPlayerCards(), people = fixedPeople(album) }: Reads = {}) {
  window.history.replaceState(null, "", address);
  return renderAlbum(shellFixtures.member, fixedAlbum(album), { playerCards, weeks: fixtureWeeks(), people, boards: fixedBoards(boardsFixtures.week), profile: fixedProfile(profileFixtures.noted), hoggies: fixedHoggies(hoggiesFixtures.glance) });
}

function withEmojisWaiting(cards: PlayerCardRead): PlayerCardRead {
  return (asking, person) => ({ ...cards(asking, person), emojis: undefined });
}

function withEmojisBroken(cards: PlayerCardRead): PlayerCardRead {
  return (asking, person) => ({ ...cards(asking, person), emojis: { kind: "broken" } });
}

async function region(name: string) {
  return within(await screen.findByRole("region", { name }, arrival));
}

describe("LP93 LP94 LP96: page D shows your own page as a player card, your rarest find and your week", { timeout: 30_000 }, () => {
  it("shows the card with the level ring, name, team, XP and Share, and no Your page heading", async () => {
    visit("/book#me");

    const card = await region("Your card");
    expect(card.getByRole("heading", { level: 1, name: "Sam Example" })).toBeInTheDocument();
    expect(card.getByRole("img", { name: "Level 6, 48% to the next" })).toBeInTheDocument();
    expect(card.getByRole("link", { name: "Lanterns" })).toHaveAttribute("href", "/book#teams/lanterns");
    expect(card.getByText("1,240 XP")).toBeInTheDocument();
    expect(card.getByText("· 260 to level 7")).toBeInTheDocument();
    expect(card.getByRole("button", { name: /share/i })).toBeInTheDocument();
    expect(screen.queryByText("Your page")).not.toBeInTheDocument();
  });

  it("shows four stats in four shapes and the rank strip to the leaderboard", async () => {
    visit("/book#me");

    const stats = within((await region("Your card")).getByRole("list", { name: "Your stats" }));
    expect(stats.getByRole("link", { name: "64 of 151 hoggies found" })).toHaveAttribute("href", "/book#hoggies");
    expect(stats.getByRole("link", { name: `24 of ${withPageD.people.length} people` })).toBeInTheDocument();
    expect(stats.getByRole("group", { name: "7 emojis" })).toBeInTheDocument();
    expect(stats.getByRole("link", { name: "4 medals" })).toBeInTheDocument();
    expect((await region("Your card")).getByRole("link", { name: "No. 1 this week · 7 kudos" })).toHaveAttribute("href", "/leaderboard");
  });

  it("emphasises the rarest find with a way to all hoggies", async () => {
    visit("/book#me");

    const rarest = await region("Rarest find");
    expect(rarest.getByText("Burning Money")).toBeInTheDocument();
    expect(rarest.getByText("Legendary")).toBeInTheDocument();
    expect(rarest.getByRole("link", { name: "All hoggies" })).toHaveAttribute("href", "/book#hoggies");
  });

  it("shows this week's totals, kudos of the week and latest kudos lines, with a way to Activity", async () => {
    visit("/book#me");

    const week = await region("This week");
    expect(week.getByRole("link", { name: "Activity" })).toHaveAttribute("href", "/activity");
    expect(week.getByRole("figure", { name: "Kudos of the week" })).toBeInTheDocument();
    expect(week.getByRole("list", { name: "Latest kudos" })).toBeInTheDocument();
  });

  it("offers your own hype emoji pick when your person page offers it", async () => {
    const ownPage: PersonPage = { ...(fixturePersonOf(withPageD, "wren-alder") as PersonPage), person: withPageD.me.person, name: withPageD.me.name, hypePick: true };
    visit("/book#me", withPageD, { people: (asking, person) => (asking && person === ownPage.person ? ownPage : undefined) });

    expect(await screen.findByRole("button", { name: "Pick your hype emoji" }, arrival)).toBeInTheDocument();
  });

  it("points you to find your team while you have none", async () => {
    visit("/book#me", withPageD, { playerCards: fixedPlayerCards([{ ...playerCardFixtures.sam, card: { ...playerCardFixtures.sam.card, team: null } }]) });

    expect((await region("Your card")).getByRole("link", { name: "Find your team" })).toHaveAttribute("href", "/settings?section=company-profile");
  });

  it("shows the card while your emojis are still on their way", async () => {
    visit("/book#me", withPageD, { playerCards: withEmojisWaiting(fixedPlayerCards()) });

    const stats = within((await region("Your card")).getByRole("list", { name: "Your stats" }));
    expect(stats.getByRole("link", { name: "4 medals" })).toBeInTheDocument();
    expect(stats.getByRole("group", { name: "Emojis not counted yet" })).toBeInTheDocument();
  });

  it("waits for the emojis before calling a card with nothing else in it quiet", async () => {
    visit("/book#people/milo-strand", withPageD, { playerCards: withEmojisWaiting(fixedPlayerCards()) });

    await screen.findByRole("region", { name: "Milo's week" }, arrival).catch(() => null);
    expect(screen.queryByText("Milo's album is just getting started.")).not.toBeInTheDocument();
  });

  it("never calls a card quiet while its emojis could not be counted", async () => {
    visit("/book#people/milo-strand", withPageD, { playerCards: withEmojisBroken(fixedPlayerCards()) });

    expect((await region("Milo Strand's card")).getByRole("group", { name: "Emojis not counted yet" })).toBeInTheDocument();
    expect(screen.queryByText("Milo's album is just getting started.")).not.toBeInTheDocument();
  });

  it("names each day's kudos on the week's day bars", async () => {
    visit("/book#me");

    expect((await region("This week")).getByRole("img", { name: /^Kudos by day: Mon \d+, Tue \d+/ })).toBeInTheDocument();
  });

  it("shows the same page for your own person page address", async () => {
    visit("/book#people/sam-example");

    expect(await region("Your card")).toBeTruthy();
    expect(screen.queryByText(/Teammate/)).not.toBeInTheDocument();
  });
});

describe("LP93 LP95 LP96: page D shows a teammate's card, their rarest find, their week and you and them", { timeout: 30_000 }, () => {
  it("keeps the teammate eyebrow and shows their level beside their XP", async () => {
    visit("/book#people/wren-alder");

    const card = await region("Wren Alder's card");
    expect(card.getByText("Teammate · in your album")).toBeInTheDocument();
    expect(card.getByRole("heading", { level: 1, name: "Wren Alder" })).toBeInTheDocument();
    expect(card.getByText("· level 4")).toBeInTheDocument();
    expect(card.getByRole("link", { name: "No. 3 tied this week · 4 kudos" })).toBeInTheDocument();
    expect(card.getByRole("group", { name: "21 of 151 hoggies found" })).toBeInTheDocument();
    expect(card.queryByRole("link", { name: "21 of 151 hoggies found" })).not.toBeInTheDocument();
    expect(card.getByRole("group", { name: "9 people" })).toBeInTheDocument();
  });

  it("shows their week's totals and their kudos of the week, never their individual kudos lines", async () => {
    visit("/book#people/wren-alder");

    const week = await region("Wren's week");
    expect(week.getByText("Wren thanked")).toBeInTheDocument();
    expect(week.getByRole("figure", { name: "Kudos of the week" })).toHaveTextContent("calm the noisy alert");
    expect(week.queryByRole("list", { name: "Latest kudos" })).not.toBeInTheDocument();
    expect(week.queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();
  });

  it("shows you and them: first thanked, the counts each way, hugs and Open in Slack", async () => {
    visit("/book#people/wren-alder");

    const together = await region("You and Wren");
    expect(together.getByText("First thanked")).toBeInTheDocument();
    expect(together.getByText("You thanked Wren")).toBeInTheDocument();
    expect(together.getByText("Wren thanked you")).toBeInTheDocument();
    expect(together.getByText("Hugs")).toBeInTheDocument();
    expect(together.getByRole("link", { name: "Open in Slack, Wren's profile (opens in a new tab)" })).toBeInTheDocument();
  });

  it("shows how many of their messages you reacted on with their hype emoji, beside the kudos way to unlock it", async () => {
    visit("/book#people/wren-alder", withPageD, { people: personWithHype({ earned: false, name: "wren-alder-hype", reactions: { have: 3, need: 10 } }) });

    const hype = (await region("You and Wren")).getByText(":wren-alder-hype:").closest("p")!;
    expect(hype).toHaveTextContent("give Wren a kudos to unlock it");
    expect(hype).toHaveTextContent("Or react with it on 10 of their messages: 3 of 10");
  });

  it("names your reactions as the way their hype emoji was unlocked", async () => {
    visit("/book#people/wren-alder", withPageD, { people: personWithHype({ earned: true, name: "wren-alder-hype", reactions: { have: 10, need: 10 }, byReactions: true }) });

    const hype = (await region("You and Wren")).getByText(":wren-alder-hype:").closest("p")!;
    expect(hype).toHaveTextContent("unlocked by your reactions on 10 of Wren's messages");
    expect(hype).not.toHaveTextContent("first kudos");
    expect(hype).not.toHaveTextContent("Or react");
  });

  it("shows their rarest find under their name, with no way into your own hoggies", async () => {
    visit("/book#people/wren-alder");

    const rarest = await region("Wren's rarest find");
    expect(rarest.getByText("Epic")).toBeInTheDocument();
    expect(rarest.queryByRole("link")).not.toBeInTheDocument();
  });

  it("counts a week of only opened packs as a week, not a quiet one", async () => {
    const packsOnly = { ...playerCardFixtures.wren, week: { days: [0, 0, 0, 0, 0, 0, 0], thanked: 0, thankedBy: 0, packsOpened: 1, hugs: 0, kudosOfWeek: null } };
    visit("/book#people/wren-alder", withPageD, { playerCards: fixedPlayerCards([packsOnly]) });

    const week = await region("Wren's week");
    expect(week.getByText("pack opened")).toBeInTheDocument();
    expect(week.queryByText(/quiet week/)).not.toBeInTheDocument();
  });
});

describe("LP97: a quiet new member gets friendly empty states, never a row of zeros", { timeout: 30_000 }, () => {
  it("shows a welcome line in place of the stats, no place and no hoggie yet", async () => {
    visit("/book#people/milo-strand");

    const card = await region("Milo Strand's card");
    expect(card.queryByRole("list", { name: "Milo's stats" })).not.toBeInTheDocument();
    expect(card.getByText("Milo's album is just getting started.")).toBeInTheDocument();
    expect(card.getByText("Not on this week's board yet")).toBeInTheDocument();
    expect((await region("Milo's rarest find")).getByText("No hoggie found yet.")).toBeInTheDocument();
    expect((await region("Milo's week")).getByText("A quiet week for Milo so far.")).toBeInTheDocument();
  });
});

describe("LP98: while person-page-d is off, both pages stay as they are", { timeout: 30_000 }, () => {
  it("shows today's profile page on your own page", async () => {
    visit("/book#me", albumFixtures.midway);

    expect(await screen.findByText("Your page", {}, arrival)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your card" })).not.toBeInTheDocument();
  });

  it("shows today's person page for a teammate", async () => {
    visit("/book#people/wren-alder", albumFixtures.midway);

    expect(await screen.findByRole("list", { name: "Your history together" }, arrival)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Wren Alder's card" })).not.toBeInTheDocument();
  });
});

function personWithHype(hype: PersonPage["hype"]): PersonRead {
  return (asking, person) => (asking && person !== null ? { ...(fixturePersonOf(withPageD, person) as PersonPage), hype } : undefined);
}
