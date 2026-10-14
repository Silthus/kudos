import { act, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import type { BoardAnswer, BoardRead } from "./boardRead";
import type { QuestsShown } from "./questsRead";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { fixedRecentKudos, recentKudosFixtures } from "./recentKudosFixtures";
import { shellFixtures, type MyBook, type MyLeaderboard, type MyQuests, type BuyAnswer, type MyRecentKudos, type MySkillTree, type OpenAnswer, type ShellState, type VisibilityReply } from "./shell";
import { fixedSkillTree, skillTreeFixtures } from "./skillTreeFixtures";
import { watchTheViewerRow } from "./test/viewerRow";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "./test/systemTheme";

const pages: { name: string; path: string; visitor: ShellState; board?: MyLeaderboard; quests?: MyQuests; book?: MyBook; skillTree?: MySkillTree; wide?: boolean }[] = [
  { name: "loading", path: "/", visitor: shellFixtures.loading },
  { name: "connecting", path: "/", visitor: shellFixtures.connecting },
  { name: "closed", path: "/", visitor: shellFixtures.closed },
  { name: "signed out", path: "/", visitor: shellFixtures.signedOut },
  { name: "signed out from a deep link", path: "/leaderboard?period=month", visitor: shellFixtures.signedOut },
  { name: "sign-in didn't finish", path: "/", visitor: shellFixtures.signInUnfinished },
  { name: "checking membership", path: "/", visitor: shellFixtures.verifying },
  { name: "membership not checked", path: "/", visitor: shellFixtures.unverified },
  { name: "not a member", path: "/", visitor: shellFixtures.notAMember },
  { name: "home", path: "/", visitor: shellFixtures.member },
  { name: "home in a quiet week", path: "/", visitor: shellFixtures.memberWithAQuietWeek },
  { name: "home at level 1", path: "/", visitor: shellFixtures.memberAtLevel1 },
  { name: "home past level 5", path: "/", visitor: shellFixtures.memberAtLevel7 },
  { name: "home for a member Slack didn't name", path: "/", visitor: { ...shellFixtures.memberAtLevel7, name: undefined } },
  { name: "not found", path: "/nowhere", visitor: shellFixtures.member },
  { name: "home with the leaderboard open", path: "/", visitor: shellFixtures.memberWithTheBoard },
  { name: "leaderboard with the viewer mid-board", path: "/leaderboard", visitor: shellFixtures.memberWithTheBoard, board: leaderboardFixtures.midBoard },
  { name: "leaderboard with teammates' Slack faces", path: "/leaderboard", visitor: shellFixtures.memberWithTheBoard, board: leaderboardFixtures.withTeammatesFaces },
  { name: "leaderboard led by the viewer", path: "/leaderboard", visitor: shellFixtures.memberWithTheBoard, board: leaderboardFixtures.viewerLeads },
  { name: "leaderboard with a shared lead", path: "/leaderboard", visitor: shellFixtures.memberWithTheBoard, board: leaderboardFixtures.sharedLead },
  { name: "leaderboard for a viewer who isn't ranked", path: "/leaderboard?period=month", visitor: shellFixtures.memberWithTheBoard, board: leaderboardFixtures.notRanked },
  { name: "leaderboard for a viewer who left", path: "/leaderboard", visitor: shellFixtures.memberWithTheBoard, board: leaderboardFixtures.left },
  { name: "home with the leaderboard locked", path: "/", visitor: shellFixtures.memberWaitingForTheBoard },
  { name: "home with the leaderboard ready and the skill tree locked", path: "/", visitor: shellFixtures.memberWithTheBoardReady },
  { name: "home with the leaderboard opened and the skill tree locked", path: "/", visitor: shellFixtures.memberWithTheBoardOpened },
  { name: "home with every shipped feature open", path: "/", visitor: shellFixtures.memberWithEveryFeatureOpen },
  { name: "home with no feature shipped", path: "/", visitor: shellFixtures.memberWithNothingShipped },
  { name: "quests with the nav in every state", path: "/quests", visitor: shellFixtures.memberWithEveryNavState, quests: questsFixtures.week },
  { name: "home with every panel locked", path: "/", visitor: shellFixtures.memberWithEveryPanelLocked },
  { name: "home with every panel ready", path: "/", visitor: shellFixtures.memberWithEveryPanelReady },
  { name: "home with every panel open", path: "/", visitor: shellFixtures.memberWithEveryPanelOpen },
  { name: "home with panels open, ready and locked", path: "/", visitor: shellFixtures.memberAcrossTheSheet },
  { name: "leaderboard locked until level 3", path: "/leaderboard", visitor: shellFixtures.memberWaitingForTheBoard, board: { kind: "locked", level: 3 } },
  { name: "leaderboard ready to open in place", path: "/leaderboard", visitor: shellFixtures.memberWithTheBoardReady, board: { kind: "ready" } },
  { name: "home with two crates and the ready pill", path: "/", visitor: shellFixtures.memberWithEveryFeatureReady },
  { name: "empty leaderboard", path: "/leaderboard?period=all", visitor: shellFixtures.memberWithTheBoard, board: leaderboardFixtures.empty },
  { name: "skill tree not found while it hasn't shipped", path: "/skills", visitor: shellFixtures.memberWaitingForTheBoard },
  { name: "skill tree locked until level 5", path: "/skills", visitor: shellFixtures.memberWithTheBoardOpened, skillTree: skillTreeFixtures.locked },
  { name: "skill tree ready to open in place", path: "/skills", visitor: shellFixtures.memberWithTheSkillTreeReady, skillTree: skillTreeFixtures.ready },
  { name: "skill tree with points and nothing owned", path: "/skills", visitor: shellFixtures.memberWithEveryFeatureOpen, skillTree: skillTreeFixtures.withPoints },
  { name: "skill tree with one perk owned, on a wide screen", path: "/skills", visitor: shellFixtures.memberWithOneSkillPoint, skillTree: skillTreeFixtures.sparkOwned, wide: true },
  { name: "skill tree with no skill points left, on a wide screen", path: "/skills", visitor: shellFixtures.memberWithNoSkillPointsLeft, skillTree: skillTreeFixtures.noPointsLeft, wide: true },
  { name: "skill tree below its row, on a wide screen", path: "/skills", visitor: shellFixtures.memberWithNoSkillPointsLeft, skillTree: skillTreeFixtures.belowTheRow, wide: true },
  { name: "skill tree with a perk that needs its base, on a wide screen", path: "/skills", visitor: shellFixtures.memberWithOneSkillPoint, skillTree: skillTreeFixtures.needsABase, wide: true },
  { name: "skill tree with every node state, the legend and the level chip", path: "/skills", visitor: shellFixtures.memberAtLevel7WithOneSkillPoint, skillTree: skillTreeFixtures.everyState },
  { name: "book locked until level 4", path: "/book", visitor: shellFixtures.memberWaitingForTheBook, book: bookFixtures.locked },
  { name: "book ready to open in place", path: "/book", visitor: shellFixtures.memberWithTheBookReady, book: bookFixtures.ready },
  { name: "book with a ladder at bronze and a ladder not started", path: "/book", visitor: shellFixtures.memberWithTheBookOpened, book: bookFixtures.book },
  { name: "book with every tier of a ladder earned", path: "/book", visitor: shellFixtures.memberWithTheBookOpened, book: bookFixtures.everyTierEarned },
  { name: "book with ladders unstarted, part-way, one tier from complete and complete", path: "/book", visitor: shellFixtures.memberWithTheBookOpened, book: bookFixtures.everyStage },
  { name: "book's overview with its page index, on a wide screen", path: "/book", visitor: shellFixtures.memberWithTheBookOpened, book: bookFixtures.everyLadder, wide: true },
  { name: "book's Giving page with its page index, on a wide screen", path: "/book?page=giving", visitor: shellFixtures.memberWithTheBookOpened, book: bookFixtures.everyLadder, wide: true },
  { name: "book's Crowd page with its page picker", path: "/book?page=crowd", visitor: shellFixtures.memberWithTheBookOpened, book: bookFixtures.everyLadder },
  { name: "home with the book locked", path: "/", visitor: shellFixtures.memberWaitingForTheBook },
  { name: "home starting the Journey with Quests locked", path: "/", visitor: shellFixtures.memberStartingTheJourney },
  { name: "home with a Journey step in each state and Quests open", path: "/", visitor: shellFixtures.memberWithQuests },
  { name: "quests this week", path: "/quests", visitor: shellFixtures.memberWithQuests, quests: questsFixtures.week },
  { name: "quests with last week's crate waiting", path: "/quests", visitor: shellFixtures.memberWithQuests, quests: questsFixtures.weekWithLastWeeksCrate },
  { name: "quests with the same quest's crate waiting from two weeks", path: "/quests", visitor: shellFixtures.memberWithQuests, quests: questsFixtures.weekWithTheSameQuestWaitingFromTwoWeeks },
  { name: "quests with nothing drawn", path: "/quests", visitor: shellFixtures.memberWithQuests, quests: questsFixtures.noDraw },
  { name: "quests with a swap left", path: "/quests", visitor: shellFixtures.memberWithQuests, quests: questsFixtures.weekWithASwapLeft },
  { name: "quests after the week's swap", path: "/quests", visitor: shellFixtures.memberWithQuests, quests: questsFixtures.weekAfterTheSwap },
  { name: "quests of every kind, finished and claimed", path: "/quests", visitor: shellFixtures.memberWithQuests, quests: questsFixtures.everyKind },
  { name: "quests locked until level 2", path: "/quests", visitor: shellFixtures.memberStartingTheJourney, quests: questsFixtures.locked },
  { name: "quests ready to open in place", path: "/quests", visitor: shellFixtures.memberWithQuestsReady, quests: questsFixtures.ready },
  { name: "error", path: "/", visitor: shellFixtures.error },
];

function answering(board: MyLeaderboard): BoardRead {
  return board.kind === "board" ? fixedLeaderboard(board) : (period) => (period && board);
}

const wcag22AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violationsIn(container: Element, options: axe.RunOptions = {}) {
  const results = await axe.run(container, { ...options, rules: { "color-contrast": { enabled: false } } });
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

describe("WS24: every page passes axe in light and dark", () => {
  for (const dark of [false, true]) {
    for (const page of pages) {
      it(`${page.name} in ${dark ? "dark" : "light"}`, async () => {
        fakeSystemTheme(dark);
        if (page.wide) preferWideScreen();
        window.history.replaceState(null, "", page.path);
        const { container } = renderApp(page.visitor, page.board && answering(page.board), undefined, page.quests && fixedQuests(page.quests), page.book && fixedBook(page.book), page.skillTree && fixedSkillTree(page.skillTree));
        expect(await violationsIn(container)).toEqual([]);
      });
    }

    it(`the whole board with the viewer's row pinned and Jump to me meets WCAG 2.2 AA in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      const viewerRow = watchTheViewerRow();
      Element.prototype.scrollTo = () => undefined;
      window.history.replaceState(null, "", "/leaderboard");
      const { user, container, getByRole } = renderApp(shellFixtures.memberWithTheBoard, fixedLeaderboard(leaderboardFixtures.midBoard));
      await user.click(getByRole("button", { name: "Show the whole board" }));
      viewerRow.see({ visible: false, edge: "bottom" });
      getByRole("button", { name: "Jump to me" });
      expect(await violationsIn(container, { runOnly: { type: "tag", values: wcag22AA } })).toEqual([]);
    });

    it(`a refused Swap's line on its quest card meets WCAG 2.2 AA in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      window.history.replaceState(null, "", "/quests");
      const { user, container, getByRole } = renderApp(shellFixtures.memberWithQuests, undefined, { swapQuest: async () => ({ kind: "refused" }) }, fixedQuests(questsFixtures.weekWithASwapLeft));
      const card = within(getByRole("main")).getByRole("heading", { name: "Thank someone and say why, 2 times." }).closest("article")!;
      await user.click(within(card).getByRole("button", { name: /^Swap/ }));
      within(card).getByText("That quest couldn't be swapped.");
      expect(await violationsIn(container, { runOnly: { type: "tag", values: wcag22AA } })).toEqual([]);
    });

    it(`the board grown by Show 5 more above and below meets WCAG 2.2 AA in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      window.history.replaceState(null, "", "/leaderboard");
      const { user, container, getByRole } = renderApp(shellFixtures.memberWithTheBoard, fixedLeaderboard(leaderboardFixtures.longBoardViewerInTheMiddle));
      await user.click(getByRole("button", { name: "Show 5 more above" }));
      await user.click(getByRole("button", { name: "Show 5 more below" }));
      getByRole("button", { name: "Show 3 more above" });
      expect(await violationsIn(container, { runOnly: { type: "tag", values: wcag22AA } })).toEqual([]);
    });

    it(`the skill tree's open perk drawer, portaled outside the landmarks, meets WCAG 2.2 AA in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      window.history.replaceState(null, "", "/skills");
      const { user, getByRole, findByRole } = renderApp(shellFixtures.memberWithEveryFeatureOpen, undefined, undefined, undefined, undefined, fixedSkillTree(skillTreeFixtures.withPoints));
      await user.click(within(getByRole("region", { name: "Perk tree" })).getByRole("button", { name: /^Rhythm\./ }));
      await findByRole("dialog", { name: "Rhythm" });
      expect(await violationsIn(document.body, { runOnly: { type: "tag", values: wcag22AA } })).toEqual([]);
    });

    it(`the next unlock's tooltip, portaled outside the landmarks, meets WCAG 2.2 AA in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      const { user, getByRole } = renderApp(shellFixtures.memberWithEveryNavState);
      await user.hover(within(getByRole("navigation", { name: "Screens" })).getByRole("link", { name: "Book, locked. Unlocks at level 4" }));
      await waitFor(() => expect(document.querySelector('[data-slot="tooltip-content"]')).toHaveTextContent("Next unlock · Book"));
      expect(await violationsIn(document.body, { runOnly: { type: "tag", values: wcag22AA } })).toEqual([]);
    });
  }
});

const railStates: { name: string; board: BoardAnswer | undefined; quests: QuestsShown | undefined; visitor?: ShellState }[] = [
  { name: "open, mid-board, with a quest in each state", board: leaderboardFixtures.midBoard, quests: questsFixtures.week },
  { name: "open, tied, with an empty week", board: leaderboardFixtures.tiedBelowTheLead, quests: questsFixtures.noDraw },
  { name: "open, leading the board with teammates' Slack faces", board: leaderboardFixtures.withTeammatesFaces, quests: questsFixtures.twoQuests },
  { name: "open, not ranked", board: leaderboardFixtures.notRanked, quests: questsFixtures.nextWeek },
  { name: "open, off the boards", board: leaderboardFixtures.left, quests: questsFixtures.week },
  { name: "waiting for both answers", board: undefined, quests: undefined },
  { name: "with both reads failed", board: { kind: "broken" }, quests: { kind: "broken" } },
  { name: "locked by the reads before getMyProfile catches up", board: { kind: "locked", level: 3 }, quests: { kind: "locked", level: 2 } },
  { name: "ready by the reads before getMyProfile catches up", board: { kind: "ready" }, quests: { kind: "ready" } },
  { name: "at level 7", board: leaderboardFixtures.viewerLeads, quests: questsFixtures.week, visitor: { ...shellFixtures.memberWithEveryPanelOpen, progression: shellFixtures.memberAtLevel7.progression } },
];

describe("WS111 WS112: every state of the home's rail passes axe in light and dark", () => {
  for (const dark of [false, true]) {
    for (const state of railStates) {
      it(`the rail ${state.name} in ${dark ? "dark" : "light"}`, async () => {
        fakeSystemTheme(dark);
        window.history.replaceState(null, "", "/");
        const { container } = renderApp(state.visitor ?? shellFixtures.memberWithEveryPanelOpen, (period) => (period && state.board), undefined, (asking) => (asking ? state.quests : undefined));
        expect(await violationsIn(container)).toEqual([]);
      });
    }
  }
});

const recentKudosStates: { name: string; received: MyRecentKudos | undefined; given: MyRecentKudos | undefined; choose?: "Given"; shows: string }[] = [
  { name: "received, with an edited message and words from before HedgeHug kept them", received: recentKudosFixtures.threeReceived, given: recentKudosFixtures.threeGiven, shows: "Edited" },
  { name: "given, to one, two and five teammates", received: recentKudosFixtures.threeReceived, given: recentKudosFixtures.threeGiven, choose: "Given", shows: "and 3 others" },
  { name: "empty, received", received: recentKudosFixtures.nothingYet, given: recentKudosFixtures.nothingYet, shows: "Kudos you receive show here." },
  { name: "empty, given", received: recentKudosFixtures.nothingYet, given: recentKudosFixtures.nothingYet, choose: "Given", shows: "Kudos you give show here" },
  { name: "with a deleted and a removed message", received: recentKudosFixtures.unavailableWords, given: recentKudosFixtures.nothingYet, shows: "This message was deleted in Slack." },
  { name: "keeping the received rows while Given loads", received: recentKudosFixtures.threeReceived, given: undefined, choose: "Given", shows: "Ada Lindqvist thanked you" },
];

describe("WS223: every state of the Recent kudos card passes axe in light and dark", () => {
  for (const dark of [false, true]) {
    for (const state of recentKudosStates) {
      it(`the card ${state.name} in ${dark ? "dark" : "light"}`, async () => {
        fakeSystemTheme(dark);
        window.history.replaceState(null, "", "/");
        const { user, container, getByRole } = renderApp(shellFixtures.memberWithEveryPanelOpen, undefined, undefined, fixedQuests(questsFixtures.week), undefined, undefined, fixedRecentKudos(state));
        if (state.choose !== undefined) await user.click(getByRole("radio", { name: state.choose }));
        expect(getByRole("region", { name: "Recent kudos" })).toHaveTextContent(state.shows);
        expect(await violationsIn(container, { runOnly: { type: "tag", values: wcag22AA } })).toEqual([]);
      });
    }
  }
});

const crateStates: { name: string; answer: () => Promise<OpenAnswer>; reducedMotion?: boolean; skip?: boolean }[] = [
  { name: "opening", answer: () => new Promise(() => undefined) },
  { name: "refused", answer: async () => ({ kind: "refused" }) },
  { name: "unreachable", answer: async () => Promise.reject(new Error("socket closed")) },
  { name: "revealing", answer: async () => ({ kind: "opened" }) },
  { name: "revealed", answer: async () => ({ kind: "opened" }), skip: true },
  { name: "revealed under reduced motion", answer: async () => ({ kind: "opened" }), reducedMotion: true },
];

describe("WS75: every crate state passes axe in light and dark", () => {
  for (const dark of [false, true]) {
    for (const state of crateStates) {
      it(`the crate ${state.name} in ${dark ? "dark" : "light"}`, async () => {
        fakeSystemTheme(dark);
        if (state.reducedMotion) preferReducedMotion();
        const { user } = renderApp(shellFixtures.memberWithEveryFeatureReady, undefined, { openFeature: state.answer });
        const crate = within(screen.getByRole("main")).getByRole("heading", { name: "Unlocks: Leaderboard" }).closest("article")!;
        await user.click(within(crate).getByRole("button", { name: "Open" }));
        await act(async () => undefined);
        if (state.skip) await user.keyboard("{Escape}");
        expect(await violationsIn(document.body, { runOnly: { type: "tag", values: wcag22AA } })).toEqual([]);
      });
    }
  }
});

const questCrates = [
  { name: "a quest crate on /quests", path: "/quests", action: "Claim", place: () => within(screen.getByRole("main")).getByRole("heading", { name: "Thank someone you haven't thanked before." }).closest("article")! },
  { name: "a Journey crate on the home", path: "/", action: "Open", place: () => within(screen.getByRole("main")).getByRole("heading", { name: "Finish a weekly quest." }).closest("li")! },
];

describe("WS75 WS74: every quest crate state passes axe in light and dark", () => {
  for (const dark of [false, true]) {
    for (const crate of questCrates) {
      for (const state of crateStates) {
        it(`${crate.name} ${state.name} in ${dark ? "dark" : "light"}`, async () => {
          fakeSystemTheme(dark);
          if (state.reducedMotion) preferReducedMotion();
          window.history.replaceState(null, "", crate.path);
          const { user } = renderApp(shellFixtures.memberWithQuests, undefined, { openQuestCrate: state.answer }, fixedQuests(questsFixtures.weekWithLastWeeksCrate));
          await user.click(within(crate.place()).getByRole("button", { name: crate.action }));
          await act(async () => undefined);
          if (state.skip) await user.keyboard("{Escape}");
          expect(await violationsIn(document.body, { runOnly: { type: "tag", values: wcag22AA } })).toEqual([]);
        });
      }
    }
  }
});

const purchaseStates: { name: string; answer: () => Promise<BuyAnswer>; wide: boolean }[] = [
  { name: "buying", answer: () => new Promise(() => undefined), wide: true },
  { name: "bought", answer: async () => ({ kind: "bought" }), wide: true },
  { name: "refused with a reason", answer: async () => ({ kind: "refused", reason: "points" }), wide: true },
  { name: "unreachable", answer: async () => Promise.reject(new Error("socket closed")), wide: true },
  { name: "buying in the drawer", answer: () => new Promise(() => undefined), wide: false },
  { name: "refused in the drawer", answer: async () => ({ kind: "refused", reason: "points" }), wide: false },
  { name: "bought in the drawer", answer: async () => ({ kind: "bought" }), wide: false },
  { name: "unreachable in the drawer", answer: async () => Promise.reject(new Error("socket closed")), wide: false },
];

describe("WS24 WS87: every purchase state passes axe in light and dark", () => {
  for (const dark of [false, true]) {
    for (const state of purchaseStates) {
      it(`the perk ${state.name} in ${dark ? "dark" : "light"}`, async () => {
        fakeSystemTheme(dark);
        if (state.wide) preferWideScreen();
        window.history.replaceState(null, "", "/skills");
        let shownTree: MySkillTree = skillTreeFixtures.withPoints;
        const { user, showVisitor } = renderApp(shellFixtures.memberWithEveryFeatureOpen, undefined, { buyPerk: state.answer }, undefined, undefined, (asking) => (asking ? shownTree : undefined));
        await user.click(within(screen.getByRole("region", { name: "Perk tree" })).getByRole("button", { name: /^Rhythm\./ }));
        const details = state.wide ? screen.getByRole("region", { name: "Perk details" }) : await screen.findByRole("dialog", { name: "Rhythm" });
        await user.click(within(details).getByRole("button", { name: "Buy for 1 skill point" }));
        await act(async () => undefined);
        if (state.name.startsWith("bought")) {
          shownTree = skillTreeFixtures.noPointsLeft;
          showVisitor(shellFixtures.memberWithNoSkillPointsLeft);
          await act(async () => undefined);
        }
        expect(await violationsIn(document.body, { runOnly: { type: "tag", values: wcag22AA } })).toEqual([]);
      });
    }
  }
});

const visibilityStates: { name: string; answer: () => Promise<VisibilityReply> }[] = [
  { name: "pending", answer: () => new Promise(() => undefined) },
  { name: "set", answer: async () => ({ kind: "set", visible: false }) },
  { name: "refused", answer: async () => ({ kind: "refused" }) },
  { name: "unreachable", answer: async () => Promise.reject(new Error("socket closed")) },
];

describe("WS24 WS321: every visibility switch state passes axe in light and dark", () => {
  for (const dark of [false, true]) {
    for (const state of visibilityStates) {
      it(`the switch ${state.name} in ${dark ? "dark" : "light"}`, async () => {
        fakeSystemTheme(dark);
        window.history.replaceState(null, "", "/leaderboard");
        const { user, container, getByRole } = renderApp(shellFixtures.memberWithTheBoard, fixedLeaderboard(leaderboardFixtures.midBoard), { setBoardVisibility: state.answer });
        await user.click(getByRole("switch", { name: "Show me on the leaderboards" }));
        await act(async () => undefined);
        expect(await violationsIn(container, { runOnly: { type: "tag", values: wcag22AA } })).toEqual([]);
      });
    }
  }
});

describe("WS315 WS339: the reward's flight passes axe in light and dark", () => {
  for (const dark of [false, true]) {
    it(`flies to the HUD avatar in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      window.history.replaceState(null, "", "/quests");
      const { user } = renderApp(shellFixtures.memberWithQuests, undefined, { openQuestCrate: async () => ({ kind: "opened" }) }, fixedQuests(questsFixtures.week));
      await user.click(within(screen.getByRole("main")).getByRole("button", { name: "Claim" }));
      await user.keyboard("{Escape}");
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
      expect(document.querySelector("[data-reward-flight]")).not.toBeNull();
      expect(await violationsIn(document.body, { runOnly: { type: "tag", values: wcag22AA } })).toEqual([]);
    });
  }
});
