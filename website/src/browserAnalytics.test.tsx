import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Root } from "./Root";
import { shellFixtures } from "./shell";
import { withoutSignInCode } from "./browserAnalytics/withoutSignInCode";
import type { CaptureResult } from "posthog-js/dist/module.full.no-external";
import { fakeSystemTheme } from "./test/systemTheme";

type Call = { instance: string; method: string; args: unknown[] };
type Sent = { instance: string; event: string; properties: Record<string, unknown>; $set_once?: Record<string, unknown> };
type Config = { before_send: (event: CaptureResult | null) => CaptureResult | null } & Record<string, unknown>;

const recorded = vi.hoisted(() => ({ imports: 0, calls: [] as Call[], sent: [] as Sent[] }));

vi.mock("posthog-js/dist/module.full.no-external", () => {
  recorded.imports++;
  return { default: { init: (token: string, config: Config, name: string) => fakePostHog(token, config, name) } };
});

function fakePostHog(token: string, config: Config, name: string) {
  const registered: Record<string, unknown> = {};
  let capturing = true;
  const call = (method: string, ...args: unknown[]) => recorded.calls.push({ instance: name, method, args });
  call("init", token, config);
  return {
    capture(event: string, properties: Record<string, unknown> = {}) {
      call("capture", event, properties);
      if (!capturing) return;
      const wouldSend = {
        uuid: `event-${recorded.sent.length}`,
        event,
        properties: { $current_url: window.location.href, $referrer: document.referrer, ...registered, ...properties },
        $set_once: { $initial_current_url: window.location.href, $initial_referrer: "$direct" },
        timestamp: new Date(),
      } as unknown as CaptureResult;
      const result = config.before_send(wouldSend);
      if (result !== null) recorded.sent.push({ instance: name, event: result.event, properties: result.properties, $set_once: result.$set_once });
    },
    register: (properties: Record<string, unknown>) => (call("register", properties), Object.assign(registered, properties)),
    unregister: (property: string) => (call("unregister", property), delete registered[property]),
    opt_in_capturing: (options: unknown) => (call("opt_in_capturing", options), (capturing = true)),
    opt_out_capturing: () => (call("opt_out_capturing"), (capturing = false)),
    reset: () => call("reset"),
    stopSessionRecording: () => call("stopSessionRecording"),
    identify: (...args: unknown[]) => call("identify", ...args),
    alias: (...args: unknown[]) => call("alias", ...args),
    setPersonProperties: (...args: unknown[]) => call("setPersonProperties", ...args),
  };
}

const answers = new Map<string, unknown>();
const listeners = new Set<() => void>();

const fakeConvex = {
  url: "https://happy-hog-123.convex.cloud",
  watchQuery: (query: FunctionReference<"query">) => ({
    onUpdate: (notify: () => void) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    localQueryResult: () => {
      const answer = answers.get(getFunctionName(query));
      if (answer instanceof Error) throw answer;
      return answer;
    },
  }),
  query: async () => undefined,
} as unknown as ConvexReactClient;

vi.mock("convex/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("convex/react")>()),
  ConvexReactClient: class {},
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useConvexConnectionState: () => ({ isWebSocketConnected: true }),
}));

vi.mock("@convex-dev/auth/react", () => ({
  ConvexAuthProvider: ({ children }: { children: ReactNode }) => <ConvexProvider client={fakeConvex}>{children}</ConvexProvider>,
  useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
  useAuthToken: () => null,
}));

const analyticsRead = "website/browserAnalytics:getBrowserAnalytics";
const ann = { kind: "capture", token: "phc_the_project_token", host: "https://us.i.posthog.com", distinctId: "ann-analytics-id", environment: "sandbox" } as const;
const bea = { ...ann, distinctId: "bea-analytics-id" };
const denials = [{ kind: "signed-out" }, { kind: "verifying" }, { kind: "unverified" }, { kind: "not-a-member" }, { kind: "closed" }];

function analyticsAnswers(answer: unknown) {
  answers.set(analyticsRead, answer);
  act(() => listeners.forEach((notify) => notify()));
}

function renderLiveSite() {
  const user = userEvent.setup();
  render(<Root convexUrl="https://happy-hog-123.convex.cloud" />);
  return { user };
}

async function capturing() {
  await waitFor(() => expect(recorded.calls.some(({ method }) => method === "init")).toBe(true));
}

function callsOf(method: string) {
  return recorded.calls.filter((call) => call.method === method);
}

function only<Item>(items: Item[], index = 0): Item {
  const item = items[index];
  if (item === undefined) throw new Error(`nothing at ${index}`);
  return item;
}

function sentEvents() {
  return recorded.sent.map(({ event, properties }) => ({ event, page: properties.page, book_page: properties.book_page, spread: properties.spread }));
}

const screens = () => screen.getByRole("navigation", { name: "Screens" });

beforeEach(() => {
  fakeSystemTheme(false);
  vi.resetModules();
  recorded.imports = 0;
  recorded.calls.length = 0;
  recorded.sent.length = 0;
  answers.clear();
  answers.set("website/profile:getMyProfile", shellFixtures.memberWithEveryFeatureOpen);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  listeners.clear();
});

describe("the browser captures only while told to", () => {
  it("imports nothing and calls nothing while the read is loading, answers off, or answers a denial", async () => {
    const { user } = renderLiveSite();
    await user.click(within(screens()).getByRole("link", { name: "Leaderboard" }));
    for (const answer of [{ kind: "off" }, ...denials]) analyticsAnswers(answer);
    await user.click(within(screens()).getByRole("link", { name: "Profile" }));

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(recorded.imports).toBe(0);
    expect(recorded.calls).toEqual([]);
  });

  it("imports nothing when the read fails", async () => {
    renderLiveSite();
    analyticsAnswers(new Error("Server Error"));

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(recorded.imports).toBe(0);
    expect(recorded.calls).toEqual([]);
    expect(screen.queryByRole("heading", { level: 1, name: "Something went wrong" })).not.toBeInTheDocument();
  });

  it("a capture answer starts posthog-js bootstrapped as the member, with environment registered, flags off and no identify", async () => {
    renderLiveSite();
    analyticsAnswers(ann);
    await capturing();

    const init = only(callsOf("init"));
    expect(init.args[0]).toBe(ann.token);
    expect(init.args[1]).toMatchObject({
      api_host: ann.host,
      bootstrap: { distinctID: ann.distinctId, isIdentifiedID: true },
      person_profiles: "identified_only",
      advanced_disable_feature_flags: true,
      disable_external_dependency_loading: true,
      capture_pageview: false,
      capture_pageleave: true,
      mask_all_text: true,
      mask_all_element_attributes: true,
      enable_heatmaps: true,
      capture_dead_clicks: true,
      capture_performance: { web_vitals: true, network_timing: false },
    });
    expect(only(callsOf("register")).args[0]).toEqual({ environment: "sandbox" });
    expect([...callsOf("identify"), ...callsOf("alias"), ...callsOf("setPersonProperties")]).toEqual([]);
  });

  it.each([
    ["signing out", { kind: "signed-out" }],
    ["the flag turning off", { kind: "off" }],
    ["the website closing", { kind: "closed" }],
    ["the read failing", new Error("Server Error")],
  ])("%s stops replay, opts out and resets, and nothing is captured afterwards", async (_, next) => {
    const { user } = renderLiveSite();
    analyticsAnswers(ann);
    await capturing();
    const sentBefore = recorded.sent.length;

    analyticsAnswers(next);
    const stopping = recorded.calls.slice(-4).map(({ method }) => method);
    await user.click(within(screens()).getByRole("link", { name: "Leaderboard" }));
    window.history.pushState(null, "", "/book#hoggies/legendary");

    expect(stopping).toEqual(["stopSessionRecording", "opt_out_capturing", "reset", "opt_out_capturing"]);
    expect(recorded.sent).toHaveLength(sentBefore);
    expect(recorded.calls.slice(-4).map(({ method }) => method)).toEqual(stopping);
  });

  it("an answer that changes while posthog-js is still loading abandons the import", async () => {
    renderLiveSite();
    analyticsAnswers(ann);
    analyticsAnswers({ kind: "signed-out" });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(recorded.calls).toEqual([]);
  });

  it("a later capture answer for another member starts afresh with that member's ID", async () => {
    renderLiveSite();
    analyticsAnswers(ann);
    await capturing();
    analyticsAnswers({ kind: "signed-out" });

    analyticsAnswers(bea);
    await waitFor(() => expect(callsOf("init")).toHaveLength(2));

    const first = only(callsOf("init"));
    const second = only(callsOf("init"), 1);
    expect(second.instance).not.toBe(first.instance);
    expect(second.args[1]).toMatchObject({ bootstrap: { distinctID: bea.distinctId, isIdentifiedID: true } });
    expect(recorded.sent.filter(({ instance }) => instance === second.instance).map(({ event }) => event)).toEqual(["$pageview"]);
  });

  it("the same capture answer again starts nothing new", async () => {
    renderLiveSite();
    analyticsAnswers(ann);
    await capturing();

    analyticsAnswers({ ...ann });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(callsOf("init")).toHaveLength(1);
    expect(recorded.sent.map(({ event }) => event)).toEqual(["$pageview"]);
  });
});

describe("MS22: pageviews follow the address", () => {
  it("the first page, then each page a member opens, sends one pageview, after a page leave for the page before", async () => {
    const { user } = renderLiveSite();
    analyticsAnswers(ann);
    await capturing();

    await user.click(within(screens()).getByRole("link", { name: "Leaderboard" }));
    await user.click(within(screens()).getByRole("link", { name: "Profile" }));

    expect(sentEvents()).toEqual([
      { event: "$pageview", page: "home", book_page: undefined, spread: undefined },
      { event: "$pageleave", page: "home", book_page: undefined, spread: undefined },
      { event: "$pageview", page: "leaderboard", book_page: undefined, spread: undefined },
      { event: "$pageleave", page: "leaderboard", book_page: undefined, spread: undefined },
      { event: "$pageview", page: "home", book_page: undefined, spread: undefined },
    ]);
  });

  it("each Book spread sends its own pageview with the Book's page and the spread's hash, and later events carry the page", async () => {
    renderLiveSite();
    analyticsAnswers(ann);
    await capturing();

    act(() => window.history.pushState(null, "", "/book#hoggies/legendary"));
    act(() => {
      window.location.hash = "teams";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    act(() => window.history.pushState(null, "", "/quests"));

    expect(sentEvents()).toEqual([
      { event: "$pageview", page: "home", book_page: undefined, spread: undefined },
      { event: "$pageleave", page: "home", book_page: undefined, spread: undefined },
      { event: "$pageview", page: "book", book_page: "overview", spread: "hoggies/legendary" },
      { event: "$pageleave", page: "book", book_page: "overview", spread: "hoggies/legendary" },
      { event: "$pageview", page: "book", book_page: "overview", spread: "teams" },
      { event: "$pageleave", page: "book", book_page: "overview", spread: "teams" },
      { event: "$pageview", page: "quests", book_page: undefined, spread: undefined },
    ]);
  });

  it("a replaceState that only canonicalises the same route, or the same address again, sends nothing", async () => {
    window.history.replaceState(null, "", "/leaderboard?period=week");
    renderLiveSite();
    analyticsAnswers(ann);
    await capturing();

    act(() => window.history.replaceState(null, "", "/leaderboard"));
    act(() => window.history.pushState(null, "", "/leaderboard"));
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));

    expect(sentEvents()).toEqual([{ event: "$pageview", page: "leaderboard", book_page: undefined, spread: undefined }]);
  });
});

describe("no sign-in code leaves the browser", () => {
  it("the sign-in code in the address never reaches an event's URL properties", async () => {
    window.history.replaceState(null, "", "/?code=SIGNIN-CODE-1234&panel=inventory");
    renderLiveSite();
    analyticsAnswers(ann);
    await capturing();
    act(() => window.history.pushState(null, "", "/quests?code=SIGNIN-CODE-1234"));

    expect(recorded.sent.length).toBeGreaterThan(0);
    expect(JSON.stringify(recorded.sent)).not.toContain("SIGNIN-CODE-1234");
    expect(only(recorded.sent).properties.$current_url).toBe("http://localhost:3000/?panel=inventory");
  });

  it("every URL property, every person property and every stack frame loses the code, and nothing else changes", () => {
    const signInUrl = "https://hedgehug.example/book?code=SIGNIN-CODE-1234&page=giving#teams";
    const event = {
      uuid: "event-1",
      event: "$exception",
      properties: {
        $current_url: signInUrl,
        $referrer: "https://hedgehug.example/?code=SIGNIN-CODE-1234",
        $initial_current_url: signInUrl,
        $initial_referrer: signInUrl,
        $prev_pageview_pathname: "/book",
        $exception_list: [{ type: "TypeError", stacktrace: { frames: [{ filename: signInUrl, abs_path: signInUrl, lineno: 3, function: "render" }] } }],
        page: "book",
      },
      $set_once: { $initial_current_url: signInUrl, $initial_referrer: signInUrl },
      timestamp: new Date("2026-10-18T10:00:00Z"),
    } as unknown as CaptureResult;

    const scrubbed = withoutSignInCode(event)!;

    expect(JSON.stringify(scrubbed)).not.toContain("SIGNIN-CODE-1234");
    expect(scrubbed.properties.$current_url).toBe("https://hedgehug.example/book?page=giving#teams");
    expect(scrubbed.properties.$exception_list[0].stacktrace.frames[0]).toEqual({ filename: "https://hedgehug.example/book?page=giving#teams", abs_path: "https://hedgehug.example/book?page=giving#teams", lineno: 3, function: "render" });
    expect(scrubbed.$set_once).toEqual({ $initial_current_url: "https://hedgehug.example/book?page=giving#teams", $initial_referrer: "https://hedgehug.example/book?page=giving#teams" });
    expect(scrubbed.timestamp).toBe(event.timestamp);
    expect(scrubbed.properties.page).toBe("book");
  });
});
