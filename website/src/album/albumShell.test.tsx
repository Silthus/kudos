import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { albumFixtures, fixedAlbum } from "./albumFixtures";
import { boardsFixtures, fixedBoards } from "./boardsFixtures";
import type { MyAlbum } from "./answer";
import type { SettingsRead, SettingsShown } from "../settingsRead";
import { fixedSettings, settingsFixtures } from "../settingsFixtures";
import { shellFixtures, type MemberProfile } from "../shell";
import { renderAlbum, renderApp } from "../test/renderApp";
import { aWideScreenThatNarrows, fakeSystemTheme, preferWideScreen } from "../test/systemTheme";

const memberWithTheAlbum: MemberProfile = { ...shellFixtures.memberWithEveryFeatureOpen, album: true };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

function visit(path: string, album: MyAlbum = albumFixtures.midway, visitor: MemberProfile = memberWithTheAlbum) {
  window.history.replaceState(null, "", path);
  return renderAlbum(visitor, fixedAlbum(album), { settings: fixedSettings(settingsFixtures.everything), boards: fixedBoards(boardsFixtures.week) });
}

async function topBar() {
  const [bar] = await screen.findAllByRole("banner");
  return within(bar!);
}

async function sidebar() {
  return within(await screen.findByRole("navigation", { name: "Album" }));
}

describe("the AlbumAnswer fixtures keep the contract the UI tickets build on", () => {
  it("lists every fixture's waiting packs oldest first", () => {
    for (const album of Object.values(albumFixtures)) {
      const earned = album.packs.map(({ earnedAt }) => earnedAt);
      expect(earned).toEqual(earned.toSorted((first, second) => first - second));
    }
    expect(albumFixtures.midway.packs.length).toBeGreaterThan(1);
  });
});

describe("AL39: the album shell shows only while getMyProfile carries album", () => {
  it("a member the flag is on for gets the album's frame, not today's", async () => {
    visit("/");

    expect(await screen.findByRole("navigation", { name: "Album" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Screens" })).not.toBeInTheDocument();
  });

  it("a member without the flag keeps today's shell and the album is never asked for", async () => {
    window.history.replaceState(null, "", "/");
    const asked: boolean[] = [];
    renderAlbum(shellFixtures.memberWithEveryFeatureOpen, (asking) => {
      asked.push(asking);
      return asking ? albumFixtures.midway : undefined;
    });

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Album" })).not.toBeInTheDocument();
    expect(asked.every((asking) => !asking)).toBe(true);
  });

  it("today's renderApp, which injects no album read, renders today's shell as before", async () => {
    window.history.replaceState(null, "", "/");
    renderApp(shellFixtures.memberWithEveryFeatureOpen);

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Album" })).not.toBeInTheDocument();
  });

  it("while getAlbum answers off for a member the profile still says album for, the album waits instead of showing", async () => {
    visit("/", { kind: "off" });

    expect(await screen.findByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("navigation", { name: "Album" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Screens" })).not.toBeInTheDocument();
  });
});

describe("AL42: the top bar", () => {
  it("carries the brand, the XP bar, the packs button, the tray, Activity, Leaderboard, the emojis, the member and the settings cog, and no tabs", async () => {
    visit("/");
    const bar = await topBar();

    expect(bar.getByRole("link", { name: "HedgeHug" })).toHaveAttribute("href", "/");
    expect(bar.getByText("Level 6")).toBeInTheDocument();
    expect(bar.getByText("290 XP to level 7")).toBeInTheDocument();
    expect(bar.getByRole("link", { name: "Open your packs, 2 waiting" })).toHaveAttribute("href", "/book#packs");
    expect(bar.getByRole("button", { name: "Tray, nothing to put in" })).toBeInTheDocument();
    expect(bar.getByRole("link", { name: "Activity" })).toHaveAttribute("href", "/activity");
    expect(bar.getByRole("link", { name: "Leaderboard" })).toHaveAttribute("href", "/leaderboard");
    expect(bar.getByRole("button", { name: "Your emojis, 3 earned" })).toBeInTheDocument();
    expect(bar.getByRole("link", { name: "Your profile, Sam Example" })).toHaveAttribute("href", "/book#me");
    expect(bar.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(bar.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("says one pack, and no packs with how to earn one", async () => {
    visit("/", albumFixtures.onePack);
    expect((await topBar()).getByRole("link", { name: "Open your packs, 1 waiting" })).toHaveTextContent("1 pack");
  });

  it("says no packs are waiting and how to earn one", async () => {
    visit("/", albumFixtures.newcomer);
    expect((await topBar()).getByRole("link", { name: "No packs waiting" })).toHaveTextContent("Say thanks to earn one");
  });

  it("the tray opens to say it holds nothing yet", async () => {
    const { user } = visit("/");
    const tray = (await topBar()).getByRole("button", { name: "Tray, nothing to put in" });

    await user.click(tray);

    expect(tray).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Tray" })).toHaveTextContent("Open a pack and what it holds waits here to be put in.");
  });

  it("Activity and Leaderboard keep their names while only icons show, and the page's own entry is current and labelled", async () => {
    visit("/activity");
    const bar = await topBar();

    expect(bar.getByRole("link", { name: "Activity" })).toHaveAttribute("aria-current", "page");
    expect(bar.getByRole("link", { name: "Activity" })).toHaveAttribute("data-labelled", "");
    expect(bar.getByRole("link", { name: "Leaderboard" })).not.toHaveAttribute("aria-current");
    expect(bar.getByRole("link", { name: "Leaderboard" })).not.toHaveAttribute("data-labelled");
  });

  it("the member's face and name lead to the profile, current there", async () => {
    visit("/book#me");
    expect((await topBar()).getByRole("link", { name: "Your profile, Sam Example" })).toHaveAttribute("aria-current", "page");
  });
});

describe("AL42: the sidebar", () => {
  it("leads with the member's team as a progress card", async () => {
    visit("/");
    const side = await sidebar();

    const mine = within(side.getByRole("region", { name: "Your team" })).getByRole("link");
    expect(mine).toHaveAttribute("href", "/");
    expect(mine).toHaveTextContent("Lanterns");
    expect(mine).toHaveTextContent("4 of 5 · 1 to go");
    expect(mine).toHaveAttribute("aria-current", "page");
  });

  it("lists the other teams by progress, a complete page not yet unlocked first, then the most held, ten of them and a Show more", async () => {
    const { user } = visit("/");
    const side = await sidebar();
    const teams = () => within(side.getByRole("list", { name: "Teams" })).getAllByRole("link").map((link) => link.getAttribute("href"));

    expect(teams()).toEqual(["/book#teams/kettle-works", "/book#teams/paper-moons", "/book#teams/quiet-harbour", "/book#teams/salt-and-sparrow", "/book#teams/tin-orchard", "/book#teams/brass-tidings", "/book#teams/glass-meadow", "/book#teams/willow-desk", "/book#teams/amber-ledger", "/book#teams/copper-kite"]);

    await user.click(side.getByRole("button", { name: "Show 2 more" }));

    expect(teams()).toHaveLength(12);
    expect(teams().slice(-2)).toEqual(["/book#teams/nimble-lantern", "/book#teams/velvet-signal"]);
    await user.click(side.getByRole("button", { name: "Show fewer" }));
    expect(teams()).toHaveLength(10);
  });

  it("says where each team stands", async () => {
    visit("/");
    const teams = within((await sidebar()).getByRole("list", { name: "Teams" }));

    expect(teams.getByRole("link", { name: /^Kettle Works/ })).toHaveAccessibleName("Kettle Works Ready to unlock");
    expect(teams.getByRole("link", { name: /^Quiet Harbour/ })).toHaveAccessibleName("Quiet Harbour Unlocked");
    expect(teams.getByRole("link", { name: /^Paper Moons/ })).toHaveAccessibleName("Paper Moons 3 of 4");
  });

  it("keeps a team past the first ten in the list while its page is open", async () => {
    visit("/book#teams/velvet-signal");
    const teams = within((await sidebar()).getByRole("list", { name: "Teams" }));

    expect(teams.getByRole("link", { name: /^Velvet Signal/ })).toHaveAttribute("aria-current", "page");
  });

  it("finds teams by name and people by name", async () => {
    const { user } = visit("/");
    const side = await sidebar();

    await user.type(side.getByRole("searchbox", { name: "Search teams and people" }), "ines");

    expect(side.queryByRole("region", { name: "Your team" })).not.toBeInTheDocument();
    expect(within(side.getByRole("list", { name: "People" })).getByRole("link", { name: "Ines Okafor" })).toHaveAttribute("href", "/book#people/ines-okafor");

    await user.clear(side.getByRole("searchbox", { name: "Search teams and people" }));
    await user.type(side.getByRole("searchbox", { name: "Search teams and people" }), "harbour");

    expect(within(side.getByRole("list", { name: "Teams" })).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/book#teams/quiet-harbour"]);
    expect(side.queryByRole("list", { name: "People" })).not.toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    const { user } = visit("/");
    const side = await sidebar();

    await user.type(side.getByRole("searchbox", { name: "Search teams and people" }), "zzzz");

    expect(side.getByText("No team or person matches “zzzz”.")).toBeInTheDocument();
  });

  it("ends with Hoggies and Milestones, Milestones counting the medals earned", async () => {
    visit("/");
    const more = within((await sidebar()).getByRole("list", { name: "More of your album" }));

    expect(more.getByRole("link", { name: "Hoggies" })).toHaveAttribute("href", "/book#hoggies");
    expect(more.getByRole("link", { name: /^Milestones/ })).toHaveAttribute("href", "/book#milestones");
    expect(more.getByRole("link", { name: /^Milestones/ })).toHaveTextContent("6 medals");
  });

  it("an album that holds no teams yet lists no Teams section, and its home says only how a team page arrives", async () => {
    visit("/", { ...albumFixtures.newcomer, teams: [], people: [] });
    const side = await sidebar();

    expect(side.queryByRole("list", { name: "Teams" })).not.toBeInTheDocument();
    expect(side.queryByRole("heading", { name: /^Teams/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Your album" }).nextElementSibling).toHaveTextContent(/^Your team's page shows here once you're matched to a team on posthog\.com\.$/);
  });

  it("a member with no team of their own sees no team card", async () => {
    visit("/", albumFixtures.newcomer);
    expect((await sidebar()).queryByRole("region", { name: "Your team" })).not.toBeInTheDocument();
  });
});

describe("AL42: Getting started", () => {
  it("shows on the home page while unfinished, counting what's done and naming the next step", async () => {
    visit("/");
    const strip = await screen.findByRole("region", { name: "Getting started" });

    expect(strip).toHaveTextContent("Getting started · 2 of 4");
    expect(strip).toHaveTextContent("Next: Open a pack");
    expect(within(strip).getAllByRole("listitem").map((step) => step.getAttribute("aria-label"))).toEqual(["Give a hug: done", "Give a thoughtful kudos: done", "Open a pack: not yet", "Complete a team page: not yet"]);
  });

  it("is gone once all four are done", async () => {
    visit("/", albumFixtures.started);
    await screen.findByRole("navigation", { name: "Album" });
    expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();
  });

  it("shows only on the home page", async () => {
    visit("/book#teams/paper-moons");
    await screen.findByRole("navigation", { name: "Album" });
    expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();
  });
});

describe("AL43: every album route has its page", () => {
  const routes: { path: string; title: string }[] = [
    { path: "/", title: "Lanterns" },
    { path: "/book#teams/paper-moons", title: "Paper Moons" },
    { path: "/book#people/ines-okafor", title: "Ines Okafor" },
    { path: "/book#me", title: "Sam Example" },
    { path: "/book#hoggies", title: "Hoggies" },
    { path: "/book#hoggies/hedgehog-sitting", title: "Hoggies" },
    { path: "/book#milestones", title: "Milestones" },
    { path: "/book#packs", title: "Your packs" },
    { path: "/activity", title: "Activity" },
    { path: "/leaderboard", title: "Who said thanks, and why" },
    { path: "/settings", title: "Settings" },
  ];

  for (const { path, title } of routes) {
    it(`${path} shows ${title}`, async () => {
      visit(path);
      expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    });
  }

  it("the home page is the member's own team without a team of their own says how to find one", async () => {
    visit("/", albumFixtures.newcomer);
    expect(await screen.findByRole("heading", { level: 1, name: "Your album" })).toBeInTheDocument();
  });

  it("a team or person the album doesn't hold is not found", async () => {
    visit("/book#teams/nowhere-team");
    expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
  });

  it("AL53: Settings is today's settings page inside the album's frame", async () => {
    visit("/settings");

    expect(await screen.findByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Album" })).toBeInTheDocument();
    expect((await topBar()).getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  });

  it("following a sidebar link moves to that page and its title takes focus", async () => {
    const { user } = visit("/");
    await user.click(within((await sidebar()).getByRole("list", { name: "Teams" })).getByRole("link", { name: /^Paper Moons/ }));

    const title = await screen.findByRole("heading", { level: 1, name: "Paper Moons" });
    expect(window.location.hash).toBe("#teams/paper-moons");
    await waitFor(() => expect(title).toHaveFocus());
  });
});

describe("AL43: page changes the address didn't come from a link", () => {
  it("Back into Settings while its read still loads moves focus to its title once it lands", async () => {
    window.history.replaceState(null, "", "/settings");
    window.history.pushState(null, "", "/");
    let settings: SettingsShown | undefined;
    const readSettings: SettingsRead = (asking) => (asking ? settings : undefined);
    const { showVisitor } = renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { settings: readSettings });
    await screen.findByRole("heading", { level: 1, name: "Lanterns" });

    act(() => window.history.back());
    await waitFor(() => expect(screen.queryByRole("heading", { level: 1, name: "Lanterns" })).not.toBeInTheDocument());
    settings = settingsFixtures.everything;
    showVisitor(memberWithTheAlbum);

    const title = await screen.findByRole("heading", { level: 1, name: "Settings" });
    await waitFor(() => expect(title).toHaveFocus());
  });

  it("a page that fails to render shows the error page inside the album's frame, and the frame still leads elsewhere", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = { kind: "settings" } as unknown as SettingsShown;
    window.history.replaceState(null, "", "/settings");
    const { user } = renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { settings: (asking) => (asking ? broken : undefined) });

    expect(await screen.findByRole("heading", { level: 1, name: "Something went wrong" })).toBeInTheDocument();
    await user.click((await sidebar()).getByRole("link", { name: /^Lanterns/ }));

    expect(await screen.findByRole("heading", { level: 1, name: "Lanterns" })).toBeInTheDocument();
  });
});

describe("AL55: the phone layout", () => {
  it("folds the sidebar into a drawer and Activity, Leaderboard, the member and Settings into a menu, keeping XP, packs, tray and emojis in the bar", async () => {
    aWideScreenThatNarrows().narrow();
    const { user } = visit("/");
    const bar = await topBar();

    expect(bar.getByText("Level 6")).toBeInTheDocument();
    expect(bar.getByRole("link", { name: "Open your packs, 2 waiting" })).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "Tray, nothing to put in" })).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "Your emojis, 3 earned" })).toBeInTheDocument();
    expect(bar.queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();

    await user.click(bar.getByRole("button", { name: "Menu" }));
    const menu = within(screen.getByRole("region", { name: "Menu" }));
    expect(menu.getByRole("link", { name: "Activity" })).toHaveAttribute("href", "/activity");
    expect(menu.getByRole("link", { name: "Leaderboard" })).toHaveAttribute("href", "/leaderboard");
    expect(menu.getByRole("link", { name: "Your profile, Sam Example" })).toHaveAttribute("href", "/book#me");
    expect(menu.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");

    const drawer = screen.getByRole("button", { name: "Teams and pages" });
    expect(drawer).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("searchbox", { name: "Search teams and people" })).not.toBeInTheDocument();
    await user.click(drawer);
    expect(drawer).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("searchbox", { name: "Search teams and people" })).toBeInTheDocument();
  });

  it("closes the drawer once a page in it is followed", async () => {
    aWideScreenThatNarrows().narrow();
    const { user } = visit("/");
    await user.click(await screen.findByRole("button", { name: "Teams and pages" }));

    await user.click(within(screen.getByRole("list", { name: "Teams" })).getByRole("link", { name: /^Paper Moons/ }));

    expect(await screen.findByRole("heading", { level: 1, name: "Paper Moons" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Teams and pages" })).toHaveAttribute("aria-expanded", "false");
  });
});
