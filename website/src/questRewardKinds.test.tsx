import { act, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bonusSteps, fixedQuests, questsFixtures } from "./questsFixtures";
import { shellFixtures, type JourneyStep, type MemberProfile, type MyQuests, type OpenAnswer } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

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

function onQuests(answer: MyQuests, openQuestCrate: () => Promise<OpenAnswer> = async () => ({ kind: "opened" })) {
  window.history.replaceState(null, "", "/quests");
  return renderApp(shellFixtures.memberWithQuests, undefined, { openQuestCrate }, fixedQuests(answer));
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

  it("shows a Journey step's coins on its line and on its crate's label", () => {
    renderApp({ ...shellFixtures.memberWithQuests, journey: [bonusSteps.yourEmoji, { ...yourEmojiFinished, step: "two-days", goal: "Say why on 2 different days." }] });

    expect(journeyStepOf("Give a kudos that says why with one of your kudos emoji.")).toHaveTextContent("Pays 40 XP and 20 coins");
    expect(within(journeyStepOf("Say why on 2 different days.")).getByText(/^Journey reward · 40 XP/)).toHaveTextContent("Journey reward · 40 XP · 20 coins");
    expect(coinsIn(journeyStepOf("Say why on 2 different days."))).toEqual([{ text: "20 coins", glyph: true }]);
  });

  it("shows an opened Journey step's earned coins", () => {
    renderApp({ ...shellFixtures.memberWithQuests, journey: [{ ...yourEmojiFinished, state: "opened", crate: null }] });

    expect(journeyStepOf("Give a kudos that says why with one of your kudos emoji.")).toHaveTextContent("Done · You earned 40 XP and 20 coins");
  });
});

describe("WS348: a quest paying only XP, or a member whose coins aren't shown, sees no coins", () => {
  it("shows no coins on the cards, the bonus, the waiting crate or the home's rows", () => {
    const { unmount } = onQuests(xpOnly);
    expect(coinsIn(main())).toEqual([]);
    expect(main()).not.toHaveTextContent(/coin/i);
    unmount();

    renderApp(shellFixtures.memberWithQuests, undefined, undefined, fixedQuests(questsFixtures.weekWithABonus));
    expect(main()).not.toHaveTextContent(/coin/i);
  });
});

describe("WS348 WS66: the reveal's end state shows one chip per reward kind after opened", () => {
  it("shows an XP chip and a coins chip once the server answers opened, and says both in the headline", async () => {
    let answer!: (opened: OpenAnswer) => void;
    const { user } = onQuests(payingCoins, () => new Promise((resolve) => (answer = resolve)));
    await user.click(within(cardOf("Thank someone you haven't thanked before.")).getByRole("button", { name: "Claim" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await act(async () => answer({ kind: "opened" }));
    await user.keyboard("{Escape}");

    const reveal = screen.getByRole("dialog");
    expect(within(reveal).getByRole("heading", { name: "You earned 20 XP and 10 coins" })).toBeVisible();
    expect(within(within(reveal).getByRole("list", { name: "Rewards" })).getAllByRole("listitem").map((chip) => chip.textContent)).toEqual(["+20 XP", "+10 coins"]);
    expect(coinsIn(reveal)).toEqual([{ text: "+10 coins", glyph: true }]);
  });

  it("shows the XP chip alone for a quest paying only XP", async () => {
    const { user } = onQuests(xpOnly);
    await user.click(within(cardOf("Thank someone you haven't thanked before.")).getByRole("button", { name: "Claim" }));
    await user.keyboard("{Escape}");

    const reveal = screen.getByRole("dialog");
    expect(within(reveal).getByRole("heading", { name: "You earned 20 XP" })).toBeVisible();
    expect(within(within(reveal).getByRole("list", { name: "Rewards" })).getAllByRole("listitem").map((chip) => chip.textContent)).toEqual(["+20 XP"]);
  });

  it("announces both kinds once the reveal finishes", async () => {
    const { user } = onQuests(payingCoins);
    await user.click(within(cardOf("Thank someone you haven't thanked before.")).getByRole("button", { name: "Claim" }));
    await user.keyboard("{Escape}");

    expect(screen.getByTestId("moment-announcement")).toHaveTextContent("You opened your quest reward. You earned 20 XP and 10 coins.");
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
