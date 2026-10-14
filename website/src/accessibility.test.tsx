import axe from "axe-core";
import { describe, expect, it } from "vitest";
import type { BoardRead } from "./boardRead";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { shellFixtures, type MyLeaderboard, type ShellState } from "./shell";
import { watchTheViewerRow } from "./test/viewerRow";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const pages: { name: string; path: string; visitor: ShellState; board?: MyLeaderboard }[] = [
  { name: "loading", path: "/", visitor: shellFixtures.loading },
  { name: "connecting", path: "/", visitor: shellFixtures.connecting },
  { name: "closed", path: "/", visitor: shellFixtures.closed },
  { name: "signed out", path: "/", visitor: shellFixtures.signedOut },
  { name: "sign-in didn't finish", path: "/", visitor: shellFixtures.signInUnfinished },
  { name: "checking membership", path: "/", visitor: shellFixtures.verifying },
  { name: "membership not checked", path: "/", visitor: shellFixtures.unverified },
  { name: "not a member", path: "/", visitor: shellFixtures.notAMember },
  { name: "home", path: "/", visitor: shellFixtures.member },
  { name: "home in a quiet week", path: "/", visitor: shellFixtures.memberWithAQuietWeek },
  { name: "home at level 1", path: "/", visitor: shellFixtures.memberAtLevel1 },
  { name: "home past level 5", path: "/", visitor: shellFixtures.memberAtLevel7 },
  { name: "not found", path: "/nowhere", visitor: shellFixtures.member },
  { name: "home with the leaderboard open", path: "/", visitor: shellFixtures.memberWithTheBoard },
  { name: "leaderboard with the viewer mid-board", path: "/leaderboard", visitor: shellFixtures.memberWithTheBoard, board: leaderboardFixtures.midBoard },
  { name: "leaderboard led by the viewer", path: "/leaderboard", visitor: shellFixtures.memberWithTheBoard, board: leaderboardFixtures.viewerLeads },
  { name: "leaderboard with a shared lead", path: "/leaderboard", visitor: shellFixtures.memberWithTheBoard, board: leaderboardFixtures.sharedLead },
  { name: "leaderboard for a viewer who isn't ranked", path: "/leaderboard?period=month", visitor: shellFixtures.memberWithTheBoard, board: leaderboardFixtures.notRanked },
  { name: "leaderboard for a viewer who left", path: "/leaderboard", visitor: shellFixtures.memberWithTheBoard, board: leaderboardFixtures.left },
  { name: "home with the leaderboard locked", path: "/", visitor: shellFixtures.memberWaitingForTheBoard },
  { name: "home with the leaderboard ready", path: "/", visitor: shellFixtures.memberWithTheBoardReady },
  { name: "leaderboard locked until level 3", path: "/leaderboard", visitor: shellFixtures.memberWaitingForTheBoard, board: { kind: "locked", level: 3 } },
  { name: "leaderboard ready to open in Slack", path: "/leaderboard", visitor: shellFixtures.memberWithTheBoardReady, board: { kind: "ready" } },
  { name: "empty leaderboard", path: "/leaderboard?period=all", visitor: shellFixtures.memberWithTheBoard, board: leaderboardFixtures.empty },
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
        window.history.replaceState(null, "", page.path);
        const { container } = renderApp(page.visitor, page.board && answering(page.board));
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

    it(`the open avatar menu, portaled outside the landmarks, meets WCAG 2.2 AA in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      const { user, getByRole, findByRole } = renderApp(shellFixtures.member);
      await user.click(getByRole("button", { name: "Account menu for Sam Example" }));
      await findByRole("menuitem", { name: "Sign out" });
      expect(await violationsIn(document.body, { runOnly: { type: "tag", values: wcag22AA } })).toEqual([]);
    });
  }
});
