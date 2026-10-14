import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { shellFixtures, type MemberProfile } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferReducedMotion } from "./test/systemTheme";

const atLevel2 = shellFixtures.memberWithQuestsAtLevel2;

const acrossALevel: MemberProfile = { ...atLevel2, progression: { level: 3, xp: 110, levelStartsAt: 100, nextLevelAt: 300, xpToNextLevel: 190 } };

const intoTheSixthLevel = shellFixtures.memberCrossingIntoLevel6;

const skillTreeReady = shellFixtures.memberWithTheSkillTreeReady;

const skillTreeOpened: MemberProfile = { ...skillTreeReady, features: skillTreeReady.features!.map((card) => (card.feature === "skillTree" ? { ...card, state: "open", openedAt: 2 } : card)), skillPoints: 1 };

beforeEach(() => {
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

function header() {
  return screen.getByRole("banner");
}

function journeyCrate() {
  return within(main()).getByRole("region", { name: "Journey" });
}

function xpBar() {
  return within(main()).getByRole("progressbar", { name: / XP to level / });
}

function heroRing() {
  return within(main()).getByRole("img", { name: /^Level / });
}

function hudRing() {
  return within(avatar()).getByRole("img", { name: /^Level / });
}

function avatar() {
  return within(header()).getByRole("link", { name: /^Sam Example/ });
}

function skillPointChip() {
  return within(header()).getByRole("link", { name: /skill points? to spend$/ });
}

function flight() {
  return document.querySelector<HTMLElement>("[data-reward-flight]");
}

function frame() {
  return document.querySelector<HTMLElement>(".hud-root")!;
}

function placeAt(element: Element, rect: { x: number; y: number; width: number; height: number }) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect(rect));
}

function courseOf(chip: HTMLElement) {
  return { left: chip.style.left, top: chip.style.top, x: chip.style.getPropertyValue("--flight-x"), y: chip.style.getPropertyValue("--flight-y") };
}

function landAll(chip: HTMLElement) {
  for (const particle of chip.querySelectorAll("[data-particle]")) fireEvent.animationEnd(particle);
}

function openJourneyCrate(member: MemberProfile) {
  return renderApp(member, undefined, { openQuestCrate: async () => ({ kind: "opened" }) }, fixedQuests(questsFixtures.week));
}

async function openAndClose(user: ReturnType<typeof renderApp>["user"], region: HTMLElement) {
  await user.click(within(region).getByRole("button", { name: "Open" }));
  await user.keyboard("{Escape}");
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
}

describe("#354: a Journey crate's XP flies into the hero's XP bar", () => {
  it("flies +{xp} XP from the Journey crate to the hero's XP bar while the bar is on screen", async () => {
    const { user } = openJourneyCrate(atLevel2);
    placeAt(within(journeyCrate()).getByText("Journey reward · 20 XP"), { x: 100, y: 500, width: 160, height: 20 });
    placeAt(xpBar(), { x: 300, y: 300, width: 400, height: 12 });
    await openAndClose(user, journeyCrate());

    expect(flight()).toHaveTextContent("+20 XP");
    expect(courseOf(flight()!)).toEqual({ left: "100px", top: "500px", x: "320px", y: "-204px" });
    landAll(flight()!);
    expect(flight()).toBeNull();
    expect(xpBar()).toHaveClass("reward-landed");
  });

  it("lands on the HUD level ring when the hero's XP bar is scrolled out of view", async () => {
    const { user } = openJourneyCrate(atLevel2);
    placeAt(within(journeyCrate()).getByText("Journey reward · 20 XP"), { x: 100, y: 500, width: 160, height: 20 });
    placeAt(xpBar(), { x: 300, y: -200, width: 400, height: 12 });
    placeAt(avatar(), { x: 1000, y: 10, width: 32, height: 32 });
    await openAndClose(user, journeyCrate());

    expect(courseOf(flight()!)).toMatchObject({ x: "836px", y: "-484px" });
    landAll(flight()!);
    expect(avatar()).toHaveClass("reward-landed");
  });

  it("holds the hero and the HUD short of the reward from the reveal until it lands, then fills both from the old share", async () => {
    const { user } = openJourneyCrate(atLevel2);
    expect(xpBar()).toHaveAttribute("aria-valuenow", "50");
    await user.click(within(journeyCrate()).getByRole("button", { name: "Open" }));
    expect(hudRing()).toHaveAccessibleName("Level 2, 30 XP to level 3");
    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));

    expect(xpBar()).toHaveAttribute("aria-valuenow", "30");
    expect(heroRing()).toHaveAccessibleName("Level 2, 30 XP to level 3");
    vi.useFakeTimers();
    landAll(flight()!);
    expect(xpBar()).toHaveAttribute("aria-valuenow", "50");
    expect(heroRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    expect(hudRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    expect(frame()).toHaveClass("reward-filling");
    expect(frame().style.getPropertyValue("--reward-from")).toBe("25");
    expect(xpBar()).toHaveAccessibleName("30 XP 10 XP to level 3");
    act(() => vi.advanceTimersByTime(1000));
    expect(xpBar()).toHaveAccessibleName("50 XP 10 XP to level 3");
  });

  it("across a level-up, holds the old level, then completes the ring and starts the new level without ever filling backwards", async () => {
    const { user } = openJourneyCrate(acrossALevel);
    await user.click(within(journeyCrate()).getByRole("button", { name: "Open" }));
    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));

    expect(heroRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    expect(xpBar()).toHaveAttribute("aria-valuenow", "90");
    vi.useFakeTimers();
    landAll(flight()!);
    expect(frame()).toHaveClass("reward-levelling");
    expect(frame()).not.toHaveClass("reward-filling");
    expect(frame().style.getPropertyValue("--reward-from")).toBe("87.5");
    expect(heroRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    act(() => vi.advanceTimersByTime(599));
    expect(heroRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    act(() => vi.advanceTimersByTime(1));
    expect(heroRing()).toHaveAccessibleName("Level 3, 190 XP to level 4");
    expect(heroRing()).toHaveClass("reward-landed");
    expect(avatar()).toHaveClass("reward-landed");
  });

  it("then, as the new level starts, flies the skill point it earned out of the hero's level ring onto the HUD skill point chip, which counts up", async () => {
    const { user } = openJourneyCrate(intoTheSixthLevel);
    await openAndClose(user, journeyCrate());
    placeAt(heroRing(), { x: 200, y: 200, width: 120, height: 120 });
    placeAt(skillPointChip(), { x: 900, y: 12, width: 48, height: 32 });

    expect(skillPointChip()).toHaveTextContent("1");
    vi.useFakeTimers();
    landAll(flight()!);
    expect(flight()).toBeNull();
    act(() => vi.advanceTimersByTime(600));
    expect(flight()).toHaveTextContent("+1 skill point");
    expect(courseOf(flight()!)).toEqual({ left: "200px", top: "200px", x: "664px", y: "-232px" });
    expect(skillPointChip()).toHaveTextContent("1");
    landAll(flight()!);
    expect(flight()).toBeNull();
    expect(skillPointChip()).toHaveClass("reward-landed");
    expect(skillPointChip()).toHaveAccessibleName("2 skill points to spend");
    expect(skillPointChip()).toHaveTextContent("1");
    act(() => vi.advanceTimersByTime(1000));
    expect(skillPointChip()).toHaveTextContent("2");
  });

  it("never flies under reduced motion: the bar shows the read's XP at once with a short fade", async () => {
    preferReducedMotion();
    const { user } = openJourneyCrate(atLevel2);
    placeAt(xpBar(), { x: 300, y: 300, width: 400, height: 12 });
    await user.click(within(journeyCrate()).getByRole("button", { name: "Open" }));
    vi.useFakeTimers();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));

    expect(flight()).toBeNull();
    expect(xpBar()).toHaveAttribute("aria-valuenow", "50");
    expect(xpBar()).toHaveClass("reward-faded");
    expect(frame()).not.toHaveClass("reward-filling");
  });
});

describe("#354 review: the held values stay true through motion changes and late XP", () => {
  it("lands the skill point at once with a fade when reduced motion is turned on while the level turns over", async () => {
    const { user } = openJourneyCrate(intoTheSixthLevel);
    await openAndClose(user, journeyCrate());
    vi.useFakeTimers();
    landAll(flight()!);
    preferReducedMotion();
    act(() => vi.advanceTimersByTime(600));

    expect(flight()).toBeNull();
    expect(skillPointChip()).toHaveTextContent("2");
    expect(skillPointChip()).toHaveClass("reward-faded");
  });

  it("keeps holding the skill point the flight set out with when more XP arrives before it lands", async () => {
    const { user, showVisitor } = openJourneyCrate(intoTheSixthLevel);
    await openAndClose(user, journeyCrate());
    vi.useFakeTimers();
    landAll(flight()!);
    act(() => vi.advanceTimersByTime(600));
    showVisitor({ ...intoTheSixthLevel, progression: { ...intoTheSixthLevel.progression!, xp: 1030, xpToNextLevel: 470 } });

    expect(flight()).toHaveTextContent("+1 skill point");
    expect(skillPointChip()).toHaveTextContent("1");
    expect(skillPointChip()).toHaveAccessibleName("1 skill point to spend");
    landAll(flight()!);
    expect(skillPointChip()).toHaveAccessibleName("2 skill points to spend");
  });
});

describe("#354 review round 2: fills restart and count-ups stop for reduced motion", () => {
  it("shows the hero's XP at once when reduced motion is turned on while it counts up", async () => {
    const { user } = openJourneyCrate(atLevel2);
    await openAndClose(user, journeyCrate());
    vi.useFakeTimers();
    landAll(flight()!);
    act(() => vi.advanceTimersByTime(120));
    preferReducedMotion();
    act(() => vi.advanceTimersByTime(40));

    expect(xpBar()).toHaveAccessibleName("50 XP 10 XP to level 3");
  });
});

describe("#354: the Skill tree crate's skill points fly onto the HUD chip", () => {
  it("shows the chip at 0 from the reveal, flies +{n} skill point from the crate onto it, and counts up once it lands", async () => {
    let shown = skillTreeReady;
    const { user, showVisitor } = renderApp(shown, undefined, {
      openFeature: async () => {
        shown = skillTreeOpened;
        return { kind: "opened" };
      },
    });
    const panel = within(main()).getByRole("heading", { name: "Unlocks: Skill tree" }).closest("article")!;
    await user.click(within(panel).getByRole("button", { name: "Open" }));
    showVisitor(shown);
    expect(skillPointChip()).toHaveTextContent("0");
    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));

    expect(flight()).toHaveTextContent("+1 skill point");
    vi.useFakeTimers();
    landAll(flight()!);
    expect(flight()).toBeNull();
    expect(skillPointChip()).toHaveTextContent("0");
    act(() => vi.advanceTimersByTime(1000));
    expect(skillPointChip()).toHaveTextContent("1");
  });

  it("sends nothing flying from a crate that pays no reward", async () => {
    const { user } = renderApp(shellFixtures.memberWithTheBoardReady, undefined, { openFeature: async () => ({ kind: "opened" }) });
    const panel = within(main()).getByRole("heading", { name: "Unlocks: Leaderboard" }).closest("article")!;
    await user.click(within(panel).getByRole("button", { name: "Open" }));
    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));

    expect(flight()).toBeNull();
  });
});
