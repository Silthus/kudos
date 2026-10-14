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

function pageTitle() {
  return screen.getByRole("heading", { level: 1 });
}

describe("WS3 WS20: Max says one sentence on the closed, not-a-member, unverified, not-found and error pages", () => {
  it.each([
    { page: "closed", path: "/", visitor: shellFixtures.closed },
    { page: "not-a-member", path: "/", visitor: shellFixtures.notAMember },
    { page: "unverified", path: "/", visitor: shellFixtures.unverified },
    { page: "not-found", path: "/missing", visitor: shellFixtures.signedOut },
    { page: "error", path: "/", visitor: shellFixtures.error },
  ])("the $page page", ({ path, visitor }) => {
    visit(path);
    renderApp(visitor);
    const maxSays = pageTitle().nextElementSibling?.textContent ?? "";
    expect(maxSays.match(/[.!?](\s|$)/g)).toHaveLength(1);
  });
});

describe("WS1 WS3 WS16 WS20: the shell renders each page from its visitor state", () => {
  it("shows the closed page on every path while the site is closed, with no sign-in button", () => {
    for (const path of ["/", "/anything"]) {
      visit(path);
      const { unmount } = renderApp(shellFixtures.closed);
      expect(pageTitle()).toHaveTextContent("Not open yet");
      expect(screen.getByText(/isn't open here yet/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /sign in/i })).not.toBeInTheDocument();
      expect(document.title).toBe("HedgeHug · Not open yet");
      unmount();
    }
  });

  it("shows the signed-out page at the root with Sign in with Slack as its one primary action", () => {
    renderApp(shellFixtures.signedOut);
    expect(pageTitle()).toHaveTextContent(/^HedgeHug$/);
    const signIn = screen.getByRole("button", { name: "Sign in with Slack" });
    expect(signIn).toBeEnabled();
    expect(signIn).not.toHaveAttribute("aria-disabled", "true");
    expect(document.title).toBe("HedgeHug · Sign in");
  });

  it("shows the not-found page with a link back to the profile on any other path", () => {
    visit("/profile");
    renderApp(shellFixtures.member);
    expect(pageTitle()).toHaveTextContent("Page not found");
    expect(screen.getByRole("link", { name: "Back to your profile" })).toHaveAttribute("href", "/");
    expect(document.title).toBe("HedgeHug · Not found");
  });

  it("shows the error page when a page fails to render", () => {
    renderApp(shellFixtures.error);
    expect(pageTitle()).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(document.title).toBe("HedgeHug · Error");
  });

  it("frames a member's profile with the wordmark, Profile as the only nav item, the theme control, the avatar and Sign out", () => {
    renderApp(shellFixtures.member);
    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("link", { name: /HedgeHug/ })).toHaveAttribute("href", "/");
    expect(within(banner).getByText("Thanks a Hog")).toBeInTheDocument();
    const nav = within(banner).getByRole("navigation", { name: "Screens" });
    const items = within(nav).getAllByRole("link");
    expect(items.map((item) => item.textContent)).toEqual(["Profile"]);
    expect(items[0]).toHaveAttribute("aria-current", "page");
    expect(within(banner).getByRole("group", { name: "Theme" })).toBeInTheDocument();
    expect(within(banner).getByRole("link", { name: "Sam Example" })).toHaveTextContent("SE");
    expect(within(banner).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(pageTitle()).toHaveTextContent("Sam Example");
    expect(document.title).toBe("HedgeHug · Profile");
  });

  it("greets a member whose name Slack didn't share without inventing one", () => {
    const { name: _, ...withoutName } = shellFixtures.member;
    renderApp({ ...withoutName, face: { kind: "initials", initials: "?" } });
    expect(screen.queryByText("Sam Example")).not.toBeInTheDocument();
    expect(within(screen.getByRole("banner")).getByRole("link", { name: "Your profile" })).toHaveAttribute("href", "/");
  });

  it("keeps the nav, the avatar and the header's Sign out off the pages of a visitor who isn't a member", () => {
    for (const visitor of [shellFixtures.verifying, shellFixtures.notAMember]) {
      const { unmount } = renderApp(visitor);
      const banner = screen.getByRole("banner");
      expect(within(banner).queryByRole("navigation")).not.toBeInTheDocument();
      expect(within(banner).queryAllByRole("link").map((link) => link.getAttribute("aria-label"))).toEqual(["HedgeHug, home"]);
      expect(within(banner).queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
      expect(within(banner).getByRole("group", { name: "Theme" })).toBeInTheDocument();
      unmount();
    }
  });

  it("stays quiet and busy while the answer is loading, never flashing the closed page", () => {
    renderApp(shellFixtures.loading);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText(/isn't open here yet/)).not.toBeInTheDocument();
  });
});

describe("WS6 WS8 WS20: the sign-in pages carry one hedgehog, one sentence from Max and their actions", () => {
  it("shows Checking your membership while the directory verifies a signed-in person, with a way to sign out", () => {
    renderApp(shellFixtures.verifying);
    expect(pageTitle()).toHaveTextContent("Checking your membership…");
    expect(document.title).toBe("HedgeHug · Checking your membership");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("tells an unverified person Max couldn't check their membership, and lets them sign in again or sign out", () => {
    renderApp(shellFixtures.unverified);
    expect(pageTitle()).toHaveTextContent("Membership not checked");
    expect(screen.getByText("We couldn't check your membership right now.")).toBeInTheDocument();
    expect(hedgehogsOnPage()).toBe(1);
    expect(screen.getByRole("button", { name: "Sign in again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(document.title).toBe("HedgeHug · Membership not checked");
  });

  it("tells a signed-in person outside the workspace that HedgeHug is for its members only, and offers sign-out", () => {
    renderApp(shellFixtures.notAMember);
    expect(pageTitle()).toHaveTextContent("Members only");
    expect(screen.getByText("Only members of this Slack workspace can use HedgeHug.")).toBeInTheDocument();
    expect(hedgehogsOnPage()).toBe(1);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign in/i })).not.toBeInTheDocument();
    expect(document.title).toBe("HedgeHug · Members only");
  });

  it("tells a visitor whose sign-in didn't finish, with Try again as the one primary action", () => {
    renderApp(shellFixtures.signInUnfinished);
    expect(pageTitle()).toHaveTextContent("Sign-in didn't finish");
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(document.title).toBe("HedgeHug · Sign-in didn't finish");
  });
});

function hedgehogsOnPage() {
  return screen.getByRole("main").querySelectorAll("svg").length;
}
