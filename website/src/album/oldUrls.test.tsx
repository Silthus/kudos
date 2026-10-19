import { act, screen, waitFor } from "@testing-library/react";
import type { GenericValidator } from "convex/values";
import { beforeEach, describe, expect, it } from "vitest";
import { pageValidator } from "../../../convex/website/link";
import { routeList, signInEntry, urlOf, type Page } from "../../../convex/website/routes";
import { activityHref } from "../route";
import { bookHref, categories } from "../book/categories";
import { rarestFirst, spreadHrefOf, type Spread } from "../book/spread/spreads";
import { groupSlugOf } from "../book/spread/teamPages";
import { pagePropertiesOf } from "../browserAnalytics/pageviews";
import type { Rarity } from "../crates/drops";
import { fixedSettings, settingsFixtures } from "../settingsFixtures";
import { shellFixtures, type MemberProfile } from "../shell";
import { renderAlbum, renderApp } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum } from "./albumFixtures";
import { boardsFixtures, fixedBoards } from "./boardsFixtures";
import { fixtureWeeks } from "./weekFixtures";

const memberWithTheAlbum: MemberProfile = { ...shellFixtures.memberWithEveryFeatureOpen, album: true };

const site = "https://kudos-site.test";

type Landing = { address: string; title: string; rarity?: Rarity };

const home: Landing = { address: "/", title: "Lanterns" };
const profile: Landing = { address: "/book#me", title: "Sam Example" };
const milestones: Landing = { address: "/book#milestones", title: "Milestones" };
const hoggies: Landing = { address: "/book#hoggies", title: "Hoggies" };
const leaderboard: Landing = { address: "/leaderboard", title: "Who said thanks, and why" };
const activity: Landing = { address: "/activity", title: "Weekly edition" };
const settings: Landing = { address: "/settings", title: "Settings" };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

function visit(address: string) {
  window.history.replaceState(null, "", address);
  return renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { settings: fixedSettings(settingsFixtures.everything), boards: fixedBoards(boardsFixtures.week), weeks: fixtureWeeks() });
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
      return page.panel === "inventory" ? profile : home;
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
  }
}

const doors = [site, `${site}${signInEntry}`];

const slackLinks = [
  ...new Map(
    (samplesOf(pageValidator) as Page[]).flatMap((page) => doors.map((door) => [urlOf(door, page).slice(site.length), albumPageFor(page)] as const)),
  ).entries(),
];

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
  { kind: "team", team: groupSlugOf("S0123456789") },
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
    await expectToLand({ ...home, address: "/?code=one-time" });
  });

  it.each(slackLinks)("%s", async (link, landing) => {
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
    await waitFor(() => expect(addressNow()).toBe("/settings?section=messages"));

    albumArrived = true;
    showVisitor({ ...memberWithTheAlbum });

    expect(await screen.findByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: "Messages" })).toHaveFocus());
  });

  it("?section= lands on that settings section's heading, as it does today", async () => {
    visit("/sign-in/settings?section=messages");
    await expectToLand({ ...settings, address: "/settings?section=messages" });
    await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: "Messages" })).toHaveFocus());
  });
});

describe("MS22: the pageview seam reads each landing as the album page it shows", () => {
  it.each([
    ["/book/earned", { page: "book", book_page: "overview", spread: "milestones" }],
    ["/?panel=inventory", { page: "book", book_page: "overview", spread: "me" }],
    ["/book/collection?crate=bought%3A2", { page: "book", book_page: "overview", spread: "hoggies" }],
    ["/sign-in/skills?perk=spark", { page: "home" }],
    ["/leaderboard?period=month&crate=leaderboard", { page: "leaderboard" }],
  ])("%s", async (link, properties) => {
    visit(link);
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(pagePropertiesOf(window.location)).toEqual(properties));
  });
});

describe("AL39: without the album nothing lands anywhere new", () => {
  it.each(["/quests?quest=2", "/book/earned", "/sign-in/leaderboard?period=month", "/book#cover"])("%s keeps its address", async (link) => {
    window.history.replaceState(null, "", link);
    renderApp(shellFixtures.memberWithEveryFeatureOpen);

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(addressNow()).toBe(link.replace(signInEntry, ""));
  });
});
