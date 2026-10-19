import { screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum } from "./albumFixtures";
import type { Album } from "./answer";
import { boardsFixtures, fixedBoards } from "./boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";
import { fixedProfile, profileFixtures } from "./profileFixtures";

const memberWithTheAlbum = shellFixtures.member;

beforeAll(async () => {
  await import("./AlbumApp");
});

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

function visit(address: string, album: Album = albumFixtures.midway) {
  window.history.replaceState(null, "", address);
  return renderAlbum(memberWithTheAlbum, fixedAlbum(album), { boards: fixedBoards(boardsFixtures.week), profile: fixedProfile(profileFixtures.noted), hoggies: fixedHoggies(hoggiesFixtures.midway) });
}

function addressNow() {
  return window.location.pathname + window.location.search + window.location.hash;
}

async function profileTitle() {
  return screen.findByRole("heading", { level: 1, name: "Sam Example" });
}

async function sidebar() {
  return within(await screen.findByRole("navigation", { name: "Album" }));
}

async function topBar() {
  const [bar] = await screen.findAllByRole("banner");
  return within(bar!);
}

describe("AL43: the album's home is the member's profile", { timeout: 30_000 }, () => {
  it("/ shows the profile and replaces the address with /book#me, adding no history entry", async () => {
    window.history.replaceState(null, "", "/");
    const entries = window.history.length;
    visit("/");

    expect(await profileTitle()).toBeInTheDocument();
    await waitFor(() => expect(addressNow()).toBe("/book#me"));
    expect(window.history.length).toBe(entries);
  });

  it("/ keeps a one-time sign-in code until Convex Auth has redeemed it", async () => {
    visit("/?code=one-time");

    expect(await profileTitle()).toBeInTheDocument();
    await waitFor(() => expect(addressNow()).toBe("/book?code=one-time#me"));
  });

  it("/ keeps its address while getAlbum answers off, where the member reads that the website isn't open here", async () => {
    window.history.replaceState(null, "", "/");
    const askedForTheAlbum = vi.fn();
    renderAlbum(memberWithTheAlbum, (asking) => {
      if (asking) askedForTheAlbum();
      return asking ? { kind: "off" } : undefined;
    });

    await waitFor(() => expect(askedForTheAlbum).toHaveBeenCalled());
    expect(await screen.findByRole("heading", { level: 1, name: "Not open yet" })).toBeInTheDocument();
    expect(addressNow()).toBe("/");
  });

  it("the brand leads to the profile", async () => {
    visit("/book#teams/paper-moons");

    expect((await topBar()).getByRole("link", { name: "HedgeHug" })).toHaveAttribute("href", "/book#me");
  });

  it("the member's own team is one click away at its own page, from the sidebar and from the profile", async () => {
    const { user } = visit("/");
    await profileTitle();
    const side = await sidebar();
    const mine = within(side.getByRole("region", { name: "Your team" })).getByRole("link");
    expect(mine).toHaveAttribute("href", "/book#teams/lanterns");
    expect(mine).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Lanterns · 4 of 5 in your album" })).toHaveAttribute("href", "/book#teams/lanterns");
    expect(screen.getByRole("link", { name: "Your team, Lanterns: 4 of 5" })).toHaveAttribute("href", "/book#teams/lanterns");

    await user.click(mine);

    expect(await screen.findByRole("heading", { level: 1, name: "Lanterns" })).toBeInTheDocument();
    expect(addressNow()).toBe("/book#teams/lanterns");
    expect(within((await sidebar()).getByRole("region", { name: "Your team" })).getByRole("link")).toHaveAttribute("aria-current", "page");
  });

  it("a member without a team finds on their profile that their team comes once they're matched, and a way to find themselves on posthog.com", async () => {
    visit("/", albumFixtures.teamless);
    await profileTitle();

    const find = within(await screen.findByRole("region", { name: "Find your team" }));
    expect(find.getByText("Your team's page joins your album once you're matched to your profile on posthog.com.")).toBeInTheDocument();
    expect(find.getByRole("link", { name: "Find yourself on posthog.com" })).toHaveAttribute("href", "/settings?section=company-profile");
  });

  it("a member with a team of their own is never asked to find it", async () => {
    visit("/");
    await profileTitle();

    expect(screen.queryByRole("region", { name: "Find your team" })).not.toBeInTheDocument();
  });

  it("an album that holds no teams yet still shows the profile, leading to finding your team", async () => {
    visit("/", { ...albumFixtures.teamless, teams: [], people: [] });

    expect(await profileTitle()).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Find your team" })).toBeInTheDocument();
  });
});
