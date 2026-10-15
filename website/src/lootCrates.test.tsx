import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { burstPlaysForMs, crateChargesForMs } from "./crates/RevealDialog";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { shellFixtures, type Drop, type MemberProfile, type MyQuests, type OpenAnswer } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferReducedMotion } from "./test/systemTheme";

const payingCoins: MemberProfile = { ...shellFixtures.memberCrossingIntoLevel6, coins: 236 };

const coinsQuest = "Thank someone you haven't thanked before.";

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

function journeyStep(goal: string) {
  return within(within(main()).getByRole("region", { name: "Journey" })).getByRole("heading", { name: goal }).closest("li")!;
}

function tokens() {
  return [...(dialog()?.querySelectorAll<HTMLElement>("[data-reward-token]") ?? [])];
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

function xpBar() {
  return within(main()).getByRole("progressbar", { name: / XP to level / });
}

function rewardChips() {
  return within(within(dialog()!).getByRole("list", { name: "Rewards" }))
    .getAllByRole("listitem")
    .map((chip) => chip.textContent);
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

const opened = async (): Promise<OpenAnswer> => ({ kind: "opened" });

async function claimTheCoinsQuest(answer: MyQuests = questsFixtures.weekPayingCoins, visitor: MemberProfile = payingCoins) {
  window.history.replaceState(null, "", "/quests");
  const view = renderApp(visitor, undefined, { openQuestCrate: opened }, fixedQuests(answer));
  vi.useFakeTimers();
  fireEvent.click(within(cardOf(coinsQuest)).getByRole("button", { name: "Claim" }));
  await act(async () => {});
  return view;
}

async function claimUntilTheTokensFly() {
  const view = await claimTheCoinsQuest();
  advance(crateChargesForMs);
  placeAt(avatar(), { x: 1000, y: 10, width: 32, height: 32 });
  placeAt(skillPointChip(), { x: 900, y: 12, width: 48, height: 32 });
  placeAt(coinsChip(), { x: 820, y: 12, width: 56, height: 32 });
  placeAt(tokenOf("xp"), { x: 200, y: 400, width: 120, height: 48 });
  placeAt(tokenOf("skillPoints"), { x: 340, y: 400, width: 160, height: 48 });
  placeAt(tokenOf("coins"), { x: 520, y: 400, width: 120, height: 48 });
  advance(burstPlaysForMs);
  return view;
}

describe("#452: a closed crate spoils nothing", () => {
  it("labels a quest crate with its kind alone, never the amounts inside", () => {
    renderApp(payingCoins, undefined, undefined, fixedQuests(questsFixtures.weekPayingCoins));
    const step = journeyStep("Finish a weekly quest.");

    expect(step).toHaveTextContent("Journey reward");
    expect(step).not.toHaveTextContent(/XP|coin/);
    expect(within(step).getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("charges the crate first, naming nothing, then bursts each reward out as a token while the HUD holds its values", async () => {
    await claimTheCoinsQuest();

    expect(dialog()).toHaveAttribute("data-phase", "charging");
    expect(tokens()).toEqual([]);
    expect(dialog()!.querySelector('[aria-hidden="true"][data-stage="charging"]')).not.toBeNull();
    expect(within(dialog()!).getByText("Quest reward")).toBeInTheDocument();
    advance(crateChargesForMs);
    expect(dialog()).toHaveAttribute("data-phase", "bursting");
    expect(tokens().map((token) => token.textContent)).toEqual(["+20 XP", "+1 skill point", "+10 coins"]);
    expect(tokens().map((token) => token.getAttribute("data-reward-token"))).toEqual(["xp", "skillPoints", "coins"]);
    expect(flight()).toBeNull();
    expect(hudRing()).toHaveAccessibleName("Level 5, 10 XP to level 6");
    expect(skillPointChip()).toHaveTextContent("1");
    expect(coinsChip()).toHaveTextContent("226");
  });
});

describe("#452: each token flies into the HUD home that holds it, which counts up as it lands", () => {
  it("keeps the HUD in view above the reveal, inert, so the tokens have somewhere to land", async () => {
    await claimTheCoinsQuest();

    expect(frame()).toHaveAttribute("data-revealing");
    expect(header().closest("[inert]")).not.toBeNull();
  });

  it("flies the XP token from the stage into the HUD level ring", async () => {
    await claimUntilTheTokensFly();

    expect(dialog()).toHaveAttribute("data-phase", "flying");
    expect(flight()).toHaveTextContent("+20 XP");
    expect(courseOf(flight()!)).toEqual({ left: "200px", top: "400px", x: "756px", y: "-398px" });
    expect(tokenOf("xp")).toHaveAttribute("data-flown");
    expect(tokenOf("skillPoints")).not.toHaveAttribute("data-flown");
  });

  it("aims at the HUD ring, never the hero's bar lying under the reveal", async () => {
    renderApp(shellFixtures.memberCrossingIntoLevel6, undefined, { openQuestCrate: opened }, fixedQuests(questsFixtures.week));
    vi.useFakeTimers();
    fireEvent.click(within(journeyStep("Finish a weekly quest.")).getByRole("button", { name: "Open" }));
    await act(async () => {});
    advance(crateChargesForMs);
    placeAt(xpBar(), { x: 300, y: 300, width: 400, height: 12 });
    placeAt(avatar(), { x: 1000, y: 10, width: 32, height: 32 });
    placeAt(tokenOf("xp"), { x: 200, y: 400, width: 120, height: 48 });
    advance(burstPlaysForMs);

    expect(courseOf(flight()!)).toEqual({ left: "200px", top: "400px", x: "756px", y: "-398px" });
  });

  it("completes the old level, turns it over, then flies the skill point and the coins from their tokens onto the chips, which count up", async () => {
    await claimUntilTheTokensFly();
    landAll(flight()!);

    expect(avatar()).toHaveClass("reward-landed");
    expect(frame()).toHaveClass("reward-levelling");
    expect(hudRing()).toHaveAccessibleName("Level 5, 10 XP to level 6");
    advance(600);
    expect(hudRing()).toHaveAccessibleName("Level 6, 490 XP to level 7");
    expect(flight()).toHaveTextContent("+1 skill point");
    expect(courseOf(flight()!)).toEqual({ left: "340px", top: "400px", x: "504px", y: "-396px" });
    landAll(flight()!);
    expect(skillPointChip()).toHaveClass("reward-landed");
    expect(skillPointChip()).toHaveAccessibleName("2 skill points to spend");
    expect(skillPointChip()).toHaveTextContent("1");
    advance(1000);
    expect(skillPointChip()).toHaveTextContent("2");
    expect(flight()).toHaveTextContent("+10 coins");
    expect(courseOf(flight()!)).toEqual({ left: "520px", top: "400px", x: "268px", y: "-396px" });
    landAll(flight()!);
    expect(coinsChip()).toHaveClass("reward-landed");
    expect(coinsChip()).toHaveAccessibleName("236 coins to spend");
    advance(1000);
    expect(coinsChip()).toHaveTextContent("236");
    expect(flight()).toBeNull();
  });

  it("ends on one clear finish once the last token lands: the headline, the chips and Done", async () => {
    await claimUntilTheTokensFly();
    landAll(flight()!);
    advance(600);
    landAll(flight()!);
    landAll(flight()!);

    expect(dialog()).toHaveAttribute("data-phase", "ended");
    expect(within(dialog()!).getByRole("heading", { name: "You earned 20 XP and 10 coins" })).toBeVisible();
    expect(rewardChips()).toEqual(["+20 XP", "+1 skill point", "+10 coins"]);
    expect(within(dialog()!).getByRole("button", { name: "Done" })).toHaveFocus();
    expect(screen.getByTestId("moment-announcement")).toHaveTextContent("You opened your quest reward. You earned 20 XP and 10 coins.");
  });

  it("keeps a flight's course and its count of landings when the member's read changes mid-flight (review round 1)", async () => {
    const { showVisitor } = await claimUntilTheTokensFly();
    const particles = [...flight()!.querySelectorAll("[data-particle]")];
    for (const particle of particles.slice(0, 3)) fireEvent.animationEnd(particle);
    showVisitor({ ...payingCoins, thisWeek: { given: 3, received: 1 } });
    expect(flight()).not.toBeNull();
    for (const particle of flight()!.querySelectorAll("[data-particle]")) if (!particles.slice(0, 3).includes(particle)) fireEvent.animationEnd(particle);

    expect(frame()).toHaveClass("reward-levelling");
  });

  it("replays the burst and the flights from the finish without touching the HUD, which already holds the values (review round 1)", async () => {
    await claimUntilTheTokensFly();
    landAll(flight()!);
    advance(600);
    landAll(flight()!);
    landAll(flight()!);
    advance(1000);
    fireEvent.click(within(dialog()!).getByRole("button", { name: "Replay" }));

    expect(dialog()).toHaveAttribute("data-phase", "charging");
    advance(crateChargesForMs);
    expect(tokens().map((token) => token.textContent)).toEqual(["+20 XP", "+1 skill point", "+10 coins"]);
    placeAt(tokenOf("xp"), { x: 200, y: 400, width: 120, height: 48 });
    advance(burstPlaysForMs);
    expect(dialog()).toHaveAttribute("data-phase", "flying");
    expect(flight()).toHaveTextContent("+20 XP");
    landAll(flight()!);
    expect(frame()).not.toHaveClass("reward-levelling");
    expect(hudRing()).toHaveAccessibleName("Level 6, 490 XP to level 7");
    expect(flight()).toHaveTextContent("+1 skill point");
    landAll(flight()!);
    landAll(flight()!);
    expect(dialog()).toHaveAttribute("data-phase", "ended");
    expect(coinsChip()).toHaveTextContent("236");
  });

  it("flies from a crate the ready pill opened too", async () => {
    renderApp(shellFixtures.memberCrossingIntoLevel6, undefined, { openQuestCrate: opened }, fixedQuests(questsFixtures.week));
    vi.useFakeTimers();
    fireEvent.click(within(header()).getByRole("button", { name: "2 ready" }));
    await act(async () => {});
    advance(crateChargesForMs);
    expect(tokens().map((token) => token.textContent)).toEqual(["+20 XP", "+1 skill point"]);
    advance(burstPlaysForMs);

    expect(flight()).toHaveTextContent("+20 XP");
  });
});

describe("#452: skipping and reduced motion land every reward at once", () => {
  it("lands everything when Esc skips the charge, and ends on the finish", async () => {
    await claimTheCoinsQuest();
    fireEvent.keyDown(dialog()!, { key: "Escape" });

    expect(dialog()).toHaveAttribute("data-phase", "ended");
    expect(flight()).toBeNull();
    expect(tokens()).toEqual([]);
    expect(hudRing()).toHaveAccessibleName("Level 6, 490 XP to level 7");
    expect(coinsChip()).toHaveClass("reward-faded");
    advance(1000);
    expect(skillPointChip()).toHaveTextContent("2");
    expect(coinsChip()).toHaveTextContent("236");
    expect(rewardChips()).toEqual(["+20 XP", "+1 skill point", "+10 coins"]);
  });

  it("lands the rest when a click skips mid-flight", async () => {
    await claimUntilTheTokensFly();
    landAll(flight()!);
    fireEvent.click(dialog()!);

    expect(dialog()).toHaveAttribute("data-phase", "ended");
    expect(flight()).toBeNull();
    expect(hudRing()).toHaveAccessibleName("Level 6, 490 XP to level 7");
    advance(1000);
    expect(skillPointChip()).toHaveTextContent("2");
    expect(coinsChip()).toHaveTextContent("236");
  });

  it("shows a calm static reveal under reduced motion: the finish and every value at once, nothing flies", async () => {
    preferReducedMotion();
    await claimTheCoinsQuest();

    expect(dialog()).toHaveAttribute("data-motion", "reduced");
    expect(dialog()).toHaveAttribute("data-phase", "ended");
    expect(flight()).toBeNull();
    expect(tokens()).toEqual([]);
    expect(rewardChips()).toEqual(["+20 XP", "+1 skill point", "+10 coins"]);
    expect(hudRing()).toHaveAccessibleName("Level 6, 490 XP to level 7");
    expect(skillPointChip()).toHaveTextContent("2");
    expect(coinsChip()).toHaveTextContent("236");
    expect(coinsChip()).toHaveClass("reward-faded");
  });
});

describe("#452: the reveal's last beat is the hoggie card a drop brings, which no answer carries yet", () => {
  const epicWizard: Drop = { hoggie: "wizard", name: "Wizard", rarity: "epic", art: { kind: "hoggie", slug: "wizard" }, copy: 1, isNew: true };
  const anotherAngel: Drop = { hoggie: "angel", name: "Angel", rarity: "common", art: { kind: "hoggie", slug: "angel" }, copy: 3, isNew: false };

  async function claimADrop(drop: Drop) {
    window.history.replaceState(null, "", "/quests");
    renderApp(payingCoins, undefined, { openQuestCrate: async () => ({ kind: "opened", drop }) }, fixedQuests(questsFixtures.weekPayingCoins));
    vi.useFakeTimers();
    fireEvent.click(within(cardOf(coinsQuest)).getByRole("button", { name: "Claim" }));
    await act(async () => {});
  }

  it("bursts the hoggie out last as a card with its rarity and New!, keeps it on the stage, and lists it in the finish", async () => {
    await claimADrop(epicWizard);
    advance(crateChargesForMs);

    expect(tokens().map((token) => token.textContent)).toEqual(["+20 XP", "+1 skill point", "+10 coins", "WizardNew!🟪 Epic"]);
    expect(tokenOf("drop")).toHaveAttribute("data-rarity", "epic");
    fireEvent.keyDown(dialog()!, { key: "Escape" });
    expect(rewardChips()).toEqual(["+20 XP", "+1 skill point", "+10 coins", "Wizard · 🟪 Epic · New!"]);
  });

  it("marks a duplicate with its copy count instead of New!", async () => {
    await claimADrop(anotherAngel);
    advance(crateChargesForMs);

    expect(tokenOf("drop")).toHaveTextContent("Angel×3⬜ Common");
    expect(tokenOf("drop")).toHaveAttribute("data-rarity", "common");
    fireEvent.keyDown(dialog()!, { key: "Escape" });
    expect(rewardChips()).toEqual(["+20 XP", "+1 skill point", "+10 coins", "Angel · ⬜ Common · ×3"]);
  });
});
