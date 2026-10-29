import { act, screen, waitFor } from "@testing-library/react";
import type { GenericValidator } from "convex/values";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pageValidator } from "../../../convex/website/link";
import { routeList, signInEntry, urlOf, type Page } from "../../../convex/website/routes";
import { visitSourceParam } from "../../../convex/website/visitSource";
import { activityHref } from "../route";
import { bookHref, categories } from "../book/categories";
import { rarestFirst, spreadHrefOf, type Spread } from "../book/spread/spreads";
import { pagePropertiesOf } from "../browserAnalytics/pageviews";
import type { Rarity } from "../crates/drops";
import { fixedSettings, settingsFixtures } from "../settingsFixtures";
import { shellFixtures } from "../shell";
import { renderAlbum, renderApp } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum, fixedPeople } from "./albumFixtures";
import { boardsFixtures, fixedBoards } from "./boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";
import { levelUpFixtures } from "./levelUpFixtures";
import { fixedProfile, profileFixtures } from "./profileFixtures";
import { fixtureWeeks } from "./weekFixtures";

const memberWithTheAlbum = shellFixtures.member;

const site = "https://kudos-site.test";

type Landing = { address: string; title: string; rarity?: Rarity };

const home: Landing = { address: "/book#me", title: "Sam Example" };
const milestones: Landing = { address: "/book#milestones", title: "Milestones" };
const hoggies: Landing = { address: "/book#hoggies", title: "Hoggies" };
const leaderboard: Landing = { address: "/leaderboard", title: "Who said thanks" };
const activity: Landing = { address: "/activity", title: "Weekly edition" };
const settings: Landing = { address: "/settings", title: "Settings" };

beforeAll(async () => {
  await import("./AlbumApp");
});

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

function visit(address: string) {
  window.history.replaceState(null, "", address);
  return renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { settings: fixedSettings(settingsFixtures.everything), boards: fixedBoards(boardsFixtures.week), weeks: fixtureWeeks(), people: fixedPeople(albumFixtures.midway), profile: fixedProfile(profileFixtures.noted), hoggies: fixedHoggies(hoggiesFixtures.midway), levelUp: (level) => (level === null ? undefined : { ...levelUpFixtures.levelSeven, level }) });
}

function addressNow() {
  return window.location.pathname + window.location.search + window.location.hash;
}

async function expectToLand(landing: Landing) {
  expect(await screen.findByRole("heading", { level: 1, name: landing.title })).toBeInTheDocument();
  await waitFor(() => expect(addressNow()).toBe(landing.address));
  if (landing.rarity !== undefined) expect(screen.getByText(`Showing ${landing.rarity} hoggies.`)).toBeInTheDocument();
}

function samplesOf(validator: GenericValidator): unknown[] {
  const values = requiredSamplesOf(validator);
  return validator.isOptional === "optional" ? [undefined, ...values] : values;
}

function requiredSamplesOf(validator: GenericValidator): unknown[] {
  switch (validator.kind) {
    case "literal":
      return [validator.value];
    case "union":
      return validator.members.flatMap(requiredSamplesOf);
    case "object":
      return objectsOf(validator.fields);
    case "string":
      return ["2026-10-05"];
    case "float64":
      return [2];
    default:
      throw new Error(`No samples for a ${validator.kind} validator`);
  }
}

function objectsOf(fields: Record<string, GenericValidator>): Record<string, unknown>[] {
  const first = Object.fromEntries(Object.entries(fields).map(([field, validator]) => [field, samplesOf(validator)[0]]));
  const varied = Object.entries(fields).flatMap(([field, validator]) => samplesOf(validator).slice(1).map((value) => ({ ...first, [field]: value })));
  return [first, ...varied].map(withoutUndefinedFields);
}

function withoutUndefinedFields(object: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function albumPageFor(page: Page): Landing {
  switch (page.page) {
    case "home":
      return home;
    case "leaderboard":
      return leaderboard;
    case "quests":
    case "skillTree":
    case "book":
      return home;
    case "bookEarned":
      return milestones;
    case "bookCollection":
      return hoggies;
    case "settings":
      return page.section === undefined ? settings : { ...settings, address: `/settings?section=${page.section}` };
    case "levelUp":
      return { address: `/book#level-up/${page.level}`, title: `Level ${page.level}` };
  }
}

const doors = [site, `${site}${signInEntry}`];

const linksSlackAlreadySent: [string, Landing][] = [
  ["/", home],
  ["/sign-in/", home],
  ["/?panel=inventory", home],
  ["/sign-in/?panel=inventory", home],
  ["/?crate=quests", home],
  ["/sign-in/?crate=quests", home],
  ["/?crate=leaderboard", home],
  ["/sign-in/?crate=leaderboard", home],
  ["/?crate=book", home],
  ["/sign-in/?crate=book", home],
  ["/?crate=skillTree", home],
  ["/sign-in/?crate=skillTree", home],
  ["/?crate=coins", home],
  ["/sign-in/?crate=coins", home],
  ["/?crate=journey", home],
  ["/sign-in/?crate=journey", home],
  ["/?crate=group", home],
  ["/sign-in/?crate=group", home],
  ["/?crate=store", home],
  ["/sign-in/?crate=store", home],
  ["/?crate=weekly%3A2026-10-05%3A2", home],
  ["/sign-in/?crate=weekly%3A2026-10-05%3A2", home],
  ["/?crate=group%3A2026-10-05", home],
  ["/sign-in/?crate=group%3A2026-10-05", home],
  ["/?crate=bought%3A2", home],
  ["/sign-in/?crate=bought%3A2", home],
  ["/leaderboard", leaderboard],
  ["/sign-in/leaderboard", leaderboard],
  ["/leaderboard?period=month", leaderboard],
  ["/sign-in/leaderboard?period=month", leaderboard],
  ["/leaderboard?period=all", leaderboard],
  ["/sign-in/leaderboard?period=all", leaderboard],
  ["/leaderboard?crate=quests", leaderboard],
  ["/sign-in/leaderboard?crate=quests", leaderboard],
  ["/leaderboard?crate=leaderboard", leaderboard],
  ["/sign-in/leaderboard?crate=leaderboard", leaderboard],
  ["/leaderboard?crate=book", leaderboard],
  ["/sign-in/leaderboard?crate=book", leaderboard],
  ["/leaderboard?crate=skillTree", leaderboard],
  ["/sign-in/leaderboard?crate=skillTree", leaderboard],
  ["/leaderboard?crate=coins", leaderboard],
  ["/sign-in/leaderboard?crate=coins", leaderboard],
  ["/leaderboard?crate=journey", leaderboard],
  ["/sign-in/leaderboard?crate=journey", leaderboard],
  ["/leaderboard?crate=group", leaderboard],
  ["/sign-in/leaderboard?crate=group", leaderboard],
  ["/leaderboard?crate=store", leaderboard],
  ["/sign-in/leaderboard?crate=store", leaderboard],
  ["/leaderboard?crate=weekly%3A2026-10-05%3A2", leaderboard],
  ["/sign-in/leaderboard?crate=weekly%3A2026-10-05%3A2", leaderboard],
  ["/leaderboard?crate=group%3A2026-10-05", leaderboard],
  ["/sign-in/leaderboard?crate=group%3A2026-10-05", leaderboard],
  ["/leaderboard?crate=bought%3A2", leaderboard],
  ["/sign-in/leaderboard?crate=bought%3A2", leaderboard],
  ["/quests", home],
  ["/sign-in/quests", home],
  ["/quests?quest=2", home],
  ["/sign-in/quests?quest=2", home],
  ["/quests?crate=quests", home],
  ["/sign-in/quests?crate=quests", home],
  ["/quests?crate=leaderboard", home],
  ["/sign-in/quests?crate=leaderboard", home],
  ["/quests?crate=book", home],
  ["/sign-in/quests?crate=book", home],
  ["/quests?crate=skillTree", home],
  ["/sign-in/quests?crate=skillTree", home],
  ["/quests?crate=coins", home],
  ["/sign-in/quests?crate=coins", home],
  ["/quests?crate=journey", home],
  ["/sign-in/quests?crate=journey", home],
  ["/quests?crate=group", home],
  ["/sign-in/quests?crate=group", home],
  ["/quests?crate=store", home],
  ["/sign-in/quests?crate=store", home],
  ["/quests?crate=weekly%3A2026-10-05%3A2", home],
  ["/sign-in/quests?crate=weekly%3A2026-10-05%3A2", home],
  ["/quests?crate=group%3A2026-10-05", home],
  ["/sign-in/quests?crate=group%3A2026-10-05", home],
  ["/quests?crate=bought%3A2", home],
  ["/sign-in/quests?crate=bought%3A2", home],
  ["/skills", home],
  ["/sign-in/skills", home],
  ["/skills?perk=spark", home],
  ["/sign-in/skills?perk=spark", home],
  ["/skills?perk=rhythm", home],
  ["/sign-in/skills?perk=rhythm", home],
  ["/skills?perk=circle", home],
  ["/sign-in/skills?perk=circle", home],
  ["/skills?perk=flame", home],
  ["/sign-in/skills?perk=flame", home],
  ["/skills?perk=cadence", home],
  ["/sign-in/skills?perk=cadence", home],
  ["/skills?perk=bridge", home],
  ["/sign-in/skills?perk=bridge", home],
  ["/skills?perk=treasurer", home],
  ["/sign-in/skills?perk=treasurer", home],
  ["/skills?perk=banker", home],
  ["/sign-in/skills?perk=banker", home],
  ["/skills?crate=quests", home],
  ["/sign-in/skills?crate=quests", home],
  ["/skills?crate=leaderboard", home],
  ["/sign-in/skills?crate=leaderboard", home],
  ["/skills?crate=book", home],
  ["/sign-in/skills?crate=book", home],
  ["/skills?crate=skillTree", home],
  ["/sign-in/skills?crate=skillTree", home],
  ["/skills?crate=coins", home],
  ["/sign-in/skills?crate=coins", home],
  ["/skills?crate=journey", home],
  ["/sign-in/skills?crate=journey", home],
  ["/skills?crate=group", home],
  ["/sign-in/skills?crate=group", home],
  ["/skills?crate=store", home],
  ["/sign-in/skills?crate=store", home],
  ["/skills?crate=weekly%3A2026-10-05%3A2", home],
  ["/sign-in/skills?crate=weekly%3A2026-10-05%3A2", home],
  ["/skills?crate=group%3A2026-10-05", home],
  ["/sign-in/skills?crate=group%3A2026-10-05", home],
  ["/skills?crate=bought%3A2", home],
  ["/sign-in/skills?crate=bought%3A2", home],
  ["/book", home],
  ["/sign-in/book", home],
  ["/book?crate=quests", home],
  ["/sign-in/book?crate=quests", home],
  ["/book?crate=leaderboard", home],
  ["/sign-in/book?crate=leaderboard", home],
  ["/book?crate=book", home],
  ["/sign-in/book?crate=book", home],
  ["/book?crate=skillTree", home],
  ["/sign-in/book?crate=skillTree", home],
  ["/book?crate=coins", home],
  ["/sign-in/book?crate=coins", home],
  ["/book?crate=journey", home],
  ["/sign-in/book?crate=journey", home],
  ["/book?crate=group", home],
  ["/sign-in/book?crate=group", home],
  ["/book?crate=store", home],
  ["/sign-in/book?crate=store", home],
  ["/book?crate=weekly%3A2026-10-05%3A2", home],
  ["/sign-in/book?crate=weekly%3A2026-10-05%3A2", home],
  ["/book?crate=group%3A2026-10-05", home],
  ["/sign-in/book?crate=group%3A2026-10-05", home],
  ["/book?crate=bought%3A2", home],
  ["/sign-in/book?crate=bought%3A2", home],
  ["/book/earned", milestones],
  ["/sign-in/book/earned", milestones],
  ["/book/earned?crate=quests", milestones],
  ["/sign-in/book/earned?crate=quests", milestones],
  ["/book/earned?crate=leaderboard", milestones],
  ["/sign-in/book/earned?crate=leaderboard", milestones],
  ["/book/earned?crate=book", milestones],
  ["/sign-in/book/earned?crate=book", milestones],
  ["/book/earned?crate=skillTree", milestones],
  ["/sign-in/book/earned?crate=skillTree", milestones],
  ["/book/earned?crate=coins", milestones],
  ["/sign-in/book/earned?crate=coins", milestones],
  ["/book/earned?crate=journey", milestones],
  ["/sign-in/book/earned?crate=journey", milestones],
  ["/book/earned?crate=group", milestones],
  ["/sign-in/book/earned?crate=group", milestones],
  ["/book/earned?crate=store", milestones],
  ["/sign-in/book/earned?crate=store", milestones],
  ["/book/earned?crate=weekly%3A2026-10-05%3A2", milestones],
  ["/sign-in/book/earned?crate=weekly%3A2026-10-05%3A2", milestones],
  ["/book/earned?crate=group%3A2026-10-05", milestones],
  ["/sign-in/book/earned?crate=group%3A2026-10-05", milestones],
  ["/book/earned?crate=bought%3A2", milestones],
  ["/sign-in/book/earned?crate=bought%3A2", milestones],
  ["/book/collection", hoggies],
  ["/sign-in/book/collection", hoggies],
  ["/book/collection?crate=quests", hoggies],
  ["/sign-in/book/collection?crate=quests", hoggies],
  ["/book/collection?crate=leaderboard", hoggies],
  ["/sign-in/book/collection?crate=leaderboard", hoggies],
  ["/book/collection?crate=book", hoggies],
  ["/sign-in/book/collection?crate=book", hoggies],
  ["/book/collection?crate=skillTree", hoggies],
  ["/sign-in/book/collection?crate=skillTree", hoggies],
  ["/book/collection?crate=coins", hoggies],
  ["/sign-in/book/collection?crate=coins", hoggies],
  ["/book/collection?crate=journey", hoggies],
  ["/sign-in/book/collection?crate=journey", hoggies],
  ["/book/collection?crate=group", hoggies],
  ["/sign-in/book/collection?crate=group", hoggies],
  ["/book/collection?crate=store", hoggies],
  ["/sign-in/book/collection?crate=store", hoggies],
  ["/book/collection?crate=weekly%3A2026-10-05%3A2", hoggies],
  ["/sign-in/book/collection?crate=weekly%3A2026-10-05%3A2", hoggies],
  ["/book/collection?crate=group%3A2026-10-05", hoggies],
  ["/sign-in/book/collection?crate=group%3A2026-10-05", hoggies],
  ["/book/collection?crate=bought%3A2", hoggies],
  ["/sign-in/book/collection?crate=bought%3A2", hoggies],
  ["/settings", settings],
  ["/sign-in/settings", settings],
  ["/settings?section=visibility", { ...settings, address: "/settings?section=visibility" }],
  ["/sign-in/settings?section=visibility", { ...settings, address: "/settings?section=visibility" }],
  ["/settings?section=messages", { ...settings, address: "/settings?section=messages" }],
  ["/sign-in/settings?section=messages", { ...settings, address: "/settings?section=messages" }],
  ["/settings?section=group", { ...settings, address: "/settings?section=group" }],
  ["/sign-in/settings?section=group", { ...settings, address: "/settings?section=group" }],
  ["/settings?section=company-profile", { ...settings, address: "/settings?section=company-profile" }],
  ["/sign-in/settings?section=company-profile", { ...settings, address: "/settings?section=company-profile" }],
  ["/settings?section=admin", { ...settings, address: "/settings?section=admin" }],
  ["/sign-in/settings?section=admin", { ...settings, address: "/settings?section=admin" }],
  ["/settings?section=workspace", { ...settings, address: "/settings?section=workspace" }],
  ["/sign-in/settings?section=workspace", { ...settings, address: "/settings?section=workspace" }],
];

const linksBuiltNow = [
  ...new Map(
    (samplesOf(pageValidator) as Page[]).flatMap((page) => doors.map((door) => [linkBuiltFor(door, page), albumPageFor(page)] as const)),
  ).entries(),
];

function linkBuiltFor(door: string, page: Page) {
  const link = new URL(urlOf(door, page, "reply"));
  link.searchParams.delete(visitSourceParam);
  return link.toString().slice(site.length);
}

function withoutTheDoor(link: string) {
  return link.startsWith(signInEntry) ? link.slice(signInEntry.length) : link;
}

function albumAddressFor(landing: Landing) {
  return landing === home ? "/" : landing.address;
}

const listedPaths: Record<string, Landing> = {
  "/": home,
  "/leaderboard": leaderboard,
  "/quests": home,
  "/skills": home,
  "/book": home,
  "/book/earned": milestones,
  "/book/collection": hoggies,
  "/activity": activity,
  "/settings": settings,
};

const everySpread: Spread[] = [
  { kind: "cover" },
  ...rarestFirst.map((rarity) => ({ kind: "hoggies", rarity }) as const),
  { kind: "teams" },
  { kind: "team", team: "paper-moons" },
  { kind: "team", team: "group:S0123456789" },
  { kind: "achievements", category: "all" },
  ...categories.map(({ id }) => ({ kind: "achievements", category: id }) as const),
];

function albumPageForSpread(spread: Spread): Landing {
  switch (spread.kind) {
    case "cover":
    case "teams":
      return home;
    case "hoggies":
      return { ...hoggies, rarity: spread.rarity };
    case "team":
      return spread.team === "paper-moons" ? { address: "/book#teams/paper-moons", title: "Paper Moons" } : home;
    case "achievements":
      return milestones;
  }
}

describe("AL44: every URL Slack sends lands in the album", () => {
  it("the landing table lists every path on the route list", () => {
    expect(Object.keys(listedPaths).sort()).toEqual([...routeList].sort());
  });

  it("a landing replaces the old address, adding no history entry", async () => {
    window.history.replaceState(null, "", "/");
    const entries = window.history.length;
    visit("/quests?quest=2");

    await expectToLand(home);
    expect(window.history.length).toBe(entries);
  });

  it("a landing keeps the one-time sign-in code until Convex Auth has redeemed it", async () => {
    visit("/sign-in/quests?quest=2&code=one-time");
    await expectToLand({ ...home, address: "/book?code=one-time#me" });
  });

  it.each(linksSlackAlreadySent)("%s", async (link, landing) => {
    visit(link);
    await expectToLand(landing);
  });

  it.each(Object.entries(listedPaths).flatMap(([path, landing]) => [path, `${signInEntry}${path === "/" ? "" : path}`].map((link) => [link, landing] as const)))("%s", async (link, landing) => {
    visit(link);
    await expectToLand(landing);
  });

  it.each(["received", "given"] as const)("/activity?filter=%s", async (filter) => {
    visit(activityHref(filter));
    await expectToLand(activity);
  });

  it.each(categories.map(({ id }) => bookHref(id)))("%s", async (link) => {
    visit(link);
    await expectToLand(milestones);
  });

  it.each(everySpread.map((spread) => [spreadHrefOf(spread), albumPageForSpread(spread)] as const))("%s", async (link, landing) => {
    visit(link);
    await expectToLand(landing);
  });

  it.each([
    ["/book/collection#hoggies/epic", { ...hoggies, rarity: "epic" }],
    ["/book/collection?crate=store#teams/paper-moons", { address: "/book#teams/paper-moons", title: "Paper Moons" }],
    ["/book?page=giving#achievements/crowd", milestones],
    ["/sign-in/book#achievements/crowd", milestones],
    ["/book/collection#teams/group:S0123456789", home],
  ] as const)("%s", async (link, landing) => {
    visit(link);
    await expectToLand(landing);
  });
});

describe("AL44: how a landing changes the address", () => {
  it("keeps the album's own addresses as they are", async () => {
    visit("/book#people/ines-okafor");
    expect(await screen.findByRole("heading", { level: 1, name: "Ines Okafor" })).toBeInTheDocument();
    expect(addressNow()).toBe("/book#people/ines-okafor");
  });

  it("lands an old address the member goes Back to", async () => {
    visit("/book#milestones");
    await expectToLand(milestones);
    act(() => {
      window.history.pushState(null, "", "/book/collection#hoggies/rare");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await expectToLand({ ...hoggies, rarity: "rare" });
  });

  it("a rarity filter stays with its history entry, and the Hoggies link opens the page unfiltered", async () => {
    const { user } = visit("/book#hoggies/legendary");
    await expectToLand({ ...hoggies, rarity: "legendary" });

    await user.click(screen.getByRole("link", { name: /^Hoggies/ }));

    await waitFor(() => expect(screen.queryByText("Showing legendary hoggies.")).not.toBeInTheDocument());
    act(() => window.history.back());
    expect(await screen.findByText("Showing legendary hoggies.")).toBeInTheDocument();
  });

  it("?section= lands on its heading once the album has arrived, when Settings answered first", async () => {
    window.history.replaceState(null, "", "/sign-in/settings?section=messages");
    let albumArrived = false;
    const { showVisitor } = renderAlbum(memberWithTheAlbum, (asking) => (asking && albumArrived ? albumFixtures.midway : undefined), { settings: fixedSettings(settingsFixtures.everything) });
    await screen.findByRole("main");

    albumArrived = true;
    showVisitor({ ...memberWithTheAlbum });

    expect(await screen.findByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    await waitFor(() => expect(addressNow()).toBe("/settings?section=messages"));
    await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: "Messages" })).toHaveFocus());
  });

  it("?section= lands on that settings section's heading, as it does today", async () => {
    visit("/sign-in/settings?section=messages");
    await expectToLand({ ...settings, address: "/settings?section=messages" });
    await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: "Messages" })).toHaveFocus());
  });
});

describe("AL67: every link the backend builds is the album address it lands on", () => {
  it.each(linksBuiltNow)("%s", async (link, landing) => {
    expect(withoutTheDoor(link)).toBe(albumAddressFor(landing));
    visit(link);
    await expectToLand(landing);
  });

  it("a sign-in link to a Book page keeps its hash and the one-time code Convex Auth adds", async () => {
    const link = urlOf(`${site}${signInEntry}`, { page: "bookEarned" }, "reply").slice(site.length);
    const withTheCode = new URL(link, site);
    withTheCode.searchParams.set("code", "one-time");

    visit(withTheCode.pathname + withTheCode.search + withTheCode.hash);

    await expectToLand({ ...milestones, address: "/book?code=one-time#milestones" });
  });
});

describe("MS22: the pageview seam reads each landing as the album page it shows", () => {
  it.each([
    ["/book/earned", { page: "book", book_page: "overview", spread: "milestones" }],
    ["/?panel=inventory", { page: "book", book_page: "overview", spread: "me" }],
    ["/book/collection?crate=bought%3A2", { page: "book", book_page: "overview", spread: "hoggies" }],
    ["/sign-in/skills?perk=spark", { page: "book", book_page: "overview", spread: "me" }],
    ["/leaderboard?period=month&crate=leaderboard", { page: "leaderboard" }],
  ])("%s", async (link, properties) => {
    visit(link);
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(pagePropertiesOf(window.location)).toEqual(properties));
  });
});

describe("AL67: while getAlbum answers off, nothing lands anywhere new", () => {
  it.each(["/quests?quest=2", "/book/earned", "/sign-in/leaderboard?period=month", "/book#cover"])("%s keeps its address", async (link) => {
    window.history.replaceState(null, "", link);
    renderApp(shellFixtures.member);

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(addressNow()).toBe(link.replace(signInEntry, ""));
  });
});
