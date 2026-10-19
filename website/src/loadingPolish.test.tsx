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
    showVisitor(shellFixtures.notAMember);
    expect(placeholder()).toBeNull();
    expect(within(main()).getByRole("heading", { level: 1 })).toBeInTheDocument();
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
