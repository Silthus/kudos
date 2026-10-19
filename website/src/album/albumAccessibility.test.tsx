import { screen, within } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { fixedSettings, settingsFixtures } from "../settingsFixtures";
import { shellFixtures, type MemberProfile } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { aWideScreenThatNarrows, fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { contrast, contrastOnTint, type Mode } from "../test/themeContrast";
import { albumFixtures, fixedAlbum, fixedPeople, fixturePackOpeningOf, fixturePutAllIn, fixtureUnlockOf } from "./albumFixtures";
import type { BoardsShown, HoggiesShown, MyAlbum, WeekShown } from "./answer";
import { boardsFixtures, fixedBoards } from "./boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";
import { fixedProfile, profileFixtures } from "./profileFixtures";
import { fixedWeek, fixtureWeeks, weekFixtures } from "./weekFixtures";

const memberWithTheAlbum: MemberProfile = { ...shellFixtures.memberWithEveryFeatureOpen, album: true };

const pages: { path: string; album?: MyAlbum; boards?: BoardsShown; week?: WeekShown; hoggies?: HoggiesShown }[] = [
  { path: "/" },
  { path: "/", album: albumFixtures.newcomer },
  { path: "/book#teams/kettle-works" },
  { path: "/book#teams/quiet-harbour" },
  { path: "/book#teams/salt-and-sparrow" },
  { path: "/book#people/ines-okafor" },
  { path: "/book#people/juno-park" },
  { path: "/book#me" },
  { path: "/book#me", album: albumFixtures.newcomer },
  { path: "/book#hoggies" },
  { path: "/book#hoggies", hoggies: hoggiesFixtures.newcomer },
  { path: "/book#hoggies/asleep" },
  { path: "/book#hoggies/ball" },
  { path: "/book#milestones" },
  { path: "/book#milestones", album: albumFixtures.newcomer },
  { path: "/book#packs" },
  { path: "/activity" },
  { path: "/activity", week: weekFixtures.quiet },
  { path: "/activity", week: weekFixtures.overflowing },
  { path: "/activity", week: weekFixtures.ownKudos },
  { path: "/activity", week: weekFixtures.noHistory },
  { path: "/leaderboard" },
  { path: "/leaderboard", boards: boardsFixtures.quiet },
  { path: "/leaderboard", boards: boardsFixtures.hidden },
  { path: "/settings" },
];

function weekNameOf(week: WeekShown | undefined) {
  if (week === weekFixtures.quiet) return " in a quiet week";
  if (week === weekFixtures.overflowing) return " in an overflowing week";
  if (week === weekFixtures.ownKudos) return " in a week led by the member's own kudos";
  if (week === weekFixtures.noHistory) return " before the first week";
  return "";
}

function hoggiesNameOf(hoggies: HoggiesShown | undefined) {
  return hoggies === hoggiesFixtures.newcomer ? " before any hoggie is found" : "";
}

function boardsNameOf(boards: BoardsShown | undefined) {
  if (boards === boardsFixtures.quiet) return " before anyone gave";
  if (boards === boardsFixtures.hidden) return " for a member off the boards";
  return "";
}

const wcag22AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violationsIn(container: Element) {
  const results = await axe.run(container, { runOnly: { type: "tag", values: wcag22AA }, rules: { "color-contrast": { enabled: false } } });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}

function visit(path: string, album: MyAlbum = albumFixtures.midway, boards: BoardsShown = boardsFixtures.week, week?: WeekShown, hoggies: HoggiesShown = hoggiesFixtures.midway) {
  window.history.replaceState(null, "", path);
  return renderAlbum(memberWithTheAlbum, fixedAlbum(album), { settings: fixedSettings(settingsFixtures.everything), boards: fixedBoards(boards), weeks: week === undefined ? fixtureWeeks() : fixedWeek(week), people: album.kind === "album" ? fixedPeople(album) : undefined, profile: fixedProfile(profileFixtures.noted), hoggies: fixedHoggies(hoggies), commands: { openThoughtfulPack: async (pack) => fixturePackOpeningOf(pack), unlockTeamSticker: async (team) => (album.kind === "album" ? fixtureUnlockOf(album, team) : { kind: "refused" }) } });
}

describe("AL55: every album page passes axe in light and dark, wide and on a phone", () => {
  for (const dark of [false, true]) {
    for (const wide of [true, false]) {
      for (const { path, album, boards, week, hoggies } of pages) {
        it(`${path}${album === albumFixtures.newcomer ? " for a newcomer" : ""}${boardsNameOf(boards)}${weekNameOf(week)}${hoggiesNameOf(hoggies)} in ${dark ? "dark" : "light"}, ${wide ? "wide" : "on a phone"}`, async () => {
          fakeSystemTheme(dark);
          if (wide) preferWideScreen();
          else aWideScreenThatNarrows().narrow();
          const { container } = visit(path, album, boards, week, hoggies);
          await screen.findByRole("navigation", { name: "Album" }, { timeout: 10_000 });

          expect(await violationsIn(container)).toEqual([]);
        }, 30_000);
      }
    }

    it(`the open tray, emoji panel, phone menu and drawer pass axe in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      aWideScreenThatNarrows().narrow();
      const { user, container } = visit("/");
      const [bar] = await screen.findAllByRole("banner");

      for (const name of ["Tray, nothing to put in", "Your emojis, 3 earned", "Menu"]) {
        await user.click(within(bar!).getByRole("button", { name }));
        expect(await violationsIn(container)).toEqual([]);
      }
      await user.click(screen.getByRole("button", { name: "Teams and pages" }));
      expect(await violationsIn(container)).toEqual([]);
    }, 60_000);

    for (const wide of [true, false]) {
      it(`the pack opening passes axe at every beat in ${dark ? "dark" : "light"}, ${wide ? "wide" : "on a phone"}`, async () => {
        fakeSystemTheme(dark);
        if (wide) preferWideScreen();
        else aWideScreenThatNarrows().narrow();
        const { user, container } = visit("/");
        await user.click(await screen.findByRole("button", { name: "Open your packs, 2 waiting" }));
        expect(await violationsIn(container)).toEqual([]);

        await user.click(screen.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));
        for (const turn of ["Turn the first card", "Next card"]) {
          await user.click(await screen.findByRole("button", { name: turn }));
          expect(await violationsIn(container)).toEqual([]);
        }
        await user.click(screen.getByRole("button", { name: "Skip" }));
        expect(await violationsIn(container)).toEqual([]);
      }, 60_000);
    }

    for (const wide of [true, false]) {
      it(`the tray holding stickers and hoggies passes axe open, after a refusal and while its cards fly in ${dark ? "dark" : "light"}, ${wide ? "wide" : "on a phone"}`, async () => {
        fakeSystemTheme(dark);
        if (wide) preferWideScreen();
        else aWideScreenThatNarrows().narrow();
        window.history.replaceState(null, "", "/");
        const { user, container } = renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.trayed), { commands: { putIn: async () => ({ kind: "refused" }), putAllIn: async () => fixturePutAllIn() } });
        const [bar] = await screen.findAllByRole("banner");

        await user.click(within(bar!).getByRole("button", { name: "Tray, 4 to put in" }));
        expect(await violationsIn(container)).toEqual([]);
        await user.click(screen.getByRole("button", { name: "Put Cass Vey's card in" }));
        await user.click(await within(bar!).findByRole("button", { name: "Tray, 4 to put in" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("That couldn't be put in. It may already be in your album.");
        expect(await violationsIn(container)).toEqual([]);
        await user.click(screen.getByRole("button", { name: "Put them all in · 4" }));
        await within(bar!).findByRole("button", { name: /^Tray, putting in/ });
        expect(await violationsIn(container)).toEqual([]);
      }, 60_000);
    }

    it(`with no pack waiting, the opening passes axe in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      preferWideScreen();
      const { user, container } = visit("/", albumFixtures.newcomer);
      await user.click(await screen.findByRole("button", { name: "No packs waiting" }));

      expect(await violationsIn(container)).toEqual([]);
    }, 30_000);
    for (const reduced of [false, true]) {
      it(`the unlock moment passes axe in ${dark ? "dark" : "light"}${reduced ? " with reduced motion" : ""}, and a ready page's unlock is reached by keyboard`, async () => {
        fakeSystemTheme(dark);
        preferWideScreen();
        if (reduced) preferReducedMotion();
        const { user, container } = visit("/book#teams/kettle-works");
        const unlock = await screen.findByRole("button", { name: "Ready to unlock the Kettle Works sticker" });

        unlock.focus();
        await user.keyboard("{Enter}");
        const moment = await screen.findByRole("dialog", { name: "Kettle Works sticker unlocked" });
        expect(await violationsIn(container)).toEqual([]);
        await within(moment).findByRole("button", { name: "Put it on the page" }, { timeout: 5_000 });
        expect(await violationsIn(container)).toEqual([]);
      }, 30_000);
    }
    it(`the Leaderboard narrowed to one team passes axe in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      preferWideScreen();
      const { user, container } = visit("/leaderboard");

      await user.click(await screen.findByRole("button", { name: "Who gave in Kettle Works" }));

      expect(await violationsIn(container)).toEqual([]);
    }, 30_000);
  }
});

describe("AL55: the album is usable by keyboard alone", { timeout: 30_000 }, () => {
  it("Tab walks the top bar in reading order, then the sidebar, then the page", async () => {
    fakeSystemTheme(false);
    preferWideScreen();
    const { user } = visit("/");
    await screen.findByRole("navigation", { name: "Album" }, { timeout: 10_000 });

    const reached: string[] = [];
    for (let step = 0; step < 11; step += 1) {
      await user.tab();
      const focused = document.activeElement as HTMLElement;
      reached.push(focused.getAttribute("aria-label") ?? focused.textContent ?? "");
    }

    expect(reached).toEqual(["HedgeHug", "Open your packs, 2 waiting", "Tray, nothing to put in", "Activity", "Leaderboard", "Your emojis, 3 earned", "Your profile, Sam Example", "Settings", "Search teams and people", "Lanterns4 of 5 · 1 to go", "Kettle Works Ready to unlock"]);
  });

  it("a panel opens with Enter, closes with Escape and hands focus back to its button", async () => {
    fakeSystemTheme(false);
    preferWideScreen();
    const { user } = visit("/");
    const tray = await screen.findByRole("button", { name: "Tray, nothing to put in" });

    tray.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("region", { name: "Tray" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Tray" })).not.toBeInTheDocument();
    expect(tray).toHaveFocus();
  });

  it("opening one panel closes the other", async () => {
    fakeSystemTheme(false);
    preferWideScreen();
    const { user } = visit("/");

    await user.click(await screen.findByRole("button", { name: "Tray, nothing to put in" }));
    await user.click(screen.getByRole("button", { name: "Your emojis, 3 earned" }));

    expect(screen.queryByRole("region", { name: "Tray" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Your emojis" })).toBeInTheDocument();
  });
});

describe("AL55: the album's own colours meet WCAG 2.2 AA in both themes", () => {
  const modes: Mode[] = ["light", "dark"];
  for (const mode of modes) {
    it(`text reaches 4.5:1 in ${mode}`, () => {
      expect(contrast(mode, "al-accent-ink", "card")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-accent-ink", "chrome")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-accent-ink", "background")).toBeGreaterThanOrEqual(4.5);
      expect(contrastOnTint(mode, "al-accent-ink", "al-accent-soft", { backdrop: "card" })).toBeGreaterThanOrEqual(4.5);
      expect(contrastOnTint(mode, "muted-foreground", "al-accent-soft", { backdrop: "card" })).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-count-ink", "al-accent-ink")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-done-ink", "al-done")).toBeGreaterThanOrEqual(4.5);
    });

    it(`the pack opening's text reaches 4.5:1 in ${mode}`, () => {
      expect(contrast(mode, "al-card-frame-ink", "al-card-frame")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-count-ink", "al-accent")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-gold-ink", "al-gold")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-ribbon-ink", "al-ribbon")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-card-back-ink", "al-card-back")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-accent-ink", "background")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "foreground", "card")).toBeGreaterThanOrEqual(4.5);
    });

    it(`the team and person pages' text reaches 4.5:1 in ${mode}`, () => {
      expect(contrast(mode, "foreground", "al-paper")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "muted-foreground", "al-paper")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-silhouette-ink", "al-silhouette")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-silhouette-ink", "al-silhouette-back")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-foil-ink", "background")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-ready-ink", "al-ready")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "foreground", "al-ready")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "muted-foreground", "al-ready")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-accent-ink", "al-ready")).toBeGreaterThanOrEqual(4.5);
    });

    it(`the seal's ring and the ready page's edge reach 3:1 in ${mode}`, () => {
      expect(contrast(mode, "al-accent", "card")).toBeGreaterThanOrEqual(3);
      expect(contrast(mode, "al-ready-edge", "background")).toBeGreaterThanOrEqual(3);
    });

    it(`the tray's text reaches 4.5:1 in ${mode}`, () => {
      expect(contrastOnTint(mode, "foreground", "al-accent-soft", { backdrop: "card" })).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-accent-ink", "card")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-count-ink", "al-accent-ink")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "al-count-ink", "al-accent")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "muted-foreground", "card")).toBeGreaterThanOrEqual(4.5);
    });

    it(`bars, pips and step rings reach 3:1 in ${mode}`, () => {
      expect(contrast(mode, "al-accent", "card")).toBeGreaterThanOrEqual(3);
      expect(contrast(mode, "al-accent", "chrome")).toBeGreaterThanOrEqual(3);
      expect(contrastOnTint(mode, "al-accent", "al-track", { backdrop: "card" })).toBeGreaterThanOrEqual(3);
      expect(contrast(mode, "muted-foreground", "chrome")).toBeGreaterThanOrEqual(3);
      expect(contrast(mode, "al-done", "card")).toBeGreaterThanOrEqual(3);
    });
  }
});
