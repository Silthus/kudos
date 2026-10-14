import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures, type FeatureCard, type MemberProfile } from "../shell";
import { renderApp } from "../test/renderApp";
import { navEntryNames as entries, screensNav as nav } from "../test/screensNav";
import { fakeSystemTheme, preferReducedMotion } from "../test/systemTheme";

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/");
});

const readyAt = Date.parse("2026-10-12T09:00:00Z");

const card = (feature: FeatureCard["feature"], name: string, level: number, state: FeatureCard["state"]): FeatureCard => ({
  feature,
  name,
  opens: "the boards",
  level,
  seen: `seen-${feature}`,
  state,
  readyAt: state === "locked" ? null : readyAt,
  openedAt: state === "open" ? readyAt : null,
});

const memberOnTheUnlockPath = (...features: FeatureCard[]): MemberProfile => ({
  ...shellFixtures.memberAtLevel7,
  features,
  leaderboard: { kind: features.some(({ feature, state }) => feature === "leaderboard" && state === "open") ? "open" : "off" },
});

const everyState = memberOnTheUnlockPath(card("quests", "Quests", 2, "open"), card("leaderboard", "Leaderboard", 3, "ready"), card("book", "Book", 8, "locked"), card("skillTree", "Skill tree", 9, "locked"));

const tooltip = () => waitFor(() => {
  const shown = document.querySelector('[data-slot="tooltip-content"]');
  if (shown === null) throw new Error("no tooltip shown");
  return shown;
});

describe("WS301: the nav lists every shipped feature with a page, in schedule order, in its state", () => {
  it("shows Profile, an open link, a ready crate and the locked entries in schedule order", () => {
    renderApp(everyState);
    expect(entries()).toEqual(["Profile", "Quests", "Leaderboard: unlock ready. Open its crate", "Book, locked. Unlocks at level 8", "Skill tree, locked. Unlocks at level 9"]);
    expect(within(nav()).getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/");
    expect(within(nav()).getByRole("link", { name: "Quests" })).toHaveAttribute("href", "/quests");
  });

  it("makes a locked entry focusable but no link anywhere, with only the next unlock carrying the neutral Lv mark", () => {
    renderApp(everyState);
    const book = within(nav()).getByRole("link", { name: "Book, locked. Unlocks at level 8" });
    const skillTree = within(nav()).getByRole("link", { name: "Skill tree, locked. Unlocks at level 9" });
    for (const locked of [book, skillTree]) {
      expect(locked).toHaveAttribute("aria-disabled", "true");
      expect(locked).toHaveAttribute("tabindex", "0");
      expect(locked).not.toHaveAttribute("href");
    }
    expect(book).toHaveTextContent("Lv 8");
    expect(skillTree).not.toHaveTextContent("Lv");
    for (const locked of [book, skillTree]) expect(locked).toHaveClass("text-muted-foreground");
    expect(nav()).not.toHaveTextContent(/levels? to go|XP|%/);
  });

  it.each([
    ["the next unlock", "Book, locked. Unlocks at level 8", "Next unlock · BookUnlocks at level 8"],
    ["a later unlock", "Skill tree, locked. Unlocks at level 9", "Skill treeUnlocks at level 9"],
  ])("tells %s's level in a tooltip, and goes nowhere when clicked", async (_, name, tip) => {
    const { user } = renderApp(everyState);
    const locked = within(nav()).getByRole("link", { name });
    await user.hover(locked);
    expect(await tooltip()).toHaveTextContent(tip);
    await user.click(locked);
    expect(window.location.pathname).toBe("/");
  });

  it("opens a ready feature's crate from its entry, through openFeature and the reveal", async () => {
    const openFeature = vi.fn(async () => ({ kind: "opened" }) as const);
    const { user } = renderApp(everyState, undefined, { openFeature });
    await user.click(within(nav()).getByRole("button", { name: "Leaderboard: unlock ready. Open its crate" }));
    expect(openFeature).toHaveBeenCalledExactlyOnceWith("leaderboard");
    expect(await screen.findByRole("dialog")).toHaveAccessibleName("Level 3 unlock");
  });

  it("says Opening… on a ready entry until openFeature answers, and sends nothing more meanwhile", async () => {
    let answer!: (value: { kind: "opened" }) => void;
    const openFeature = vi.fn(() => new Promise<{ kind: "opened" }>((resolve) => (answer = resolve)));
    const { user } = renderApp(everyState, undefined, { openFeature });
    await user.click(within(nav()).getByRole("button", { name: "Leaderboard: unlock ready. Open its crate" }));
    const opening = within(nav()).getByRole("button", { name: "Leaderboard: opening its crate" });
    expect(opening).toHaveAttribute("aria-disabled", "true");
    expect(opening).toHaveTextContent("Opening…");
    await user.click(opening);
    expect(openFeature).toHaveBeenCalledOnce();
    await act(async () => answer({ kind: "opened" }));
    expect(await screen.findByRole("dialog")).toHaveAccessibleName("Level 3 unlock");
  });

  it.each([
    ["refuses", async () => ({ kind: "refused" }) as const, "That couldn't be opened."],
    ["can't be reached", async () => Promise.reject(new Error("socket closed")), "Couldn't reach HedgeHug. Try again."],
  ])("says beside the bar what went wrong when a later ready entry's open %s", async (_, openFeature, says) => {
    window.history.replaceState(null, "", "/quests");
    const twoReady = memberOnTheUnlockPath(card("leaderboard", "Leaderboard", 3, "ready"), card("skillTree", "Skill tree", 5, "ready"));
    const { user } = renderApp(twoReady, undefined, { openFeature });
    await user.click(within(nav()).getByRole("button", { name: "Skill tree: unlock ready. Open its crate" }));
    expect(await within(screen.getByRole("banner")).findByText(says)).toBeVisible();
  });

  it("keeps today's nav while unlocks don't apply", () => {
    renderApp({ ...shellFixtures.memberAtLevel7, leaderboard: { kind: "open" } });
    expect(entries()).toEqual(["Profile", "Leaderboard"]);
  });
});

describe("WS302: labels and widths", () => {
  it("names the first entry Profile, links it home, keeps it current there and titles the tab HedgeHug · Profile", () => {
    renderApp(everyState);
    expect(within(nav()).getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
    expect(document.title).toBe("HedgeHug · Profile");
  });

  it("reads Back to your profile wherever a page sent the member home", () => {
    window.history.replaceState(null, "", "/nowhere");
    renderApp(everyState);
    expect(within(screen.getByRole("main")).getByRole("link", { name: "Back to your profile" })).toHaveAttribute("href", "/");
  });

  it("shows icons only from lg to xl, with the label kept as the name, and a filled pill for the current entry below lg", () => {
    window.history.replaceState(null, "", "/quests");
    renderApp(everyState);
    for (const label of nav().querySelectorAll("[data-entry-label]")) expect(label).toHaveClass("lg:max-xl:sr-only");
    const current = within(nav()).getByRole("link", { name: "Quests" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveClass("max-lg:rounded-full", "max-lg:bg-primary", "max-lg:text-primary-foreground", "lg:after:bg-primary");
    expect(within(nav()).getByRole("link", { name: "Profile" })).not.toHaveClass("max-lg:bg-primary");
  });

  it("gives an icon-only entry its label as a tooltip on keyboard focus, shown only from lg to xl", async () => {
    const { user } = renderApp(everyState);
    within(nav()).getByRole("link", { name: "Profile" }).focus();
    await user.tab();
    expect(within(nav()).getByRole("link", { name: "Quests" })).toHaveFocus();
    const tip = await tooltip();
    expect(tip).toHaveTextContent("Quests");
    expect(tip).toHaveClass("hidden", "lg:max-xl:block");
  });
});

describe("WS300 WS301: the rail keeps the current entry in view as it opens", () => {
  it("brings a page's entry into view when it turns from ready to open on that page", () => {
    window.history.replaceState(null, "", "/skills");
    const treeReady = memberOnTheUnlockPath(card("skillTree", "Skill tree", 5, "ready"));
    const { showVisitor } = renderApp(treeReady);
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    showVisitor(memberOnTheUnlockPath(card("skillTree", "Skill tree", 5, "open")));
    expect(scrolled.mock.contexts).toContain(within(nav()).getByRole("link", { name: "Skill tree" }));
  });
});

describe("WS303: the right of the bar", () => {
  it("links the avatar to the profile, named with the member's level, beside its own Sign out", async () => {
    const { user, actions } = renderApp(everyState);
    const banner = within(screen.getByRole("banner"));
    expect(banner.getByRole("link", { name: "Sam Example, level 7" })).toHaveAttribute("href", "/");
    expect(banner.queryByRole("button", { name: /Account menu/ })).not.toBeInTheDocument();
    const signOut = banner.getByRole("button", { name: "Sign out" });
    expect(signOut).toHaveClass("quill-button--variant-outline");
    await user.click(signOut);
    expect(actions.signOut).toHaveBeenCalledOnce();
  });

  it("names the avatar without a level while progression is off", () => {
    renderApp(shellFixtures.member);
    expect(within(screen.getByRole("banner")).getByRole("link", { name: "Sam Example" })).toHaveAttribute("href", "/");
  });

  it("gives the header E's one-pixel bottom shadow", () => {
    renderApp(everyState);
    expect(screen.getByRole("banner")).toHaveClass("shadow-[0_1px_0_0_color-mix(in_oklab,var(--foreground)_4%,transparent)]");
  });
});

describe("WS304: a feature opened in this tab pops in once", () => {
  const leaderboardReady = memberOnTheUnlockPath(card("leaderboard", "Leaderboard", 3, "ready"));
  const leaderboardOpen = memberOnTheUnlockPath(card("leaderboard", "Leaderboard", 3, "open"));

  async function openTheLeaderboardHere() {
    const view = renderApp(leaderboardReady, undefined, { openFeature: async () => ({ kind: "opened" }) });
    await view.user.click(within(nav()).getByRole("button", { name: "Leaderboard: unlock ready. Open its crate" }));
    await screen.findByRole("dialog");
    view.showVisitor(leaderboardOpen);
    return view;
  }

  it("pops in the new entry after openFeature answers opened", async () => {
    await openTheLeaderboardHere();
    expect(within(nav()).getByRole("link", { name: "Leaderboard" })).toHaveClass("nav-pop");
    expect(within(nav()).getByRole("link", { name: "Profile" })).not.toHaveClass("nav-pop");
  });

  it("pops in only once: not again after the HUD comes back from a lost connection", async () => {
    const { showVisitor } = await openTheLeaderboardHere();
    const popped = within(nav()).getByRole("link", { name: "Leaderboard" });
    fireEvent.animationEnd(popped);
    expect(popped).not.toHaveClass("nav-pop");
    showVisitor(shellFixtures.connecting);
    showVisitor(leaderboardOpen);
    expect(within(nav()).getByRole("link", { name: "Leaderboard" })).not.toHaveClass("nav-pop");
  });

  it("never pops in on an ordinary visit or a reload", () => {
    renderApp(leaderboardOpen);
    expect(within(nav()).getByRole("link", { name: "Leaderboard" })).not.toHaveClass("nav-pop");
  });

  it("never pops in under reduced motion", async () => {
    preferReducedMotion();
    await openTheLeaderboardHere();
    expect(within(nav()).getByRole("link", { name: "Leaderboard" })).not.toHaveClass("nav-pop");
  });

  it("pops in the skill point chip the skill tree brings", async () => {
    const treeReady = { ...memberOnTheUnlockPath(card("skillTree", "Skill tree", 5, "ready")), skillPoints: null };
    const treeOpen = { ...memberOnTheUnlockPath(card("skillTree", "Skill tree", 5, "open")), skillPoints: 1 };
    const { user, showVisitor } = renderApp(treeReady, undefined, { openFeature: async () => ({ kind: "opened" }) });
    await user.click(within(nav()).getByRole("button", { name: "Skill tree: unlock ready. Open its crate" }));
    await screen.findByRole("dialog");
    showVisitor(treeOpen);
    expect(within(screen.getByRole("banner")).getByRole("link", { name: /skill point/ }).parentElement).toHaveClass("nav-pop");
  });
});
