import { act, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardRead } from "./boardRead";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { shellFixtures, type CommandAnswer, type MemberProfile, type OpenAnswer, type ShellState } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferReducedMotion } from "./test/systemTheme";

const ready = shellFixtures.memberWithTheBoardReady;
const opened = shellFixtures.memberWithTheBoardOpened;

const theWeeksBoard = fixedLeaderboard(leaderboardFixtures.midBoard);

beforeEach(() => {
  fakeSystemTheme(false);
});

function answerLater() {
  let settle!: (answer: OpenAnswer) => void;
  let fail!: (reason: Error) => void;
  const answer = new Promise<OpenAnswer>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { answer, settle: (value: OpenAnswer) => act(() => settle(value)), fail: () => act(() => fail(new Error("socket closed"))) };
}

function main() {
  return screen.getByRole("main");
}

function crate() {
  return within(main()).getByRole("heading", { level: 3, name: "Unlocks: Leaderboard" }).closest("article")!;
}

function crateNamed(name: string) {
  return within(main()).getByRole("heading", { level: 3, name: `Unlocks: ${name}` }).closest("article")!;
}

function openButton() {
  return within(crate()).getByRole("button", { name: /Open|Opening…/ });
}

function dialog() {
  return screen.queryByRole("dialog");
}

function announcement() {
  return screen.getByTestId("moment-announcement");
}

async function openTheCrate(answer: OpenAnswer = { kind: "opened" }, visitor: ShellState = ready) {
  const view = renderApp(visitor, theWeeksBoard, { openFeature: async () => answer });
  await view.user.click(openButton());
  return view;
}

describe("WS65: a ready feature is a closed crate", () => {
  it("labels the crate with what it unlocks and what it opens, with one outline Open on the home", () => {
    renderApp(ready);
    expect(within(main()).getByRole("region", { name: "Leaderboard" })).toContainElement(crate());
    expect(crate()).toHaveTextContent("It opens the boards.");
    expect(crate()).not.toHaveTextContent("Open it in Slack's App Home");
    expect(within(crate()).getAllByRole("button")).toEqual([openButton()]);
    expect(openButton()).toHaveAccessibleName("Open");
    expect(openButton()).toHaveClass("quill-button--variant-outline");
    expect(within(main()).getByRole("region", { name: "Leaderboard" })).toHaveClass("hud-panel");
  });
});

describe("WS66: the reveal follows the server", () => {
  it("shows Opening… without a dialog until the server answers, then plays the reveal after opened", async () => {
    const pending = answerLater();
    const openFeature = vi.fn(() => pending.answer);
    const { user } = renderApp(ready, undefined, { openFeature });
    await user.click(openButton());
    expect(openFeature).toHaveBeenCalledExactlyOnceWith("leaderboard");
    expect(openButton()).toHaveAccessibleName("Opening…");
    expect(openButton()).toHaveAttribute("aria-disabled", "true");
    expect(dialog()).toBeNull();
    await pending.settle({ kind: "opened" });
    expect(dialog()).toHaveAccessibleName("Level 3 unlock");
  });

  it("ends on the end state with the headline, the line, Go to and Done once the reveal has played", async () => {
    await openTheCrate();
    const reveal = dialog()!;
    expect(within(reveal).queryByRole("heading", { name: "Leaderboard is open" })).toBeNull();
    expect(await within(reveal).findByRole("heading", { name: "Leaderboard is open" }, { timeout: 4000 })).toBeVisible();
    expect(reveal).toHaveTextContent("It opens the boards.");
    expect(within(reveal).getByRole("link", { name: "Go to Leaderboard" })).toHaveAttribute("href", "/leaderboard");
    expect(within(reveal).getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(within(reveal).getByRole("button", { name: "Replay" })).toBeInTheDocument();
    expect(reveal).not.toHaveTextContent(/XP|coin|\d+ ready/i);
  });

  it("points a feature without a web page or a home panel to Slack's App Home from the end state, opened from the ready pill", async () => {
    const coinsReady = shellFixtures.memberWithCoinsReady;
    const { user } = renderApp(coinsReady, undefined, { openFeature: async () => ({ kind: "opened" }) });
    expect(within(main()).queryByRole("heading", { name: "Unlocks: Coins and inventory" })).toBeNull();
    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: "1 ready" }));
    await user.keyboard("{Escape}");
    const toSlack = within(dialog()!).getByRole("link", { name: "Find it in Slack's App Home. (opens in a new tab)" });
    expect(toSlack).toHaveAttribute("href", coinsReady.chatUrl);
    expect(within(dialog()!).queryByRole("link", { name: /Go to/ })).toBeNull();
  });

  it("plays no reveal after refused, and says so in the live region", async () => {
    const { user } = await openTheCrate({ kind: "refused" });
    expect(dialog()).toBeNull();
    expect(announcement()).toHaveTextContent("That couldn't be opened.");
    expect(crate()).toHaveTextContent("That couldn't be opened.");
    expect(openButton()).toHaveAccessibleName("Open");
    await user.click(openButton());
    expect(dialog()).toBeNull();
  });

  it("plays no reveal after a denial and ends Opening…, leaving the page to getMyProfile's own answer", async () => {
    await openTheCrate({ kind: "signed-out" });
    expect(dialog()).toBeNull();
    expect(openButton()).toHaveAccessibleName("Open");
    expect(announcement()).toBeEmptyDOMElement();
  });

  it("closes the crate again after an error, says HedgeHug couldn't be reached, and lets the member retry", async () => {
    const first = answerLater();
    const openFeature = vi.fn().mockReturnValueOnce(first.answer).mockResolvedValueOnce({ kind: "opened" });
    const { user } = renderApp(ready, undefined, { openFeature });
    await user.click(openButton());
    await first.fail();
    expect(dialog()).toBeNull();
    expect(announcement()).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    expect(openButton()).toHaveAccessibleName("Open");
    expect(openButton()).not.toHaveAttribute("aria-disabled", "true");
    await user.click(openButton());
    expect(openFeature).toHaveBeenCalledTimes(2);
    expect(dialog()).toHaveAccessibleName("Level 3 unlock");
  });

  it.each([
    ["Esc", "{Escape}"],
    ["Space", " "],
  ])("skips to the end state with %s", async (_, key) => {
    const { user } = await openTheCrate();
    await user.keyboard(key);
    expect(within(dialog()!).getByRole("heading", { name: "Leaderboard is open" })).toBeInTheDocument();
  });

  it("skips to the end state with a click anywhere on the reveal", async () => {
    const { user } = await openTheCrate();
    await user.click(dialog()!);
    expect(within(dialog()!).getByRole("heading", { name: "Leaderboard is open" })).toBeInTheDocument();
  });

  it("replays the reveal from the end state, and skips it again", async () => {
    const { user } = await openTheCrate();
    await user.keyboard("{Escape}");
    await user.click(within(dialog()!).getByRole("button", { name: "Replay" }));
    expect(within(dialog()!).queryByRole("heading", { name: "Leaderboard is open" })).toBeNull();
    await user.keyboard("{Escape}");
    expect(within(dialog()!).getByRole("heading", { name: "Leaderboard is open" })).toBeInTheDocument();
  });

  it("shows the end state at once under reduced motion, fading in", async () => {
    preferReducedMotion();
    await openTheCrate();
    expect(within(dialog()!).getByRole("heading", { name: "Leaderboard is open" })).toBeInTheDocument();
    expect(dialog()).toHaveAttribute("data-motion", "reduced");
  });

  it("moves focus into the dialog, and back to the feature's card, now open, when it closes", async () => {
    const { user, showVisitor } = await openTheCrate();
    expect(dialog()).toContainElement(document.activeElement as HTMLElement);
    showVisitor(opened);
    await user.keyboard("{Escape}");
    await user.click(within(dialog()!).getByRole("button", { name: "Done" }));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(within(main()).getByRole("link", { name: "Open the leaderboard" }));
  });

  it("closes from the end state with Esc", async () => {
    const { user } = await openTheCrate();
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");
    expect(dialog()).toBeNull();
  });

  it("announces what opened in the one live region, which stays mounted and readable while the page behind the dialog is inert", async () => {
    const { user } = renderApp(ready, undefined, { openFeature: async () => ({ kind: "opened" }) });
    const region = announcement();
    await user.click(openButton());
    await user.keyboard("{Escape}");
    expect(announcement()).toBe(region);
    expect(region).toHaveTextContent("You opened Leaderboard.");
    expect(region).toHaveAttribute("role", "status");
    expect(dialog()).not.toHaveAttribute("aria-modal");
    expect(main().closest("[inert]")).not.toBeNull();
    expect(region.closest("[inert]")).toBeNull();
  });

  it("goes to the feature's page from the end state", async () => {
    const { user, showVisitor } = await openTheCrate(undefined, ready);
    showVisitor(opened);
    await user.keyboard("{Escape}");
    await user.click(within(dialog()!).getByRole("link", { name: "Go to Leaderboard" }));
    expect(dialog()).toBeNull();
    expect(window.location.pathname).toBe("/leaderboard");
  });
});

describe("WS66: the reveal holds up against overlapping answers and sessions", () => {
  it("plays each crate's first reveal in full when two answers arrive together", async () => {
    const leaderboard = answerLater();
    const skillTree = answerLater();
    const openFeature = vi.fn((feature: string) => (feature === "leaderboard" ? leaderboard.answer : skillTree.answer));
    const { user } = renderApp(shellFixtures.memberWithEveryFeatureReady, undefined, { openFeature });
    await user.click(within(crateNamed("Leaderboard")).getByRole("button", { name: "Open" }));
    await user.click(within(crateNamed("Skill tree")).getByRole("button", { name: "Open" }));
    await leaderboard.settle({ kind: "opened" });
    await user.keyboard("{Escape}");
    await skillTree.settle({ kind: "opened" });
    expect(within(dialog()!).getByRole("heading", { name: "Leaderboard is open" })).toBeInTheDocument();
    await user.click(within(dialog()!).getByRole("button", { name: "Done" }));
    expect(dialog()).toHaveAccessibleName("Level 5 unlock");
    expect(within(dialog()!).queryByRole("heading", { name: "Skill tree is open" })).toBeNull();
  });

  it("drops the reveal when the member signs out, and shows none on the next sign-in", async () => {
    const { showVisitor } = await openTheCrate();
    showVisitor(shellFixtures.signedOut);
    showVisitor(ready);
    expect(dialog()).toBeNull();
  });

  it("ignores an answer that arrives after the member signed out", async () => {
    const pending = answerLater();
    const { user, showVisitor } = renderApp(ready, undefined, { openFeature: () => pending.answer });
    await user.click(openButton());
    showVisitor(shellFixtures.signedOut);
    await pending.settle({ kind: "opened" });
    showVisitor(ready);
    expect(dialog()).toBeNull();
    expect(openButton()).toHaveAccessibleName("Open");
  });

  it("WS60: ignores an answer for the member shown before when another member replaces them without a sign-out", async () => {
    const pending = answerLater();
    const { user, showVisitor } = renderApp(ready, undefined, { openFeature: () => pending.answer });
    await user.click(openButton());
    showVisitor(shellFixtures.loading);
    showVisitor(withSeenKeys(ready, { leaderboard: "another-member-leaderboard", skillTree: "another-member-skill-tree" }));
    await pending.settle({ kind: "opened" });
    expect(dialog()).toBeNull();
    expect(openButton()).toHaveAccessibleName("Open");
  });

  it.each([
    { without: "features while unlocks don't apply", next: { ...ready, features: null } },
    { without: "features when nothing has shipped", next: shellFixtures.memberWithNothingShipped },
  ])("WS60: ignores the member shown before's answer when the next member has no $without", async ({ next }) => {
    const pending = answerLater();
    const { user, showVisitor } = renderApp(ready, undefined, { openFeature: () => pending.answer });
    await user.click(openButton());
    showVisitor(shellFixtures.loading);
    showVisitor(next);
    await pending.settle({ kind: "opened" });
    expect(dialog()).toBeNull();
  });

  it("keeps a member's own crates through a ship that adds one, so their open still plays its reveal", async () => {
    const pending = answerLater();
    const { user, showVisitor } = renderApp(shellFixtures.memberWithTheBoardReady, undefined, { openFeature: () => pending.answer });
    await user.click(openButton());
    showVisitor(withAnotherFeatureShipped(shellFixtures.memberWithTheBoardReady));
    await pending.settle({ kind: "opened" });
    expect(dialog()).toHaveAccessibleName("Level 3 unlock");
  });

  it("keeps focus in the dialog after Replay under reduced motion, so Esc still closes it", async () => {
    preferReducedMotion();
    const { user } = await openTheCrate();
    within(dialog()!).getByRole("button", { name: "Replay" }).focus();
    await user.keyboard("{Enter}");
    expect(dialog()).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).not.toBe(document.body);
    await user.keyboard("{Escape}");
    expect(dialog()).toBeNull();
  });

  it("keeps the dialog open when Go to opens in another tab", async () => {
    const { user } = await openTheCrate();
    await user.keyboard("{Escape}");
    await user.keyboard("{Control>}");
    await user.click(within(dialog()!).getByRole("link", { name: "Go to Leaderboard" }));
    await user.keyboard("{/Control}");
    expect(dialog()).not.toBeNull();
  });
});

describe("WS65 WS66: the crate nudges once, and never while it opens", () => {
  it("stops nudging once Open is pressed, and stays still after an error", async () => {
    const { user } = renderApp(ready, undefined, { openFeature: async () => Promise.reject(new Error("socket closed")) });
    expect(crate().querySelector("[data-nudge]")).not.toBeNull();
    await user.click(openButton());
    expect(crate().querySelector("[data-nudge]")).toBeNull();
  });
});

describe("WS66: seen state is kept per member and crate in this browser", () => {
  it("opens a crate this member has seen on its end state, with Replay, and never plays it by itself", async () => {
    const { user, showVisitor } = await openTheCrate();
    await user.keyboard("{Escape}");
    await user.click(within(dialog()!).getByRole("button", { name: "Done" }));
    showVisitor({ ...ready });
    await user.click(openButton());
    expect(within(dialog()!).getByRole("heading", { name: "Leaderboard is open" })).toBeInTheDocument();
    expect(within(dialog()!).getByRole("button", { name: "Replay" })).toBeInTheDocument();
  });

  it("plays another member's first reveal in full in the same browser", async () => {
    const { user, showVisitor } = await openTheCrate();
    await user.keyboard("{Escape}");
    await user.click(within(dialog()!).getByRole("button", { name: "Done" }));
    showVisitor(withSeenKeys(ready, { leaderboard: "another-member-leaderboard" }));
    await user.click(openButton());
    expect(within(dialog()!).queryByRole("heading", { name: "Leaderboard is open" })).toBeNull();
  });

  it("keeps nothing but the opaque seen key in the browser", async () => {
    const { user } = await openTheCrate();
    await user.keyboard("{Escape}");
    const kept = Object.keys(localStorage).filter((key) => key.includes("seen"));
    expect(kept).toEqual([expect.stringContaining(ready.features!.find(({ feature }) => feature === "leaderboard")!.seen)]);
  });
});

describe("WS67: /leaderboard's ready state opens in place", () => {
  const readyBoard: BoardRead = (period) => (period && { kind: "ready" });

  function onTheReadyPage(openFeature = vi.fn(async (): Promise<CommandAnswer> => ({ kind: "opened" }))) {
    window.history.replaceState(null, "", "/leaderboard");
    return renderApp(ready, readyBoard, { openFeature });
  }

  it("shows the crate with a primary Open in place of WS52's sentence", () => {
    onTheReadyPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Leaderboard");
    const page = within(main()).getByRole("heading", { name: "Unlocks: Leaderboard" }).closest("article")!;
    expect(within(page).getByRole("button", { name: "Open" })).toHaveClass("quill-button--variant-primary");
    expect(main()).not.toHaveTextContent("Open it in Slack's App Home");
    expect(document.title).toBe("HedgeHug · Leaderboard");
  });

  it("becomes the board once opened, and returns focus to the page title when the reveal closes", async () => {
    const openFeature = vi.fn(async (): Promise<CommandAnswer> => ({ kind: "opened" }));
    window.history.replaceState(null, "", "/leaderboard");
    let board: BoardRead = readyBoard;
    const { user, showVisitor } = renderApp(ready, (period) => board(period), { openFeature });
    await user.click(within(main()).getByRole("button", { name: "Open" }));
    board = fixedLeaderboard(leaderboardFixtures.midBoard);
    showVisitor(opened);
    expect(dialog()).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Escape}");
    await user.click(within(dialog()!).getByRole("button", { name: "Done" }));
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent(/^Leaderboard$/);
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  });

  it("keeps WS52's sentence while the board is locked", () => {
    window.history.replaceState(null, "", "/leaderboard");
    renderApp(shellFixtures.memberWaitingForTheBoard, (period) => (period && { kind: "locked", level: 3 }));
    expect(main()).toHaveTextContent("Leaderboard opens at level 3.");
    expect(within(main()).queryByRole("button", { name: "Open" })).toBeNull();
  });
});

describe("WS68: the ready pill", () => {
  function pill() {
    return within(screen.getByRole("banner")).queryByRole("button", { name: /^\d+ ready$|^Opening…$/ });
  }

  it("counts what is ready to open, and is gone at zero", () => {
    const { showVisitor } = renderApp(ready);
    expect(pill()).toHaveAccessibleName("1 ready");
    showVisitor(shellFixtures.memberWithEveryFeatureReady);
    expect(pill()).toHaveAccessibleName("2 ready");
    showVisitor(opened);
    expect(pill()).toBeNull();
  });

  it.each([
    { outcome: "a refusal", answer: async () => ({ kind: "refused" }) as const, message: "That couldn't be opened." },
    { outcome: "an error", answer: async () => Promise.reject(new Error("socket closed")), message: "Couldn't reach HedgeHug. Try again." },
  ])("shows what went wrong beside the pill after $outcome, away from the home's crate", async ({ answer, message }) => {
    window.history.replaceState(null, "", "/quests");
    const { user } = renderApp(shellFixtures.memberWithEveryFeatureReady, undefined, { openFeature: answer });
    await user.click(pill()!);
    expect(within(screen.getByRole("banner")).getByText(message)).toBeVisible();
    expect(pill()).toHaveAccessibleName("2 ready");
  });

  it("leaves a failure on the home to the crate's own message", async () => {
    const { user } = renderApp(shellFixtures.memberWithEveryFeatureReady, undefined, { openFeature: async () => ({ kind: "refused" }) });
    await user.click(pill()!);
    expect(within(screen.getByRole("banner")).queryByText("That couldn't be opened.")).toBeNull();
    expect(within(crateNamed("Leaderboard")).getByText("That couldn't be opened.")).toBeVisible();
  });

  it("shows what went wrong beside the pill on a page that isn't any screen", async () => {
    window.history.replaceState(null, "", "/nowhere");
    const everyReady = shellFixtures.memberWithEveryFeatureReady;
    const onlySkillTreeReady = { ...everyReady, features: everyReady.features!.filter(({ feature }) => feature === "skillTree") };
    const { user } = renderApp(onlySkillTreeReady, undefined, { openFeature: async () => ({ kind: "refused" }) });
    await user.click(pill()!);
    expect(within(screen.getByRole("banner")).getByText("That couldn't be opened.")).toBeVisible();
  });

  it("leaves a failure on a feature's own page to the crate shown there", async () => {
    window.history.replaceState(null, "", "/quests");
    const { user } = renderApp(shellFixtures.memberWithQuestsReady, undefined, { openFeature: async () => ({ kind: "refused" }) }, fixedQuests(questsFixtures.ready));
    await user.click(pill()!);
    expect(within(screen.getByRole("banner")).queryByText("That couldn't be opened.")).toBeNull();
    const readyCrate = within(main()).getByRole("heading", { level: 2, name: "Unlocks: Quests" }).closest("article")!;
    expect(within(readyCrate).getByText("That couldn't be opened.")).toBeVisible();
  });

  it("is gone while unlocks don't apply", () => {
    renderApp(shellFixtures.member);
    expect(pill()).toBeNull();
  });

  it("sends the guarded command for the first ready crate in schedule order and reveals only after opened", async () => {
    const pending = answerLater();
    const openFeature = vi.fn(() => pending.answer);
    const { user } = renderApp(shellFixtures.memberWithEveryFeatureReady, undefined, { openFeature });
    await user.click(pill()!);
    expect(openFeature).toHaveBeenCalledExactlyOnceWith("leaderboard");
    expect(pill()).toHaveAccessibleName("Opening…");
    expect(dialog()).toBeNull();
    await pending.settle({ kind: "opened" });
    expect(dialog()).toHaveAccessibleName("Level 3 unlock");
  });

  it("ends a refusal from the pill as the crate does, with no reveal", async () => {
    const { user } = renderApp(ready, undefined, { openFeature: async () => ({ kind: "refused" }) });
    await user.click(pill()!);
    expect(dialog()).toBeNull();
    expect(announcement()).toHaveTextContent("That couldn't be opened.");
    expect(pill()).toHaveAccessibleName("1 ready");
  });

  it("takes in a crate that becomes ready during the visit without opening a dialog by itself", () => {
    const { showVisitor } = renderApp(shellFixtures.memberWaitingForTheBoard);
    expect(pill()).toBeNull();
    showVisitor(ready);
    expect(pill()).toHaveAccessibleName("1 ready");
    expect(dialog()).toBeNull();
  });
});

describe("WS75: the keyboard path", () => {
  it("opens with Enter, skips with Esc, replays, and closes with Done, returning focus to the card", async () => {
    const { user, showVisitor } = renderApp(ready, theWeeksBoard, { openFeature: async () => ({ kind: "opened" }) });
    openButton().focus();
    await user.keyboard("{Enter}");
    expect(dialog()).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Escape}");
    expect(within(dialog()!).getByRole("heading", { name: "Leaderboard is open" })).toBeInTheDocument();
    const actions = [document.activeElement];
    for (let i = 0; i < 3; i++) {
      await user.tab();
      actions.push(document.activeElement);
    }
    expect(actions.map((element) => element?.textContent)).toEqual(["Go to Leaderboard", "Done", "Replay", "Go to Leaderboard"]);
    showVisitor(opened);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(within(main()).getByRole("link", { name: "Open the leaderboard" }));
  });

  it("opens the pill's crate with Space", async () => {
    const { user } = renderApp(ready, undefined, { openFeature: async () => ({ kind: "opened" }) });
    within(screen.getByRole("banner")).getByRole("button", { name: "1 ready" }).focus();
    await user.keyboard(" ");
    expect(dialog()).toHaveAccessibleName("Level 3 unlock");
  });
});

function withAnotherFeatureShipped(member: MemberProfile): MemberProfile {
  const quests = { feature: "quests", name: "Quests", opens: "your weekly quests", level: 2, state: "open", readyAt: null, openedAt: null, seen: "quests-of-the-same-member" } as const;
  return { ...member, features: [quests, ...member.features!] };
}

function withSeenKeys(member: MemberProfile, keys: Record<string, string>): MemberProfile {
  return { ...member, features: member.features!.map((card) => ({ ...card, seen: keys[card.feature] ?? card.seen })) };
}
