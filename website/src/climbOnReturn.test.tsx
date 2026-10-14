import { act, fireEvent, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aGiven, aPage, aReceived } from "./activityFixtures";
import type { ActivityRead, ActivityWatch } from "./activityRead";
import { progressionAt } from "./crates/rewards";
import { fixedRecentKudos, recentKudosFixtures } from "./recentKudosFixtures";
import { shellFixtures, type ActivityEntry, type MemberProfile } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferReducedMotion } from "./test/systemTheme";

const hour = 60 * 60 * 1000;

const lastVisit = Date.parse("2026-10-12T09:00:00Z");

const thisVisit = Date.parse("2026-10-14T16:30:00Z");

const boardReady = shellFixtures.memberWithTheBoardReady;

function at(xp: number, changes: Partial<MemberProfile> = {}): MemberProfile {
  return { ...boardReady, progression: progressionAt(xp), ...changes };
}

const sinceTheLastVisit: ActivityEntry[] = [
  aGiven("review", lastVisit + 2 * hour, { earned: { xp: 25, questsDone: [], bonuses: [] } }),
  aReceived("thanks", lastVisit + 90 * 60 * 1000),
  aGiven("demo", lastVisit + hour, { earned: { xp: 15, questsDone: [], bonuses: [] } }),
  aGiven("before", lastVisit - hour, { earned: { xp: 50, questsDone: [], bonuses: [] } }),
];

const noWatch: ActivityWatch = (filter) => (filter === undefined ? undefined : { kind: "not-found" });

function answering(entries: ActivityEntry[]) {
  const read = vi.fn<ActivityRead>(async ({ filter }) => aPage(entries.filter(({ kind }) => filter !== "given" || kind === "kudosGiven"), null));
  return { watch: noWatch, read };
}

function visit(member: MemberProfile, entries: ActivityEntry[] = sinceTheLastVisit) {
  const activity = answering(entries);
  return { ...renderApp(member, undefined, undefined, undefined, undefined, undefined, undefined, fixedRecentKudos({ received: recentKudosFixtures.threeReceived, given: recentKudosFixtures.threeGiven }), activity), read: activity.read };
}

function visitedBefore(member: MemberProfile) {
  vi.setSystemTime(lastVisit);
  visit(member).unmount();
  vi.setSystemTime(thisVisit);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function main() {
  return screen.getByRole("main");
}

function xpBar() {
  return within(main()).getByRole("progressbar", { name: / XP to level / });
}

function heroRing() {
  return within(main()).getByRole("img", { name: /^Level / });
}

function recentKudos() {
  return within(main()).getByRole("region", { name: "Recent kudos" });
}

function flights() {
  return [...document.querySelectorAll<HTMLElement>("[data-reward-flight]")];
}

function hudRing() {
  return within(screen.getByRole("banner")).getByRole("img", { name: /^Level / });
}

function frame() {
  return document.querySelector<HTMLElement>(".hud-root")!;
}

function celebration() {
  return document.querySelector<HTMLElement>("[data-level-up]");
}

function levelAnnouncement() {
  return screen.getByTestId("level-up-announcement");
}

function placeAt(element: Element, rect: { x: number; y: number; width: number; height: number }) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect(rect));
}

function land(flight: HTMLElement) {
  for (const particle of flight.querySelectorAll("[data-particle]")) fireEvent.animationEnd(particle);
}

async function readTheActivity() {
  await act(async () => {});
}

function wait(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

async function climbAll() {
  await readTheActivity();
  for (let launch = 0; launch < 5; launch += 1) {
    wait(500);
    if (flights().length === 0) return;
    for (const flight of flights()) land(flight);
  }
}

describe("#413: the climb on return", () => {
  it("shows the current totals at once on the first visit", async () => {
    const { read } = visit(at(130));

    await readTheActivity();
    expect(xpBar()).toHaveAttribute("aria-valuenow", "130");
    expect(flights()).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });

  it("starts the header at the last visit's totals and flies each kudos given since then from the Recent kudos card into the XP bar, oldest first", async () => {
    visitedBefore(at(110));
    visit(at(150));
    placeAt(recentKudos(), { x: 800, y: 400, width: 320, height: 200 });
    placeAt(xpBar(), { x: 300, y: 300, width: 400, height: 12 });

    expect(xpBar()).toHaveAttribute("aria-valuenow", "110");
    await readTheActivity();
    const [first] = flights();
    expect(first).toHaveTextContent("+15 XP");
    expect(first!.style.left).toBe("800px");
    expect(first!.style.top).toBe("400px");
    wait(1000);
    expect(flights().map((flight) => flight.textContent)).toEqual(["+15 XP", "+25 XP"]);

    land(flights()[0]!);
    expect(xpBar()).toHaveAttribute("aria-valuenow", "125");
    land(flights()[0]!);
    expect(xpBar()).toHaveAttribute("aria-valuenow", "150");
    expect(flights()).toEqual([]);
  });

  it("flies what the kudos since the last visit don't explain as one last chip, and never more than the totals grew", async () => {
    visitedBefore(at(110));
    const first = visit(at(170));

    await readTheActivity();
    expect(flights()[0]).toHaveTextContent("+15 XP");
    await climbAll();
    expect(xpBar()).toHaveAttribute("aria-valuenow", "170");
    first.unmount();

    visitedBefore(at(110));
    visit(at(120));
    await readTheActivity();
    expect(flights().map((flight) => flight.textContent)).toEqual(["+10 XP"]);
  });

  it("never flies a quest's XP that waits in an unopened crate", async () => {
    visitedBefore(at(110));
    const waiting = { kind: "weekly", goal: "Thank three people", xp: 40, waiting: true } as const;
    visit(at(125), [aGiven("demo", lastVisit + hour, { earned: { xp: 15, questsDone: [waiting], bonuses: [] } })]);

    await readTheActivity();
    expect(flights().map((flight) => flight.textContent)).toEqual(["+15 XP"]);
  });

  it("folds a long absence into a few chips", async () => {
    visitedBefore(at(110));
    const many = Array.from({ length: 12 }, (_, kudos) => aGiven(`kudos ${kudos}`, lastVisit + (kudos + 1) * hour, { earned: { xp: 5, questsDone: [], bonuses: [] } }));
    visit(at(170), many);

    await readTheActivity();
    for (const _launch of [1, 2, 3]) wait(400);
    expect(flights()).toHaveLength(4);
    expect(flights()[0]).toHaveTextContent("+45 XP");
  });

  it("climbs from the page title into the HUD on a page without the Recent kudos card", async () => {
    visitedBefore(at(110));
    window.history.replaceState(null, "", "/nowhere");
    visit(at(125));

    await readTheActivity();
    expect(flights()).toHaveLength(1);
  });

  it("never leaves the header held short when a chip never lands, as when reduced motion turns on mid-climb", async () => {
    visitedBefore(at(110));
    visit(at(150));
    await readTheActivity();
    expect(flights()).not.toEqual([]);

    preferReducedMotion();
    wait(5000);
    expect(flights()).toEqual([]);
    expect(xpBar()).toHaveAttribute("aria-valuenow", "150");
  });

  it("lands every chip once at once when there is nowhere to fly from, and celebrates once", async () => {
    visitedBefore(at(90));
    window.history.replaceState(null, "", "/quests");
    const activity = answering(sinceTheLastVisit);
    renderApp(at(130), undefined, undefined, () => undefined, undefined, undefined, undefined, undefined, activity);

    await readTheActivity();
    wait(300);
    expect(flights()).toEqual([]);
    expect(screen.getByRole("link", { name: /^Sam Example, level/ })).toHaveAccessibleName("Sam Example, level 3");
    expect(celebration()).toHaveTextContent("Level 3");
    expect(levelAnnouncement()).toHaveTextContent("You reached level 3.");
  });

  it("lands a chip that can't fly once, so a live update after it shows the true totals", async () => {
    visitedBefore(at(110));
    window.history.replaceState(null, "", "/quests");
    const activity = answering([]);
    const { showVisitor } = renderApp(at(125), undefined, undefined, () => undefined, undefined, undefined, undefined, undefined, activity);
    await readTheActivity();

    showVisitor(at(150));
    expect(hudRing()).toHaveAccessibleName("Level 3, 150 XP to level 4");
  });

  it("leaves no fill animation behind on the frame once the climb and its celebration are over", async () => {
    visitedBefore(at(90));
    visit(at(130));
    await climbAll();
    wait(3000);

    expect(frame()).not.toHaveClass("reward-levelling");
    expect(frame()).not.toHaveClass("reward-filling");
    expect(frame()).not.toHaveClass("level-burst");
  });

  it("stays still when nothing grew since the last visit", async () => {
    visitedBefore(at(130));
    const { read } = visit(at(130));

    await readTheActivity();
    expect(xpBar()).toHaveAttribute("aria-valuenow", "130");
    expect(flights()).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });

  it("plays once per change: a reload after it played stays still", async () => {
    visitedBefore(at(110));
    const { unmount } = visit(at(150));
    await readTheActivity();
    expect(flights()).not.toEqual([]);
    unmount();

    visit(at(150));
    await readTheActivity();
    expect(xpBar()).toHaveAttribute("aria-valuenow", "150");
    expect(flights()).toEqual([]);
  });

  it("keeps the last-seen totals for each member apart", async () => {
    visitedBefore(at(110));
    const someoneElse = at(150, { features: boardReady.features!.map((card) => ({ ...card, seen: `other-${card.seen}` })) });
    visit(someoneElse);

    await readTheActivity();
    expect(xpBar()).toHaveAttribute("aria-valuenow", "150");
    expect(flights()).toEqual([]);
  });

  it("under reduced motion shows the current totals at once and says what grew since the last visit", async () => {
    preferReducedMotion();
    visitedBefore(at(90));
    visit(at(130));

    await readTheActivity();
    expect(xpBar()).toHaveAttribute("aria-valuenow", "130");
    expect(flights()).toEqual([]);
    expect(celebration()).toBeNull();
    expect(within(main()).getByText("+40 XP and level 3 since your last visit")).toBeVisible();
  });
});

describe("#413: a level-up celebration worth the moment", () => {
  it("celebrates once at the end of a climb across a level, naming the new level and what it made ready", async () => {
    visitedBefore(at(90));
    visit(at(130));

    expect(heroRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    await readTheActivity();
    land(flights()[0]!);
    expect(celebration()).toBeNull();
    await climbAll();

    expect(heroRing()).toHaveAccessibleName("Level 3, 170 XP to level 4");
    expect(celebration()).toHaveTextContent("Level 3");
    expect(celebration()).toHaveTextContent("Leaderboard is ready to open");
    expect(levelAnnouncement()).toHaveTextContent("You reached level 3. Leaderboard is ready to open.");
  });

  it("names the skill point a level earns", async () => {
    const skillTreeOpen = { ...shellFixtures.memberWithEveryFeatureOpen };
    visitedBefore({ ...skillTreeOpen, progression: progressionAt(590), skillPoints: 0 });
    visit({ ...skillTreeOpen, progression: progressionAt(610), skillPoints: 1 }, []);

    await climbAll();
    expect(celebration()).toHaveTextContent("+1 skill point");
    expect(levelAnnouncement()).toHaveTextContent("You reached level 5. You earned 1 skill point.");
  });

  it("celebrates a live level-up while the page is open, then gets out of the way", async () => {
    const { showVisitor } = visit(at(90));
    await readTheActivity();
    expect(celebration()).toBeNull();

    showVisitor(at(130));
    expect(celebration()).toHaveTextContent("Level 3");
    expect(levelAnnouncement()).toHaveTextContent("You reached level 3.");
    expect(flights()).toEqual([]);
    wait(4000);
    expect(celebration()).toBeNull();
  });

  it("under reduced motion announces a live level-up calmly, without the burst", async () => {
    preferReducedMotion();
    const { showVisitor } = visit(at(90));
    await readTheActivity();

    showVisitor(at(130));
    expect(celebration()).toHaveAttribute("data-motion", "reduced");
    expect(celebration()!.querySelector("[data-spark]")).toBeNull();
    expect(levelAnnouncement()).toHaveTextContent("You reached level 3.");
  });

  it("under reduced motion the calm card leaves within three seconds", async () => {
    preferReducedMotion();
    const { showVisitor } = visit(at(90));
    await readTheActivity();
    showVisitor(at(130));
    wait(3000);
    expect(celebration()).toBeNull();
  });

  it("never shows one member's celebration after they sign out", async () => {
    const { showVisitor } = visit(at(90));
    await readTheActivity();
    showVisitor(at(130));
    expect(celebration()).not.toBeNull();

    showVisitor(shellFixtures.signedOut);
    expect(celebration()).toBeNull();
    expect(levelAnnouncement()).toHaveTextContent("");
  });

  for (const dark of [false, true]) {
    it(`the climb and the celebration pass axe in ${dark ? "dark" : "light"}`, async () => {
      vi.useRealTimers();
      fakeSystemTheme(dark);
      const { showVisitor } = visit(at(90));
      showVisitor(at(130));
      expect(celebration()).not.toBeNull();
      const results = await axe.run(document.body, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    }, 30_000);
  }
});
