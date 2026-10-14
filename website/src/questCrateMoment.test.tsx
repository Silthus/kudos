import { act, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { markSeen } from "./crates/seen";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import type { QuestsRead } from "./questsRead";
import { shellFixtures, type JourneyStep, type MemberProfile, type MyQuests, type OpenAnswer } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const withQuests = shellFixtures.memberWithQuests;
const thisWeeksCrate = { kind: "weekly", week: "2026-W42", slot: 1 } as const;
const journeyCrate = { kind: "journey", step: "first-quest" } as const;
const finishedStep: JourneyStep = { step: "first-thanks", goal: "Give a kudos that says why.", hint: null, reward: { xp: 10 }, state: "finished", crate: { kind: "journey", step: "first-thanks" }, seen: "77aa01" };
const questsLockedWithAFinishedStep: MemberProfile = { ...shellFixtures.memberStartingTheJourney, journey: [finishedStep] };

beforeEach(() => {
  fakeSystemTheme(false);
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

function answerLater() {
  let settle!: (answer: OpenAnswer) => void;
  const answer = new Promise<OpenAnswer>((resolve) => {
    settle = resolve;
  });
  return { answer, settle: (value: OpenAnswer) => act(() => settle(value)) };
}

function main() {
  return screen.getByRole("main");
}

function dialog() {
  return screen.queryByRole("dialog");
}

function announcement() {
  return screen.getByTestId("moment-announcement");
}

function pill() {
  return within(screen.getByRole("banner")).queryByRole("button", { name: /ready|Opening…/ });
}

function questCard(goal = "Thank someone you haven't thanked before.") {
  return within(main()).getByRole("heading", { name: goal }).closest("article")!;
}

function journeyStep(goal = "Finish a weekly quest.") {
  return within(within(main()).getByRole("region", { name: "Journey" })).getByRole("heading", { name: goal }).closest("li")!;
}

function openIn(element: HTMLElement) {
  return within(element).getByRole("button", { name: /^(Open|Opening…)$/ });
}

type Commands = { openQuestCrate?: () => Promise<OpenAnswer>; openFeature?: () => Promise<OpenAnswer> };

function onQuests(answer: MyQuests = questsFixtures.week, commands: Commands = { openQuestCrate: async () => ({ kind: "opened" }) }, visitor: MemberProfile = withQuests) {
  window.history.replaceState(null, "", "/quests");
  return renderApp(visitor, undefined, commands, fixedQuests(answer));
}

function onTheHome(visitor: MemberProfile = withQuests, commands: Commands = { openQuestCrate: async () => ({ kind: "opened" }) }, quests: QuestsRead = fixedQuests(questsFixtures.week)) {
  return renderApp(visitor, undefined, commands, quests);
}

describe("WS74: opening a quest crate follows the server", () => {
  it("sends openQuestCrate with the crate's own quest from the read, and shows Opening… without a dialog until it answers", async () => {
    const pending = answerLater();
    const openQuestCrate = vi.fn(() => pending.answer);
    const { user } = onQuests(questsFixtures.week, { openQuestCrate });

    await user.click(openIn(questCard()));

    expect(openQuestCrate).toHaveBeenCalledExactlyOnceWith(thisWeeksCrate);
    expect(openIn(questCard())).toHaveAccessibleName("Opening…");
    expect(openIn(questCard())).toHaveAttribute("aria-disabled", "true");
    expect(dialog()).toBeNull();
    await pending.settle({ kind: "opened" });
    expect(dialog()).toHaveAccessibleName("Quest reward");
  });

  it("ends on You earned {xp} XP with Done and Replay, and no way to this week's quests from /quests", async () => {
    const { user } = onQuests();
    await user.click(openIn(questCard()));
    await user.keyboard("{Escape}");

    const reveal = dialog()!;
    expect(within(reveal).getByRole("heading", { name: "You earned 20 XP" })).toBeVisible();
    expect(within(reveal).getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(within(reveal).getByRole("button", { name: "Replay" })).toBeInTheDocument();
    expect(within(reveal).queryByRole("link", { name: "See this week's quests" })).toBeNull();
    expect(reveal).not.toHaveTextContent(/coin|is open|Go to/i);
  });

  it("labels a Journey step's reveal Journey reward, and offers this week's quests from the home while Quests is open", async () => {
    const openQuestCrate = vi.fn(async () => ({ kind: "opened" }) as const);
    const { user } = onTheHome(withQuests, { openQuestCrate });
    await user.click(openIn(journeyStep()));
    await user.keyboard("{Escape}");

    expect(openQuestCrate).toHaveBeenCalledExactlyOnceWith(journeyCrate);
    expect(dialog()).toHaveAccessibleName("Journey reward");
    expect(within(dialog()!).getByRole("heading", { name: "You earned 20 XP" })).toBeVisible();
    await user.click(within(dialog()!).getByRole("link", { name: "See this week's quests" }));

    expect(window.location.pathname).toBe("/quests");
    expect(dialog()).toBeNull();
  });

  it("offers no way to this week's quests while Quests isn't open", async () => {
    const { user } = onTheHome(questsLockedWithAFinishedStep);
    await user.click(openIn(journeyStep("Give a kudos that says why.")));
    await user.keyboard("{Escape}");

    expect(dialog()).toHaveAccessibleName("Journey reward");
    expect(within(dialog()!).queryByRole("link", { name: "See this week's quests" })).toBeNull();
  });

  it("plays no reveal after refused, and says so on the card and in the live region", async () => {
    const { user } = onQuests(questsFixtures.week, { openQuestCrate: async () => ({ kind: "refused" }) });
    await user.click(openIn(questCard()));

    expect(dialog()).toBeNull();
    expect(questCard()).toHaveTextContent("That couldn't be opened.");
    expect(announcement()).toHaveTextContent("That couldn't be opened.");
    expect(openIn(questCard())).toHaveAccessibleName("Open");
  });

  it("closes the crate again after an error, says HedgeHug couldn't be reached, and lets the member retry", async () => {
    const openQuestCrate = vi.fn<() => Promise<OpenAnswer>>().mockRejectedValueOnce(new Error("socket closed")).mockResolvedValueOnce({ kind: "opened" });
    const { user } = onQuests(questsFixtures.week, { openQuestCrate });
    await user.click(openIn(questCard()));

    expect(questCard()).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    expect(announcement()).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    expect(openIn(questCard())).not.toHaveAttribute("aria-disabled");
    await user.click(openIn(questCard()));
    expect(dialog()).toHaveAccessibleName("Quest reward");
  });

  it("opens an earlier week's waiting crate with its own quest", async () => {
    const openQuestCrate = vi.fn(async () => ({ kind: "opened" }) as const);
    const { user } = onQuests(questsFixtures.weekWithLastWeeksCrate, { openQuestCrate });
    await user.click(openIn(within(main()).getByRole("region", { name: "Waiting to open" })));

    expect(openQuestCrate).toHaveBeenCalledExactlyOnceWith({ kind: "weekly", week: "2026-W41", slot: 0 });
    expect(dialog()).toHaveAccessibleName("Quest reward");
  });
});

describe("WS74 WS66: focus and the live region after a quest crate's reveal", () => {
  it("returns focus to the quest's card on /quests when Done closes the reveal, and announces what opened", async () => {
    const { user } = onQuests();
    const card = questCard();
    await user.click(openIn(card));
    await user.keyboard("{Escape}");
    expect(announcement()).toHaveTextContent("You opened your quest reward.");
    await user.click(within(dialog()!).getByRole("button", { name: "Done" }));

    expect(dialog()).toBeNull();
    expect(questCard()).toHaveFocus();
  });

  it("returns focus to the Journey step on the home", async () => {
    const { user } = onTheHome();
    await user.click(openIn(journeyStep()));
    await user.keyboard("{Escape}");
    expect(announcement()).toHaveTextContent("You opened your Journey reward.");
    await user.keyboard("{Escape}");

    expect(dialog()).toBeNull();
    expect(journeyStep()).toHaveFocus();
  });

  it("opens a crate this member has seen on its end state, keyed by the read's seen key", async () => {
    markSeen("c41d77");
    const { user } = onQuests();
    await user.click(openIn(questCard()));

    expect(within(dialog()!).getByRole("heading", { name: "You earned 20 XP" })).toBeVisible();
  });
});

describe("WS68 WS74: the ready pill counts quest and Journey crates", () => {
  it("counts the Journey's, this week's and waiting crates after the ready features", () => {
    onTheHome(withQuests, {}, fixedQuests(questsFixtures.weekWithLastWeeksCrate));
    expect(pill()).toHaveAccessibleName("3 ready");
  });

  it("counts a finished Journey step while Quests is still locked", () => {
    onTheHome(questsLockedWithAFinishedStep, {}, () => undefined);
    expect(pill()).toHaveAccessibleName("1 ready");
  });

  it("takes a ready feature before any quest crate", async () => {
    const openFeature = vi.fn(async () => ({ kind: "refused" }) as const);
    const openQuestCrate = vi.fn(async () => ({ kind: "refused" }) as const);
    const withTheBoardReady: MemberProfile = { ...withQuests, features: [...withQuests.features!, { feature: "leaderboard", name: "Leaderboard", opens: "the boards", level: 3, seen: "5e3a0c", state: "ready", readyAt: 0, openedAt: null }] };
    const { user } = onTheHome(withTheBoardReady, { openFeature, openQuestCrate });

    expect(pill()).toHaveAccessibleName("3 ready");
    await user.click(pill()!);
    expect(openFeature).toHaveBeenCalledExactlyOnceWith("leaderboard");
    expect(openQuestCrate).not.toHaveBeenCalled();
  });

  it("sends openQuestCrate for the first quest crate, the Journey's, and reveals only after opened", async () => {
    const pending = answerLater();
    const openQuestCrate = vi.fn(() => pending.answer);
    const { user } = onTheHome(withQuests, { openQuestCrate });
    await user.click(pill()!);

    expect(openQuestCrate).toHaveBeenCalledExactlyOnceWith(journeyCrate);
    expect(pill()).toHaveAccessibleName("Opening…");
    expect(dialog()).toBeNull();
    await pending.settle({ kind: "opened" });
    expect(dialog()).toHaveAccessibleName("Journey reward");
  });

  it("is gone once every quest crate is opened", () => {
    const allOpened: MemberProfile = { ...withQuests, journey: withQuests.journey!.filter(({ state }) => state !== "finished") };
    onTheHome(allOpened, {}, fixedQuests({ ...questsFixtures.week, slots: questsFixtures.week.slots.filter(({ state }) => state !== "finished") }));
    expect(pill()).toBeNull();
  });
});

describe("WS75 WS74: the keyboard path for a quest crate", () => {
  it("opens with Space, skips with Esc, tabs through Done and Replay, and closes with Done, returning focus to the quest's card", async () => {
    const { user } = onQuests();
    openIn(questCard()).focus();
    await user.keyboard(" ");
    expect(dialog()).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Escape}");
    expect(within(dialog()!).getByRole("heading", { name: "You earned 20 XP" })).toBeInTheDocument();
    const actions = [document.activeElement];
    for (let i = 0; i < 2; i++) {
      await user.tab();
      actions.push(document.activeElement);
    }
    expect(actions.map((element) => element?.textContent)).toEqual(["Done", "Replay", "Done"]);
    expect(within(dialog()!).getByRole("button", { name: "Done" })).toHaveClass("quill-button--variant-primary");
    await user.keyboard("{Enter}");

    expect(dialog()).toBeNull();
    expect(questCard()).toHaveFocus();
  });

  it("opens the pill's quest crate with Enter", async () => {
    const openQuestCrate = vi.fn(async () => ({ kind: "opened" }) as const);
    const { user } = onTheHome(withQuests, { openQuestCrate });
    pill()!.focus();
    await user.keyboard("{Enter}");

    expect(openQuestCrate).toHaveBeenCalledExactlyOnceWith(journeyCrate);
    expect(dialog()).toHaveAccessibleName("Journey reward");
  });
});
