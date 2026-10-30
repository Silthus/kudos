import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const chatUrl = "https://app.slack.com/client/T1";

const bookNext = { chatUrl, rarityCaps: true };

const onPageD: Album = { ...albumFixtures.midway, personPageD: true, linkPreviews: true, bookNext };

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
    visit("/book#me", { ...albumFixtures.midway, bookNext });

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

function tile(name: string) {
  return screen.findByRole("button", { name: new RegExp(`^${name}`) }, arrival);
}

function card(name: string) {
  return screen.getByRole("dialog", { name });
}

function paysOf(dialog: HTMLElement) {
  return within(within(dialog).getByRole("list", { name: "What it pays" }))
    .getAllByRole("listitem")
    .map((chip) => chip.textContent);
}

async function opened(name: string, album: Album = onPageD) {
  visit("/book#me", album);
  await userEvent.click(await tile(name));
  return card(name);
}

describe("HH84: a milestone tile opens a card with how to get it and what it pays", { timeout: 30_000 }, () => {
  it("names the ladder with its medal and the medal, says how to get it, and offers one Slack button", async () => {
    const dialog = within(await opened("Bridge builder"));

    expect(dialog.getByText("Across the company · Silver")).toBeInTheDocument();
    expect(dialog.getByRole("heading", { name: "Bridge builder" })).toBeInTheDocument();
    expect(dialog.getByText("How to get it")).toBeInTheDocument();
    expect(dialog.getByText("Give a kudos to someone on a team not in your album yet (4 to go).")).toBeInTheDocument();
    expect(dialog.getAllByRole("link")).toHaveLength(1);
    expect(dialog.getByRole("link", { name: /^Give a kudos in Slack/ })).toHaveAttribute("href", chatUrl);
  });

  it("pays a rare hoggie and the medal's emoji, and no XP", async () => {
    const dialog = await opened("Bridge builder");

    expect(paysOf(dialog)).toEqual(["A rare hoggie", ":bridge-builder:"]);
    expect(dialog).not.toHaveTextContent(/XP/);
  });

  it("pays an uncommon or rare hoggie for a bronze medal", async () => {
    const dialog = await opened("Next door", withNoMedals(onPageD));

    expect(paysOf(dialog)[0]).toBe("An uncommon or rare hoggie");
  });

  it("pays today's floor while rarity-caps is off", async () => {
    expect(paysOf(await opened("Bridge builder", { ...onPageD, bookNext: { chatUrl, rarityCaps: false } }))[0]).toBe("A rare hoggie or rarer");
  });

  it("says kudos are the only way to epic and legendary hoggies while rarity-caps is on", async () => {
    expect(await opened("Bridge builder")).toHaveTextContent("Kudos are the only way to epic and legendary hoggies.");
  });

  it("says nothing about epic and legendary while rarity-caps is off", async () => {
    expect(await opened("Bridge builder", { ...onPageD, bookNext: { chatUrl, rarityCaps: false } })).not.toHaveTextContent(/only way/);
  });

  it.each([
    ["Full of friends", "Give a kudos to 13 people you haven't thanked yet.", "Give a kudos in Slack"],
    ["Collector", "Find 22 hoggies you don't have yet: hugs and kudos both find them.", "Hug a message in Slack"],
    ["Generous soul", "Give 16 more kudos. Thanking the same person again counts.", "Give a kudos in Slack"],
    ["Five teams strong", "Collect everyone on 4 more teams.", "Give a kudos in Slack"],
  ])("says how to get %s with a hug or a kudos", async (name, howTo, button) => {
    const dialog = within(await opened(name));

    expect(dialog.getByText(howTo)).toBeInTheDocument();
    expect(dialog.getByRole("link", { name: new RegExp(`^${button}`) })).toHaveAttribute("href", chatUrl);
  });
});

describe("HH85: the card floats, opens on hover or click, and closes on Escape, a click outside or ×", { timeout: 30_000 }, () => {
  it("floats in the shell, outside the tile row, so no scroll area clips it", async () => {
    const dialog = await opened("Bridge builder");

    expect(screen.getByRole("list", { name: "Next milestones" })).not.toContainElement(dialog);
    expect(dialog.closest(".al-shell")).not.toBeNull();
    expect(dialog).toBeVisible();
  });

  it("marks the tile expanded while its card is open", async () => {
    visit("/book#me");
    const bridge = await tile("Bridge builder");
    expect(bridge).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(bridge);

    expect(bridge).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on Escape and gives the focus back to the tile", async () => {
    await opened("Bridge builder");

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await tile("Bridge builder")).toHaveFocus();
  });

  it("closes on a click outside, but not on a click inside", async () => {
    const dialog = await opened("Bridge builder");

    await userEvent.click(within(dialog).getByText("How to get it"));
    expect(card("Bridge builder")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("region", { name: "This week" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on ×", async () => {
    const dialog = await opened("Bridge builder");

    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens on hover and closes a moment after the pointer leaves, unless it moves onto the card", async () => {
    visit("/book#me");
    const bridge = await tile("Bridge builder");

    fireEvent.mouseEnter(bridge.closest("li")!);
    const dialog = card("Bridge builder");
    fireEvent.mouseLeave(bridge.closest("li")!);
    fireEvent.mouseEnter(dialog);
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(card("Bridge builder")).toBeInTheDocument();

    fireEvent.mouseLeave(dialog);
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays open when the pointer leaves the card and comes back to the tile within a moment", async () => {
    visit("/book#me");
    const bridge = (await tile("Bridge builder")).closest("li")!;

    fireEvent.mouseEnter(bridge);
    const dialog = card("Bridge builder");
    fireEvent.mouseLeave(bridge);
    fireEvent.mouseEnter(dialog);
    fireEvent.mouseLeave(dialog);
    fireEvent.mouseEnter(bridge);
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));

    expect(card("Bridge builder")).toBeInTheDocument();
  });

  it("takes the focus into the card a click opens, so the keyboard reaches its Slack button", async () => {
    const dialog = await opened("Bridge builder");

    expect(dialog).toHaveFocus();
    await userEvent.tab();
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus();
    await userEvent.tab();
    expect(within(dialog).getByRole("link", { name: /^Give a kudos in Slack/ })).toHaveFocus();
  });

  it("closes when the focus moves away, so the keyboard opens one card at a time", async () => {
    await opened("Bridge builder");

    act(() => screen.getByRole("button", { name: /^Collector/ }).focus());
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.keyboard("{Enter}");

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(card("Collector")).toBeInTheDocument();
  });

  it("stays open once a click pinned it, when the pointer leaves", async () => {
    visit("/book#me");
    const bridge = await tile("Bridge builder");

    fireEvent.mouseEnter(bridge.closest("li")!);
    await userEvent.click(bridge);
    fireEvent.mouseLeave(bridge.closest("li")!);
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));

    expect(card("Bridge builder")).toBeInTheDocument();
  });
});

function withNoMedals(album: Album): Album {
  return { ...album, milestones: album.milestones.map((milestone) => ({ ...milestone, tiers: milestone.tiers.map((tier) => ({ ...tier, earnedAt: null })) })) };
}
