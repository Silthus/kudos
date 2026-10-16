import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shellFixtures, type MemberProfile } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

afterEach(() => {
  vi.restoreAllMocks();
});

const { memberWithQuests, memberWithEveryFeatureOpen } = shellFixtures;

const memberWithThreePages: MemberProfile = { ...memberWithQuests, leaderboard: { kind: "open" }, features: [...(memberWithEveryFeatureOpen.features ?? []), ...(memberWithQuests.features ?? [])].sort((one, other) => one.level - other.level) };

const screensNav = () => within(screen.getByRole("banner")).getByRole("navigation", { name: "Screens" });

describe("WS300: below lg the screen nav is a scroll rail that never wraps", () => {
  it("scrolls sideways in one line instead of widening the page", () => {
    fakeSystemTheme(false);
    renderApp(memberWithThreePages);
    const rail = screensNav();
    expect(rail).toHaveClass("max-lg:overflow-x-auto", "flex-nowrap");
    for (const entry of within(rail).getAllByRole("link")) expect(entry).toHaveClass("shrink-0", "whitespace-nowrap");
  });

  it("is no focus trap: Tab moves through its entries in order and on past the rail", async () => {
    fakeSystemTheme(false);
    const { user } = renderApp(memberWithThreePages);
    const [first, ...rest] = within(screensNav()).getAllByRole("link");
    first?.focus();
    for (const entry of rest) {
      await user.tab();
      expect(entry).toHaveFocus();
    }
    await user.tab();
    expect(screensNav()).not.toContainElement(document.activeElement as HTMLElement);
  });

  it("brings each entry Tab reaches into view", async () => {
    fakeSystemTheme(false);
    const { user } = renderApp(memberWithThreePages);
    const [home, quests, leaderboard] = within(screensNav()).getAllByRole("link");
    home?.focus();
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    await user.tab();
    await user.tab();
    expect(scrolled.mock.contexts).toEqual([quests, leaderboard]);
    expect(scrolled).toHaveBeenCalledWith({ block: "nearest", inline: "nearest", behavior: "instant" });
  });

  it("brings the current entry into view on load, without animation", () => {
    fakeSystemTheme(false);
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    window.history.replaceState(null, "", "/leaderboard");
    renderApp(memberWithThreePages);
    const current = within(screensNav()).getByRole("link", { name: "Leaderboard" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(scrolled.mock.contexts).toContain(current);
    expect(scrolled).toHaveBeenCalledWith({ block: "nearest", inline: "nearest", behavior: "instant" });
  });
});

describe("WS300: below sm the theme control is one button that cycles light, dark and system", () => {
  const isDark = () => document.documentElement.classList.contains("dark");

  it("names its current choice and the next, and cycles through all three", async () => {
    fakeSystemTheme(true);
    const { user } = renderApp(shellFixtures.signedOut);
    const cycle = () => screen.getByRole("button", { name: /^Theme: / });
    expect(cycle()).toHaveAccessibleName("Theme: System. Switch to Light");
    expect(isDark()).toBe(true);

    await user.click(cycle());
    expect(cycle()).toHaveAccessibleName("Theme: Light. Switch to Dark");
    expect(isDark()).toBe(false);

    await user.click(cycle());
    expect(cycle()).toHaveAccessibleName("Theme: Dark. Switch to System");
    expect(isDark()).toBe(true);
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");

    await user.click(cycle());
    expect(cycle()).toHaveAccessibleName("Theme: System. Switch to Light");
  });
});
