import { act, fireEvent, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bonusSteps, fixedQuests, questsFixtures } from "./questsFixtures";
import { shellFixtures, type JourneyStep, type MemberProfile, type MyQuests, type OpenAnswer } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferReducedMotion } from "./test/systemTheme";

const payingCoins = questsFixtures.weekPayingCoins;
const xpOnly = questsFixtures.week;
const yourEmojiFinished: JourneyStep = bonusSteps.yourEmojiFinished;
const withYourEmojiFinished: MemberProfile = { ...shellFixtures.memberWithQuests, journey: [yourEmojiFinished] };

beforeEach(() => {
  fakeSystemTheme(false);
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

function main() {
  return screen.getByRole("main");
}

function cardOf(goal: string) {
  return within(main()).getByRole("heading", { name: goal }).closest("article")!;
}

function homeRowOf(goal: string) {
  return within(within(main()).getByRole("region", { name: "Quests this week" })).getByRole("link", { name: new RegExp(`^${goal}`) }).closest("li")!;
}

function journeyStepOf(goal: string) {
  return within(within(main()).getByRole("region", { name: "Journey" })).getByRole("heading", { name: goal }).closest("li")!;
}

function coinsIn(element: HTMLElement) {
  return [...element.querySelectorAll<HTMLElement>('[data-reward="coins"]')].map((coins) => ({ text: coins.textContent, glyph: coins.querySelector('[data-testid="coin-glyph"]') !== null }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function onQuests(answer: MyQuests, openQuestCrate: () => Promise<OpenAnswer> = async () => ({ kind: "opened" }), visitor: MemberProfile = shellFixtures.memberWithQuests) {
  window.history.replaceState(null, "", "/quests");
  return renderApp(visitor, undefined, { openQuestCrate }, fixedQuests(answer));
}

describe("WS348: a quest paying coins shows the coin glyph and value wherever its reward shows", () => {
  it("shows each quest card's coins beside its XP, in progress, finished and claimed", () => {
    onQuests(payingCoins);

    for (const goal of ["Thank someone and say why, 3 times.", "Thank someone you haven't thanked before.", "Thank someone you haven't thanked in the last 30 days."]) {
      expect(cardOf(goal)).toHaveTextContent("+20 XP");
      expect(coinsIn(cardOf(goal))).toEqual([{ text: "10 coins", glyph: true }]);
    }
  });

  it("shows the bonus quest's coins and an earlier week's waiting crate's coins", () => {
    onQuests(payingCoins);

    expect(coinsIn(cardOf("Give a kudos that says why with one of your kudos emoji."))).toEqual([{ text: "20 coins", glyph: true }]);
    expect(coinsIn(cardOf("Thank someone and say why on 2 different days."))).toEqual([{ text: "10 coins", glyph: true }]);
  });

  it("shows the coins on the home's quest rows, the bonus row included", () => {
    renderApp(shellFixtures.memberWithQuests, undefined, undefined, fixedQuests(payingCoins));

    expect(coinsIn(homeRowOf("Thank someone and say why, 3 times."))).toEqual([{ text: "10 coins", glyph: true }]);
    expect(coinsIn(homeRowOf("Give a kudos that says why with one of your kudos emoji."))).toEqual([{ text: "20 coins", glyph: true }]);
  });

  it("shows an active Journey step's coins on its line", () => {
    renderApp({ ...shellFixtures.memberWithQuests, journey: [bonusSteps.yourEmoji] });

    expect(journeyStepOf("Give a kudos that says why with one of your kudos emoji.")).toHaveTextContent("Pays 40 XP · 20 coins");
    expect(coinsIn(journeyStepOf("Give a kudos that says why with one of your kudos emoji."))).toEqual([{ text: "20 coins", glyph: true }]);
  });

  it("keeps a closed crate's coins hidden: crates are loot boxes until opened", () => {
    renderApp({ ...shellFixtures.memberWithQuests, journey: [yourEmojiFinished] });

    expect(coinsIn(journeyStepOf("Give a kudos that says why with one of your kudos emoji."))).toEqual([]);
    expect(journeyStepOf("Give a kudos that says why with one of your kudos emoji.")).not.toHaveTextContent(/coin/i);
  });

  it("shows an opened Journey step's earned coins", () => {
    renderApp({ ...shellFixtures.memberWithQuests, journey: [{ ...yourEmojiFinished, state: "opened", crate: null }] });

    expect(journeyStepOf("Give a kudos that says why with one of your kudos emoji.")).toHaveTextContent("Done · You earned 40 XP and 20 coins");
  });
});

describe("WS348: a read that carries no coins, because the quest pays none or getQuests hides them, shows no coins", () => {
  it("shows no coins on the cards, the bonus, the waiting crate or the home's rows", () => {
    const { unmount } = onQuests(xpOnly);
    expect(coinsIn(main())).toEqual([]);
    expect(main()).not.toHaveTextContent(/coin/i);
    unmount();

    renderApp(shellFixtures.memberWithQuests, undefined, undefined, fixedQuests(questsFixtures.weekWithABonus));
    expect(main()).not.toHaveTextContent(/coin/i);
  });
});

describe("WS348 #354: a quest's coins fly into the header's coins chip", () => {
  const withForty: MemberProfile = { ...shellFixtures.memberWithQuests, progression: { level: 2, xp: 40, levelStartsAt: 20, nextLevelAt: 100, xpToNextLevel: 60 }, coins: 40 };
  const finishedGoal = "Thank someone you haven't thanked before.";

  function coinsChip() {
    return screen.getByRole("img", { name: /coins? to spend$/ });
  }

  function flight() {
    return document.querySelector<HTMLElement>("[data-reward-flight]");
  }

  function placeAt(element: Element, rect: { x: number; y: number; width: number; height: number }) {
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect(rect));
  }

  function landAll(flying: HTMLElement) {
    for (const particle of flying.querySelectorAll("[data-particle]")) fireEvent.animationEnd(particle);
  }

  async function claimAndClose(user: ReturnType<typeof renderApp>["user"]) {
    await user.click(within(cardOf(finishedGoal)).getByRole("button", { name: "Claim" }));
    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
  }

  it("holds the chip short of the quest's coins from the reveal, flies +10 coins from the card's coins once the XP lands, and counts up once it lands", async () => {
    const { user } = onQuests(payingCoins, undefined, withForty);
    placeAt(cardOf(finishedGoal).querySelector('[data-reward="coins"]')!, { x: 160, y: 700, width: 30, height: 16 });
    placeAt(coinsChip(), { x: 900, y: 10, width: 60, height: 32 });
    await user.click(within(cardOf(finishedGoal)).getByRole("button", { name: "Claim" }));
    expect(coinsChip()).toHaveAccessibleName("30 coins to spend");
    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));

    expect(flight()).toHaveTextContent("+20 XP");
    landAll(flight()!);
    expect(flight()).toHaveTextContent("+10 coins");
    expect(flight()!.style.left).toBe("160px");
    expect(flight()!.style.getPropertyValue("--flight-x")).toBe("755px");
    expect(flight()!.style.getPropertyValue("--flight-y")).toBe("-682px");
    expect(coinsChip()).toHaveTextContent("30");
    vi.useFakeTimers();
    landAll(flight()!);
    expect(flight()).toBeNull();
    expect(coinsChip()).toHaveClass("reward-landed");
    act(() => vi.advanceTimersByTime(1000));
    expect(coinsChip()).toHaveTextContent("40");
  });

  it("flies only the XP from a quest paying no coins, and never holds the chip", async () => {
    const { user } = onQuests(xpOnly, undefined, withForty);
    await user.click(within(cardOf(finishedGoal)).getByRole("button", { name: "Claim" }));
    expect(coinsChip()).toHaveTextContent("40");
    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));

    landAll(flight()!);
    expect(flight()).toBeNull();
    expect(coinsChip()).toHaveTextContent("40");
  });

  it("never flies under reduced motion: the chip shows the balance at once with a short fade", async () => {
    preferReducedMotion();
    const { user } = onQuests(payingCoins, undefined, withForty);
    await user.click(within(cardOf(finishedGoal)).getByRole("button", { name: "Claim" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));

    expect(flight()).toBeNull();
    expect(coinsChip()).toHaveTextContent("40");
    expect(coinsChip()).toHaveClass("reward-faded");
  });

  it("lets the flight go when the coins chip isn't shown", async () => {
    const { user } = onQuests(payingCoins, undefined, { ...withForty, coins: null });
    await claimAndClose(user);

    landAll(flight()!);
    expect(flight()).toBeNull();
  });
});

describe("WS348 WS339: the coin rewards pass axe in light and dark", () => {
  for (const dark of [false, true]) {
    it(`on /quests, the home and the reveal in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      const quests = onQuests(payingCoins);
      expect(await violationsIn(quests.container)).toEqual([]);
      await quests.user.click(within(cardOf("Thank someone you haven't thanked before.")).getByRole("button", { name: "Claim" }));
      await quests.user.keyboard("{Escape}");
      expect(await violationsIn(document.body)).toEqual([]);
      quests.unmount();

      window.history.replaceState(null, "", "/");
      const home = renderApp(withYourEmojiFinished, undefined, undefined, fixedQuests(payingCoins));
      expect(await violationsIn(home.container)).toEqual([]);
    }, 30_000);
  }
});

async function violationsIn(container: Element) {
  vi.useRealTimers();
  const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}
