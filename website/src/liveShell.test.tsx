import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Root } from "./Root";
import { bookFixtures } from "./bookFixtures";
import { leaderboardFixtures } from "./leaderboardFixtures";
import { recentKudosFixtures } from "./recentKudosFixtures";
import { shellFixtures } from "./shell";
import { skillTreeFixtures } from "./skillTreeFixtures";
import { spotlightFixtures } from "./spotlightFixtures";
import { fakeSystemTheme, preferWideScreen } from "./test/systemTheme";

const profileRead = vi.fn();
const boardRead = vi.fn();
const authActions = { signIn: vi.fn(), signOut: vi.fn() };
const openFeatureCall = vi.fn();
const buyPerkCall = vi.fn();
const socket = { isWebSocketConnected: true };
const sessionToken = { current: "the-session-jwt" as string | null };
const sentOverHttp = vi.fn();
const readOnce = vi.fn();
const auth = { isLoading: false, isAuthenticated: true };

vi.mock("convex/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("convex/browser")>()),
  ConvexHttpClient: class {
    private token: string | undefined;
    constructor(private readonly address: string) {}
    setAuth(token: string) {
      this.token = token;
    }
    mutation(mutation: FunctionReference<"mutation">, args: unknown) {
      return sentOverHttp({ address: this.address, token: this.token, mutation: getFunctionName(mutation), args });
    }
  },
}));

vi.mock("convex/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("convex/react")>()),
  ConvexReactClient: class {},
  useConvexAuth: () => ({ ...auth }),
  useConvexConnectionState: () => ({ ...socket }),
  useQuery: () => profileRead(),
  useMutation: (mutation: FunctionReference<"mutation">) => (getFunctionName(mutation) === "website/commands:buyPerk" ? buyPerkCall : openFeatureCall),
}));

const boardListeners = new Set<() => void>();

function boardAnswers(answer: unknown) {
  boardRead.mockReturnValue(answer);
  act(() => boardListeners.forEach((notify) => notify()));
}

const watchedQueries: string[] = [];

const subscriptions = new Set<{ query: string; args: unknown }>();

const boardWatch = {
  url: "https://happy-hog-123.convex.cloud",
  watchQuery: (query: FunctionReference<"query">, args: unknown) => {
    watchedQueries.push(getFunctionName(query));
    return {
      onUpdate: (notify: () => void) => {
        const subscription = { query: getFunctionName(query), args };
        boardListeners.add(notify);
        subscriptions.add(subscription);
        return () => {
          boardListeners.delete(notify);
          subscriptions.delete(subscription);
        };
      },
      localQueryResult: () => {
        const answer = boardRead(getFunctionName(query));
        if (answer instanceof Error) throw answer;
        return answer;
      },
    };
  },
  query: (query: FunctionReference<"query">, args: unknown) => readOnce({ query: getFunctionName(query), args }),
} as unknown as ConvexReactClient;

vi.mock("@convex-dev/auth/react", () => ({
  ConvexAuthProvider: ({ children }: { children: ReactNode }) => <ConvexProvider client={boardWatch}>{children}</ConvexProvider>,
  useAuthActions: () => authActions,
  useAuthToken: () => sessionToken.current,
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
  watchedQueries.length = 0;
  subscriptions.clear();
  window.history.replaceState(null, "", "/");
  authActions.signIn.mockReset();
  authActions.signOut.mockReset();
  openFeatureCall.mockReset();
  buyPerkCall.mockReset();
  sentOverHttp.mockReset();
  readOnce.mockReset();
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

  it("shows the error page under the HUD when the board read fails, and Profile still opens in place", async () => {
    boardRead.mockReturnValue(new Error("Too many documents read"));
    const { user } = renderLiveSite();

    expect(await errorPage()).toBeInTheDocument();
    await user.click(within(screen.getByRole("navigation", { name: "Screens" })).getByRole("link", { name: "Profile" }));

    expect(pageTitle()).not.toHaveTextContent("Something went wrong");
    expect(window.location.pathname).toBe("/");
  });

  it("WS344: reads the group boards beside the board and shows their tabs once both answer", () => {
    const { groups, myGroup } = leaderboardFixtures.withGroupBoards;
    boardRead.mockImplementation((query: string) => (query === "website/groupBoards:getGroupBoards" ? { kind: "boards", groups, myGroup } : { ...leaderboardFixtures.withGroupBoards, groups: undefined, myGroup: undefined }));
    renderLiveSite();

    expect([...subscriptions].filter(({ query }) => query === "website/groupBoards:getGroupBoards").map(({ args }) => args)).toEqual([{ period: "week" }]);
    expect(screen.getByRole("tab", { name: "My group" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Groups" })).toBeInTheDocument();
  });

  it("WS344: shows Everyone alone when the group boards read answers a denial", () => {
    boardRead.mockImplementation((query: string) => (query === "website/groupBoards:getGroupBoards" ? { kind: "signed-out" } : leaderboardFixtures.midBoard));
    renderLiveSite();

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(pageTitle()).toHaveTextContent("Ada Lindqvist leads the week.");
  });

  it("shows the board once a failed read answers again", async () => {
    boardRead.mockReturnValue(new Error("Too many documents read"));
    renderLiveSite();
    expect(await errorPage()).toBeInTheDocument();

    boardAnswers(leaderboardFixtures.midBoard);

    expect(pageTitle()).toHaveTextContent("Ada Lindqvist leads the week.");
  });
});

describe("WS111: the home's rail reads through the live shell", () => {
  function subscriptionsTo(name: string) {
    return [...subscriptions].filter(({ query }) => query === name).map(({ args }) => args);
  }

  it("subscribes to this week's board once while the Leaderboard is open, and adds no second getQuests", () => {
    profileRead.mockReturnValue(shellFixtures.memberWithEveryPanelOpen);
    boardRead.mockReturnValue(undefined);
    renderLiveSite();
    boardAnswers(undefined);
    profileRead.mockReturnValue({ ...shellFixtures.memberWithEveryPanelOpen, thisWeek: { given: 3, received: 1 } });
    boardAnswers(undefined);

    expect(within(screen.getByRole("main")).getByRole("region", { name: "Where you stand" })).toHaveAttribute("aria-busy", "true");
    expect(subscriptionsTo("website/leaderboard:getLeaderboard")).toEqual([{ period: "week" }]);
    expect(subscriptionsTo("website/quests:getQuests")).toEqual([{}]);
    expect(subscriptionsTo("website/groupBoards:getGroupBoards")).toEqual([]);
  });

  it("WS343: subscribes once to the member's own profile card on the home", () => {
    profileRead.mockReturnValue(shellFixtures.memberWithEveryPanelOpen);
    boardRead.mockReturnValue(undefined);
    renderLiveSite();

    expect(subscriptionsTo("website/profileCard:getProfileCard")).toEqual([{}]);
  });

  it("subscribes to no board while the Leaderboard is locked", () => {
    profileRead.mockReturnValue(shellFixtures.memberWithEveryPanelLocked);
    boardRead.mockReturnValue(undefined);
    renderLiveSite();

    expect(watchedQueries).not.toContain("website/leaderboard:getLeaderboard");
  });
});

describe("WS200 WS207: the Recent kudos card reads getRecentKudos through the live shell", () => {
  function recentKudosAsked() {
    const asked = [...subscriptions].filter(({ query }) => query === "website/activity:getRecentKudos").map(({ args }) => JSON.stringify(args));
    return [...new Set(asked)].map((args) => JSON.parse(args) as unknown);
  }

  it("subscribes once to the last three kudos received across re-renders, then to the last three given once switched, while the tabs keep watching the received side", async () => {
    profileRead.mockReturnValue(shellFixtures.memberWithEveryPanelLocked);
    boardRead.mockReturnValue(recentKudosFixtures.threeReceived);
    const { user } = renderLiveSite();
    profileRead.mockReturnValue({ ...shellFixtures.memberWithEveryPanelLocked, thisWeek: { given: 3, received: 1 } });
    boardAnswers(recentKudosFixtures.threeReceived);

    const card = within(screen.getByRole("main")).getByRole("region", { name: "Recent kudos" });
    expect(card).toHaveTextContent("Ada Lindqvist thanked you");
    expect(recentKudosAsked()).toEqual([{ direction: "received", limit: 3 }]);

    await user.click(within(card).getByRole("radio", { name: "Given" }));

    expect(recentKudosAsked()).toEqual([
      { direction: "received", limit: 3 },
      { direction: "given", limit: 3 },
    ]);
  });

  it("takes the card away when the read fails after it showed rows", () => {
    profileRead.mockReturnValue(shellFixtures.memberWithEveryPanelLocked);
    boardRead.mockReturnValue(recentKudosFixtures.threeReceived);
    renderLiveSite();
    expect(within(screen.getByRole("main")).getByRole("region", { name: "Recent kudos" })).toBeInTheDocument();

    boardAnswers(new Error("Too many documents read"));

    expect(within(screen.getByRole("main")).queryByRole("region", { name: "Recent kudos" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Sam Example" })).toBeInTheDocument();
  });

  it("renders no card and keeps the home when the read fails", () => {
    profileRead.mockReturnValue(shellFixtures.memberWithEveryPanelLocked);
    boardRead.mockReturnValue(new Error("Too many documents read"));
    renderLiveSite();

    expect(within(screen.getByRole("main")).queryByRole("region", { name: "Recent kudos" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Sam Example" })).toBeInTheDocument();
  });
});

describe("WS219: the spotlight draws through the live shell with one-shot getSpotlight reads", () => {
  const { pairing, onboarding } = spotlightFixtures;

  function spotlightDraws() {
    return readOnce.mock.calls.map(([read]) => read as { query: string; args: unknown }).filter(({ query }) => query === "website/activity:getSpotlight");
  }

  beforeEach(() => {
    window.history.replaceState(null, "", "/leaderboard");
    profileRead.mockReturnValue(shellFixtures.memberWithTheBoard);
    boardRead.mockReturnValue(leaderboardFixtures.midBoard);
  });

  it("draws once per board visit with a seed, never subscribes, keeps the thank-you while the board updates, and reads after it on Next", async () => {
    readOnce.mockImplementation(async ({ args }: { args: unknown }) => (typeof args === "object" && args !== null && "after" in args ? onboarding : pairing));
    const { user } = renderLiveSite();
    const panel = await screen.findByRole("region", { name: "A thank-you from your workspace" });
    expect(panel).toHaveTextContent("Ada Lindqvist thanked Bo Okafor");
    expect(spotlightDraws()).toEqual([{ query: "website/activity:getSpotlight", args: { seed: expect.any(Number) } }]);
    expect(watchedQueries).not.toContain("website/activity:getSpotlight");

    boardAnswers(leaderboardFixtures.midBoardAfterAClimb);
    expect(spotlightDraws()).toHaveLength(1);

    await user.click(within(panel).getByRole("button", { name: "Next" }));
    expect(await within(panel).findByText("Cleo Marchetti thanked Dev Rao and Eli Brandt")).toBeInTheDocument();
    expect(spotlightDraws().at(-1)).toEqual({ query: "website/activity:getSpotlight", args: { after: pairing.after } });
  });

  it("ends a draw the server never answers after ten seconds, with Max's line and Try again", async () => {
    vi.useFakeTimers();
    readOnce.mockImplementation(() => new Promise(() => undefined));
    renderLiveSite();
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    const panel = screen.getByRole("region", { name: "A thank-you from your workspace" });
    expect(panel).toHaveTextContent("Couldn't find a thank-you just now.");
    expect(within(panel).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("WS85: the skill tree page reads getSkillTree through the live shell", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/skills");
    profileRead.mockReturnValue(shellFixtures.memberWithEveryFeatureOpen);
  });

  it("marks the page busy while the tree loads, then shows it with the HUD's skill point chip", () => {
    boardRead.mockReturnValue(undefined);
    renderLiveSite();
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");

    boardAnswers(skillTreeFixtures.withPoints);

    expect(pageTitle()).toHaveTextContent("Perks");
    expect(within(screen.getByRole("region", { name: "Perk tree" })).getAllByRole("button")).toHaveLength(3);
    expect(watchedQueries).toContain("website/skillTree:getSkillTree");
    expect(screen.getByRole("link", { name: "2 skill points to spend" })).toHaveAttribute("href", "/skills");
  });

  it("shows the error page under the HUD when the tree read fails", async () => {
    boardRead.mockReturnValue(new Error("Too many documents read"));
    renderLiveSite();

    expect(await errorPage()).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Screens" })).toBeInTheDocument();
  });
});

describe("WS87: the skill tree page buys through the live shell's buyPerk", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/skills");
    profileRead.mockReturnValue(shellFixtures.memberWithEveryFeatureOpen);
    boardRead.mockReturnValue(skillTreeFixtures.withPoints);
    preferWideScreen();
  });

  function buyButton() {
    return within(screen.getByRole("main")).getByRole("button", { name: /^Buy/ });
  }

  it("calls buyPerk with the perk and a browser request, and announces the answer", async () => {
    buyPerkCall.mockResolvedValue({ kind: "refused", reason: "points" });
    renderLiveSite();

    fireEvent.click(buyButton());
    await act(async () => undefined);

    expect(buyPerkCall).toHaveBeenCalledExactlyOnceWith({ perk: "spark", request: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(openFeatureCall).not.toHaveBeenCalled();
    expect(within(screen.getByRole("main")).getByRole("status")).toHaveTextContent("That couldn't be bought. No skill points to spend.");
  });

  it("ends Buying… after ten seconds without an answer, says HedgeHug couldn't be reached, and a retry resends the same request", async () => {
    vi.useFakeTimers();
    buyPerkCall.mockReturnValueOnce(new Promise(() => undefined)).mockResolvedValueOnce({ kind: "bought" });
    renderLiveSite();

    fireEvent.click(buyButton());
    await act(async () => vi.advanceTimersByTime(9_999));
    expect(buyButton()).toHaveAccessibleName("Buying…");
    await act(async () => vi.advanceTimersByTime(1));

    expect(within(screen.getByRole("main")).getByRole("status")).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    fireEvent.click(buyButton());
    await act(async () => undefined);

    expect(buyPerkCall).toHaveBeenCalledTimes(2);
    expect(buyPerkCall.mock.calls[1]).toEqual(buyPerkCall.mock.calls[0]);
    expect(within(screen.getByRole("main")).getByRole("status")).toHaveTextContent("You bought Spark.");
  });
});

describe("WS90 WS334: the live site reads the Book on /book", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/book");
    profileRead.mockReturnValue(shellFixtures.memberWithTheBookOpened);
  });

  it("shows the member's Book from getBook", () => {
    boardRead.mockReturnValue(bookFixtures.book);
    renderLiveSite();
    expect(pageTitle()).toHaveTextContent("Achievements");
    expect(screen.getByRole("heading", { level: 2, name: "1 of 8 tiers earned" })).toBeInTheDocument();
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

    expect(pageTitle()).toHaveTextContent(/^HedgeHug$/);
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

describe("WS321: the visibility switch never sends again by itself", () => {
  it("sends its one call over HTTP with the session's token, never through the socket's queue, which replays an unanswered mutation after a reconnect", async () => {
    window.history.replaceState(null, "", "/leaderboard");
    profileRead.mockReturnValue(shellFixtures.memberWithTheBoard);
    boardRead.mockReturnValue(leaderboardFixtures.midBoard);
    sentOverHttp.mockResolvedValue({ kind: "set", visible: false });
    const { user } = renderLiveSite();

    await user.click(await screen.findByRole("switch", { name: "Show me on the leaderboards" }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/commands:setBoardVisibility", args: { visible: false } });
    expect(openFeatureCall).not.toHaveBeenCalled();
    boardAnswers(leaderboardFixtures.left);
    expect(await screen.findByText("You're off the leaderboards.")).toBeInTheDocument();
  });
});

describe("WS200 WS214: /activity reads getActivity through the live shell", () => {
  it("watches the newest page of the filter and reads each page once, 20 at a time", async () => {
    window.history.replaceState(null, "", "/activity?filter=given");
    profileRead.mockReturnValue(shellFixtures.memberWithEveryPanelLocked);
    boardRead.mockReturnValue({ kind: "activity", entries: [], cursor: null, timeZone: "Europe/Berlin" });
    readOnce.mockResolvedValue({ kind: "activity", entries: [], cursor: null, timeZone: "Europe/Berlin" });
    renderLiveSite();

    expect(await screen.findByText("Kudos you give show here, with what each one earned.")).toBeInTheDocument();
    const watched = [...subscriptions].filter(({ query }) => query === "website/activity:getActivity").map(({ args }) => args);
    expect(watched).toContainEqual({ filter: "given", cursor: null, limit: 20 });
    expect(readOnce).toHaveBeenCalledWith({ query: "website/activity:getActivity", args: { filter: "given", cursor: null, limit: 20 } });
  });
});
