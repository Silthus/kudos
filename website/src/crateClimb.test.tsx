import { act, fireEvent, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { burstPlaysForMs, crateChargesForMs } from "./crates/RevealDialog";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { shellFixtures, type AppliedReward, type JourneyStep, type MemberProfile, type MyQuests, type OpenAnswer } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferReducedMotion } from "./test/systemTheme";

const coinsQuest = "Thank someone you haven't thanked before.";

const afterTheOpen: MemberProfile = { ...shellFixtures.memberCrossingIntoLevel6, coins: 236 };

const acrossLevel6: AppliedReward = { xp: 20, coins: 10, from: { xp: 990, level: 5, coins: 226, skillPoints: 1 }, to: { xp: 1010, level: 6, coins: 236, skillPoints: 2 } };

const withinLevel6: AppliedReward = { xp: 20, coins: 10, from: { xp: 1010, level: 6, coins: 226, skillPoints: 2 }, to: { xp: 1030, level: 6, coins: 236, skillPoints: 2 } };

const paying = questsFixtures.weekPayingCoins;

const finishedWaiting: MyQuests = { ...paying, slots: paying.slots.map((slot) => (slot.goal === coinsQuest ? { ...slot, waiting: true } : slot)), waiting: paying.waiting.map((crate) => ({ ...crate, waiting: true })), bonus: { ...paying.bonus!, state: "finished", waiting: true, crate: { kind: "journey", step: "your-emoji" }, seen: "e1f2a3" } };

beforeEach(() => {
  fakeSystemTheme(false);
  localStorage.clear();
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

function cardOf(goal: string) {
  return within(main()).getByRole("heading", { name: goal }).closest("article")!;
}

function tokens() {
  return [...(dialog()?.querySelectorAll<HTMLElement>("[data-reward-token]") ?? [])].map((token) => token.textContent);
}

function tokenOf(kind: string) {
  return dialog()!.querySelector<HTMLElement>(`[data-reward-token="${kind}"]`)!;
}

function flight() {
  return document.querySelector<HTMLElement>("[data-reward-flight]");
}

function frame() {
  return document.querySelector<HTMLElement>(".hud-root")!;
}

function avatar() {
  return within(header()).getByRole("link", { name: /^Sam Example/ });
}

function hudRing() {
  return within(avatar()).getByRole("img", { name: /^Level / });
}

function skillPointChip() {
  return within(header()).getByRole("link", { name: /skill points? to spend$/ });
}

function coinsChip() {
  return within(header()).getByRole("img", { name: /coins to spend$/ });
}

function hud() {
  return { level: hudRing().getAttribute("aria-label"), skillPoints: skillPointChip().textContent, coins: coinsChip().textContent };
}

function placeAt(element: Element, rect: { x: number; y: number; width: number; height: number }) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect(rect));
}

function landAll(chip: HTMLElement) {
  for (const particle of chip.querySelectorAll("[data-particle]")) fireEvent.animationEnd(particle);
}

function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

function answering(applied: AppliedReward | null) {
  return async (): Promise<OpenAnswer> => ({ kind: "opened", applied });
}

async function claim(applied: AppliedReward | null, visitor: MemberProfile = afterTheOpen, quests: MyQuests = paying) {
  window.history.replaceState(null, "", "/quests");
  const view = renderApp(visitor, undefined, { openQuestCrate: answering(applied) }, fixedQuests(quests));
  vi.useFakeTimers();
  fireEvent.click(within(cardOf(coinsQuest)).getByRole("button", { name: "Claim" }));
  await act(async () => {});
  return view;
}

function burst() {
  advance(crateChargesForMs);
  placeAt(avatar(), { x: 1000, y: 10, width: 32, height: 32 });
  placeAt(skillPointChip(), { x: 900, y: 12, width: 48, height: 32 });
  placeAt(coinsChip(), { x: 820, y: 12, width: 56, height: 32 });
  for (const kind of ["xp", "skillPoints", "coins"]) if (dialog()!.querySelector(`[data-reward-token="${kind}"]`) !== null) placeAt(tokenOf(kind), { x: 200, y: 400, width: 120, height: 48 });
  advance(burstPlaysForMs);
}

describe("#450: the climb on the open, from the answer's from to its to", () => {
  it("pins the header at from while the tokens fly, lands each one, and turns the level over once", async () => {
    await claim(acrossLevel6);
    expect(hud()).toEqual({ level: "Level 5, 10 XP to level 6", skillPoints: "1", coins: "226" });
    burst();
    expect(tokens()).toEqual(["+20 XP", "+1 skill point", "+10 coins"]);

    landAll(flight()!);
    expect(frame()).toHaveClass("reward-levelling");
    expect(hud().level).toBe("Level 5, 10 XP to level 6");
    advance(600);
    expect(hud().level).toBe("Level 6, 490 XP to level 7");
    landAll(flight()!);
    expect(skillPointChip()).toHaveAccessibleName("2 skill points to spend");
    landAll(flight()!);
    expect(coinsChip()).toHaveAccessibleName("236 coins to spend");
    advance(1000);
    expect(hud()).toEqual({ level: "Level 6, 490 XP to level 7", skillPoints: "2", coins: "236" });
    expect(screen.getByTestId("level-up-announcement")).toHaveTextContent("You reached level 6. You earned 1 skill point.");
  });

  it("stays within the level when the answer crosses none: no skill point token, no turnover", async () => {
    await claim(withinLevel6, { ...afterTheOpen, progression: { level: 6, xp: 1030, levelStartsAt: 1000, nextLevelAt: 1500, xpToNextLevel: 470 } });
    expect(hud()).toEqual({ level: "Level 6, 490 XP to level 7", skillPoints: "2", coins: "226" });
    burst();
    expect(tokens()).toEqual(["+20 XP", "+10 coins"]);

    landAll(flight()!);
    expect(frame()).toHaveClass("reward-filling");
    expect(frame()).not.toHaveClass("reward-levelling");
    expect(hud().level).toBe("Level 6, 470 XP to level 7");
    expect(screen.getByTestId("level-up-announcement")).toHaveTextContent("");
  });

  it("climbs from the stored answer's numbers even when the read has moved past them, as after an open in Slack", async () => {
    const movedOn: MemberProfile = { ...afterTheOpen, progression: { level: 6, xp: 1050, levelStartsAt: 1000, nextLevelAt: 1500, xpToNextLevel: 450 }, coins: 241 };
    await claim(acrossLevel6, movedOn);
    expect(hud()).toEqual({ level: "Level 5, 10 XP to level 6", skillPoints: "1", coins: "226" });
    burst();

    landAll(flight()!);
    advance(600);
    expect(hud().level).toBe("Level 6, 490 XP to level 7");
    landAll(flight()!);
    landAll(flight()!);
    advance(1000);
    expect(hud()).toEqual({ level: "Level 6, 490 XP to level 7", skillPoints: "2", coins: "236" });
    fireEvent.click(within(dialog()!).getByRole("button", { name: "Done" }));
    advance(1000);
    expect(hud()).toEqual({ level: "Level 6, 450 XP to level 7", skillPoints: "2", coins: "241" });
  });

  it("shows the answer's to once a token lands, not a read that moved past it, and celebrates the level the crate earned (review round 1)", async () => {
    const twoLevelsOn: MemberProfile = { ...afterTheOpen, progression: { level: 7, xp: 1510, levelStartsAt: 1500, nextLevelAt: 2100, xpToNextLevel: 590 }, skillPoints: 3, coins: 250 };
    await claim(acrossLevel6, twoLevelsOn);
    expect(hud()).toEqual({ level: "Level 5, 10 XP to level 6", skillPoints: "1", coins: "226" });
    burst();

    landAll(flight()!);
    advance(600);
    expect(hud().level).toBe("Level 6, 490 XP to level 7");
    expect(screen.getByTestId("level-up-announcement")).toHaveTextContent("You reached level 6. You earned 1 skill point.");
    landAll(flight()!);
    expect(skillPointChip()).toHaveAccessibleName("2 skill points to spend");
    landAll(flight()!);
    expect(coinsChip()).toHaveAccessibleName("236 coins to spend");
    advance(1000);
    expect(dialog()).toHaveAttribute("data-phase", "ended");
    expect(hud()).toEqual({ level: "Level 6, 490 XP to level 7", skillPoints: "2", coins: "236" });
    fireEvent.click(within(dialog()!).getByRole("button", { name: "Done" }));
    advance(1000);
    expect(hud()).toEqual({ level: "Level 7, 590 XP to level 8", skillPoints: "3", coins: "250" });
  });

  it("celebrates a crossed level once when the read reached it before the answer pinned the header below it (review round 1)", async () => {
    let answer!: (opened: OpenAnswer) => void;
    window.history.replaceState(null, "", "/quests");
    const before: MemberProfile = { ...afterTheOpen, progression: { level: 5, xp: 990, levelStartsAt: 600, nextLevelAt: 1000, xpToNextLevel: 10 }, skillPoints: 1, coins: 226 };
    const { showVisitor } = renderApp(before, undefined, { openQuestCrate: () => new Promise((resolve) => (answer = resolve)) }, fixedQuests(paying));
    vi.useFakeTimers();
    fireEvent.click(within(cardOf(coinsQuest)).getByRole("button", { name: "Claim" }));
    showVisitor(afterTheOpen);
    expect(screen.getByTestId("level-up-announcement")).toHaveTextContent("");
    await act(async () => answer({ kind: "opened", applied: acrossLevel6 }));
    expect(hud().level).toBe("Level 5, 10 XP to level 6");
    expect(screen.getByTestId("level-up-announcement")).toHaveTextContent("");
    burst();

    landAll(flight()!);
    advance(600);
    expect(document.querySelectorAll("[data-level-up]")).toHaveLength(1);
    expect(screen.getByTestId("level-up-announcement")).toHaveTextContent("You reached level 6. You earned 1 skill point.");
    landAll(flight()!);
    landAll(flight()!);
    advance(3000);
    expect(document.querySelectorAll("[data-level-up]")).toHaveLength(0);
    expect(hud()).toEqual({ level: "Level 6, 490 XP to level 7", skillPoints: "2", coins: "236" });
  });

  it("reveals without a climb when applied is null: the crate still bursts, the header never moves", async () => {
    await claim(null);
    const before = hud();
    expect(before).toEqual({ level: "Level 6, 490 XP to level 7", skillPoints: "2", coins: "236" });
    burst();
    expect(tokens()).toEqual(["+20 XP", "+10 coins"]);

    while (flight() !== null) {
      landAll(flight()!);
      advance(600);
    }
    expect(frame()).not.toHaveClass("reward-filling");
    expect(frame()).not.toHaveClass("reward-levelling");
    expect(hud()).toEqual(before);
    expect(dialog()).toHaveAttribute("data-phase", "ended");
    expect(within(dialog()!).getByRole("heading", { name: "You earned 20 XP and 10 coins" })).toBeVisible();
  });

  it("lands everything at once on a skip, at the answer's to", async () => {
    await claim(acrossLevel6);
    fireEvent.keyDown(dialog()!, { key: "Escape" });
    advance(1000);

    expect(hud()).toEqual({ level: "Level 6, 490 XP to level 7", skillPoints: "2", coins: "236" });
    expect(dialog()).toHaveAttribute("data-phase", "ended");
  });

  it("shows the after state at once under reduced motion, with one announcement of the open and one of the level", async () => {
    preferReducedMotion();
    await claim(acrossLevel6);

    expect(dialog()).toHaveAttribute("data-phase", "ended");
    expect(flight()).toBeNull();
    expect(hud()).toEqual({ level: "Level 6, 490 XP to level 7", skillPoints: "2", coins: "236" });
    expect(screen.getByTestId("moment-announcement")).toHaveTextContent("You opened your quest reward. You earned 20 XP and 10 coins.");
    expect(screen.getByTestId("level-up-announcement")).toHaveTextContent("You reached level 6. You earned 1 skill point.");
  });
});

describe("#450: +N XP waiting while a reward waits in its crate", () => {
  it("says it on the finished quest card, the bonus card and an earlier week's crate on /quests, and not on a card whose reward counted", () => {
    window.history.replaceState(null, "", "/quests");
    renderApp(afterTheOpen, undefined, undefined, fixedQuests(finishedWaiting));

    expect(cardOf(coinsQuest)).toHaveTextContent("+20 XP waiting");
    expect(cardOf("Give a kudos that says why with one of your kudos emoji.")).toHaveTextContent("+40 XP waiting");
    expect(cardOf("Thank someone and say why on 2 different days.")).toHaveTextContent("+20 XP waiting");
    expect(cardOf("Thank someone and say why, 3 times.")).toHaveTextContent("+20 XP");
    expect(cardOf("Thank someone and say why, 3 times.")).not.toHaveTextContent("waiting");
  });

  it("says it on the home's quest rows and the Journey's finished step", () => {
    const stepWaiting: JourneyStep = { ...shellFixtures.memberWithQuests.journey![1]!, waiting: true };
    renderApp({ ...afterTheOpen, journey: [stepWaiting] }, undefined, undefined, fixedQuests(finishedWaiting));
    const rows = within(main()).getByRole("region", { name: "Quests this week" });
    const journey = within(main()).getByRole("region", { name: "Journey" });

    expect(within(rows).getByRole("link", { name: new RegExp(`^${coinsQuest}`) }).closest("li")).toHaveTextContent("+20 XP waiting");
    expect(within(rows).getByRole("link", { name: /^Give a kudos that says why with one of your kudos emoji/ }).closest("li")).toHaveTextContent("+40 XP waiting");
    expect(within(journey).getByRole("heading", { name: "Finish a weekly quest." }).closest("li")).toHaveTextContent("+20 XP waiting");
    expect(within(journey).getByRole("heading", { name: "Finish a weekly quest." }).closest("li")).not.toHaveTextContent(/coin/);
  });

  for (const dark of [false, true]) {
    it(`passes axe with waiting rows and the climbing reveal in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      window.history.replaceState(null, "", "/quests");
      const { container } = renderApp(afterTheOpen, undefined, { openQuestCrate: answering(acrossLevel6) }, fixedQuests(finishedWaiting));
      expect(await violationsIn(container)).toEqual([]);
      vi.useFakeTimers();
      fireEvent.click(within(cardOf(coinsQuest)).getByRole("button", { name: "Claim" }));
      await act(async () => {});
      burst();
      vi.useRealTimers();
      expect(await violationsIn(document.body)).toEqual([]);
    }, 30_000);
  }
});

async function violationsIn(container: Element) {
  const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}
