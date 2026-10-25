import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { albumFixtures, fixedAlbum, fixedPeople, startedWith } from "./albumFixtures";
import { boardsFixtures, fixedBoards } from "./boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";
import { fixedProfile, profileFixtures } from "./profileFixtures";
import { fixtureWeeks } from "./weekFixtures";
import type { MyAlbum } from "./answer";
import type { SettingsRead, SettingsShown } from "../settingsRead";
import { fixedSettings, settingsFixtures } from "../settingsFixtures";
import { shellFixtures, type ShellState } from "../shell";
import type { Capturer } from "../browserAnalytics/capture";
import { renderAlbum, renderApp } from "../test/renderApp";
import { aWideScreenThatNarrows, fakeSystemTheme, preferWideScreen } from "../test/systemTheme";

const memberWithTheAlbum = shellFixtures.member;

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

function visit(path: string, album: MyAlbum = albumFixtures.midway, visitor: ShellState = memberWithTheAlbum, capturer: Capturer | null = null) {
  window.history.replaceState(null, "", path);
  return renderAlbum(visitor, fixedAlbum(album), { settings: fixedSettings(settingsFixtures.everything), boards: fixedBoards(boardsFixtures.week), weeks: fixtureWeeks(), people: album.kind === "album" ? fixedPeople(album) : undefined, profile: fixedProfile(profileFixtures.noted), hoggies: fixedHoggies(hoggiesFixtures.midway), capturer });
}

function visitWhileCapturing(path: string, album: MyAlbum = albumFixtures.midway) {
  return visit(path, album, memberWithTheAlbum, { capture: vi.fn() } as unknown as Capturer);
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

describe("AL67: the album is the only shell", () => {
  it("a member gets the album's frame whatever getMyProfile says about the album", async () => {
    visit("/", albumFixtures.midway, shellFixtures.member);

    expect(await screen.findByRole("navigation", { name: "Album" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Screens" })).not.toBeInTheDocument();
  });

  it("while getAlbum answers off, the member reads that the website isn't open here, never another shell", async () => {
    visit("/", { kind: "off" });

    expect(await screen.findByRole("heading", { level: 1, name: "Not open yet" })).toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveAttribute("aria-busy");
    expect(screen.queryByRole("navigation", { name: "Album" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Screens" })).not.toBeInTheDocument();
  });
});

describe("AL42: the top bar", () => {
  it("carries the brand, the XP bar, the packs button while packs wait, Activity, Leaderboard, the emojis, the member and the settings cog, and no tabs", async () => {
    visit("/");
    const bar = await topBar();

    expect(bar.getByRole("link", { name: "HedgeHug" })).toHaveAttribute("href", "/book#me");
    expect(bar.getByText("Level 6")).toBeInTheDocument();
    expect(bar.getByText("290 XP to level 7")).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "Open your packs, 2 waiting" })).toHaveAttribute("aria-haspopup", "dialog");
    expect(bar.getByRole("link", { name: "Activity" })).toHaveAttribute("href", "/activity");
    expect(bar.getByRole("link", { name: "Leaderboard" })).toHaveAttribute("href", "/leaderboard");
    expect(bar.getByRole("button", { name: "Your emojis, 9 earned" })).toBeInTheDocument();
    expect(bar.getByRole("link", { name: "Your profile, Sam Example" })).toHaveAttribute("href", "/book#me");
    expect(bar.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(bar.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("says one pack, and no packs with how to earn one", async () => {
    visit("/", albumFixtures.onePack);
    expect((await topBar()).getByRole("button", { name: "Open your packs, 1 waiting" })).toHaveTextContent("1 pack");
  });

  it("#127: with no pack waiting and nothing in the tray, holds neither the packs button nor the tray", async () => {
    visit("/", albumFixtures.newcomer);
    const bar = await topBar();

    expect(bar.queryByRole("button", { name: /packs/i })).not.toBeInTheDocument();
    expect(bar.queryByRole("button", { name: /^Tray/ })).not.toBeInTheDocument();
    expect(bar.getByRole("button", { name: /^Your emojis/ })).toBeInTheDocument();
  });

  it("#127: holds the tray while it holds something to put in, and leaves the packs button out while no pack waits", async () => {
    const { user } = visit("/", { ...albumFixtures.trayed, packs: [] });
    const bar = await topBar();
    const tray = bar.getByRole("button", { name: /^Tray, \d+ to put in$/ });

    await user.click(tray);

    expect(tray).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Tray" })).toBeInTheDocument();
    expect(bar.queryByRole("button", { name: /packs/i })).not.toBeInTheDocument();
  });

  it("#127: on desktop Activity and Leaderboard write out their names on every page, and the page's own entry is current", async () => {
    visit("/activity");
    const bar = await topBar();

    expect(bar.getByRole("link", { name: "Activity" })).toHaveAttribute("aria-current", "page");
    expect(bar.getByRole("link", { name: "Activity" })).toHaveAttribute("data-labelled", "");
    expect(bar.getByRole("link", { name: "Leaderboard" })).not.toHaveAttribute("aria-current");
    expect(bar.getByRole("link", { name: "Leaderboard" })).toHaveAttribute("data-labelled", "");
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
    visitWhileCapturing("/", { ...albumFixtures.midway, tray: albumFixtures.trayed.tray });
    const bar = await topBar();

    expect(opensOutTo(bar.getByRole("button", { name: "Open your packs, 2 waiting" }))).toBe("2 packsReady to open");
    expect(opensOutTo(bar.getByRole("button", { name: /^Tray, \d+ to put in$/ }))).toBe("Tray");
    expect(opensOutTo(bar.getByRole("link", { name: "Activity" }))).toBe("Activity");
    expect(opensOutTo(bar.getByRole("link", { name: "Leaderboard" }))).toBe("Leaderboard");
    expect(opensOutTo(bar.getByRole("button", { name: "Your emojis, 9 earned" }))).toBe("Emojis");
    expect(opensOutTo(bar.getByRole("button", { name: "Feedback" }))).toBe("Feedback");
  });

  it("#695: the packs button stays open on the packs page", async () => {
    visit("/book#packs");
    const bar = await topBar();

    expect(bar.getByRole("button", { name: "Open your packs, 2 waiting" })).toHaveAttribute("data-labelled", "");
  });

  it("the emoji button always shows its label beside its icon and count, not only on hover", async () => {
    visit("/");
    const emojis = (await topBar()).getByRole("button", { name: "Your emojis, 9 earned" });

    expect(emojis).toHaveAttribute("data-labelled", "");
    expect(opensOutTo(emojis)).toBe("Emojis");
    expect(emojis.querySelector(".al-emojis-count")).toHaveTextContent("9");
  });

  it("the member's face and name lead to the profile, current there", async () => {
    visit("/book#me");
    expect((await topBar()).getByRole("link", { name: "Your profile, Sam Example" })).toHaveAttribute("aria-current", "page");
  });
});

describe("the emoji button marks New what the member has not opened yet", () => {
  function theEmojiButton() {
    return within(screen.getAllByRole("banner")[0]!).getByRole("button", { name: /^Your emojis/ });
  }

  function theRowOf(code: string) {
    return within(screen.getByRole("region", { name: "Your emojis" })).getByText(code).closest("li")!;
  }

  it("marks the button New while it holds an earned emoji the member has not opened the popup on, and clears it once they open it, on the next visit too", async () => {
    const first = visit("/");
    await topBar();
    expect(theEmojiButton()).toHaveAccessibleDescription("New");

    await act(async () => fireEvent.click(theEmojiButton()));
    expect(theEmojiButton()).not.toHaveAccessibleDescription("New");
    await act(async () => fireEvent.click(theEmojiButton()));
    expect(theEmojiButton(), "once the popup closes").not.toHaveAccessibleDescription("New");

    first.unmount();
    visit("/");
    await topBar();
    expect(theEmojiButton(), "on the next visit").not.toHaveAccessibleDescription("New");
  });

  it("shows no New while the member holds no earned emoji", async () => {
    visit("/", albumFixtures.newcomer);
    await topBar();

    expect(theEmojiButton()).not.toHaveAccessibleDescription("New");
  });

  it("marks New again once an emoji is earned after the member opened the popup", async () => {
    const album = albumFixtures.midway;
    let answer = album;
    const listeners = new Set<() => void>();
    const read = (asking: boolean) => {
      const shown = useSyncExternalStore(
        (listener) => (listeners.add(listener), () => void listeners.delete(listener)),
        () => answer,
      );
      return asking ? shown : undefined;
    };
    window.history.replaceState(null, "", "/");
    renderAlbum(memberWithTheAlbum, read, { people: fixedPeople(album), profile: fixedProfile(profileFixtures.noted), hoggies: fixedHoggies(hoggiesFixtures.midway) });
    await topBar();
    await act(async () => fireEvent.click(theEmojiButton()));
    await act(async () => fireEvent.click(theEmojiButton()));
    expect(theEmojiButton()).not.toHaveAccessibleDescription("New");

    const locked = album.emojis.find(({ earned }) => !earned)!;
    answer = { ...album, emojis: album.emojis.map((emoji) => (emoji.id === locked.id ? { ...emoji, earned: true, earnedAt: Date.now(), seen: true, progress: null } : emoji)) };
    await act(async () => listeners.forEach((listener) => listener()));

    expect(theEmojiButton()).toHaveAccessibleDescription("New");
  });

  it("marks New on each emoji earned since the member last opened the popup, until they close it", async () => {
    const album = albumFixtures.midway;
    let answer = album;
    const listeners = new Set<() => void>();
    const read = (asking: boolean) => {
      const shown = useSyncExternalStore(
        (listener) => (listeners.add(listener), () => void listeners.delete(listener)),
        () => answer,
      );
      return asking ? shown : undefined;
    };
    window.history.replaceState(null, "", "/");
    renderAlbum(memberWithTheAlbum, read, { people: fixedPeople(album), profile: fixedProfile(profileFixtures.noted), hoggies: fixedHoggies(hoggiesFixtures.midway) });
    await topBar();
    await act(async () => fireEvent.click(theEmojiButton()));
    expect(theRowOf(":team-quiet-harbour:"), "the first time, every earned emoji is new").toHaveTextContent("New");
    await act(async () => fireEvent.click(theEmojiButton()));

    const locked = album.emojis.find(({ earned }) => !earned)!;
    answer = { ...album, emojis: album.emojis.map((emoji) => (emoji.id === locked.id ? { ...emoji, earned: true, earnedAt: Date.now(), seen: true, progress: null } : emoji)) };
    await act(async () => listeners.forEach((listener) => listener()));
    await act(async () => fireEvent.click(theEmojiButton()));

    expect(theRowOf(`:${locked.name}:`)).toHaveTextContent("New");
    expect(theRowOf(":team-quiet-harbour:")).not.toHaveTextContent("New");

    await act(async () => fireEvent.click(theEmojiButton()));
    await act(async () => fireEvent.click(theEmojiButton()));
    expect(theRowOf(`:${locked.name}:`), "once opened before").not.toHaveTextContent("New");
  });

  it("marks New for another member's album that arrives while the popup is open, as what they never opened", async () => {
    const album = albumFixtures.midway;
    let answer = album;
    const listeners = new Set<() => void>();
    const read = (asking: boolean) => {
      const shown = useSyncExternalStore(
        (listener) => (listeners.add(listener), () => void listeners.delete(listener)),
        () => answer,
      );
      return asking ? shown : undefined;
    };
    window.history.replaceState(null, "", "/");
    renderAlbum(memberWithTheAlbum, read, { people: fixedPeople(album), profile: fixedProfile(profileFixtures.noted), hoggies: fixedHoggies(hoggiesFixtures.midway) });
    await topBar();
    await act(async () => fireEvent.click(theEmojiButton()));
    await act(async () => fireEvent.click(theEmojiButton()));
    await act(async () => fireEvent.click(theEmojiButton()));
    expect(theRowOf(":team-quiet-harbour:")).not.toHaveTextContent("New");

    answer = { ...album, me: { ...album.me, person: "another-member" } };
    await act(async () => listeners.forEach((listener) => listener()));

    expect(theRowOf(":team-quiet-harbour:"), "for the other member").toHaveTextContent("New");
  });

  it("reads what each member opened on their own, so another member's album in the same tab marks New until they open it", async () => {
    const album = albumFixtures.midway;
    let answer = album;
    const listeners = new Set<() => void>();
    const read = (asking: boolean) => {
      const shown = useSyncExternalStore(
        (listener) => (listeners.add(listener), () => void listeners.delete(listener)),
        () => answer,
      );
      return asking ? shown : undefined;
    };
    window.history.replaceState(null, "", "/");
    renderAlbum(memberWithTheAlbum, read, { people: fixedPeople(album), profile: fixedProfile(profileFixtures.noted), hoggies: fixedHoggies(hoggiesFixtures.midway) });
    await topBar();
    await act(async () => fireEvent.click(theEmojiButton()));
    await act(async () => fireEvent.click(theEmojiButton()));
    expect(theEmojiButton()).not.toHaveAccessibleDescription("New");

    answer = { ...album, me: { ...album.me, person: "another-member" } };
    await act(async () => listeners.forEach((listener) => listener()));

    expect(theEmojiButton(), "for the other member").toHaveAccessibleDescription("New");
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

describe("#708: the sidebar stays in view", () => {
  it("stays below the top bar at desktop widths and scrolls its own content, and on a phone gives way to a drawer that scrolls its own under the top bar", () => {
    expect(declarationsOf(".al-side")).toMatchObject({ position: "sticky", top: "var(--al-top-height)", height: "calc(100vh - var(--al-top-height))", "overflow-y": "auto" });
    expect(declarationsOf(".al-drawer")).toMatchObject({ position: "absolute", top: "calc(100% + 1px)", height: "calc(100dvh - 100% - 1px)", "overflow-y": "auto" });
  });

  it("no scroll box lets the hidden text it scrolls stretch the page past the album, so the sidebar never runs out of room to stick", () => {
    const albumCss = readdirSync(__dirname)
      .filter((file) => file.endsWith(".css"))
      .map((file) => readFileSync(join(__dirname, file), "utf8"))
      .join("\n");

    expect(atRulesIn(albumCss).filter((atRule) => !readAtRules.includes(atRule))).toEqual([]);
    expect(looseScrollBoxesIn(albumCss)).toEqual([]);
  });

  it("reads the stylesheets as a desktop browser does: the last position wins, a condition can only take a position away, rules only below 64rem are left out with the phone drawer, every at-rule is read, and each selector of a list counts", () => {
    const css = [
      ".a, .b { overflow: hidden auto }",
      ".a { position: relative }",
      ".b { position: sticky }",
      ".b { position: static }",
      "@media (min-width: 64rem) { .c { overflow-x: scroll; position: absolute } }",
      "@supports (display: grid) { .c { position: static } }",
      ".d { overflow: auto; position: static }",
      "@media (prefers-reduced-motion: reduce) { .d { position: relative } }",
      ".e { overflow-y: auto; position: relative }",
      "@media (prefers-reduced-motion: reduce) { .e { position: static } }",
      "@media (max-width: 63.999rem) { @keyframes fade { from { opacity: 0 } } .a { position: static } .f { overflow: auto } }",
      ".g, .h, .i { overflow: auto; position: relative }",
      "@media (min-width: 64rem) and (prefers-reduced-motion: reduce) { .g { position: static } }",
      "@media (max-width: 63.999rem), (min-width: 90rem) { .h { position: static } }",
      "@media (max-width: 47.99rem) { .i { position: static } }",
      ".j { overflow: auto; position: relative }",
      "@container (max-width: 13rem) { .j { position: static } }",
    ].join("\n");

    expect(looseScrollBoxesIn(css)).toEqual([".b", ".c", ".d", ".e", ".g", ".h", ".j"]);
    expect(atRulesIn(`${css}\n@layer later { .a { position: static } }\n/* @scope */`)).toEqual(["@media", "@supports", "@keyframes", "@container", "@layer"]);
  });
});

type DesktopRule = { selectors: string[]; style: CSSStyleDeclaration; conditional: boolean };

const everyDesktopWidth = "(min-width: 64rem)";
const readAtRules = ["@media", "@supports", "@container", "@keyframes"];

function atRulesIn(css: string) {
  return [...new Set(css.replace(/\/\*[\s\S]*?\*\//g, "").match(/@[\w-]+/g) ?? [])];
}

function looseScrollBoxesIn(css: string) {
  const rules = desktopRulesOf(css);
  const scrollBoxes = rules.filter(scrolls).flatMap(({ selectors }) => selectors);
  return [...new Set(scrollBoxes)].filter((selector) => !holdsWhatItScrolls(selector, rules));
}

function desktopRulesOf(css: string): DesktopRule[] {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  try {
    return rulesWithin(style.sheet!.cssRules, false);
  } finally {
    style.remove();
  }
}

function rulesWithin(rules: CSSRuleList, conditional: boolean): DesktopRule[] {
  return [...rules].flatMap((rule) => {
    if (rule instanceof CSSStyleRule) return [{ selectors: rule.selectorText.split(",").map((selector) => selector.trim()), style: rule.style, conditional }];
    if (rule instanceof CSSMediaRule) return onlyBelowDesktop(rule.media.mediaText) ? [] : rulesWithin(rule.cssRules, conditional || rule.media.mediaText !== everyDesktopWidth);
    if (rule instanceof CSSSupportsRule) return rulesWithin(rule.cssRules, conditional);
    if (rule instanceof CSSContainerRule) return rulesWithin(rule.cssRules, true);
    return [];
  });
}

function onlyBelowDesktop(mediaText: string) {
  const widest = /^\(max-width: ([\d.]+)rem\)$/.exec(mediaText)?.[1];
  return widest !== undefined && Number(widest) < 64;
}

function scrolls({ style }: DesktopRule) {
  return ["overflow", "overflow-x", "overflow-y"].some((property) => /\b(auto|scroll)\b/.test(style.getPropertyValue(property)));
}

function holdsWhatItScrolls(selector: string, rules: DesktopRule[]) {
  const positions = rules.filter(({ selectors, style }) => selectors.includes(selector) && style.position !== "");
  const always = positions.findLast(({ conditional }) => !conditional)?.style.position ?? "static";
  return always !== "static" && !positions.some(({ conditional, style }) => conditional && style.position === "static");
}

describe("LP76: Getting started follows the loop", () => {
  it("shows on the profile, the album's home, while unfinished, counting what's done and naming the next step with how to do it", async () => {
    visit("/");
    const strip = await screen.findByRole("region", { name: "Getting started" });

    expect(strip).toHaveTextContent("Getting started · 2 of 4");
    expect(strip).toHaveTextContent("Next: Turn an item · turn a waiting item on your board");
    expect(within(strip).getAllByRole("listitem").map((step) => step.getAttribute("aria-label"))).toEqual(["Give a hug: done", "Give a thoughtful kudos: done", "Turn an item: not yet", "Reach level 2: not yet"]);
  });

  it.each([
    ["nothing done", { hugged: false, thoughtful: false, turned: false, levelTwo: false }, "Next: Give a hug · react with 🦔 on any message in Slack"],
    ["a hug given", { hugged: true, thoughtful: false, turned: false, levelTwo: false }, "Next: Give a thoughtful kudos · thank a teammate with 🦔 in a message and say why"],
    ["only level 2 left", { hugged: true, thoughtful: true, turned: true, levelTwo: false }, "Next: Reach level 2 · your first kudos takes you there"],
    ["level 2 reached first", { hugged: false, thoughtful: false, turned: false, levelTwo: true }, "Next: Give a hug · react with 🦔 on any message in Slack"],
  ])("with %s, names the first step not done, with the workspace's kudos emoji in its hint", async (_, steps, next) => {
    visit("/", { ...albumFixtures.midway, gettingStarted: startedWith(steps) });

    expect(await screen.findByRole("region", { name: "Getting started" })).toHaveTextContent(next);
  });

  it("shows a custom kudos emoji as its picture", async () => {
    visit("/", { ...albumFixtures.midway, gettingStarted: { ...startedWith({ hugged: false, thoughtful: false, turned: false, levelTwo: false }), kudos: { kudosEmoji: "hoggo", kudosEmojiImage: "https://emoji.slack-edge.com/T1/hoggo/1.png" } } });

    expect(within(await screen.findByRole("region", { name: "Getting started" })).getByRole("img", { name: ":hoggo:" })).toHaveAttribute("src", "https://emoji.slack-edge.com/T1/hoggo/1.png");
  });

  it("is gone once all four are done", async () => {
    visit("/", albumFixtures.started);
    await screen.findByRole("navigation", { name: "Album" });
    expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();
  });

  it("is gone while getAlbum answers none, as with onboarding off", async () => {
    visit("/", { ...albumFixtures.midway, gettingStarted: null });
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
    const { user } = visit("/", { ...albumFixtures.midway, tray: albumFixtures.trayed.tray });
    const bar = await topBar();

    expect(bar.getByText("Level 6")).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "Open your packs, 2 waiting" })).toBeInTheDocument();
    expect(bar.getByRole("button", { name: /^Tray, \d+ to put in$/ })).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "Your emojis, 9 earned" })).toBeInTheDocument();
    expect(bar.queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();

    await user.click(bar.getByRole("button", { name: "Menu" }));
    const menu = within(screen.getByRole("region", { name: "Menu" }));
    expect(menu.getByRole("link", { name: "Activity" })).toHaveAttribute("href", "/activity");
    expect(menu.getByRole("link", { name: "Leaderboard" })).toHaveAttribute("href", "/leaderboard");
    expect(menu.getByRole("link", { name: "Your profile, Sam Example" })).toHaveAttribute("href", "/book#me");
    expect(menu.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");

    const burger = bar.getByRole("button", { name: "Teams and pages" });
    expect(burger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("searchbox", { name: "Search teams and people" })).not.toBeInTheDocument();
    await user.click(burger);
    expect(burger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("searchbox", { name: "Search teams and people" })).toBeInTheDocument();
  });

  it("#157: holds Teams and pages behind a burger at the bar's far left, before the brand, with nothing under the bar", async () => {
    aWideScreenThatNarrows().narrow();
    visit("/");
    const [bar] = await screen.findAllByRole("banner");
    const burger = within(bar!).getByRole("button", { name: "Teams and pages" });

    expect(bar!.querySelector("a[href], button")).toBe(burger);
    expect(screen.getAllByRole("button", { name: "Teams and pages" })).toEqual([burger]);
    expect(screen.queryByRole("navigation", { name: "Album" })).not.toBeInTheDocument();
  });

  it("#157: the burger opens the drawer with the sidebar's teams and pages, moves focus into it, and closes it again", async () => {
    aWideScreenThatNarrows().narrow();
    const { user } = visit("/");
    const burger = (await topBar()).getByRole("button", { name: "Teams and pages" });

    await user.click(burger);

    const drawer = screen.getByRole("navigation", { name: "Album" });
    expect(burger).toHaveAttribute("aria-expanded", "true");
    expect(burger).toHaveAttribute("aria-controls", drawer.id);
    expect(drawer).toHaveFocus();
    expect(within(drawer).getByRole("searchbox", { name: "Search teams and people" })).toBeInTheDocument();
    expect(within(drawer).getByRole("list", { name: "Teams" })).toBeInTheDocument();
    expect(within(drawer).getByRole("list", { name: "More of your album" })).toBeInTheDocument();

    await user.click(burger);

    expect(burger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Album" })).not.toBeInTheDocument();
    expect(burger).toHaveFocus();
  });

  it("#157: Escape and a tap on the backdrop close the drawer, giving focus back to the burger", async () => {
    aWideScreenThatNarrows().narrow();
    const { user } = visit("/");
    const burger = (await topBar()).getByRole("button", { name: "Teams and pages" });

    await user.click(burger);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("navigation", { name: "Album" })).not.toBeInTheDocument();
    expect(burger).toHaveFocus();

    await user.click(burger);
    await user.click(document.querySelector(".al-drawer-backdrop")!);

    expect(screen.queryByRole("navigation", { name: "Album" })).not.toBeInTheDocument();
    expect(burger).toHaveAttribute("aria-expanded", "false");
    expect(burger).toHaveFocus();
  });

  it("#157: the burger closes the drawer onto itself even when tapping it gave it no focus, as in Safari", async () => {
    aWideScreenThatNarrows().narrow();
    const { user } = visit("/");
    const burger = (await topBar()).getByRole("button", { name: "Teams and pages" });
    await user.click(burger);
    screen.getByRole("searchbox", { name: "Search teams and people" }).focus();

    fireEvent.click(burger);

    expect(screen.queryByRole("navigation", { name: "Album" })).not.toBeInTheDocument();
    expect(burger).toHaveFocus();
  });

  it("#157: tabbing past the drawer's last entry closes it, so focus never lands on the page under it", async () => {
    aWideScreenThatNarrows().narrow();
    const { user } = visit("/");
    const bar = await topBar();
    await user.click(bar.getByRole("button", { name: "Teams and pages" }));
    within(screen.getByRole("navigation", { name: "Album" })).getByRole("link", { name: /^Milestones/ }).focus();

    await user.tab();

    expect(screen.queryByRole("navigation", { name: "Album" })).not.toBeInTheDocument();
    expect(bar.getByRole("link", { name: "HedgeHug" })).toHaveFocus();
  });

  it("#157: the drawer and the menu take turns, one open at a time", async () => {
    aWideScreenThatNarrows().narrow();
    const { user } = visit("/");
    const bar = await topBar();

    await user.click(bar.getByRole("button", { name: "Menu" }));
    await user.click(bar.getByRole("button", { name: "Teams and pages" }));

    expect(screen.queryByRole("region", { name: "Menu" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Album" })).toBeInTheDocument();

    await user.click(bar.getByRole("button", { name: "Menu" }));

    expect(screen.getByRole("region", { name: "Menu" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Album" })).not.toBeInTheDocument();
  });

  it("#157: a wide screen keeps the sidebar beside the page and holds no burger", async () => {
    visit("/");

    expect(await sidebar()).toBeTruthy();
    expect((await topBar()).queryByRole("button", { name: "Teams and pages" })).not.toBeInTheDocument();
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
