import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Root } from "./Root";
import { shellFixtures } from "./shell";
import { fakeSystemTheme } from "./test/systemTheme";

const profileRead = vi.fn();
const authActions = { signIn: vi.fn(), signOut: vi.fn() };
const socket = { isWebSocketConnected: true };
const authProviderProps = vi.fn();

vi.mock("convex/react", () => ({
  ConvexReactClient: class {},
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useConvexConnectionState: () => ({ ...socket }),
  useQuery: () => profileRead(),
}));

vi.mock("@convex-dev/auth/react", () => ({
  ConvexAuthProvider: ({ children, ...props }: { children: ReactNode }) => {
    authProviderProps(props);
    return children;
  },
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  socket.isWebSocketConnected = true;
  authProviderProps.mockReset();
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

function pageTitle() {
  return screen.queryByRole("heading", { level: 1 });
}

describe("WS20: a socket that never connects shows where the page stands, never a blank page forever", () => {
  it("shows Can't reach HedgeHug once the socket has stayed unconnected for five seconds", () => {
    vi.useFakeTimers();
    socket.isWebSocketConnected = false;
    profileRead.mockReturnValue(undefined);
    renderLiveSite();

    act(() => vi.advanceTimersByTime(4_999));
    expect(pageTitle()).toBeNull();
    act(() => vi.advanceTimersByTime(1));

    expect(pageTitle()).toHaveTextContent("Can't reach HedgeHug");
  });

  it("moves on to the answer by itself once the socket connects", () => {
    vi.useFakeTimers();
    socket.isWebSocketConnected = false;
    profileRead.mockReturnValue(undefined);
    const { rerender } = render(<Root convexUrl="https://happy-hog-123.convex.cloud" />);
    act(() => vi.advanceTimersByTime(5_000));

    socket.isWebSocketConnected = true;
    profileRead.mockReturnValue(shellFixtures.closed);
    rerender(<Root convexUrl="https://happy-hog-123.convex.cloud" />);

    expect(pageTitle()).toHaveTextContent("Not open yet");
  });

  it("stays quiet while a connected socket waits for the answer", () => {
    vi.useFakeTimers();
    profileRead.mockReturnValue(undefined);
    renderLiveSite();

    act(() => vi.advanceTimersByTime(60_000));

    expect(pageTitle()).toBeNull();
  });
});

describe("WS5 WS20: the one-time code Slack's return brings is redeemed once, by the shell, and a failure ends the wait", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/?code=12345678");
  });

  it("redeems the code once, takes it off the address, and leaves Convex Auth's own redemption off", async () => {
    profileRead.mockReturnValue(shellFixtures.member);
    authActions.signIn.mockResolvedValue({ signingIn: true });
    renderLiveSite();

    expect(await screen.findByRole("heading", { level: 1, name: "Thank someone for work you noticed" })).toBeInTheDocument();
    expect(authActions.signIn.mock.calls).toEqual([[undefined, { code: "12345678" }]]);
    expect(window.location.search).toBe("");
    expect(authProviderProps).toHaveBeenCalledWith(expect.objectContaining({ shouldHandleCode: false }));
  });

  it("shows nothing but the busy frame while the code redeems, never the signed-out page", () => {
    profileRead.mockReturnValue(shellFixtures.signedOut);
    authActions.signIn.mockReturnValue(new Promise(() => undefined));
    renderLiveSite();

    expect(pageTitle()).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in with Slack" })).toBeNull();
  });

  it("shows Sign-in didn't finish when the code fails to redeem, instead of loading forever", async () => {
    profileRead.mockReturnValue(shellFixtures.signedOut);
    authActions.signIn.mockRejectedValue(new Error("Server Error"));
    renderLiveSite();

    expect(await screen.findByRole("heading", { level: 1, name: "Sign-in didn't finish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows the closed page when the code fails to redeem while the website is closed", async () => {
    profileRead.mockReturnValue(shellFixtures.closed);
    authActions.signIn.mockRejectedValue(new Error("Server Error"));
    renderLiveSite();

    expect(await screen.findByRole("heading", { level: 1, name: "Not open yet" })).toBeInTheDocument();
  });
});
