import { hedgehogHandClaspPng } from "@posthog/brand/hoggies/png";
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { shellFixtures } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
});

function visit(path: string) {
  window.history.replaceState(null, "", path);
}

function signInCard() {
  return within(screen.getByRole("main"));
}

function landingHint() {
  return screen.queryByText(/You'll land on/);
}

describe("WS309: the sign-in page stands alone as variant E's card", () => {
  it("drops the HUD bar and keeps only the theme control above the card", () => {
    renderApp(shellFixtures.signedOut);
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "HedgeHug, home" })).not.toBeInTheDocument();
    const theme = screen.getByRole("group", { name: "Theme" });
    expect(screen.getByRole("main")).not.toContainElement(theme);
  });

  it("leads with the hand-clasp hedgehog at 112 px, then HedgeHug as the title and Thanks a Hog", () => {
    renderApp(shellFixtures.signedOut);
    const hedgehog = screen.getByRole("main").querySelector("img");
    expect(hedgehog).toHaveAttribute("src", hedgehogHandClaspPng);
    expect(hedgehog).toHaveAttribute("width", "112");
    const title = screen.getByRole("heading", { level: 1 });
    expect(title).toHaveTextContent(/^HedgeHug$/);
    expect(hedgehog?.compareDocumentPosition(title)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(signInCard().getByText("Thanks a Hog")).toBeInTheDocument();
    expect(document.title).toBe("HedgeHug · Sign in");
  });

  it("says what signing in shows and who can sign in, naming nothing a member might not have", () => {
    renderApp(shellFixtures.signedOut);
    expect(
      signInCard().getByText("Sign in to see your kudos, your level and everything you've unlocked. Only members of your Slack workspace can sign in."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Prototype/)).not.toBeInTheDocument();
  });

  it("makes Sign in with Slack the large, full-width primary action with the four-colour Slack glyph", () => {
    renderApp(shellFixtures.signedOut);
    const signIn = signInCard().getByRole("button", { name: "Sign in with Slack" });
    expect(signIn).toHaveClass("w-full");
    expect(signIn.querySelectorAll("svg rect")).toHaveLength(4);
    expect(signInCard().getAllByRole("button")).toEqual([signIn]);
  });

  it("centres the card in a narrow column", () => {
    renderApp(shellFixtures.signedOut);
    expect(screen.getByRole("main")).toHaveClass("max-w-sm", "mx-auto", "justify-center");
  });

  it.each([
    { path: "/quests", landing: "/quests" },
    { path: "/leaderboard", landing: "/leaderboard" },
    { path: "/leaderboard?period=month", landing: "/leaderboard?period=month" },
    { path: "/skills", landing: "/skills" },
    { path: "/book", landing: "/book" },
  ])("tells a visitor who followed a deep link to $path that they land on $landing afterwards", ({ path, landing }) => {
    visit(path);
    renderApp(shellFixtures.signedOut);
    const hint = landingHint();
    expect(hint).toHaveTextContent(`You'll land on ${landing} afterwards.`);
    expect(within(hint!).getByText(landing).tagName).toBe("CODE");
  });

  it("shows no landing hint at the front door", () => {
    visit("/");
    renderApp(shellFixtures.signedOut);
    expect(landingHint()).not.toBeInTheDocument();
  });

  it("shows the not-found page, with no card and no landing hint, for a path the website doesn't list", () => {
    visit("/inventory");
    renderApp(shellFixtures.signedOut);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Page not found");
    expect(screen.queryByRole("button", { name: "Sign in with Slack" })).not.toBeInTheDocument();
    expect(landingHint()).not.toBeInTheDocument();
  });

  it("moves focus to the card's title after signing out", () => {
    const { showVisitor } = renderApp(shellFixtures.member);
    showVisitor(shellFixtures.signedOut);
    const title = screen.getByRole("heading", { level: 1 });
    expect(title).toHaveTextContent(/^HedgeHug$/);
    expect(title).toHaveFocus();
  });

  it.each([
    { page: "closed", state: shellFixtures.closed, title: "Not open yet" },
    { page: "not-a-member", state: shellFixtures.notAMember, title: "Members only" },
  ])("keeps the HUD bar and its own layout on the $page page", ({ state, title }) => {
    renderApp(state);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.queryByText(/You'll land on/)).not.toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveClass("max-w-sm");
  });
});
