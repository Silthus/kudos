// @vitest-environment happy-dom
import { act, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Outlet, useLocation } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * A fake Convex session. Like the real client, a query sent before the token reached the
 * backend is answered as signed out: that answer is what used to send deep links to /me.
 */
type Session = { isLoading: boolean; isAuthenticated: boolean; tokenOnServer: boolean; viewer: Record<string, unknown> };
const readyViewer = (workspace: Record<string, unknown> = {}, member: Record<string, unknown> = {}) => ({
  status: "ready",
  workspaces: [] as Record<string, unknown>[],
  member: { _id: "m1", name: "Alex Rivera", isAdmin: true, ...member },
  workspace: { _id: "w1", name: "Lumen Labs", isDemo: true, storeEnabled: true, ...workspace },
});
let session: Session;
const listeners = new Set<() => void>();
function setSession(patch: Partial<Session>) {
  session = { ...session, ...patch };
  listeners.forEach((l) => l());
}
const useSession = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => session,
  );

/** `session.switchWorkspace`, answered by each test (the real one makes the viewer query follow). */
const switchWorkspace = vi.fn<(args: { memberId: string }) => Promise<null>>();

vi.mock("convex/react", () => ({
  useMutation: (fn: FunctionReference<"mutation">) => {
    if (getFunctionName(fn) !== "session:switchWorkspace") throw new Error(`unexpected mutation ${getFunctionName(fn)}`);
    return switchWorkspace;
  },
  useConvexAuth: () => {
    const { isLoading, isAuthenticated } = useSession();
    return { isLoading, isAuthenticated };
  },
  useQuery: (fn: FunctionReference<"query">, args?: unknown) => {
    const s = useSession();
    if (args === "skip" || getFunctionName(fn) !== "session:viewer") return undefined;
    return s.tokenOnServer ? s.viewer : { status: "signedOut" };
  },
}));

// Every screen is a stub naming itself, so the test sees which page the router chose.
const page = (name: string) => () => <h1>{name}</h1>;
vi.mock("./components/AppShell", () => ({ AppShell: () => <Outlet /> }));
vi.mock("./pages/Landing", () => ({ Landing: page("Landing") }));
vi.mock("./pages/NotInstalled", () => ({ NotInstalled: page("NotInstalled") }));
vi.mock("./pages/Me", () => ({ Me: page("Me") }));
vi.mock("./pages/Leaderboard", () => ({ Leaderboard: page("Leaderboard") }));
vi.mock("./pages/compare/Compare", () => ({ Compare: page("Compare") }));
vi.mock("./pages/Discoveries", () => ({ Discoveries: page("Discoveries") }));
vi.mock("./pages/Quests", () => ({ Quests: page("Quests") }));
vi.mock("./pages/Store", () => ({ Store: page("Store") }));
vi.mock("./pages/Analytics", () => ({ Analytics: page("Analytics") }));
vi.mock("./pages/Admin", () => ({ Admin: page("Admin") }));
vi.mock("./pages/Playground", () => ({ Playground: page("Playground") }));
vi.mock("./pages/Setup", () => ({ Setup: page("Setup") }));

const { App } = await import("./App");

let url = "";
function LocationProbe() {
  const { pathname, search, hash } = useLocation();
  url = `${pathname}${search}${hash}`;
  return null;
}

let root: Root;
let container: HTMLElement;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function open(path: string) {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
}
const step = (patch: Partial<Session>) => act(() => setSession(patch));
const screen = () => container.querySelector("h1")?.textContent ?? "Splash";

/** A hard reload: the page renders before the stored session has been restored. */
function reload(path: string, viewer = readyViewer()) {
  session = { isLoading: true, isAuthenticated: false, tokenOnServer: false, viewer };
  open(path);
  step({ isLoading: false, isAuthenticated: true, tokenOnServer: true });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("a hard reload of a deep link", () => {
  test.each([
    ["/leaderboard?period=year", "Leaderboard"],
    ["/compare?vs=past&period=quarter", "Compare"],
    ["/analytics", "Analytics"],
    ["/discoveries", "Discoveries"],
    ["/quests", "Quests"], // the Quest log link in every quest completion DM
    // Registered only for some viewers: the store when it's open, admin pages, the demo playground.
    ["/store#my-requests", "Store"],
    ["/admin?tab=store", "Admin"],
    ["/playground", "Playground"],
  ])("%s stays on %s while the session is restored", (path, name) => {
    reload(path);
    expect(url).toBe(path);
    expect(screen()).toBe(name);
  });

  test("shows the splash, not the landing page, until the session is known", () => {
    session = { isLoading: true, isAuthenticated: false, tokenOnServer: false, viewer: readyViewer() };
    open("/leaderboard?period=year");
    expect(screen()).toBe("Splash");
  });

  test("a page this viewer can't open still falls back to the dashboard", () => {
    reload("/store", readyViewer({ storeEnabled: false, gameEnabled: false }));
    expect(url).toBe("/me");
    expect(screen()).toBe("Me");
  });

  test("the Store opens from a link while the game is on, even before it's in the menu: the page shows its locked state", () => {
    reload("/store#my-requests", readyViewer({ storeEnabled: false, gameEnabled: true }));
    expect(url).toBe("/store#my-requests");
    expect(screen()).toBe("Store");
  });
});

describe("a signed-out visitor on a deep link", () => {
  test("is asked to sign in right there, and lands on the page once signed in", () => {
    session = { isLoading: false, isAuthenticated: false, tokenOnServer: false, viewer: readyViewer() };
    open("/admin?tab=store");
    expect(screen()).toBe("Landing");
    expect(url).toBe("/admin?tab=store");

    step({ isAuthenticated: true, tokenOnServer: true });
    expect(screen()).toBe("Admin");
    expect(url).toBe("/admin?tab=store");
  });

  test("the landing page itself leads to the dashboard after signing in", () => {
    session = { isLoading: false, isAuthenticated: false, tokenOnServer: false, viewer: readyViewer() };
    open("/");
    expect(screen()).toBe("Landing");
    step({ isAuthenticated: true, tokenOnServer: true });
    expect(url).toBe("/me");
  });

  test("a user whose workspace hasn't installed Kudos sees that at the requested URL", () => {
    session = { isLoading: false, isAuthenticated: true, tokenOnServer: true, viewer: { status: "notInstalled", name: "Sam" } };
    open("/leaderboard");
    expect(screen()).toBe("NotInstalled");
    expect(url).toBe("/leaderboard");
  });
});

describe("a link from Slack that names its workspace (?ws=)", () => {
  // Alex is in Lumen Labs (store closed, used last) and Acme (store open).
  const lumen = { memberId: "m1", slackTeamId: "TLUMEN", name: "Lumen Labs" };
  const acme = { memberId: "m2", slackTeamId: "TACME", name: "Acme" };
  const inWorkspace = (current: typeof lumen) => ({
    ...readyViewer(
      current === lumen ? { _id: "w1", name: "Lumen Labs", storeEnabled: false } : { _id: "w2", name: "Acme", storeEnabled: true },
      { _id: current.memberId },
    ),
    workspaces: [lumen, acme].map((w) => ({ ...w, iconUrl: null, current: w === current })),
  });
  beforeEach(() => {
    switchWorkspace.mockReset();
    // Like the real mutation: once it's done, the viewer query answers in the new workspace.
    switchWorkspace.mockImplementation(async ({ memberId }) => {
      setSession({ viewer: inWorkspace(memberId === acme.memberId ? acme : lumen) });
      return null;
    });
  });

  test("opens that workspace first, then the page and the section it points to", async () => {
    let finish = () => {};
    switchWorkspace.mockImplementationOnce(
      () => new Promise((resolve) => (finish = () => (setSession({ viewer: inWorkspace(acme) }), resolve(null)))),
    );
    reload("/store?ws=TACME#my-requests", inWorkspace(lumen));
    // Not the dashboard: Lumen Labs has no store, but the link isn't for Lumen Labs.
    expect(screen()).toBe("Splash");
    expect(url).toBe("/store?ws=TACME#my-requests");
    await act(async () => finish());
    expect(switchWorkspace).toHaveBeenCalledExactlyOnceWith({ memberId: "m2" });
    expect(screen()).toBe("Store");
    expect(url).toBe("/store#my-requests");
  });

  test("the workspace you're already in just drops the parameter", async () => {
    reload("/leaderboard?period=year&ws=TLUMEN", inWorkspace(lumen));
    await act(async () => {});
    expect(switchWorkspace).not.toHaveBeenCalled();
    expect(screen()).toBe("Leaderboard");
    expect(url).toBe("/leaderboard?period=year");
  });

  test("a workspace you're not in is ignored without a word", async () => {
    reload("/leaderboard?ws=TSTRANGER", inWorkspace(lumen));
    await act(async () => {});
    expect(switchWorkspace).not.toHaveBeenCalled();
    expect(screen()).toBe("Leaderboard");
    expect(url).toBe("/leaderboard");
    expect(container.textContent).not.toContain("TSTRANGER");
  });

  test("a switch that fails leaves you where you were, on the page the link points to", async () => {
    switchWorkspace.mockRejectedValue(new Error("You can't switch to that workspace."));
    reload("/leaderboard?ws=TACME", inWorkspace(lumen));
    await act(async () => {});
    expect(switchWorkspace).toHaveBeenCalledOnce();
    expect(screen()).toBe("Leaderboard");
    expect(url).toBe("/leaderboard");
  });

  test("a switch that another tab overrides in the meantime still opens the page", async () => {
    // Done, but by the time the viewer answers, another tab has picked Lumen Labs again.
    switchWorkspace.mockResolvedValue(null);
    reload("/leaderboard?ws=TACME", inWorkspace(lumen));
    await act(async () => {});
    expect(switchWorkspace).toHaveBeenCalledOnce();
    expect(screen()).toBe("Leaderboard");
    expect(url).toBe("/leaderboard");
  });

  test("survives signing in first", async () => {
    session = { isLoading: false, isAuthenticated: false, tokenOnServer: false, viewer: inWorkspace(lumen) };
    open("/store?ws=TACME#my-requests");
    expect(screen()).toBe("Landing");
    expect(url).toBe("/store?ws=TACME#my-requests");
    step({ isAuthenticated: true, tokenOnServer: true });
    await act(async () => {});
    expect(screen()).toBe("Store");
    expect(url).toBe("/store#my-requests");
  });
});
