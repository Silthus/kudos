import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Root } from "./Root";
import { bookFixtures } from "./bookFixtures";
import { collectionFixtures } from "./collectionFixtures";
import { leaderboardFixtures } from "./leaderboardFixtures";
import { recentKudosFixtures } from "./recentKudosFixtures";
import { settingsFixtures } from "./settingsFixtures";
import { shellFixtures } from "./shell";
import { skillTreeFixtures } from "./skillTreeFixtures";
import { spotlightFixtures } from "./spotlightFixtures";
import { fakeSystemTheme, preferWideScreen } from "./test/systemTheme";

const profileRead = vi.fn();
const faceRead = vi.fn();
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
  useQuery: (query: FunctionReference<"query">) => (getFunctionName(query) === "website/face:getMyFace" ? faceRead() : profileRead()),
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
        const answer = boardRead(getFunctionName(query), args);
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
  faceRead.mockReset();
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

describe("WS21: the member's own face comes from getMyFace, beside the profile and the boards", () => {
  const cutout = { kind: "company-profile", image: "https://res.cloudinary.com/posthog-test/image/upload/sam.png", colour: "#8567FF", initials: "SE" } as const;

  function isOwn(row: HTMLElement) {
    return within(row).queryByText("Sam Example") !== null;
  }

  function picturesOf(cutoutImage: string) {
    return [...document.querySelectorAll("img")].filter((picture) => picture.getAttribute("src") === cutoutImage);
  }

  it("shows the face getMyFace answers in place of the profile's own picture on the home", () => {
    profileRead.mockReturnValue(shellFixtures.memberWithEveryPanelOpen);
    faceRead.mockReturnValue(cutout);
    boardRead.mockReturnValue(undefined);
    renderLiveSite();

    expect(picturesOf(cutout.image).length).toBeGreaterThan(0);
  });

  it("puts that face on the member's own row of the board, and on no one else's", () => {
    window.history.replaceState(null, "", "/leaderboard");
    profileRead.mockReturnValue(shellFixtures.memberWithTheBoard);
    faceRead.mockReturnValue(cutout);
    boardRead.mockReturnValue(leaderboardFixtures.midBoard);
    renderLiveSite();

    const rows = screen.getAllByRole("listitem");
    const [ownRows, otherRows] = [rows.filter(isOwn), rows.filter((row) => !isOwn(row))];
    const withCutout = (row: HTMLElement) => row.querySelector(`img[src="${cutout.image}"]`) !== null;
    expect(ownRows.length).toBeGreaterThan(0);
    expect(ownRows.every(withCutout)).toBe(true);
    expect(otherRows.filter(withCutout)).toEqual([]);
  });

  it("keeps the profile's own picture while getMyFace answers a denial", () => {
    profileRead.mockReturnValue(shellFixtures.memberWithEveryPanelOpen);
    faceRead.mockReturnValue({ kind: "closed" });
    boardRead.mockReturnValue(undefined);
    renderLiveSite();

    expect(screen.getAllByText("SE").length).toBeGreaterThan(0);
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

  it("WS344: adds one subscription to this week's group boards while groups show to the member", () => {
    profileRead.mockReturnValue({ ...shellFixtures.memberWithEveryPanelOpen, groups: true });
    boardRead.mockReturnValue(undefined);
    renderLiveSite();

    expect(subscriptionsTo("website/leaderboard:getLeaderboard")).toEqual([{ period: "week" }]);
    expect(subscriptionsTo("website/groupBoards:getGroupBoards")).toEqual([{ period: "week" }]);
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
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Level 2 unlock");
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

describe("#568: a member picks a hoggie they hold as their avatar on /book/collection", () => {
  const rocket = { hoggie: "rocket", name: "Rocket", rarity: "legendary", art: { kind: "hoggie", slug: "rocket" } } as const;
  const banana = collectionFixtures.collection.hoggies.find(({ hoggie }) => hoggie === "banana")!;

  function onTheCollectionWith(avatar: typeof rocket | null) {
    window.history.replaceState(null, "", "/book/collection");
    profileRead.mockReturnValue({ ...shellFixtures.memberWithTheBookOpened, avatar });
    boardRead.mockImplementation((query: string) => (query === "website/collection:getCollection" ? collectionFixtures.collection : bookFixtures.book));
  }

  it("sends Use as avatar's one setAvatar over HTTP with the session's token and the tile's hoggie, never through the socket's queue", async () => {
    onTheCollectionWith(null);
    sentOverHttp.mockResolvedValue({ kind: "set", avatar: { hoggie: banana.hoggie, name: banana.name, rarity: banana.rarity, art: banana.art } });
    const { user } = renderLiveSite();

    await user.click(await screen.findByRole("button", { name: `Use as avatar: ${banana.name}` }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/commands:setAvatar", args: { hoggie: banana.hoggie } });
    expect(openFeatureCall).not.toHaveBeenCalled();
    expect(buyPerkCall).not.toHaveBeenCalled();
  });

  it("sends Remove avatar's one setAvatar with null over HTTP, never through the socket's queue", async () => {
    onTheCollectionWith(rocket);
    sentOverHttp.mockResolvedValue({ kind: "set", avatar: null });
    const { user } = renderLiveSite();

    await user.click(await screen.findByRole("button", { name: "Remove avatar" }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/commands:setAvatar", args: { hoggie: null } });
    expect(openFeatureCall).not.toHaveBeenCalled();
  });
});

describe("#606: every crate listed as a pack opens in the one scene, wherever its Open is", () => {
  it("#614: sends the picked pack's one openCrate over HTTP with the session's token, never through the socket's queue", async () => {
    window.history.replaceState(null, "", "/book/collection");
    profileRead.mockReturnValue(shellFixtures.memberWithPacks);
    boardRead.mockImplementation((query: string) => (query === "website/collection:getCollection" ? collectionFixtures.withEveryKindOfPack : bookFixtures.book));
    sentOverHttp.mockReturnValue(new Promise(() => undefined));
    const { user } = renderLiveSite();

    await user.click((await screen.findAllByRole("button", { name: "Fan out the 5 packs" }))[0]!);
    await user.click(screen.getByRole("button", { name: "Open pack 4" }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/commands:openCrate", args: { crate: "bought:1" } });
    expect(openFeatureCall).not.toHaveBeenCalled();
  });
});

describe("#608: a member's posthog.com match changes only through the link commands", () => {
  function onTheSettings() {
    window.history.replaceState(null, "", "/settings");
    profileRead.mockReturnValue(shellFixtures.memberWithSettings);
    boardRead.mockImplementation((query: string) => (query === "website/settings:getSettings" ? settingsFixtures.forAnAdmin : undefined));
  }

  it("sends This is me's one linkMyCompanyProfile over HTTP with the session's token and the person's profile, never through the socket's queue", async () => {
    onTheSettings();
    boardRead.mockImplementation((query: string) => (query === "website/settings:getSettings" ? settingsFixtures.thisIsMe : undefined));
    sentOverHttp.mockResolvedValue({ kind: "linked" });
    const { user } = renderLiveSite();

    await user.click(await screen.findByRole("button", { name: "This is me: Samantha Okafor" }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/commands:linkMyCompanyProfile", args: { profile: 2 } });
    expect(openFeatureCall).not.toHaveBeenCalled();
  });

  it("sends an admin's one linkCompanyProfile over HTTP with the teammate's key and the profile, never through the socket's queue", async () => {
    onTheSettings();
    sentOverHttp.mockResolvedValue({ kind: "linked" });
    const { user } = renderLiveSite();

    await user.click(await screen.findByRole("button", { name: "Change Ada Admin's match" }));
    await user.click(screen.getByRole("button", { name: "Match Ada Admin to Oriel Pemberton" }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/commands:linkCompanyProfile", args: { member: "k-ada", profile: 3 } });
    expect(openFeatureCall).not.toHaveBeenCalled();
  });
});

describe("the maintainer's workspace settings change only through setWorkspaceSettings", () => {
  it("sends the maintainer's one setWorkspaceSettings over HTTP with the three settings, never through the socket's queue", async () => {
    window.history.replaceState(null, "", "/settings");
    profileRead.mockReturnValue(shellFixtures.memberWithSettings);
    boardRead.mockImplementation((query: string) => (query === "website/settings:getSettings" ? settingsFixtures.forTheMaintainer : undefined));
    sentOverHttp.mockResolvedValue({ kind: "set" });
    const { user } = renderLiveSite();

    const allowance = await screen.findByRole("spinbutton", { name: "Kudos a day" });
    await user.clear(allowance);
    await user.type(allowance, "6");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/commands:setWorkspaceSettings", args: { baseAllowance: 6, kudosEmoji: "taco", hugBudget: 10 } });
    expect(openFeatureCall).not.toHaveBeenCalled();
  });
});

describe("WS87 WS335: an item purchase never sends again by itself", () => {
  it("sends buyItem once over HTTP with the session's token and the item's pending request, never through the socket's queue", async () => {
    profileRead.mockReturnValue(shellFixtures.memberWithTheInventory);
    sentOverHttp.mockResolvedValue({ kind: "bought", item: "kudos-emoji-gem" });
    const { user } = renderLiveSite();

    await user.click(await screen.findByRole("button", { name: "Buy for 100 coins, Gem" }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/commands:buyItem", args: { item: "kudos-emoji-gem", request: expect.stringMatching(/^[0-9a-f-]{36}$/) } });
    expect(openFeatureCall).not.toHaveBeenCalled();
    expect(await screen.findByText("You bought Gem.")).toBeInTheDocument();
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

describe("AL39 AL40: the album shell reads getAlbum through the live shell", () => {
  const albumV1 = {
    kind: "album",
    me: { name: "Juno Park", face: { kind: "initials", initials: "JP" }, person: "m-juno" },
    level: { level: 6, xp: 1210, startsAt: 1000, nextAt: 1500 },
    teams: [],
    people: [],
    morePeople: false,
    packs: [{ pack: "p-1", person: "m-ines", earnedAt: Date.parse("2026-10-17T09:00:00Z") }],
    morePacks: false,
    tray: [{ item: "t-1", kind: "sticker", person: "m-ines" }],
    moreTray: false,
  };

  it("a member getMyProfile says album for gets the album from one getAlbum subscription, with what the read doesn't answer yet left empty", async () => {
    preferWideScreen();
    profileRead.mockReturnValue({ ...shellFixtures.memberWithEveryFeatureOpen, album: true });
    boardRead.mockImplementation((query: string) => (query === "website/album:getAlbum" ? albumV1 : undefined));

    renderLiveSite();

    const bar = within((await screen.findAllByRole("banner"))[0]!);
    expect(await bar.findByRole("button", { name: "Open your packs, 1 waiting" })).toBeInTheDocument();
    expect(bar.getByText("290 XP to level 7")).toBeInTheDocument();
    expect(bar.getByRole("link", { name: "Your profile, Juno Park" })).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "Your emojis, 0 earned" })).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "Tray, 1 to put in" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Your album" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();
    expect([...subscriptions].filter(({ query }) => query === "website/album:getAlbum")).toEqual([{ query: "website/album:getAlbum", args: {} }]);
  });

  it("AL23: the emoji button counts the earned emojis getAlbum answers, and none of its locked ones; an answer that doesn't say what earns each yet still lists them, named after themselves", async () => {
    preferWideScreen();
    profileRead.mockReturnValue({ ...shellFixtures.memberWithEveryFeatureOpen, album: true });
    const emojis = [
      { id: "level:5", kind: "level", name: "level-5", picture: "/emoji/level-5.png", earned: true, seen: false, inSlack: false, progress: null },
      { id: "hype:m-ines", kind: "hype", name: "ines-okafor-hype", picture: "/emoji/hype.png", earned: true, seen: true, inSlack: true, progress: null },
      { id: "level:10", kind: "level", name: "level-10", picture: "/emoji/level-10.png", earned: false, seen: false, inSlack: false, progress: { have: 700, need: 3600 } },
    ];
    boardRead.mockImplementation((query: string) => (query === "website/album:getAlbum" ? { ...albumV1, emojis, moreEmojis: false, sharedEmojis: null } : undefined));
    const { user } = renderLiveSite();

    const bar = within((await screen.findAllByRole("banner"))[0]!);
    await user.click(await bar.findByRole("button", { name: "Your emojis, 2 earned" }));
    expect(within(screen.getByRole("region", { name: "Levels 1 of 2" })).getAllByRole("listitem")[0]).toHaveTextContent(":level-5:You reached level-5");
  });

  it("AL49: /leaderboard reads the boards from one getThoughtfulBoards subscription, which no other album page opens", async () => {
    preferWideScreen();
    profileRead.mockReturnValue({ ...shellFixtures.memberWithEveryFeatureOpen, album: true });
    const boards = {
      kind: "boards",
      people: [{ person: "m-ines", name: "Ines Okafor", face: { kind: "initials", initials: "IO" }, teams: ["lanterns"], thoughtful: 4, you: false, rank: 1, tied: false }],
      teams: [{ team: "lanterns", name: "Lanterns", art: null, thoughtful: 4, mine: true, rank: 1, tied: false }],
      pinned: { me: { person: "m-juno", name: "Juno Park", face: { kind: "initials", initials: "JP" }, teams: ["lanterns"], thoughtful: 0, you: true, rank: null, tied: false }, teams: [{ team: "lanterns", name: "Lanterns", art: null, thoughtful: 4, mine: true, rank: 1, tied: false }] },
      onTheBoards: true,
    };
    boardRead.mockImplementation((query: string) => (query === "website/album:getAlbum" ? albumV1 : query === "website/album:getThoughtfulBoards" ? boards : undefined));
    window.history.replaceState(null, "", "/");
    const { user } = renderLiveSite();
    await screen.findByRole("heading", { level: 1, name: "Your album" });
    expect([...subscriptions].map(({ query }) => query)).not.toContain("website/album:getThoughtfulBoards");

    await user.click(within((await screen.findAllByRole("banner"))[0]!).getByRole("link", { name: "Leaderboard" }));

    const people = within(await screen.findByRole("region", { name: "People" }));
    expect(people.getByText("Ines Okafor leads with 4.")).toBeInTheDocument();
    expect(people.getByText("Juno Park")).toBeInTheDocument();
    expect([...subscriptions].filter(({ query }) => query === "website/album:getThoughtfulBoards")).toEqual([{ query: "website/album:getThoughtfulBoards", args: {} }]);
  });

  it("AL48: /activity reads this week's issue from one getAlbumWeek subscription with no week, then the picked week's, which no other album page opens", async () => {
    preferWideScreen();
    profileRead.mockReturnValue({ ...shellFixtures.memberWithEveryFeatureOpen, album: true });
    const quiet = { kudosGiven: 0, kudosReceived: 0, thoughtfulGiven: 0, thoughtfulReceived: 0, hugsGiven: 0, hugsReceived: 0, packsOpened: 0, days: [0, 0, 0, 0, 0, 0, 0], kudosOfWeek: null, thanked: { people: [], more: 0 }, thankedBy: { people: [], more: 0 }, hugged: { people: [], more: 0 }, huggedBy: { people: [], more: 0 }, newFaces: { people: [], more: 0 }, hoggies: { hoggies: [], more: 0 }, given: { kudos: [], more: false }, received: { kudos: [], more: false } };
    const weeks = [{ week: "2026-10-12", days: [0, 1, 0, 0, 0, 0, 0] }, { week: "2026-10-05", days: quiet.days }];
    const ines = { person: "m-ines", name: "Ines Okafor", face: { kind: "initials", initials: "IO" } };
    const thanksToInes = { people: [ines], morePeople: 0, message: { kind: "text", segments: [{ kind: "text", text: "Thanks for the review" }], edited: false }, at: Date.parse("2026-10-13T10:00:00Z") };
    const thisWeek = { kind: "week", week: "2026-10-12", weeks, issue: { ...quiet, kudosGiven: 1, thoughtfulGiven: 1, days: weeks[0]!.days, thanked: { people: [ines], more: 0 }, given: { kudos: [thanksToInes], more: false } } };
    const lastWeek = { kind: "week", week: "2026-10-05", weeks, issue: quiet };
    const weekAnswer = (args: { week?: string }) => (args.week === "2026-10-05" ? lastWeek : thisWeek);
    boardRead.mockImplementation((query: string, args: unknown) => (query === "website/album:getAlbum" ? albumV1 : query === "website/album:getAlbumWeek" ? weekAnswer(args as { week?: string }) : undefined));
    window.history.replaceState(null, "", "/");
    const { user } = renderLiveSite();
    await screen.findByRole("heading", { level: 1, name: "Your album" });
    expect([...subscriptions].map(({ query }) => query)).not.toContain("website/album:getAlbumWeek");

    await user.click(within((await screen.findAllByRole("banner"))[0]!).getByRole("link", { name: "Activity" }));

    expect(within(await screen.findByRole("region", { name: "Who you thanked" })).getByRole("link", { name: "Ines Okafor" })).toBeInTheDocument();
    expect([...subscriptions].filter(({ query }) => query === "website/album:getAlbumWeek")).toEqual([{ query: "website/album:getAlbumWeek", args: {} }]);

    await user.click(screen.getByRole("tab", { name: /^Last week/ }));

    expect(await screen.findByText("A quiet week. Thank someone in Slack and say why, and it shows here.")).toBeInTheDocument();
    expect([...subscriptions].filter(({ query }) => query === "website/album:getAlbumWeek")).toEqual([{ query: "website/album:getAlbumWeek", args: { week: "2026-10-05" } }]);
  });

  it("the people getAlbum holds are found in the sidebar, before their teams are answered", async () => {
    preferWideScreen();
    profileRead.mockReturnValue({ ...shellFixtures.memberWithEveryFeatureOpen, album: true });
    const ines = { person: "m-ines", name: "Ines Okafor", face: { kind: "initials", initials: "IO" }, held: true };
    boardRead.mockImplementation((query: string) => (query === "website/album:getAlbum" ? { ...albumV1, people: [ines] } : undefined));
    const user = userEvent.setup();

    renderLiveSite();

    const side = within(await screen.findByRole("navigation", { name: "Album" }));
    await user.type(side.getByRole("searchbox", { name: "Search teams and people" }), "ines");
    expect(within(side.getByRole("list", { name: "People" })).getByRole("link", { name: "Ines Okafor" })).toBeInTheDocument();
  });

  it("AL18: the member's team page counts the held people getAlbum's team pages name, and none on another team", async () => {
    preferWideScreen();
    profileRead.mockReturnValue({ ...shellFixtures.memberWithEveryFeatureOpen, album: true });
    const face = { kind: "initials", initials: "XX" };
    const people = ["m-ines", "m-omar", "m-pia"].map((person) => ({ person, name: person, face, held: true }));
    const lanterns = { team: "lanterns", name: "Lanterns", art: null, mine: true, people: ["m-ines", "m-omar", "m-sol"], unmatched: [], held: 2, total: 3, state: "progress", unlockedAt: null };
    const comets = { ...lanterns, team: "comets", name: "Comets", mine: false, people: ["m-pia"], held: 1, total: 1, state: "ready" };
    boardRead.mockImplementation((query: string) => (query === "website/album:getAlbum" ? { ...albumV1, teams: [lanterns, comets], people } : undefined));
    window.history.replaceState(null, "", "/");

    renderLiveSite();

    expect(await screen.findByRole("heading", { level: 1, name: "Lanterns" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Lanterns sticker, 2 of 3" })).toBeInTheDocument();
  });

  it("AL45: the class photo names the people getAlbum lists as not held yet, as silhouettes", async () => {
    preferWideScreen();
    profileRead.mockReturnValue({ ...shellFixtures.memberWithEveryFeatureOpen, album: true });
    const people = [
      { person: "m-ines", name: "Ines Okafor", face: { kind: "initials", initials: "IO" }, held: true },
      { person: "m-omar", name: "Omar Siddiqui", face: { kind: "initials", initials: "OS" }, held: false },
    ];
    const lanterns = { team: "lanterns", name: "Lanterns", art: null, mine: true, people: ["m-ines", "m-omar"], unmatched: [], held: 1, total: 2, state: "progress", unlockedAt: null };
    boardRead.mockImplementation((query: string) => (query === "website/album:getAlbum" ? { ...albumV1, teams: [lanterns], people } : undefined));
    window.history.replaceState(null, "", "/");

    renderLiveSite();

    expect(await screen.findByRole("link", { name: "Omar Siddiqui Not in your album yet" })).toHaveAttribute("href", "/book#people/m-omar");
    expect(screen.getByRole("figure", { name: "Left to right Ines Okafor, Omar Siddiqui" })).toBeInTheDocument();
  });

  it("AL46: a person page subscribes to getAlbumPerson for the person in its address, and only there", async () => {
    preferWideScreen();
    profileRead.mockReturnValue({ ...shellFixtures.memberWithEveryFeatureOpen, album: true });
    const omar = { kind: "person", person: "m-omar", name: "Omar Siddiqui", face: { kind: "initials", initials: "OS" }, held: true, firstThankedAt: null, kudosGiven: 2, kudosReceived: 1, hugsGiven: 0, hugsReceived: 3, best: null, teams: [], hype: { earned: false, name: "omar-siddiqui-hype" } };
    boardRead.mockImplementation((query: string) => (query === "website/album:getAlbum" ? albumV1 : query === "website/album:getAlbumPerson" ? omar : undefined));
    window.history.replaceState(null, "", "/book#people/m-omar");

    renderLiveSite();

    expect(await screen.findByRole("heading", { level: 1, name: "Omar Siddiqui" })).toBeInTheDocument();
    expect([...subscriptions].filter(({ query }) => query === "website/album:getAlbumPerson")).toEqual([{ query: "website/album:getAlbumPerson", args: { person: "m-omar" } }]);
  });

  it("AL45: unlocking a team sticker sends its one unlockTeamSticker over HTTP with the session's token, never through the socket's queue", async () => {
    preferWideScreen();
    profileRead.mockReturnValue({ ...shellFixtures.memberWithEveryFeatureOpen, album: true });
    const comets = { team: "comets", name: "Comets", art: null, mine: false, people: ["m-pia"], unmatched: [], held: 1, total: 1, state: "ready", unlockedAt: null };
    boardRead.mockImplementation((query: string) => (query === "website/album:getAlbum" ? { ...albumV1, teams: [comets], people: [{ person: "m-pia", name: "Pia Lund", face: { kind: "initials", initials: "PL" }, held: true }] } : undefined));
    sentOverHttp.mockReturnValue(new Promise(() => undefined));
    window.history.replaceState(null, "", "/book#teams/comets");
    const { user } = renderLiveSite();

    await user.click(await screen.findByRole("button", { name: "Ready to unlock the Comets sticker" }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/album:unlockTeamSticker", args: { team: "comets" } });
  });

  it("AL47: ripping a pack sends its one openThoughtfulPack over HTTP with the session's token, never through the socket's queue", async () => {
    preferWideScreen();
    profileRead.mockReturnValue({ ...shellFixtures.memberWithEveryFeatureOpen, album: true });
    boardRead.mockImplementation((query: string) => (query === "website/album:getAlbum" ? albumV1 : undefined));
    sentOverHttp.mockReturnValue(new Promise(() => undefined));
    const { user } = renderLiveSite();

    await user.click(await within((await screen.findAllByRole("banner"))[0]!).findByRole("button", { name: "Open your packs, 1 waiting" }));
    await user.click(await screen.findByRole("button", { name: "Rip open the pack for thanking a teammate" }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/album:openThoughtfulPack", args: { pack: "p-1" } });
  });

  it("AL11: Put in and Put them all in send putIn and putAllIn over HTTP with the session's token, never through the socket's queue", async () => {
    preferWideScreen();
    profileRead.mockReturnValue({ ...shellFixtures.memberWithEveryFeatureOpen, album: true });
    boardRead.mockImplementation((query: string) => (query === "website/album:getAlbum" ? { ...albumV1, tray: [...albumV1.tray, { item: "t-2", kind: "hoggie", hoggie: "banana", rarity: "common", isNew: true }] } : undefined));
    sentOverHttp.mockResolvedValue({ kind: "refused" });
    const { user } = renderLiveSite();
    const bar = within((await screen.findAllByRole("banner"))[0]!);

    await user.click(await bar.findByRole("button", { name: "Tray, 2 to put in" }));
    await user.click(screen.getByRole("button", { name: "Put Banana in" }));
    await user.click(await bar.findByRole("button", { name: "Tray, 2 to put in" }));
    await user.click(screen.getByRole("button", { name: "Put them all in · 2" }));

    await waitFor(() => expect(sentOverHttp).toHaveBeenCalledTimes(2));
    expect(sentOverHttp.mock.calls).toEqual([
      [{ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/album:putIn", args: { item: "t-2" } }],
      [{ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/album:putAllIn", args: {} }],
    ]);
  });

  it("while getAlbum answers off, the album waits, and a member without album never subscribes to getAlbum", async () => {
    profileRead.mockReturnValue({ ...shellFixtures.memberWithEveryFeatureOpen, album: true });
    boardRead.mockImplementation((query: string) => (query === "website/album:getAlbum" ? { kind: "off" } : undefined));
    const { unmount } = render(<Root convexUrl="https://happy-hog-123.convex.cloud" />);

    expect(await screen.findByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("navigation", { name: "Album" })).not.toBeInTheDocument();
    unmount();
    watchedQueries.length = 0;

    profileRead.mockReturnValue(shellFixtures.memberWithEveryFeatureOpen);
    renderLiveSite();

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(watchedQueries).not.toContain("website/album:getAlbum");
  });
});
