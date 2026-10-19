import { act } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { fixedSettings, settingsFixtures } from "./settingsFixtures";
import { shellFixtures, type ShellState, type VisibilityReply } from "./shell";
import { renderApp, renderSettingsPage } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const pages: { name: string; path: string; visitor: ShellState }[] = [
  { name: "loading", path: "/", visitor: shellFixtures.loading },
  { name: "connecting", path: "/", visitor: shellFixtures.connecting },
  { name: "closed", path: "/", visitor: shellFixtures.closed },
  { name: "signed out", path: "/", visitor: shellFixtures.signedOut },
  { name: "signed out from a deep link", path: "/leaderboard?period=month", visitor: shellFixtures.signedOut },
  { name: "sign-in didn't finish", path: "/", visitor: shellFixtures.signInUnfinished },
  { name: "checking membership", path: "/", visitor: shellFixtures.verifying },
  { name: "membership not checked", path: "/", visitor: shellFixtures.unverified },
  { name: "not a member", path: "/", visitor: shellFixtures.notAMember },
  { name: "not found", path: "/nowhere", visitor: shellFixtures.signedOut },
  { name: "error", path: "/", visitor: shellFixtures.error },
];

const wcag22AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violationsIn(container: Element, options: axe.RunOptions = {}) {
  const results = await axe.run(container, { ...options, rules: { "color-contrast": { enabled: false } } });
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

describe("WS24: every page before the album passes axe in light and dark", () => {
  for (const dark of [false, true]) {
    for (const page of pages) {
      it(`${page.name} in ${dark ? "dark" : "light"}`, async () => {
        fakeSystemTheme(dark);
        window.history.replaceState(null, "", page.path);
        const { container } = renderApp(page.visitor);
        expect(await violationsIn(container)).toEqual([]);
      }, 30_000);
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
        window.history.replaceState(null, "", "/settings");
        const { user, container, getByRole } = await renderSettingsPage(fixedSettings(settingsFixtures.everything), { setBoardVisibility: state.answer });
        await user.click(getByRole("switch", { name: "Show me on the leaderboards" }));
        await act(async () => undefined);
        expect(await violationsIn(container, { runOnly: { type: "tag", values: wcag22AA } })).toEqual([]);
      }, 30_000);
    }
  }
});
