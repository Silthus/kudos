import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Root } from "./Root";
import { bookFixtures } from "./bookFixtures";
import { leaderboardFixtures } from "./leaderboardFixtures";
import { shellFixtures } from "./shell";
import { fakeSystemTheme } from "./test/systemTheme";

const profileRead = vi.fn();
const boardRead = vi.fn();
const authActions = { signIn: vi.fn(), signOut: vi.fn() };
const openFeatureCall = vi.fn();
const socket = { isWebSocketConnected: true };
const auth = { isLoading: false, isAuthenticated: true };

vi.mock("convex/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("convex/react")>()),
  ConvexReactClient: class {},
  useConvexAuth: () => ({ ...auth }),
  useConvexConnectionState: () => ({ ...socket }),
  useQuery: () => profileRead(),
  useMutation: () => openFeatureCall,
}));

const boardListeners = new Set<() => void>();

function boardAnswers(answer: unknown) {
  boardRead.mockReturnValue(answer);
  act(() => boardListeners.forEach((notify) => notify()));
}

const boardWatch = {
  watchQuery: () => ({
    onUpdate: (notify: () => void) => {
      boardListeners.add(notify);
      return () => boardListeners.delete(notify);
    },
    localQueryResult: () => {
      const answer = boardRead();
      if (answer instanceof Error) throw answer;
      return answer;
    },
  }),
} as unknown as ConvexReactClient;

vi.mock("@convex-dev/auth/react", () => ({
  ConvexAuthProvider: ({ children }: { children: ReactNode }) => <ConvexProvider client={boardWatch}>{children}</ConvexProvider>,
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
  auth.isLoading = false;
  profileRead.mockReset();
  boardRead.mockReset();
  window.history.replaceState(null, "", "/");
  authActions.signIn.mockReset();
  authActions.signOut.mockReset();
  openFeatureCall.mockReset();
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

describe("WS20 WS36: the leaderboard read shows where the page stands, inside the HUD", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/leaderboard");
    profileRead.mockReturnValue(shellFixtures.memberWithTheBoard);
  });

  it("marks the page busy while the board loads, and shows Can't reach HedgeHug once the socket has stayed unconnected for five seconds", () => {
    vi.useFakeTimers();
    socket.isWebSocketConnected = false;
    boardRead.mockReturnValue(undefined);
    renderLiveSite();

    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    act(() => vi.advanceTimersByTime(5_000));

    expect(pageTitle()).toHaveTextContent("Can't reach HedgeHug");
    expect(screen.getByRole("navigation", { name: "Screens" })).toBeInTheDocument();
  });

  it("shows the error page under the HUD when the board read fails, and Home still opens in place", async () => {
    boardRead.mockReturnValue(new Error("Too many documents read"));
    const { user } = renderLiveSite();

    expect(await errorPage()).toBeInTheDocument();
    await user.click(within(screen.getByRole("navigation", { name: "Screens" })).getByRole("link", { name: "Home" }));

    expect(pageTitle()).not.toHaveTextContent("Something went wrong");
    expect(window.location.pathname).toBe("/");
  });

  it("shows the board once a failed read answers again", async () => {
    boardRead.mockReturnValue(new Error("Too many documents read"));
    renderLiveSite();
    expect(await errorPage()).toBeInTheDocument();

    boardAnswers(leaderboardFixtures.midBoard);

    expect(pageTitle()).toHaveTextContent("Ada Lindqvist leads the week.");
  });
});

describe("WS90 WS92: the live site reads the Book on /book", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/book");
    profileRead.mockReturnValue(shellFixtures.memberWithTheBookOpened);
  });

  it("shows the member's Book from getBook", () => {
    boardRead.mockReturnValue(bookFixtures.book);
    renderLiveSite();
    expect(pageTitle()).toHaveTextContent("Achievements");
    expect(screen.getByRole("heading", { level: 2, name: "Generosity" })).toBeInTheDocument();
  });

  it("shows the error page under the HUD when the Book read fails", async () => {
    boardRead.mockReturnValue(new Error("Too many documents read"));
    renderLiveSite();
    expect(await errorPage()).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Screens" })).toBeInTheDocument();
  });
});

describe("WS5: a sign-in started on a deep link comes back to it", () => {
  it.each(["/leaderboard?period=month", "/quests", "/"])("asks Convex Auth to bring the member back to %s after Slack", async (address) => {
    window.history.replaceState(null, "", address);
    profileRead.mockReturnValue(shellFixtures.signedOut);
    authActions.signIn.mockResolvedValue({ signingIn: false });
    const { user } = renderLiveSite();

    await user.click(screen.getByRole("button", { name: "Sign in with Slack" }));

    expect(authActions.signIn).toHaveBeenCalledWith("slack", { redirectTo: address });
  });
});

describe("WS5 WS20: a code from Slack that Convex Auth fails to redeem ends the wait", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/?code=12345678");
    auth.isLoading = true;
  });

  function redemptionRejects() {
    act(() => {
      window.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: new Error("Connection lost while action was in flight") }));
    });
  }

  it("shows nothing but the busy frame while Convex Auth redeems the code, never the signed-out page", () => {
    profileRead.mockReturnValue(shellFixtures.signedOut);
    renderLiveSite();

    expect(pageTitle()).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in with Slack" })).toBeNull();
  });

  it("shows Sign-in didn't finish when the redemption is rejected, instead of loading forever", () => {
    profileRead.mockReturnValue(shellFixtures.signedOut);
    renderLiveSite();

    redemptionRejects();

    expect(pageTitle()).toHaveTextContent("Sign-in didn't finish");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows the closed page when the redemption is rejected while the website is closed", () => {
    profileRead.mockReturnValue(shellFixtures.closed);
    renderLiveSite();

    redemptionRejects();

    expect(pageTitle()).toHaveTextContent("Not open yet");
  });

  it("lets the failure go once auth settles, so a later signed-out answer shows the plain sign-in page", () => {
    profileRead.mockReturnValue(shellFixtures.signedOut);
    const { rerender } = render(<Root convexUrl="https://happy-hog-123.convex.cloud" />);
    redemptionRejects();

    auth.isLoading = false;
    rerender(<Root convexUrl="https://happy-hog-123.convex.cloud" />);

    expect(pageTitle()).toHaveTextContent(/^Sign in$/);
  });

  it("ignores a rejection elsewhere on a page that brought no code from Slack", () => {
    window.history.replaceState(null, "", "/");
    profileRead.mockReturnValue(shellFixtures.signedOut);
    renderLiveSite();

    redemptionRejects();

    expect(pageTitle()).toBeNull();
  });
});

describe("WS66: an open the server never answers ends the wait", () => {
  function leaderboardCrate() {
    return within(screen.getByRole("main")).getByRole("heading", { level: 3, name: "Unlocks: Leaderboard" }).closest("article")!;
  }

  it("closes the crate again after ten seconds without an answer, says HedgeHug couldn't be reached, and a retry opens it", async () => {
    vi.useFakeTimers();
    profileRead.mockReturnValue(shellFixtures.memberWithTheBoardReady);
    openFeatureCall.mockReturnValueOnce(new Promise(() => undefined)).mockResolvedValueOnce({ kind: "opened" });
    renderLiveSite();

    fireEvent.click(within(leaderboardCrate()).getByRole("button", { name: "Open" }));
    await act(async () => vi.advanceTimersByTime(9_999));
    expect(within(leaderboardCrate()).getByRole("button", { name: "Opening…" })).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(1));

    expect(screen.getByTestId("moment-announcement")).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    fireEvent.click(within(leaderboardCrate()).getByRole("button", { name: "Open" }));
    await act(async () => undefined);

    expect(openFeatureCall).toHaveBeenNthCalledWith(2, { feature: "leaderboard" });
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Level 3 unlock");
  });
});
