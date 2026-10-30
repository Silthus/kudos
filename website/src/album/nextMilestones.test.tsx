import { screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum, fixedPeople } from "./albumFixtures";
import type { Album, AlbumMilestone } from "./answer";
import { boardsFixtures, fixedBoards } from "./boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";
import { fixedPlayerCards } from "./playerCardFixtures";
import { fixedProfile, profileFixtures } from "./profileFixtures";
import { fixtureWeeks } from "./weekFixtures";

const onPageD: Album = { ...albumFixtures.midway, personPageD: true, linkPreviews: true, bookNext: true };

const arrival = { timeout: 10_000 };

beforeAll(async () => {
  await import("./AlbumApp");
});

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => vi.restoreAllMocks());

function visit(address: string, album: Album = onPageD) {
  window.history.replaceState(null, "", address);
  return renderAlbum(shellFixtures.member, fixedAlbum(album), { playerCards: fixedPlayerCards(), weeks: fixtureWeeks(), people: fixedPeople(album), boards: fixedBoards(boardsFixtures.week), profile: fixedProfile(profileFixtures.noted), hoggies: fixedHoggies(hoggiesFixtures.glance) });
}

function nextMilestones() {
  return screen.findByRole("list", { name: "Next milestones" }, arrival);
}

function tileNames(list: HTMLElement) {
  return within(list).getAllByRole("listitem").map((tile) => within(tile).getByRole("heading").textContent);
}

function withEveryMedal(album: Album, ladder: AlbumMilestone["id"]): Album {
  return { ...album, milestones: album.milestones.map((milestone) => (milestone.id === ladder ? { ...milestone, tiers: milestone.tiers.map((tier) => ({ ...tier, earnedAt: tier.earnedAt ?? 1 })) } : milestone)) };
}

describe("HH83: the next five milestones sit under the profile card", { timeout: 30_000 }, () => {
  it("shows one tile per ladder for its next medal, closest first by the share already done", async () => {
    visit("/book#me");

    expect(tileNames(await nextMilestones())).toEqual(["Bridge builder", "Full of friends", "Collector", "Generous soul", "Five teams strong"]);
  });

  it("gives each tile the ladder's emblem, the medal's name, N to go and a thin progress bar", async () => {
    visit("/book#me");

    const tile = within(within(await nextMilestones()).getAllByRole("listitem")[0]!);
    expect(tile.getByRole("heading", { name: "Bridge builder" })).toBeInTheDocument();
    expect(tile.getByText("4 to go")).toBeInTheDocument();
    expect(tile.getByRole("img", { name: "Across the company" })).toBeInTheDocument();
    const bar = tile.getByRole("progressbar", { name: "6 of 10 for Bridge builder" });
    expect(bar).toHaveAttribute("aria-valuenow", "6");
    expect(bar).toHaveAttribute("aria-valuemax", "10");
  });

  it("sits under your card and its rarest find, above your week", async () => {
    visit("/book#me");

    const row = await screen.findByRole("region", { name: "Next milestones" }, arrival);
    expect(row.previousElementSibling).toBe(screen.getByRole("region", { name: "Rarest find" }));
    expect(row.nextElementSibling).toBe(screen.getByRole("region", { name: "This week" }));
  });

  it("shows no tile for a ladder with every medal", async () => {
    visit("/book#me", withEveryMedal(onPageD, "reach"));

    expect(tileNames(await nextMilestones())).toEqual(["Full of friends", "Collector", "Generous soul", "Five teams strong"]);
  });

  it("is not on a teammate's page", async () => {
    visit("/book#people/wren-alder");

    await screen.findByRole("region", { name: "Wren Alder's card" }, arrival);
    expect(screen.queryByRole("region", { name: "Next milestones" })).toBeNull();
  });

  it("sits between the profile card and Your album at a glance on the profile page", async () => {
    visit("/book#me", { ...albumFixtures.midway, bookNext: true });

    const row = await screen.findByRole("region", { name: "Next milestones" }, arrival);
    expect(row.nextElementSibling).toBe(screen.getByRole("region", { name: "Your album at a glance" }));
    expect(tileNames(within(row).getByRole("list"))).toHaveLength(5);
  });
});

describe("HH89: while book-next is off, the profile is as before", { timeout: 30_000 }, () => {
  it("shows no next milestones on your card page", async () => {
    visit("/book#me", { ...onPageD, bookNext: undefined });

    await screen.findByRole("region", { name: "Your card" }, arrival);
    expect(screen.queryByRole("region", { name: "Next milestones" })).toBeNull();
  });

  it("shows no next milestones on the profile page", async () => {
    visit("/book#me", albumFixtures.midway);

    await screen.findByRole("region", { name: "Your album at a glance" }, arrival);
    expect(screen.queryByRole("region", { name: "Next milestones" })).toBeNull();
  });
});
