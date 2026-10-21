import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum, fixedPeople } from "./albumFixtures";
import type { Album, AlbumPerson, BoardPeriod } from "./answer";
import { boardsByPeriod, boardsFixtures } from "./boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";
import { levelUpFixtures } from "./levelUpFixtures";
import { fixedProfile, profileFixtures } from "./profileFixtures";
import { fixedSettings, settingsFixtures } from "../settingsFixtures";
import { fixtureWeeks } from "./weekFixtures";

const myPage = "/book#people/sam-example";

const withShareableUrls: Album = { ...albumFixtures.midway, shareableUrls: true };

type Landing = { address: string; title: string };

beforeAll(async () => {
  await import("./AlbumApp");
});

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

function visit(address: string, album: Album = withShareableUrls) {
  window.history.replaceState(null, "", address);
  const boards: BoardPeriod[] = [];
  const view = renderAlbum(shellFixtures.member, fixedAlbum(album), {
    settings: fixedSettings(settingsFixtures.everything),
    boards: boardsByPeriod({ week: boardsFixtures.week, "last-week": boardsFixtures.lastWeek, month: boardsFixtures.twoTeams, all: boardsFixtures.hidden }, boards),
    weeks: fixtureWeeks(),
    people: fixedPeople(withMeListed(album)),
    profile: fixedProfile(profileFixtures.noted),
    hoggies: fixedHoggies(hoggiesFixtures.midway),
    levelUp: (level) => (level === null ? undefined : { ...levelUpFixtures.levelSeven, level }),
  });
  return { ...view, boardsAsked: boards };
}

function withMeListed(album: Album): Album {
  const me: AlbumPerson = { person: album.me.person, name: album.me.name, face: album.me.face, teams: [], held: true, packedThisWeek: false };
  return { ...album, people: [...album.people, me] };
}

function addressNow() {
  return window.location.pathname + window.location.search + window.location.hash;
}

async function expectToLand({ address, title }: Landing) {
  expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
  await waitFor(() => expect(addressNow()).toBe(address));
}

async function expectMyOwnPage() {
  await expectToLand({ address: myPage, title: "Sam Example" });
  expect(screen.getByText("Your page")).toBeInTheDocument();
}

describe("every album place has one shareable address", () => {
  describe("a signed-in member's root is their own page's shareable URL", () => {
    it.each(["/", "/sign-in", "/sign-in/", "/book", "/book#me", "/quests?quest=2", "/skills?perk=spark", "/book#cover", "/book/collection#teams/group:S0123456789"])("%s lands on the member's own page at its person URL", async (link) => {
      visit(link);
      await expectMyOwnPage();
    });

    it("the person URL anyone opens for the member shows the member their own page, not the page others see", async () => {
      visit(myPage);
      await expectMyOwnPage();
      expect(screen.queryByText("You")).not.toBeInTheDocument();
    });

    it("the root keeps the one-time sign-in code until Convex Auth has redeemed it", async () => {
      visit("/sign-in/?code=one-time");
      await expectToLand({ address: "/book?code=one-time#people/sam-example", title: "Sam Example" });
    });

    it("the brand and the member's face link to the member's own page URL", async () => {
      visit("/leaderboard");
      await expectToLand({ address: "/leaderboard", title: "Who said thanks, and why" });

      expect(screen.getByRole("link", { name: "HedgeHug" })).toHaveAttribute("href", myPage);
      expect(screen.getByRole("link", { name: "Your profile, Sam Example" })).toHaveAttribute("href", myPage);
    });

    it("following the member's face opens their own page at its URL", async () => {
      const { user } = visit("/book#teams/lanterns");
      await expectToLand({ address: "/book#teams/lanterns", title: "Lanterns" });

      await user.click(screen.getByRole("link", { name: "Your profile, Sam Example" }));

      await expectMyOwnPage();
    });
  });

  describe("every album place reopens from its URL in a fresh browser", () => {
    it.each<[string, string]>([
      ["/book#people/ines-okafor", "Ines Okafor"],
      ["/book#teams/paper-moons", "Paper Moons"],
      ["/book#hoggies", "Hoggies"],
      ["/book#milestones", "Milestones"],
      ["/book#level-up/7", "Level 7"],
      ["/leaderboard", "Who said thanks, and why"],
      ["/leaderboard?period=last-week", "Who said thanks, and why"],
      ["/leaderboard?period=month", "Who said thanks, and why"],
      ["/leaderboard?period=all", "Who said thanks, and why"],
      ["/activity", "Weekly edition"],
      ["/activity?week=2026-09-28", "Weekly edition"],
      ["/settings", "Settings"],
      ["/settings?section=messages", "Settings"],
    ])("%s", async (address, title) => {
      visit(address);
      await expectToLand({ address, title });
    });

    it("a period in the URL opens the Leaderboard on that period", async () => {
      const { boardsAsked } = visit("/leaderboard?period=month");
      await expectToLand({ address: "/leaderboard?period=month", title: "Who said thanks, and why" });

      expect(within(screen.getByRole("group", { name: "Period" })).getByRole("button", { name: "This month" })).toHaveAttribute("aria-pressed", "true");
      expect(boardsAsked).not.toContain("week");
    });

    it("choosing a period puts it in the URL without a history entry, and This week takes it out", async () => {
      const { user } = visit("/leaderboard");
      await expectToLand({ address: "/leaderboard", title: "Who said thanks, and why" });
      const entries = window.history.length;
      const periods = within(screen.getByRole("group", { name: "Period" }));

      await user.click(periods.getByRole("button", { name: "All time" }));
      await waitFor(() => expect(addressNow()).toBe("/leaderboard?period=all"));
      expect(periods.getByRole("button", { name: "All time" })).toHaveFocus();

      await user.click(periods.getByRole("button", { name: "This week" }));
      await waitFor(() => expect(addressNow()).toBe("/leaderboard"));
      expect(window.history.length).toBe(entries);
    });

    it("an old Leaderboard link with a period keeps its period", async () => {
      visit("/sign-in/leaderboard?period=month&crate=leaderboard");
      await expectToLand({ address: "/leaderboard?period=month", title: "Who said thanks, and why" });
    });

    it("a period the board doesn't know lands on this week", async () => {
      visit("/leaderboard?period=decade");
      await expectToLand({ address: "/leaderboard", title: "Who said thanks, and why" });
    });

    it("a week in the URL opens Activity on that week's issue", async () => {
      visit("/activity?week=2026-09-28");
      await expectToLand({ address: "/activity?week=2026-09-28", title: "Weekly edition" });

      expect(within(screen.getByRole("tablist", { name: "Weeks" })).getByRole("tab", { name: /^Week of 28 Sept/ })).toHaveAttribute("aria-selected", "true");
    });

    it("choosing a week puts it in the URL without a history entry, and This week takes it out", async () => {
      const { user } = visit("/activity");
      await expectToLand({ address: "/activity", title: "Weekly edition" });
      const entries = window.history.length;
      const weeks = within(screen.getByRole("tablist", { name: "Weeks" }));

      await user.click(weeks.getByRole("tab", { name: /^Week of 21 Sept/ }));
      await waitFor(() => expect(addressNow()).toBe("/activity?week=2026-09-21"));
      expect(weeks.getByRole("tab", { name: /^Week of 21 Sept/ })).toHaveFocus();

      await user.click(weeks.getByRole("tab", { name: /^This week/ }));
      await waitFor(() => expect(addressNow()).toBe("/activity"));
      expect(window.history.length).toBe(entries);
    });

    it("a week that isn't a date lands on this week", async () => {
      visit("/activity?week=soon");
      await expectToLand({ address: "/activity", title: "Weekly edition" });
    });

    it("Back from a chosen period to another page and forward again keeps the period", async () => {
      const { user } = visit("/leaderboard?period=all");
      await expectToLand({ address: "/leaderboard?period=all", title: "Who said thanks, and why" });

      await user.click(screen.getByRole("link", { name: "Your profile, Sam Example" }));
      await expectMyOwnPage();
      act(() => window.history.back());

      await expectToLand({ address: "/leaderboard?period=all", title: "Who said thanks, and why" });
    });
  });

  describe("with shareable-urls off every address lands as before", () => {
    const before = albumFixtures.midway;

    it.each([
      ["/", "/book#me"],
      ["/book#me", "/book#me"],
      ["/leaderboard?period=month", "/leaderboard"],
      ["/activity?week=2026-09-28", "/activity"],
    ])("%s lands on %s", async (link, address) => {
      visit(link, before);
      await screen.findByRole("heading", { level: 1 });
      await waitFor(() => expect(addressNow()).toBe(address));
    });

    it("the member's person URL shows the page others see, and the brand links to /book#me", async () => {
      visit(myPage, before);
      await expectToLand({ address: myPage, title: "Sam Example" });

      expect(screen.getByText("You")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "HedgeHug" })).toHaveAttribute("href", "/book#me");
    });
  });
});
