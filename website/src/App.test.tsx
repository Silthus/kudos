import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { shellFixtures } from "./shell";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
});

function visit(path: string) {
  window.history.replaceState(null, "", path);
}

describe("WS1 WS3 WS16 WS20: the shell renders each page from its fixture", () => {
  it("shows the closed page on every path while the site is closed, with no sign-in button", () => {
    for (const path of ["/", "/anything"]) {
      visit(path);
      const { unmount } = render(<App shell={shellFixtures.closed} />);
      expect(screen.getByRole("heading", { level: 1, name: "Not open yet" })).toBeInTheDocument();
      expect(screen.getByText(/isn't open here yet/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /sign in/i })).not.toBeInTheDocument();
      expect(document.title).toBe("HedgeHug · Not open yet");
      unmount();
    }
  });

  it("shows the signed-out page at the root with a disabled Sign in with Slack placeholder", () => {
    render(<App shell={shellFixtures.signedOut} />);
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with Slack" })).toHaveAttribute("aria-disabled", "true");
    expect(document.title).toBe("HedgeHug · Sign in");
  });

  it("shows the not-found page with a link home on any other path", () => {
    visit("/profile");
    render(<App shell={shellFixtures.member} />);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/");
    expect(document.title).toBe("HedgeHug · Not found");
  });

  it("shows the error page when a page fails to render", () => {
    render(<App shell={shellFixtures.error} />);
    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(document.title).toBe("HedgeHug · Error");
  });

  it("frames a member's home with the wordmark, Home as the only nav item, the theme control and the avatar", () => {
    render(<App shell={shellFixtures.member} />);
    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("link", { name: /HedgeHug/ })).toHaveAttribute("href", "/");
    expect(within(banner).getByText("Thanks a Hog")).toBeInTheDocument();
    const nav = within(banner).getByRole("navigation", { name: "Screens" });
    const items = within(nav).getAllByRole("link");
    expect(items.map((item) => item.textContent)).toEqual(["Home"]);
    expect(items[0]).toHaveAttribute("aria-current", "page");
    expect(within(banner).getByRole("group", { name: "Theme" })).toBeInTheDocument();
    expect(within(banner).getByRole("img", { name: shellFixtures.member.member.name })).toBeInTheDocument();
    expect(document.title).toBe("HedgeHug · Home");
  });

  it("keeps the nav and the avatar off the pages of a visitor who isn't signed in", () => {
    render(<App shell={shellFixtures.signedOut} />);
    const banner = screen.getByRole("banner");
    expect(within(banner).queryByRole("navigation")).not.toBeInTheDocument();
    expect(within(banner).getByRole("group", { name: "Theme" })).toBeInTheDocument();
  });
});
