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

describe("WS20: the live site shows the error page when a call fails", () => {
  it("a profile read that fails on the server shows the error page, not a blank page", async () => {
    profileRead.mockImplementation(() => {
      throw new Error("Server Error");
    });

    renderLiveSite();

    expect(await errorPage()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("a sign-in that can't start shows the error page and forgets the attempt", async () => {
    profileRead.mockReturnValue(shellFixtures.signedOut);
    authActions.signIn.mockRejectedValue(new Error("Server Error"));
    const { user } = renderLiveSite();

    await user.click(screen.getByRole("button", { name: "Sign in with Slack" }));

    expect(await errorPage()).toBeInTheDocument();
    expect(sessionStorage.length).toBe(0);
  });

  it("a sign-out that fails shows the error page", async () => {
    profileRead.mockReturnValue(shellFixtures.member);
    authActions.signOut.mockRejectedValue(new Error("Server Error"));
    const { user } = renderLiveSite();

    await user.click(screen.getByRole("button", { name: /Account menu/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    expect(await errorPage()).toBeInTheDocument();
  });
});
