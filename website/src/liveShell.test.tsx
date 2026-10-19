import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Root } from "./Root";
import { settingsFixtures } from "./settingsFixtures";
import { shellFixtures } from "./shell";
import { fakeSystemTheme, preferWideScreen } from "./test/systemTheme";

const profileRead = vi.fn();
const boardRead = vi.fn();
const authActions = { signIn: vi.fn(), signOut: vi.fn() };
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
}));

const boardListeners = new Set<() => void>();

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

function albumAnd(query: string, answer: unknown) {
  return (asked: string) => (asked === "website/album:getAlbum" ? albumV1 : asked === query ? answer : undefined);
}

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

describe("WS321: the visibility switch never sends again by itself", () => {
  it("sends its one call over HTTP with the session's token, never through the socket's queue, which replays an unanswered mutation after a reconnect", async () => {
    window.history.replaceState(null, "", "/settings");
    profileRead.mockReturnValue(shellFixtures.member);
    boardRead.mockImplementation(albumAnd("website/settings:getSettings", settingsFixtures.everything));
    sentOverHttp.mockResolvedValue({ kind: "set", visible: false });
    const { user } = renderLiveSite();

    await user.click(await screen.findByRole("switch", { name: "Show me on the leaderboards" }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/commands:setBoardVisibility", args: { visible: false } });
    boardRead.mockImplementation(albumAnd("website/settings:getSettings", { ...settingsFixtures.everything, board: { onTheBoards: false } }));
    act(() => boardListeners.forEach((notify) => notify()));
    expect(await screen.findByText("You're off the leaderboards.")).toBeInTheDocument();
  });
});

describe("#608: a member's posthog.com match changes only through the link commands", () => {
  function onTheSettings() {
    window.history.replaceState(null, "", "/settings");
    profileRead.mockReturnValue(shellFixtures.member);
    boardRead.mockImplementation(albumAnd("website/settings:getSettings", settingsFixtures.forAnAdmin));
  }

  it("sends This is me's one linkMyCompanyProfile over HTTP with the session's token and the person's profile, never through the socket's queue", async () => {
    onTheSettings();
    boardRead.mockImplementation(albumAnd("website/settings:getSettings", settingsFixtures.thisIsMe));
    sentOverHttp.mockResolvedValue({ kind: "linked" });
    const { user } = renderLiveSite();

    await user.click(await screen.findByRole("button", { name: "This is me: Samantha Okafor" }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/commands:linkMyCompanyProfile", args: { profile: 2 } });
  });

  it("sends an admin's one linkCompanyProfile over HTTP with the teammate's key and the profile, never through the socket's queue", async () => {
    onTheSettings();
    sentOverHttp.mockResolvedValue({ kind: "linked" });
    const { user } = renderLiveSite();

    await user.click(await screen.findByRole("button", { name: "Change Ada Admin's match" }));
    await user.click(screen.getByRole("button", { name: "Match Ada Admin to Oriel Pemberton" }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/commands:linkCompanyProfile", args: { member: "k-ada", profile: 3 } });
  });
});

describe("the maintainer's workspace settings change only through setWorkspaceSettings", () => {
  it("sends the maintainer's one setWorkspaceSettings over HTTP with the three settings, never through the socket's queue", async () => {
    window.history.replaceState(null, "", "/settings");
    profileRead.mockReturnValue(shellFixtures.member);
    boardRead.mockImplementation(albumAnd("website/settings:getSettings", settingsFixtures.forTheMaintainer));
    sentOverHttp.mockResolvedValue({ kind: "set" });
    const { user } = renderLiveSite();

    const allowance = await screen.findByRole("spinbutton", { name: "Kudos a day" });
    await user.clear(allowance);
    await user.type(allowance, "6");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/commands:setWorkspaceSettings", args: { baseAllowance: 6, kudosEmoji: "taco", hugBudget: 10 } });
  });
});

describe("AL40: the album shell reads getAlbum through the live shell", () => {

  function showTheAlbum(album: unknown, otherReads: (query: string, args: unknown) => unknown = () => undefined) {
    preferWideScreen();
    profileRead.mockReturnValue(shellFixtures.member);
    boardRead.mockImplementation((query: string, args: unknown) => (query === "website/album:getAlbum" ? album : otherReads(query, args)));
  }

  it("a member getMyProfile says album for gets the album from one getAlbum subscription, with what the read doesn't answer yet left empty", async () => {
    showTheAlbum(albumV1);
    window.history.replaceState(null, "", "/");

    renderLiveSite();

    const bar = within((await screen.findAllByRole("banner"))[0]!);
    expect(await bar.findByRole("button", { name: "Open your packs, 1 waiting" })).toBeInTheDocument();
    expect(bar.getByText("290 XP to level 7")).toBeInTheDocument();
    expect(bar.getByRole("link", { name: "Your profile, Juno Park" })).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "Your emojis, 0 earned" })).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "Tray, 1 to put in" })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname + window.location.hash).toBe("/book#me"));
    expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();
    expect([...subscriptions].filter(({ query }) => query === "website/album:getAlbum")).toEqual([{ query: "website/album:getAlbum", args: {} }]);
  });

  it("AL23: the emoji button counts the earned emojis getAlbum answers, and none of its locked ones; an answer that doesn't say what earns each yet still lists them, named after themselves", async () => {
    const emojis = [
      { id: "level:5", kind: "level", name: "level-5", picture: "/emoji/level-5.png", earned: true, seen: false, inSlack: false, progress: null },
      { id: "hype:m-ines", kind: "hype", name: "ines-okafor-hype", picture: "/emoji/hype.png", earned: true, seen: true, inSlack: true, progress: null },
      { id: "level:10", kind: "level", name: "level-10", picture: "/emoji/level-10.png", earned: false, seen: false, inSlack: false, progress: { have: 700, need: 3600 } },
    ];
    showTheAlbum({ ...albumV1, emojis, moreEmojis: false, sharedEmojis: null });
    const { user } = renderLiveSite();

    const bar = within((await screen.findAllByRole("banner"))[0]!);
    await user.click(await bar.findByRole("button", { name: "Your emojis, 2 earned" }));
    expect(within(screen.getByRole("region", { name: "Levels 1 of 2" })).getAllByRole("listitem")[0]).toHaveTextContent(":level-5:You reached level-5");
  });

  it("AL49: /leaderboard reads the boards from one getThoughtfulBoards subscription, which no other album page opens", async () => {
    const boards = {
      kind: "boards",
      people: [{ person: "m-ines", name: "Ines Okafor", face: { kind: "initials", initials: "IO" }, teams: ["lanterns"], thoughtful: 4, you: false, rank: 1, tied: false }],
      teams: [{ team: "lanterns", name: "Lanterns", art: null, thoughtful: 4, mine: true, rank: 1, tied: false }],
      pinned: { me: { person: "m-juno", name: "Juno Park", face: { kind: "initials", initials: "JP" }, teams: ["lanterns"], thoughtful: 0, you: true, rank: null, tied: false }, teams: [{ team: "lanterns", name: "Lanterns", art: null, thoughtful: 4, mine: true, rank: 1, tied: false }] },
      onTheBoards: true,
    };
    showTheAlbum(albumV1, (query) => (query === "website/album:getThoughtfulBoards" ? boards : undefined));
    window.history.replaceState(null, "", "/book#milestones");
    const { user } = renderLiveSite();
    await screen.findByRole("heading", { level: 1, name: "Milestones" });
    expect([...subscriptions].map(({ query }) => query)).not.toContain("website/album:getThoughtfulBoards");

    await user.click(within((await screen.findAllByRole("banner"))[0]!).getByRole("link", { name: "Leaderboard" }));

    const people = within(await screen.findByRole("region", { name: "People" }));
    expect(people.getByText("Ines Okafor leads with 4.")).toBeInTheDocument();
    expect(people.getByText("Juno Park")).toBeInTheDocument();
    expect([...subscriptions].filter(({ query }) => query === "website/album:getThoughtfulBoards")).toEqual([{ query: "website/album:getThoughtfulBoards", args: {} }]);

    await user.click(within(screen.getByRole("group", { name: "Period" })).getByRole("button", { name: "Last week" }));

    expect([...subscriptions].filter(({ query }) => query === "website/album:getThoughtfulBoards"), "picking a period moves the one subscription to it").toEqual([{ query: "website/album:getThoughtfulBoards", args: { period: "last-week" } }]);
  });

  it("AL48: /activity reads this week's issue from one getAlbumWeek subscription with no week, then the picked week's, which no other album page opens", async () => {
    const quiet = { kudosGiven: 0, kudosReceived: 0, thoughtfulGiven: 0, thoughtfulReceived: 0, hugsGiven: 0, hugsReceived: 0, packsOpened: 0, days: [0, 0, 0, 0, 0, 0, 0], kudosOfWeek: null, thanked: { people: [], more: 0 }, thankedBy: { people: [], more: 0 }, hugged: { people: [], more: 0 }, huggedBy: { people: [], more: 0 }, newFaces: { people: [], more: 0 }, hoggies: { hoggies: [], more: 0 }, given: { kudos: [], more: false }, received: { kudos: [], more: false } };
    const weeks = [{ week: "2026-10-12", days: [0, 1, 0, 0, 0, 0, 0] }, { week: "2026-10-05", days: quiet.days }];
    const ines = { person: "m-ines", name: "Ines Okafor", face: { kind: "initials", initials: "IO" } };
    const thanksToInes = { people: [ines], morePeople: 0, message: { kind: "text", segments: [{ kind: "text", text: "Thanks for the review" }], edited: false }, at: Date.parse("2026-10-13T10:00:00Z") };
    const thisWeek = { kind: "week", week: "2026-10-12", weeks, issue: { ...quiet, kudosGiven: 1, thoughtfulGiven: 1, days: weeks[0]!.days, thanked: { people: [ines], more: 0 }, given: { kudos: [thanksToInes], more: false } } };
    const lastWeek = { kind: "week", week: "2026-10-05", weeks, issue: quiet };
    const weekAnswer = (args: { week?: string }) => (args.week === "2026-10-05" ? lastWeek : thisWeek);
    showTheAlbum(albumV1, (query, args) => (query === "website/album:getAlbumWeek" ? weekAnswer(args as { week?: string }) : undefined));
    window.history.replaceState(null, "", "/book#milestones");
    const { user } = renderLiveSite();
    await screen.findByRole("heading", { level: 1, name: "Milestones" });
    expect([...subscriptions].map(({ query }) => query)).not.toContain("website/album:getAlbumWeek");

    await user.click(within((await screen.findAllByRole("banner"))[0]!).getByRole("link", { name: "Activity" }));

    expect(within(await screen.findByRole("region", { name: "Who you thanked" })).getByRole("link", { name: "Ines Okafor" })).toBeInTheDocument();
    expect([...subscriptions].filter(({ query }) => query === "website/album:getAlbumWeek")).toEqual([{ query: "website/album:getAlbumWeek", args: {} }]);

    await user.click(screen.getByRole("tab", { name: /^Last week/ }));

    expect(await screen.findByText("A quiet week. Thank someone in Slack and say why, and it shows here.")).toBeInTheDocument();
    expect([...subscriptions].filter(({ query }) => query === "website/album:getAlbumWeek")).toEqual([{ query: "website/album:getAlbumWeek", args: { week: "2026-10-05" } }]);
  });

  it("the people getAlbum holds are found in the sidebar, before their teams are answered", async () => {
    const ines = { person: "m-ines", name: "Ines Okafor", face: { kind: "initials", initials: "IO" }, held: true };
    showTheAlbum({ ...albumV1, people: [ines] });
    const user = userEvent.setup();

    renderLiveSite();

    const side = within(await screen.findByRole("navigation", { name: "Album" }));
    await user.type(side.getByRole("searchbox", { name: "Search teams and people" }), "ines");
    expect(within(side.getByRole("list", { name: "People" })).getByRole("link", { name: "Ines Okafor" })).toBeInTheDocument();
  });

  it("AL18: the member's team page counts the held people getAlbum's team pages name, and none on another team", async () => {
    const face = { kind: "initials", initials: "XX" };
    const people = ["m-ines", "m-omar", "m-pia"].map((person) => ({ person, name: person, face, held: true }));
    const lanterns = { team: "lanterns", name: "Lanterns", art: null, mine: true, people: ["m-ines", "m-omar", "m-sol"], unmatched: [], held: 2, total: 3, state: "progress", unlockedAt: null };
    const comets = { ...lanterns, team: "comets", name: "Comets", mine: false, people: ["m-pia"], held: 1, total: 1, state: "ready" };
    showTheAlbum({ ...albumV1, teams: [lanterns, comets], people });
    window.history.replaceState(null, "", "/book#teams/lanterns");

    renderLiveSite();

    expect(await screen.findByRole("heading", { level: 1, name: "Lanterns" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Lanterns sticker, 2 of 3" })).toBeInTheDocument();
  });

  it("AL45: the class photo names the people getAlbum lists as not held yet, as silhouettes", async () => {
    const people = [
      { person: "m-ines", name: "Ines Okafor", face: { kind: "initials", initials: "IO" }, held: true },
      { person: "m-omar", name: "Omar Siddiqui", face: { kind: "initials", initials: "OS" }, held: false },
    ];
    const lanterns = { team: "lanterns", name: "Lanterns", art: null, mine: true, people: ["m-ines", "m-omar"], unmatched: [], held: 1, total: 2, state: "progress", unlockedAt: null };
    showTheAlbum({ ...albumV1, teams: [lanterns], people });
    window.history.replaceState(null, "", "/book#teams/lanterns");

    renderLiveSite();

    expect(await screen.findByRole("link", { name: "Omar Siddiqui Not in your album yet" })).toHaveAttribute("href", "/book#people/m-omar");
    expect(screen.getByRole("figure", { name: "Left to right Ines Okafor, Omar Siddiqui" })).toBeInTheDocument();
  });

  it("AL46: a person page subscribes to getAlbumPerson for the person in its address, and only there", async () => {
    const omar = { kind: "person", person: "m-omar", name: "Omar Siddiqui", face: { kind: "initials", initials: "OS" }, held: true, firstThankedAt: null, kudosGiven: 2, kudosReceived: 1, hugsGiven: 0, hugsReceived: 3, best: null, teams: [], hype: { earned: false, name: "omar-siddiqui-hype" } };
    showTheAlbum(albumV1, (query) => (query === "website/album:getAlbumPerson" ? omar : undefined));
    window.history.replaceState(null, "", "/book#people/m-omar");

    renderLiveSite();

    expect(await screen.findByRole("heading", { level: 1, name: "Omar Siddiqui" })).toBeInTheDocument();
    expect([...subscriptions].filter(({ query }) => query === "website/album:getAlbumPerson")).toEqual([{ query: "website/album:getAlbumPerson", args: { person: "m-omar" } }]);
  });

  it("AL45: unlocking a team sticker sends its one unlockTeamSticker over HTTP with the session's token, never through the socket's queue", async () => {
    const comets = { team: "comets", name: "Comets", art: null, mine: false, people: ["m-pia"], unmatched: [], held: 1, total: 1, state: "ready", unlockedAt: null };
    showTheAlbum({ ...albumV1, teams: [comets], people: [{ person: "m-pia", name: "Pia Lund", face: { kind: "initials", initials: "PL" }, held: true }] });
    sentOverHttp.mockReturnValue(new Promise(() => undefined));
    window.history.replaceState(null, "", "/book#teams/comets");
    const { user } = renderLiveSite();

    await user.click(await screen.findByRole("button", { name: "Ready to unlock the Comets sticker" }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/album:unlockTeamSticker", args: { team: "comets" } });
  });

  it("AL47: ripping a pack sends its one openThoughtfulPack over HTTP with the session's token, never through the socket's queue", async () => {
    showTheAlbum({ ...albumV1, packs: albumV1.packs.map((pack) => ({ ...pack, thanked: { name: "Ines Okafor", face: { kind: "initials", initials: "IO" } } })) });
    sentOverHttp.mockReturnValue(new Promise(() => undefined));
    const { user } = renderLiveSite();

    await user.click(await within((await screen.findAllByRole("banner"))[0]!).findByRole("button", { name: "Open your packs, 1 waiting" }));
    await user.click(await screen.findByRole("button", { name: "Rip open the pack for thanking Ines Okafor" }));

    expect(sentOverHttp).toHaveBeenCalledExactlyOnceWith({ address: "https://happy-hog-123.convex.cloud", token: "the-session-jwt", mutation: "website/album:openThoughtfulPack", args: { pack: "p-1" } });
  });

  it("AL11: Put in and Put them all in send putIn and putAllIn over HTTP with the session's token, never through the socket's queue", async () => {
    showTheAlbum({ ...albumV1, tray: [...albumV1.tray, { item: "t-2", kind: "hoggie", hoggie: "banana", rarity: "common", isNew: true }] });
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

  it("#718: an answer from a getAlbum and a putIn without the thanked person, as an older backend sends during a rollback, still lists and puts in the card, and opens the pack, for a teammate", async () => {
    showTheAlbum(albumV1);
    sentOverHttp.mockResolvedValueOnce({ kind: "placed", item: albumV1.tray[0] }).mockResolvedValueOnce({ kind: "opened", items: [{ item: "t-9", kind: "sticker", person: "m-ines" }], applied: null });
    const { user } = renderLiveSite();
    const bar = within((await screen.findAllByRole("banner"))[0]!);

    await user.click(await bar.findByRole("button", { name: "Tray, 1 to put in" }));
    expect(screen.getByRole("region", { name: "Tray" })).toHaveTextContent("A teammate");
    await user.click(screen.getByRole("button", { name: "Put your teammate's card in" }));

    await waitFor(() => expect(sentOverHttp).toHaveBeenCalledOnce());
    expect(await bar.findByRole("button", { name: "Tray, nothing to put in" })).toBeInTheDocument();
    await user.click(bar.getByRole("button", { name: "Open your packs, 1 waiting" }));
    expect(screen.getByText("For thanking a teammate")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rip open the pack for thanking a teammate" }));
    expect(await screen.findByRole("button", { name: "Turn the card" })).toBeInTheDocument();
  });

  it("AL67: every member subscribes to getAlbum whatever getMyProfile says, and while it answers off they read that the website isn't open here", async () => {
    profileRead.mockReturnValue(shellFixtures.member);
    boardRead.mockImplementation((query: string) => (query === "website/album:getAlbum" ? { kind: "off" } : undefined));
    renderLiveSite();

    expect(await screen.findByRole("heading", { level: 1, name: "Not open yet" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Album" })).not.toBeInTheDocument();
    expect(watchedQueries).toContain("website/album:getAlbum");
  });
});
