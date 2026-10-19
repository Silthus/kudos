import { screen, within } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { fixedSettings, settingsFixtures } from "../settingsFixtures";
import { shellFixtures, type MemberProfile } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { aWideScreenThatNarrows, fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { contrast, contrastOnTint, type Mode } from "../test/themeContrast";
import { albumFixtures, fixedAlbum, fixturePackOpeningOf } from "./albumFixtures";
import type { MyAlbum } from "./answer";

const memberWithTheAlbum: MemberProfile = { ...shellFixtures.memberWithEveryFeatureOpen, album: true };

const pages: { path: string; album?: MyAlbum }[] = [
  { path: "/" },
  { path: "/", album: albumFixtures.newcomer },
  { path: "/book#teams/kettle-works" },
  { path: "/book#teams/quiet-harbour" },
  { path: "/book#people/ines-okafor" },
  { path: "/book#me" },
  { path: "/book#hoggies" },
  { path: "/book#milestones" },
  { path: "/book#packs" },
  { path: "/activity" },
  { path: "/leaderboard" },
  { path: "/settings" },
];

const wcag22AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violationsIn(container: Element) {
  const results = await axe.run(container, { runOnly: { type: "tag", values: wcag22AA }, rules: { "color-contrast": { enabled: false } } });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}

function visit(path: string, album: MyAlbum = albumFixtures.midway) {
  window.history.replaceState(null, "", path);
  return renderAlbum(memberWithTheAlbum, fixedAlbum(album), { settings: fixedSettings(settingsFixtures.everything), commands: { openThoughtfulPack: async (pack) => fixturePackOpeningOf(pack) } });
}

describe("AL55: every album page passes axe in light and dark, wide and on a phone", () => {
  for (const dark of [false, true]) {
    for (const wide of [true, false]) {
      for (const { path, album } of pages) {
        it(`${path}${album === albumFixtures.newcomer ? " for a newcomer" : ""} in ${dark ? "dark" : "light"}, ${wide ? "wide" : "on a phone"}`, async () => {
          fakeSystemTheme(dark);
          if (wide) preferWideScreen();
          else aWideScreenThatNarrows().narrow();
          const { container } = visit(path, album);
          await screen.findByRole("navigation", { name: "Album" });

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

    it(`with no pack waiting, the opening passes axe in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      preferWideScreen();
      const { user, container } = visit("/", albumFixtures.newcomer);
      await user.click(await screen.findByRole("button", { name: "No packs waiting" }));

      expect(await violationsIn(container)).toEqual([]);
    }, 30_000);
  }
});

describe("AL55: the album is usable by keyboard alone", () => {
  it("Tab walks the top bar in reading order, then the sidebar, then the page", async () => {
    fakeSystemTheme(false);
    preferWideScreen();
    const { user } = visit("/");
    await screen.findByRole("navigation", { name: "Album" });

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
      expect(contrast(mode, "al-accent-ink", "background")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mode, "foreground", "card")).toBeGreaterThanOrEqual(4.5);
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
