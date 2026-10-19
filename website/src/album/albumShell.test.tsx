import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { albumFixtures, fixedAlbum, fixedPeople } from "./albumFixtures";
import { boardsFixtures, fixedBoards } from "./boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";
import { fixedProfile, profileFixtures } from "./profileFixtures";
import { fixtureWeeks } from "./weekFixtures";
import type { MyAlbum } from "./answer";
import type { SettingsRead, SettingsShown } from "../settingsRead";
import { fixedSettings, settingsFixtures } from "../settingsFixtures";
import { shellFixtures, type MemberProfile } from "../shell";
import type { Capturer } from "../browserAnalytics/capture";
import { renderAlbum, renderApp } from "../test/renderApp";
import { aWideScreenThatNarrows, fakeSystemTheme, preferWideScreen } from "../test/systemTheme";

const memberWithTheAlbum: MemberProfile = { ...shellFixtures.memberWithEveryFeatureOpen, album: true };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

function visit(path: string, album: MyAlbum = albumFixtures.midway, visitor: MemberProfile = memberWithTheAlbum, capturer: Capturer | null = null) {
  window.history.replaceState(null, "", path);
  return renderAlbum(visitor, fixedAlbum(album), { settings: fixedSettings(settingsFixtures.everything), boards: fixedBoards(boardsFixtures.week), weeks: fixtureWeeks(), people: album.kind === "album" ? fixedPeople(album) : undefined, profile: fixedProfile(profileFixtures.noted), hoggies: fixedHoggies(hoggiesFixtures.midway), capturer });
}

function visitWhileCapturing(path: string) {
  return visit(path, albumFixtures.midway, memberWithTheAlbum, { capture: vi.fn() } as unknown as Capturer);
}

function opensOutTo(control: HTMLElement) {
  return control.querySelector(".al-opens-out")?.textContent ?? null;
}

const albumCss = readFileSync(join(__dirname, "album.css"), "utf8");

function declarationsOf(selector: string, css = albumCss) {
  const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, selectors]) => selectors!.split(",").some((each) => each.trim() === selector));
  if (rule === undefined) throw new Error(`${selector} has no rule in album.css`);
  return Object.fromEntries([...rule[2]!.matchAll(/([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value!.trim()]));
}

function cssFrom(media: string) {
  return albumCss.slice(albumCss.indexOf(media));
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

    expect(bar.getByRole("link", { name: "HedgeHug" })).toHaveAttribute("href", "/book#me");
    expect(bar.getByText("Level 6")).toBeInTheDocument();
    expect(bar.getByText("290 XP to level 7")).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "Open your packs, 2 waiting" })).toHaveAttribute("aria-haspopup", "dialog");
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
    expect((await topBar()).getByRole("button", { name: "Open your packs, 1 waiting" })).toHaveTextContent("1 pack");
  });

  it("says no packs are waiting and how to earn one", async () => {
    visit("/", albumFixtures.newcomer);
    expect((await topBar()).getByRole("button", { name: "No packs waiting" })).toHaveTextContent("Say thanks to earn one");
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

  it("#695: holds Feedback while the visit is captured, and the sidebar holds only teams and pages", async () => {
    visitWhileCapturing("/");
    const bar = await topBar();
    const side = await sidebar();

    expect(bar.getByRole("button", { name: "Feedback" })).toHaveAttribute("data-ph-capture-attribute-control", "feedback");
    expect(side.queryByRole("button", { name: "Feedback" })).not.toBeInTheDocument();
    expect(side.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    expect(side.queryByRole("group", { name: "Theme" })).not.toBeInTheDocument();
  });

  it("#695: the packs button, the tray, Activity, Leaderboard, the emojis and Feedback each open out to their label", async () => {
    visitWhileCapturing("/");
    const bar = await topBar();

    expect(opensOutTo(bar.getByRole("button", { name: "Open your packs, 2 waiting" }))).toBe("2 packsReady to open");
    expect(opensOutTo(bar.getByRole("button", { name: "Tray, nothing to put in" }))).toBe("Tray");
    expect(opensOutTo(bar.getByRole("link", { name: "Activity" }))).toBe("Activity");
    expect(opensOutTo(bar.getByRole("link", { name: "Leaderboard" }))).toBe("Leaderboard");
    expect(opensOutTo(bar.getByRole("button", { name: "Your emojis, 3 earned" }))).toBe("Emojis");
    expect(opensOutTo(bar.getByRole("button", { name: "Feedback" }))).toBe("Feedback");
  });

  it("#695: the packs button stays open on the packs page, as Activity and Leaderboard do on theirs", async () => {
    visit("/book#packs");
    const bar = await topBar();

    expect(bar.getByRole("button", { name: "Open your packs, 2 waiting" })).toHaveAttribute("data-labelled", "");
    expect(bar.getByRole("link", { name: "Activity" })).not.toHaveAttribute("data-labelled");
  });

  it("the member's face and name lead to the profile, current there", async () => {
    visit("/book#me");
    expect((await topBar()).getByRole("link", { name: "Your profile, Sam Example" })).toHaveAttribute("aria-current", "page");
  });
});

describe("#695: a top bar label opens out calmly", () => {
  it("opens about 150 ms after the pointer or keyboard focus arrives, so a pointer passing across the bar opens nothing", () => {
    const opening = declarationsOf(".al-top :hover > .al-opens-out");

    expect(opening["clip-path"]).toBe("inset(-0.75rem -1rem -0.75rem 0)");
    expect(opening["transition-delay"]).toBe("150ms");
    expect(declarationsOf(".al-top :focus-visible > .al-opens-out")).toEqual(opening);
  });

  it("closes as soon as they leave, sliding shut rather than snapping", () => {
    const resting = declarationsOf(".al-opens-out");

    expect(resting["clip-path"]).toBe("inset(0 100% 0 0)");
    expect(resting.transition).toMatch(/clip-path \d+ms/);
    expect(resting["transition-delay"]).toBeUndefined();
  });

  it("opens over the bar beside its button, so no entry moves under a resting pointer and the pointer passes through it", () => {
    const resting = declarationsOf(".al-opens-out");

    expect(resting.position).toBe("absolute");
    expect(resting.left).toBe("100%");
    expect(resting.width).toBe("max-content");
    expect(resting["pointer-events"]).toBe("none");
  });

  it("opens at once, with no delay, while its panel is open", () => {
    const expanded = declarationsOf(".al-top [aria-expanded=\"true\"] > .al-opens-out");

    expect(expanded["clip-path"]).toBe("inset(-0.75rem -1rem -0.75rem 0)");
    expect(expanded["transition-delay"]).toBe("0ms");
  });

  it("takes its place in the bar on the current page, open from the start", () => {
    const labelled = declarationsOf(".al-top [data-labelled] > .al-opens-out");

    expect(labelled.position).toBe("static");
    expect(labelled["clip-path"]).toBe("none");
    expect(labelled["transition-delay"]).toBe("0ms");
  });

  it("stays closed on a phone, read only by screen readers, so the bar never outgrows the screen", () => {
    const phone = declarationsOf(".al-top .al-top-end .al-opens-out", cssFrom("@media (max-width: 63.999rem)"));

    expect(phone).toMatchObject({ width: "1px", height: "1px", overflow: "hidden", "clip-path": "inset(50%)", opacity: "0" });
  });

  it("with reduced motion, keeps the delay but shows and hides the label without sliding", () => {
    expect(declarationsOf(".al-opens-out", cssFrom("@media (prefers-reduced-motion: reduce)"))["transition-duration"]).toBe("0s");
  });
});

describe("AL42: the sidebar", () => {
  it("leads with the member's team as a progress card", async () => {
    visit("/book#teams/lanterns");
    const side = await sidebar();

    const mine = within(side.getByRole("region", { name: "Your team" })).getByRole("link");
    expect(mine).toHaveAttribute("href", "/book#teams/lanterns");
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

  it("an album that holds no teams yet lists no Teams section, and the profile leads to finding your team", async () => {
    visit("/", { ...albumFixtures.newcomer, teams: [], people: [] });
    const side = await sidebar();

    expect(side.queryByRole("list", { name: "Teams" })).not.toBeInTheDocument();
    expect(side.queryByRole("heading", { name: /^Teams/ })).not.toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Find your team" })).toBeInTheDocument();
  });

  it("a member with no team of their own sees no team card", async () => {
    visit("/", albumFixtures.newcomer);
    expect((await sidebar()).queryByRole("region", { name: "Your team" })).not.toBeInTheDocument();
  });
});

describe("AL42: Getting started", () => {
  it("shows on the profile, the album's home, while unfinished, counting what's done and naming the next step", async () => {
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

  it("shows only on the profile, never on the member's own team page", async () => {
    visit("/book#teams/lanterns");
    await screen.findByRole("navigation", { name: "Album" });
    expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();
  });
});

describe("AL43: every album route has its page", () => {
  const routes: { path: string; title: string }[] = [
    { path: "/", title: "Sam Example" },
    { path: "/book#teams/lanterns", title: "Lanterns" },
    { path: "/book#teams/paper-moons", title: "Paper Moons" },
    { path: "/book#people/ines-okafor", title: "Ines Okafor" },
    { path: "/book#me", title: "Sam Example" },
    { path: "/book#hoggies", title: "Hoggies" },
    { path: "/book#hoggies/hedgehog-sitting", title: "Hoggies" },
    { path: "/book#milestones", title: "Milestones" },
    { path: "/book#packs", title: "Your packs" },
    { path: "/activity", title: "Weekly edition" },
    { path: "/leaderboard", title: "Who said thanks, and why" },
    { path: "/settings", title: "Settings" },
  ];

  for (const { path, title } of routes) {
    it(`${path} shows ${title}`, async () => {
      visit(path);
      expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    });
  }

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

  it("#695: Settings also holds the theme choice and Sign out, which left the sidebar", async () => {
    const { user, actions } = visit("/settings");
    await screen.findByRole("heading", { level: 1, name: "Settings" });
    const page = within(screen.getByRole("main"));
    const theme = page.getByRole("group", { name: "Theme" });

    await user.click(within(theme).getByRole("button", { name: "Dark" }));
    expect(within(theme).getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).toHaveClass("dark");
    await user.click(within(theme).getByRole("button", { name: "System" }));
    expect(document.documentElement).not.toHaveClass("dark");

    await user.click(page.getByRole("button", { name: "Sign out" }));
    expect(actions.signOut).toHaveBeenCalledOnce();
  });

  it("#695: Settings keeps the theme choice and Sign out while its own read fails", async () => {
    window.history.replaceState(null, "", "/settings");
    const { user, actions } = renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { settings: (asking) => (asking ? { kind: "broken" } : undefined) });
    await screen.findByRole("heading", { level: 1, name: "Something went wrong" });
    const page = within(screen.getByRole("main"));

    expect(page.getByRole("group", { name: "Theme" })).toBeInTheDocument();
    await user.click(page.getByRole("button", { name: "Sign out" }));
    expect(actions.signOut).toHaveBeenCalledOnce();
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
    window.history.pushState(null, "", "/book#teams/lanterns");
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
    expect(bar.getByRole("button", { name: "Open your packs, 2 waiting" })).toBeInTheDocument();
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

  it("#695: keeps Feedback in the bar, where its form can stay open, and Settings in the menu", async () => {
    aWideScreenThatNarrows().narrow();
    visitWhileCapturing("/");
    const bar = await topBar();

    expect(bar.getByRole("button", { name: "Feedback" })).toBeInTheDocument();
    expect(bar.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
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
