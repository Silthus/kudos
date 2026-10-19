import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures, type MemberProfile } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum } from "./albumFixtures";
import type { Album, ProfileRead, PutAllInReply, TrayItem } from "./answer";
import { fixedProfile, profileFixtures } from "./profileFixtures";

const memberWithTheAlbum: MemberProfile = { ...shellFixtures.memberWithEveryFeatureOpen, album: true };

beforeAll(async () => {
  await import("./AlbumApp");
});

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => {
  vi.useRealTimers();
});

function visit(album: Album = albumFixtures.teamless, profile: ProfileRead = fixedProfile(profileFixtures.noted), putAllIn?: () => Promise<PutAllInReply>) {
  window.history.replaceState(null, "", "/");
  return renderAlbum(memberWithTheAlbum, fixedAlbum(album), { profile, commands: putAllIn === undefined ? {} : { putAllIn } });
}

const juno: TrayItem = { item: "tray-juno", kind: "sticker", person: "juno-park" };

const banana: TrayItem = { item: "tray-banana", kind: "hoggie", hoggie: "banana", rarity: "common", isNew: true };

async function part(name: string) {
  return within(await screen.findByRole("region", { name }));
}

function linksIn(region: ReturnType<typeof within>) {
  return region.getAllByRole("link").map((link: HTMLElement) => [link.getAttribute("aria-label") ?? link.textContent, link.getAttribute("href")]);
}

describe("AL43: a member without a team lands on the album overview, never an empty home", { timeout: 30_000 }, () => {
  it("says their team's page comes once they're matched, and leads to finding themselves on posthog.com in Settings", async () => {
    visit();

    expect(await screen.findByRole("heading", { level: 1, name: "Your album" })).toBeInTheDocument();
    const find = await part("Find your team");
    expect(find.getByText("Your team's page shows here once you're matched to your profile on posthog.com.")).toBeInTheDocument();
    expect(find.getByRole("link", { name: "Find yourself on posthog.com" })).toHaveAttribute("href", "/settings?section=company-profile");
  });

  it("names the three teams closest to complete, a page ready to unlock first, then the fewest people to go and the furthest along, each linking to its page", async () => {
    visit();

    const closest = await part("Closest to complete");
    expect(linksIn(closest)).toEqual([
      ["Kettle Works: 3 of 3", "/book#teams/kettle-works"],
      ["Lanterns: 4 of 5", "/book#teams/lanterns"],
      ["Paper Moons: 3 of 4", "/book#teams/paper-moons"],
    ]);
    expect(closest.getByText("Ready to unlock")).toBeInTheDocument();
  });

  it("counts the waiting packs, and Open a pack opens them", async () => {
    const { user } = visit();

    const packs = await part("Waiting packs");
    expect(packs.getByText("2 packs waiting to open.")).toBeInTheDocument();
    await user.click(packs.getByRole("button", { name: "Open a pack" }));

    expect(await screen.findByRole("dialog", { name: "Open your packs" })).toBeInTheDocument();
  });

  it("Open a pack opens nothing while the cards are being put in, as the packs button doesn't", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = visit({ ...albumFixtures.teamless, tray: [juno, banana] }, fixedProfile(profileFixtures.noted), async () => ({ kind: "placed", items: [banana, juno], more: false }));
    const [bar] = await screen.findAllByRole("banner");
    await user.click(within(bar!).getByRole("button", { name: /^Tray/ }));
    await user.click(within(await screen.findByRole("region", { name: "Tray" })).getByRole("button", { name: "Put them all in · 2" }));
    await within(bar!).findByRole("button", { name: "Tray, putting in, 2 to go" });

    const open = (await part("Waiting packs")).getByRole("button", { name: "Open a pack" });
    await user.click(open);

    expect(screen.queryByRole("dialog", { name: "Open your packs" })).not.toBeInTheDocument();
    expect(open).toHaveAttribute("aria-disabled", "true");
  });

  it("closing the packs before a rip gives focus back to the overview's Open a pack", async () => {
    const { user } = visit();
    await user.click((await part("Waiting packs")).getByRole("button", { name: "Open a pack" }));
    await screen.findByRole("dialog", { name: "Open your packs" });

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Open your packs" })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Open a pack" })).toHaveFocus());
  });

  it("with no pack waiting says how to earn one, and offers nothing to open", async () => {
    visit({ ...albumFixtures.teamless, packs: [] });

    const packs = await part("Waiting packs");
    expect(packs.getByText("No packs waiting. Thank someone and say why to earn one.")).toBeInTheDocument();
    expect(packs.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lists the newest people in the album, each linking to their page", async () => {
    visit();

    const newest = await part("New in your album");
    expect(newest.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/book#people/perrin-holt", "/book#people/wren-alder", "/book#people/fen-marlowe"]);
    expect(newest.getByRole("link", { name: /^Perrin Holt, Quiet Harbour, joined/ })).toBeInTheDocument();
  });

  it("with nobody in the album yet says how the first person comes", async () => {
    visit(albumFixtures.teamless, fixedProfile(profileFixtures.quiet));

    expect((await part("New in your album")).getByText("Give a thoughtful kudos and open its pack: your first person shows here.")).toBeInTheDocument();
  });

  it("an album that holds no teams yet still leads to finding your team and to the waiting packs", async () => {
    visit({ ...albumFixtures.teamless, teams: [], people: [] });

    expect(await part("Find your team")).toBeTruthy();
    expect(await part("Waiting packs")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Closest to complete" })).not.toBeInTheDocument();
  });

  it("asks getAlbumProfile only on the overview, never on a member's own team page", async () => {
    const asked: boolean[] = [];
    const read: ProfileRead = (asking) => {
      asked.push(asking);
      return asking ? profileFixtures.noted : undefined;
    };
    visit(albumFixtures.midway, read);

    expect(await screen.findByRole("heading", { level: 1, name: "Lanterns" })).toBeInTheDocument();
    expect(asked).not.toContain(true);
  });
});
