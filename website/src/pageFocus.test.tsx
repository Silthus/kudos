import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
});

function pageTitle() {
  return screen.getByRole("heading", { level: 1 });
}

describe("WS24: focus lands on the page title after a state change, never on first load", () => {
  it("leaves focus alone on the first page shown", () => {
    renderApp(shellFixtures.signedOut);
    expect(pageTitle()).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it("leaves focus alone when the first answer arrives after loading", () => {
    const { showVisitor } = renderApp(shellFixtures.loading);
    showVisitor(shellFixtures.member);
    expect(pageTitle()).not.toHaveFocus();
  });

  it("moves focus to the home's title when the membership check turns into a member", () => {
    const { showVisitor } = renderApp(shellFixtures.verifying);
    showVisitor(shellFixtures.member);
    expect(pageTitle()).toHaveTextContent("Sam Example");
    expect(pageTitle()).toHaveFocus();
  });

  it("moves focus to the closed page's title when the site closes under an open page", () => {
    const { showVisitor } = renderApp(shellFixtures.member);
    showVisitor(shellFixtures.closed);
    expect(pageTitle()).toHaveTextContent("Not open yet");
    expect(pageTitle()).toHaveFocus();
  });

  it("moves focus to the sign-in page's title after signing out", () => {
    const { showVisitor } = renderApp(shellFixtures.member);
    showVisitor(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent(/^HedgeHug$/);
    expect(pageTitle()).toHaveFocus();
  });
});
