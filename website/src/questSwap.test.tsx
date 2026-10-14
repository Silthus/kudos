import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import type { QuestsRead } from "./questsRead";
import { shellFixtures, type MyQuests, type SwapReply } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const withQuests = shellFixtures.memberWithQuests;
const sayingWhyTwice = "Thank someone and say why, 2 times.";
const sayingWhyThreeTimes = "Thank someone and say why, 3 times.";
const swappedIn = "Thank someone and say why on 2 different days.";
const swapTitle = "Swap this quest for another. One swap a week.";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/quests");
});

function main() {
  return screen.getByRole("main");
}

function header() {
  return within(main()).getByRole("heading", { level: 1 }).closest("header")!;
}

function cardOf(goal: string) {
  return within(main()).getByRole("heading", { name: goal }).closest("article")!;
}

function swapButtonIn(goal: string) {
  return within(cardOf(goal)).getByRole("button", { name: /^Swap/ });
}

function showQuests(answer: MyQuests, swapQuest?: () => Promise<SwapReply>) {
  return renderApp(withQuests, undefined, { swapQuest }, fixedQuests(answer));
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function swappingRead() {
  let answer: MyQuests = questsFixtures.weekWithASwapLeft;
  const read: QuestsRead = (asking) => (asking ? answer : undefined);
  return { read, swapLands: () => (answer = questsFixtures.weekAfterTheSwap) };
}

describe("WS319: the header tells how the week's swap stands", () => {
  it("reads 1 swap left this week while the swap is available, with the swap icon", () => {
    showQuests(questsFixtures.weekWithASwapLeft);
    const line = within(header()).getByText("1 swap left this week");
    expect(line.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("reads Swap used this week once the week's swap is used", () => {
    showQuests(questsFixtures.week);
    expect(header()).toHaveTextContent("Swap used this week");
    expect(header()).not.toHaveTextContent("swap left");
  });

  it.each([
    { state: "with no replacement to offer", answer: questsFixtures.weekWithNoSwapToOffer },
    { state: "with every quest finished", answer: questsFixtures.weekWithAFinishedQuestEach },
    { state: "with nothing drawn", answer: questsFixtures.noDraw },
  ])("says nothing about swapping $state", ({ answer }) => {
    showQuests(answer);
    expect(header()).not.toHaveTextContent(/swap/i);
  });
});

describe("WS319: each quest in progress offers Swap while the swap is available", () => {
  it("gives each in-progress card a muted Swap titled with the one-a-week rule, and finished or claimed cards none", () => {
    showQuests(questsFixtures.weekWithASwapLeft);
    for (const goal of [sayingWhyThreeTimes, sayingWhyTwice]) {
      const swap = swapButtonIn(goal);
      expect(swap).toHaveTextContent("Swap");
      expect(swap).toHaveAttribute("title", swapTitle);
      expect(swap).toHaveClass("quill-button--variant-link-muted");
    }
    expect(within(cardOf("Thank someone you haven't thanked before.")).queryByRole("button", { name: /^Swap/ })).not.toBeInTheDocument();
  });

  it.each([
    { state: "once the swap is used", answer: questsFixtures.week },
    { state: "with no replacement to offer", answer: questsFixtures.weekWithNoSwapToOffer },
  ])("offers no Swap $state", ({ answer }) => {
    showQuests(answer);
    expect(within(main()).queryByRole("button", { name: /^Swap/ })).not.toBeInTheDocument();
  });
});

describe("WS318 WS319: pressing Swap sends the read's own quest and answers in place", () => {
  it("sends the slot's quest from the read, and reads Swapping… and stays inert until the answer", async () => {
    const answer = deferred<SwapReply>();
    const { user, actions } = showQuests(questsFixtures.weekWithASwapLeft, () => answer.promise);

    await user.click(swapButtonIn(sayingWhyTwice));
    await user.click(swapButtonIn(sayingWhyTwice));

    expect(actions.swapQuest.mock.calls).toEqual([[{ kind: "weekly", week: "2026-10-12", slot: 2 }]]);
    expect(swapButtonIn(sayingWhyTwice)).toHaveTextContent("Swapping…");
    expect(swapButtonIn(sayingWhyTwice)).toHaveAttribute("aria-disabled", "true");
    expect(swapButtonIn(sayingWhyThreeTimes)).toHaveAttribute("aria-disabled", "true");
    await act(async () => answer.resolve({ kind: "refused" }));
  });

  it("after swapped, shows the new quest with its Swapped tag, says so politely and moves focus to its heading", async () => {
    const { read, swapLands } = swappingRead();
    const view = renderApp(withQuests, undefined, {
      swapQuest: async () => {
        swapLands();
        view.showVisitor(withQuests);
        return { kind: "swapped" };
      },
    }, read);

    await view.user.click(swapButtonIn(sayingWhyTwice));

    await waitFor(() => expect(within(main()).getByRole("status")).toHaveTextContent(`Swapped. Your new quest: ${swappedIn}`, { normalizeWhitespace: true }));
    expect(cardOf(swappedIn)).toHaveTextContent("Swapped");
    expect(within(main()).getByRole("heading", { name: swappedIn })).toHaveFocus();
    expect(header()).toHaveTextContent("Swap used this week");
    expect(within(main()).queryByRole("button", { name: /^Swap/ })).not.toBeInTheDocument();
  });

  it("after swapped, waits for the read to show the new quest before it speaks or moves focus", async () => {
    const { read, swapLands } = swappingRead();
    const view = renderApp(withQuests, undefined, { swapQuest: async () => ({ kind: "swapped" }) }, read);

    await view.user.click(swapButtonIn(sayingWhyTwice));
    expect(within(main()).getByRole("status")).toBeEmptyDOMElement();

    swapLands();
    view.showVisitor(withQuests);

    expect(within(main()).getByRole("heading", { name: swappedIn })).toHaveFocus();
    expect(within(main()).getByRole("status").textContent).toBe(`Swapped. Your new quest: ${swappedIn}`);
  });

  it("after refused, says the quest couldn't be swapped on its card", async () => {
    const { user } = showQuests(questsFixtures.weekWithASwapLeft, async () => ({ kind: "refused" }));

    await user.click(swapButtonIn(sayingWhyTwice));

    expect(cardOf(sayingWhyTwice)).toHaveTextContent("That quest couldn't be swapped.");
    expect(cardOf(sayingWhyThreeTimes)).not.toHaveTextContent("couldn't be swapped");
    expect(swapButtonIn(sayingWhyTwice)).toHaveTextContent(/^Swap$/);
    expect(within(main()).getByRole("status").textContent).toBe("That quest couldn't be swapped.");
  });

  it("after refused because the week's swap went to another quest, keeps the line on the card once Swap is gone", async () => {
    const { read, swapLands } = swappingRead();
    const view = renderApp(withQuests, undefined, {
      swapQuest: async () => {
        swapLands();
        view.showVisitor(withQuests);
        return { kind: "refused" };
      },
    }, read);

    await view.user.click(swapButtonIn(sayingWhyThreeTimes));

    await waitFor(() => expect(cardOf(sayingWhyThreeTimes)).toHaveTextContent("That quest couldn't be swapped."));
    expect(within(main()).queryByRole("button", { name: /^Swap/ })).not.toBeInTheDocument();
    expect(within(main()).getByRole("heading", { name: sayingWhyThreeTimes })).toHaveFocus();
  });

  it("after no answer, a swap that commits late clears the line, says the new quest and moves focus to it", async () => {
    const { read, swapLands } = swappingRead();
    const view = renderApp(withQuests, undefined, { swapQuest: async () => Promise.reject(new Error("HedgeHug didn't answer in time.")) }, read);
    await view.user.click(swapButtonIn(sayingWhyTwice));
    expect(cardOf(sayingWhyTwice)).toHaveTextContent("Couldn't reach HedgeHug. Try again.");

    swapLands();
    view.showVisitor(withQuests);

    expect(within(main()).getByRole("heading", { name: swappedIn })).toHaveFocus();
    expect(cardOf(swappedIn)).not.toHaveTextContent("Couldn't reach HedgeHug");
    expect(within(main()).getByRole("status").textContent).toBe(`Swapped. Your new quest: ${swappedIn}`);
  });

  it("after the Monday turn, last week's line doesn't stay on the new week's quest in the same slot", async () => {
    let answer: MyQuests = questsFixtures.weekWithASwapLeft;
    const read: QuestsRead = (asking) => (asking ? answer : undefined);
    const view = renderApp(withQuests, undefined, { swapQuest: async () => ({ kind: "refused" }) }, read);
    await view.user.click(swapButtonIn(sayingWhyTwice));
    expect(cardOf(sayingWhyTwice)).toHaveTextContent("That quest couldn't be swapped.");

    answer = { ...questsFixtures.weekWithASwapLeft, slots: questsFixtures.weekWithASwapLeft.slots.map((slot) => ({ ...slot, quest: { ...slot.quest, week: "2026-10-19" } })) };
    view.showVisitor(withQuests);

    expect(cardOf(sayingWhyTwice)).not.toHaveTextContent("couldn't be swapped");
  });

  it("after an error, says HedgeHug couldn't be reached, and pressing Swap again sends the same quest", async () => {
    let calls = 0;
    const { user, actions } = showQuests(questsFixtures.weekWithASwapLeft, async () => {
      calls += 1;
      if (calls === 1) throw new Error("HedgeHug didn't answer in time.");
      return { kind: "refused" };
    });

    await user.click(swapButtonIn(sayingWhyTwice));
    expect(cardOf(sayingWhyTwice)).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    expect(within(main()).getByRole("status").textContent).toBe("Couldn't reach HedgeHug. Try again.");

    await user.click(swapButtonIn(sayingWhyTwice));
    expect(actions.swapQuest.mock.calls).toEqual([[{ kind: "weekly", week: "2026-10-12", slot: 2 }], [{ kind: "weekly", week: "2026-10-12", slot: 2 }]]);
    expect(cardOf(sayingWhyTwice)).not.toHaveTextContent("Couldn't reach HedgeHug");
  });

  it("after a denial, adds no line of its own and leaves the frame to the profile read", async () => {
    const { user } = showQuests(questsFixtures.weekWithASwapLeft, async () => ({ kind: "signed-out" }));

    await user.click(swapButtonIn(sayingWhyTwice));

    expect(cardOf(sayingWhyTwice)).not.toHaveTextContent(/couldn't|Try again/);
    expect(within(main()).getByRole("status")).toBeEmptyDOMElement();
  });
});

describe("WS319: How quests work", () => {
  it("says a quest can be swapped once a week, with no word of Slack", () => {
    showQuests(questsFixtures.weekWithASwapLeft);
    const how = within(main()).getByRole("region", { name: "How quests work" });
    expect(how).toHaveTextContent(
      "Quests reward thanking someone new, someone you haven't thanked in a while, and thanks that say why. A thanks says why when your message has 5 or more words besides mentions and emoji. New quests arrive every Monday. You can swap one quest a week.",
    );
  });
});
