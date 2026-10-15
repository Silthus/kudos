import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { burstPlaysForMs, crateChargesForMs } from "./crates/RevealDialog";
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
  return document.querySelector<HTMLElement>(".hud-root > header")!;
}

function dialog() {
  return screen.queryByRole("dialog");
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

function tokenOf(kind: string) {
  return dialog()!.querySelector<HTMLElement>(`[data-reward-token="${kind}"]`)!;
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

function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

function showJourneyCrate(member: MemberProfile) {
  return renderApp(member, undefined, { openQuestCrate: async () => ({ kind: "opened" }) }, fixedQuests(questsFixtures.week));
}

async function openTheCrate(region: HTMLElement, name = "Open") {
  vi.useFakeTimers();
  fireEvent.click(within(region).getByRole("button", { name }));
  await act(async () => {});
}

async function openUntilTheTokensFly(region: HTMLElement) {
  await openTheCrate(region);
  advance(crateChargesForMs);
  placeAt(avatar(), { x: 1000, y: 10, width: 32, height: 32 });
  placeAt(tokenOf("xp"), { x: 100, y: 500, width: 160, height: 48 });
  advance(burstPlaysForMs);
}

describe("#354 #452: a Journey crate's XP flies out of the reveal into the HUD level ring, and the hero fills behind it", () => {
  it("flies +{xp} XP from its token to the HUD level ring, which bumps when it lands", async () => {
    showJourneyCrate(atLevel2);
    await openUntilTheTokensFly(journeyCrate());

    expect(flight()).toHaveTextContent("+20 XP");
    expect(courseOf(flight()!)).toEqual({ left: "100px", top: "500px", x: "836px", y: "-498px" });
    landAll(flight()!);
    expect(flight()).toBeNull();
    expect(avatar()).toHaveClass("reward-landed");
  });

  it("holds the hero and the HUD short of the reward from the reveal until it lands, then fills both from the old share", async () => {
    showJourneyCrate(atLevel2);
    expect(xpBar()).toHaveAttribute("aria-valuenow", "50");
    await openTheCrate(journeyCrate());
    expect(hudRing()).toHaveAccessibleName("Level 2, 30 XP to level 3");
    expect(xpBar()).toHaveAttribute("aria-valuenow", "30");
    expect(heroRing()).toHaveAccessibleName("Level 2, 30 XP to level 3");
    advance(crateChargesForMs);
    advance(burstPlaysForMs);

    landAll(flight()!);
    expect(xpBar()).toHaveAttribute("aria-valuenow", "50");
    expect(heroRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    expect(hudRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    expect(frame()).toHaveClass("reward-filling");
    expect(frame().style.getPropertyValue("--reward-from")).toBe("25");
    expect(xpBar()).toHaveAccessibleName("30 XP 10 XP to level 3");
    advance(1000);
    expect(xpBar()).toHaveAccessibleName("50 XP 10 XP to level 3");
  });

  it("across a level-up, holds the old level, then completes the ring and starts the new level without ever filling backwards", async () => {
    showJourneyCrate(acrossALevel);
    await openTheCrate(journeyCrate());
    advance(crateChargesForMs);
    advance(burstPlaysForMs);

    expect(heroRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    expect(xpBar()).toHaveAttribute("aria-valuenow", "90");
    landAll(flight()!);
    expect(frame()).toHaveClass("reward-levelling");
    expect(frame()).not.toHaveClass("reward-filling");
    expect(frame().style.getPropertyValue("--reward-from")).toBe("87.5");
    expect(heroRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    advance(599);
    expect(heroRing()).toHaveAccessibleName("Level 2, 10 XP to level 3");
    advance(1);
    expect(heroRing()).toHaveAccessibleName("Level 3, 190 XP to level 4");
    expect(heroRing()).toHaveClass("reward-landed");
    expect(avatar()).toHaveClass("reward-landed");
  });

  it("then, as the new level starts, flies the skill point it earned from its token onto the HUD skill point chip, which counts up", async () => {
    showJourneyCrate(intoTheSixthLevel);
    await openUntilTheTokensFly(journeyCrate());
    placeAt(tokenOf("skillPoints"), { x: 300, y: 500, width: 200, height: 48 });
    placeAt(skillPointChip(), { x: 900, y: 12, width: 48, height: 32 });

    expect(skillPointChip()).toHaveTextContent("1");
    landAll(flight()!);
    expect(flight()).toBeNull();
    advance(600);
    expect(flight()).toHaveTextContent("+1 skill point");
    expect(courseOf(flight()!)).toEqual({ left: "300px", top: "500px", x: "524px", y: "-496px" });
    expect(skillPointChip()).toHaveTextContent("1");
    landAll(flight()!);
    expect(flight()).toBeNull();
    expect(skillPointChip()).toHaveClass("reward-landed");
    expect(skillPointChip()).toHaveAccessibleName("2 skill points to spend");
    expect(skillPointChip()).toHaveTextContent("1");
    advance(1000);
    expect(skillPointChip()).toHaveTextContent("2");
  });

  it("never flies under reduced motion: the bar shows the read's XP at once, and the ring fades in", async () => {
    preferReducedMotion();
    showJourneyCrate(atLevel2);
    await openTheCrate(journeyCrate());

    expect(flight()).toBeNull();
    expect(xpBar()).toHaveAttribute("aria-valuenow", "50");
    expect(avatar()).toHaveClass("reward-faded");
    expect(frame()).not.toHaveClass("reward-filling");
  });
});

describe("#354 review: the held values stay true through motion changes and late XP", () => {
  it("lands the skill point at once with a fade when reduced motion is turned on while the level turns over", async () => {
    showJourneyCrate(intoTheSixthLevel);
    await openUntilTheTokensFly(journeyCrate());
    landAll(flight()!);
    preferReducedMotion();
    advance(600);

    expect(flight()).toBeNull();
    expect(skillPointChip()).toHaveTextContent("2");
    expect(skillPointChip()).toHaveClass("reward-faded");
  });

  it("keeps holding the skill point the flight set out with when more XP arrives before it lands", async () => {
    const { showVisitor } = showJourneyCrate(intoTheSixthLevel);
    await openUntilTheTokensFly(journeyCrate());
    landAll(flight()!);
    advance(600);
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
    showJourneyCrate(atLevel2);
    await openUntilTheTokensFly(journeyCrate());
    landAll(flight()!);
    advance(120);
    preferReducedMotion();
    advance(40);

    expect(xpBar()).toHaveAccessibleName("50 XP 10 XP to level 3");
  });
});

describe("#354 #452: the Skill tree crate's skill points fly out of the reveal onto the HUD chip", () => {
  it("shows the chip at 0 from the reveal, bursts +{n} skill point out of the crate, flies it onto the chip, and counts up once it lands", async () => {
    let shown = skillTreeReady;
    const { showVisitor } = renderApp(shown, undefined, {
      openFeature: async () => {
        shown = skillTreeOpened;
        return { kind: "opened" };
      },
    });
    const panel = within(main()).getByRole("heading", { name: "Unlocks: Skill tree" }).closest("article")!;
    await openTheCrate(panel);
    showVisitor(shown);
    expect(skillPointChip()).toHaveTextContent("0");
    advance(crateChargesForMs);
    expect(tokenOf("skillPoints")).toHaveTextContent("+1 skill point");
    advance(burstPlaysForMs);

    expect(flight()).toHaveTextContent("+1 skill point");
    landAll(flight()!);
    expect(flight()).toBeNull();
    expect(skillPointChip()).toHaveTextContent("0");
    advance(1000);
    expect(skillPointChip()).toHaveTextContent("1");
  });

  it("sends nothing flying from a crate that pays no reward, and ends after the burst", async () => {
    renderApp(shellFixtures.memberWithTheBoardReady, undefined, { openFeature: async () => ({ kind: "opened" }) });
    const panel = within(main()).getByRole("heading", { name: "Unlocks: Leaderboard" }).closest("article")!;
    await openTheCrate(panel);
    advance(crateChargesForMs);
    advance(burstPlaysForMs);

    expect(flight()).toBeNull();
    expect(dialog()).toHaveAttribute("data-phase", "ended");
  });
});
