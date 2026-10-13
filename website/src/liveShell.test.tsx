import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Root } from "./Root";
import { shellFixtures } from "./shell";
import { fakeSystemTheme } from "./test/systemTheme";

const profileRead = vi.fn();
const authActions = { signIn: vi.fn(), signOut: vi.fn() };

vi.mock("convex/react", () => ({
  ConvexReactClient: class {},
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: () => profileRead(),
}));

vi.mock("@convex-dev/auth/react", () => ({
  ConvexAuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuthActions: () => authActions,
}));

function renderLiveSite() {
  const user = userEvent.setup();
  render(<Root convexUrl="https://happy-hog-123.convex.cloud" />);
  return { user };
}

function errorPage() {
  return screen.findByRole("heading", { level: 1, name: "Something went wrong" });
}

beforeEach(() => {
  fakeSystemTheme(false);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  profileRead.mockReset();
  authActions.signIn.mockReset();
  authActions.signOut.mockReset();
});

describe("WS20 WS24: the live site shows the error page when a call fails, with focus on its title after a state change", () => {
  it("a profile read that fails on the first load shows the error page, not a blank page, and leaves focus alone", async () => {
    profileRead.mockImplementation(() => {
      throw new Error("Server Error");
    });

    renderLiveSite();

    expect(await errorPage()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(await errorPage()).not.toHaveFocus();
  });

  it("a sign-in that can't start shows the error page, focuses its title and forgets the attempt", async () => {
    profileRead.mockReturnValue(shellFixtures.signedOut);
    authActions.signIn.mockRejectedValue(new Error("Server Error"));
    const { user } = renderLiveSite();

    await user.click(screen.getByRole("button", { name: "Sign in with Slack" }));

    expect(await errorPage()).toHaveFocus();
    expect(sessionStorage.length).toBe(0);
  });
});
