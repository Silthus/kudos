import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
});

function main() {
  return screen.getByRole("main");
}

function placeholder() {
  return main().querySelector("[data-loading-placeholder]");
}

describe("#481 loading: a quiet placeholder holds the page's shape while the profile loads", () => {
  it("draws a hidden, wordless, unanimated placeholder under the busy main", () => {
    renderApp(shellFixtures.loading);
    expect(main()).toHaveAttribute("aria-busy", "true");
    const shape = placeholder();
    expect(shape).not.toBeNull();
    expect(shape).toHaveAttribute("aria-hidden", "true");
    expect(shape).toHaveTextContent("");
    expect(shape!.querySelectorAll("[class*='animate-']")).toHaveLength(0);
    expect(within(main()).queryByRole("heading")).toBeNull();
  });

  it("gives way to the page once the answer lands, and never shows on a page that answered", () => {
    const { showVisitor } = renderApp(shellFixtures.loading);
    showVisitor(shellFixtures.member);
    expect(placeholder()).toBeNull();
    expect(within(main()).getByRole("heading", { level: 1 })).toHaveTextContent("Sam Example");
  });

  it.each([
    { path: "/leaderboard", shape: "board" },
    { path: "/quests", shape: "home" },
    { path: "/book", shape: "column" },
    { path: "/activity", shape: "column" },
  ])("keeps holding $path's shape after the profile answers while the page's own read is still pending", ({ path, shape }) => {
    window.history.replaceState(null, "", path);
    const pending = () => undefined;
    renderApp(shellFixtures.memberWithEveryPanelOpen, pending, undefined, pending, pending, undefined, undefined, undefined, { watch: pending, read: () => new Promise(() => {}) });
    expect(main()).toHaveAttribute("aria-busy", "true");
    expect(placeholder()).toHaveAttribute("data-loading-placeholder", shape);
    expect(within(main()).queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("shapes the placeholder for the page the deep link asked for while the profile loads", () => {
    window.history.replaceState(null, "", "/leaderboard");
    renderApp(shellFixtures.loading);
    expect(placeholder()).toHaveAttribute("data-loading-placeholder", "board");
  });

  it("stays off the connecting and closed pages, which have Max's words", () => {
    window.history.replaceState(null, "", "/");
    for (const visitor of [shellFixtures.connecting, shellFixtures.closed]) {
      const { unmount } = renderApp(visitor);
      expect(placeholder()).toBeNull();
      unmount();
    }
  });
});
