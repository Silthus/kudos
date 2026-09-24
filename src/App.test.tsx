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
  workspaces: [],
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

vi.mock("convex/react", () => ({
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
    reload("/store", readyViewer({ storeEnabled: false }));
    expect(url).toBe("/me");
    expect(screen()).toBe("Me");
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
