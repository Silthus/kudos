import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Root } from "./Root";
import { shellFixtures } from "./shell";
import { withoutSignInCode } from "./browserAnalytics/withoutSignInCode";
import { postHogScriptUrl } from "./browserAnalytics/postHogScript";
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
  const send = (event: string, properties: Record<string, unknown>) => {
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
  };
  return {
    capture(event: string, properties: Record<string, unknown> = {}) {
      call("capture", event, properties);
      send(event, properties);
    },
    captureException(error: Error, properties: Record<string, unknown> = {}) {
      call("captureException", error, properties);
      send("$exception", { ...properties, ...exceptionPropertiesOf(error) });
    },
    register: (properties: Record<string, unknown>) => (call("register", properties), Object.assign(registered, properties)),
    unregister: (property: string) => (call("unregister", property), delete registered[property]),
    opt_in_capturing: (options: unknown) => (call("opt_in_capturing", options), (capturing = true)),
    opt_out_capturing: () => (call("opt_out_capturing"), (capturing = false)),
    reset: () => call("reset"),
    stopSessionRecording: () => call("stopSessionRecording"),
    stopExceptionAutocapture: () => call("stopExceptionAutocapture"),
    identify: (...args: unknown[]) => call("identify", ...args),
    alias: (...args: unknown[]) => call("alias", ...args),
    setPersonProperties: (...args: unknown[]) => call("setPersonProperties", ...args),
  };
}

function exceptionPropertiesOf(error: Error) {
  const frames = [{ filename: window.location.href, abs_path: window.location.href, function: "renderPage", lineno: 12, colno: 7, in_app: true, platform: "web:javascript" }];
  return { $exception_list: [{ type: error.name, value: error.message, mechanism: { type: "generic", handled: true }, stacktrace: { type: "raw", frames } }], $exception_level: "error" };
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

const privateWords = ["Thanks Ann for untangling the deploy", "U0123ABCD", "C0456EFGH", "SIGNIN-CODE-1234"];

function privateError() {
  return new TypeError(`${privateWords[0]} with ${privateWords[1]} in ${privateWords[2]}, see https://hedgehug.example/?code=${privateWords[3]}`);
}

function aPageThrows(error: Error) {
  answers.set("website/profile:getMyProfile", error);
  act(() => listeners.forEach((notify) => notify()));
}

function errorPage() {
  return screen.findByRole("heading", { level: 1, name: "Something went wrong" });
}

function settled() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

function beforeSendOfTheStartedSdk() {
  return (only(callsOf("init")).args[1] as Config).before_send;
}

function autocapturedException(frames: Record<string, unknown>[]) {
  return {
    uuid: "event-autocaptured",
    event: "$exception",
    properties: {
      $exception_list: [
        { type: "Error", value: `Uncaught ${privateWords[0]}`, mechanism: { type: "onunhandledrejection", handled: false }, stacktrace: { type: "raw", frames } },
        { type: "RangeError", value: `caused by ${privateWords[1]}`, mechanism: { type: "chained", source: "cause" }, stacktrace: { type: "raw", frames } },
      ],
      $exception_level: "error",
      page: "home",
    },
    timestamp: new Date("2026-10-18T10:00:00Z"),
  } as unknown as CaptureResult;
}

const ownFrame = { filename: "https://hedgehug.example/assets/index-abc.js", function: "giveKudos", lineno: 3, colno: 41, in_app: true };

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
      capture_exceptions: { capture_unhandled_errors: true, capture_unhandled_rejections: true, capture_console_errors: false },
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
    const stopping = recorded.calls.slice(-5).map(({ method }) => method);
    await user.click(within(screens()).getByRole("link", { name: "Leaderboard" }));
    window.history.pushState(null, "", "/book#hoggies/legendary");

    expect(new Set(stopping.slice(0, 2))).toEqual(new Set(["stopSessionRecording", "stopExceptionAutocapture"]));
    expect(stopping.slice(2), "consent is withdrawn again after reset, which clears it").toEqual(["opt_out_capturing", "reset", "opt_out_capturing"]);
    expect(recorded.sent).toHaveLength(sentBefore);
    expect(recorded.calls.slice(-5).map(({ method }) => method)).toEqual(stopping);
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

  it.each([
    ["answers off", { kind: "off" }],
    ...denials.map((denial) => [`answers ${denial.kind}`, denial] as [string, unknown]),
    ["fails", new Error("Server Error")],
  ])("an error the shell's error page catches while the read %s is never reported, even when capture starts later", async (_, answer) => {
    renderLiveSite();
    analyticsAnswers(answer);
    aPageThrows(privateError());
    await errorPage();

    analyticsAnswers(ann);
    await capturing();
    await settled();

    expect(callsOf("captureException")).toEqual([]);
    expect(recorded.sent.map(({ event }) => event)).not.toContain("$exception");
  });

  it("an error the shell's error page catches while the read still loads waits, untouched, and is reported once capture starts", async () => {
    renderLiveSite();
    const error = privateError();
    aPageThrows(error);
    await errorPage();
    await settled();
    expect(recorded.imports).toBe(0);
    expect(recorded.calls).toEqual([]);

    analyticsAnswers(ann);
    await capturing();

    await waitFor(() => expect(callsOf("captureException").map(({ args }) => args)).toEqual([[error, { page: "home" }]]));
    await settled();
    expect(callsOf("captureException")).toHaveLength(1);
  });

  it("the frame shows the Feedback control only while capturing", async () => {
    renderLiveSite();
    analyticsAnswers({ kind: "off" });
    expect(screen.queryByRole("button", { name: "Feedback" })).not.toBeInTheDocument();

    analyticsAnswers(ann);
    expect(await screen.findByRole("button", { name: "Feedback" })).toBeInTheDocument();

    analyticsAnswers({ kind: "signed-out" });
    expect(screen.queryByRole("button", { name: "Feedback" })).not.toBeInTheDocument();
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

describe("MS24: the shell's error page reports what it caught", () => {
  it("an error a page throws while capturing is reported once, with the route's page, and the error page shows", async () => {
    const { user } = renderLiveSite();
    analyticsAnswers(ann);
    await capturing();
    await user.click(within(screens()).getByRole("link", { name: "Leaderboard" }));
    const error = privateError();

    aPageThrows(error);

    expect(await errorPage()).toBeInTheDocument();
    await settled();
    expect(callsOf("captureException").map(({ args }) => args)).toEqual([[error, { page: "leaderboard" }]]);
    expect(recorded.sent.filter(({ event }) => event === "$exception")).toHaveLength(1);
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

  it("AL56: each album page under /book sends its own pageview with the hash as its spread", async () => {
    renderLiveSite();
    analyticsAnswers(ann);
    await capturing();

    for (const address of ["/book#me", "/book#people/ines-okafor", "/book#milestones", "/book#packs", "/book#hoggies/hedgehog-sitting", "/book#teams/paper-moons"]) act(() => window.history.pushState(null, "", address));

    expect(sentEvents().filter(({ event }) => event === "$pageview")).toEqual([
      { event: "$pageview", page: "home", book_page: undefined, spread: undefined },
      ...["me", "people/ines-okafor", "milestones", "packs", "hoggies/hedgehog-sitting", "teams/paper-moons"].map((spread) => ({ event: "$pageview", page: "book", book_page: "overview", spread })),
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

describe("nothing private reaches PostHog from the browser", () => {
  it("an error the shell's error page caught, full of kudos words, Slack IDs and a sign-in URL, is sent as its type alone, with its frames free of the code", async () => {
    window.history.replaceState(null, "", `/?code=${privateWords[3]}&panel=inventory`);
    renderLiveSite();
    analyticsAnswers(ann);
    await capturing();

    aPageThrows(privateError());
    await errorPage();

    const exception = only(recorded.sent.filter(({ event }) => event === "$exception"));
    expect(exception.properties.$exception_list).toEqual([expect.objectContaining({ type: "TypeError", value: "TypeError" })]);
    expect(exception.properties.page).toBe("home");
    expect(JSON.stringify(exception.properties.$exception_list)).toContain("http://localhost:3000/?panel=inventory");
    for (const word of privateWords) expect(JSON.stringify(recorded.sent), word).not.toContain(word);
  });

  it("an exception posthog-js captures by itself, causes included, keeps its types, frames and page and loses every message", async () => {
    renderLiveSite();
    analyticsAnswers(ann);
    await capturing();

    const sent = beforeSendOfTheStartedSdk()(autocapturedException([ownFrame]))!;

    expect(sent.properties.$exception_list).toEqual([
      { type: "Error", value: "Error", mechanism: { type: "onunhandledrejection", handled: false }, stacktrace: { type: "raw", frames: [ownFrame] } },
      { type: "RangeError", value: "RangeError", mechanism: { type: "chained", source: "cause" }, stacktrace: { type: "raw", frames: [ownFrame] } },
    ]);
    expect(sent.properties.page).toBe("home");
    for (const word of privateWords) expect(JSON.stringify(sent), word).not.toContain(word);
  });

  it("an exception thrown inside posthog-js's own script is never sent back to PostHog", async () => {
    renderLiveSite();
    analyticsAnswers(ann);
    await capturing();
    const beforeSend = beforeSendOfTheStartedSdk();

    expect(beforeSend(autocapturedException([ownFrame, { ...ownFrame, filename: postHogScriptUrl, function: "Kr" }]))).toBeNull();
    expect(beforeSend(autocapturedException([{ ...ownFrame, filename: postHogScriptUrl, function: "Kr" }, ownFrame]))).not.toBeNull();
  });

  it("replay records the member's sessions with every input masked, ph-no-capture blocked, and no network payloads, console logs, canvas or other frames", async () => {
    renderLiveSite();
    analyticsAnswers(ann);
    await capturing();

    expect(only(callsOf("init")).args[1]).toMatchObject({
      disable_session_recording: false,
      enable_recording_console_log: false,
      capture_performance: { network_timing: false },
      session_recording: {
        blockClass: "ph-no-capture",
        maskAllInputs: true,
        recordHeaders: false,
        recordBody: false,
        captureCanvas: { recordCanvas: false },
        recordCrossOriginIframes: false,
      },
    });
  });
});

describe("no sign-in code leaves the browser", () => {
  it("every replay URL loses the code and keeps everything else", async () => {
    renderLiveSite();
    analyticsAnswers(ann);
    await capturing();
    const { session_recording } = only(callsOf("init")).args[1] as { session_recording: { maskCapturedNetworkRequestFn: (request: { name: string; isInitial?: boolean }) => { name: string; isInitial?: boolean } } };

    const masked = session_recording.maskCapturedNetworkRequestFn({ name: "https://hedgehug.example/book?code=SIGNIN-CODE-1234&page=giving#teams", isInitial: true });

    expect(masked).toEqual({ name: "https://hedgehug.example/book?page=giving#teams", isInitial: true });
  });

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

  it("a heatmap keyed by a URL with the code is keyed by the URL without it, its clicks kept and merged with the same page's", () => {
    const click = (x: number) => ({ x, y: 80, target_fixed: false, type: "click" });
    const event = {
      uuid: "event-2",
      event: "$$heatmap",
      properties: {
        $heatmap_data: {
          "https://hedgehug.example/book?code=SIGNIN-CODE-1234&page=giving": [click(1)],
          "https://hedgehug.example/book?page=giving": [click(2)],
          "https://hedgehug.example/leaderboard": [click(3)],
        },
      },
    } as unknown as CaptureResult;

    const scrubbed = withoutSignInCode(event)!;

    expect(scrubbed.properties.$heatmap_data).toEqual({
      "https://hedgehug.example/book?page=giving": [click(1), click(2)],
      "https://hedgehug.example/leaderboard": [click(3)],
    });
  });
});

const feedbackSurvey = "01a14dfa-686c-0000-15fd-1e42871cb016";
const feedbackQuestion = "ac5e3810-2b39-46a2-80d2-f8553b37dbac";

function surveyEvents() {
  return recorded.sent.filter(({ event }) => event.startsWith("survey ")).map(({ event, properties }) => ({ event, properties }));
}

async function openFeedback(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Feedback" }));
  return screen.findByRole("textbox", { name: "What's confusing or missing here?" });
}

describe("MS35: a Feedback button", () => {
  it("opening the form captures survey shown, and Send captures survey sent with the member's own words and thanks them", async () => {
    const { user } = renderLiveSite();
    analyticsAnswers(ann);
    await capturing();

    const answer = await openFeedback(user);
    expect(surveyEvents()).toEqual([{ event: "survey shown", properties: expect.objectContaining({ $survey_id: feedbackSurvey }) }]);
    await user.type(answer, "Where do I see who thanked me?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const sent = only(surveyEvents(), 1);
    expect(sent.event).toBe("survey sent");
    expect(sent.properties).toMatchObject({
      $survey_id: feedbackSurvey,
      $survey_response: "Where do I see who thanked me?",
      [`$survey_response_${feedbackQuestion}`]: "Where do I see who thanked me?",
      $survey_completed: true,
      $survey_questions: [{ id: feedbackQuestion, question: "What's confusing or missing here?" }],
      page: "home",
    });
    expect(sent.properties.$survey_submission_id).toEqual(expect.any(String));
    expect(await screen.findByText("Thanks, we read every answer.")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(surveyEvents().map(({ event }) => event)).toEqual(["survey shown", "survey sent"]);
  });

  it("closing the form unsent captures survey dismissed and sends nothing the member typed", async () => {
    const { user } = renderLiveSite();
    analyticsAnswers(ann);
    await capturing();

    await user.type(await openFeedback(user), "half a thought");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "What's confusing or missing here?" })).not.toBeInTheDocument());

    expect(surveyEvents()).toEqual([
      { event: "survey shown", properties: expect.objectContaining({ $survey_id: feedbackSurvey }) },
      { event: "survey dismissed", properties: expect.objectContaining({ $survey_id: feedbackSurvey }) },
    ]);
    expect(JSON.stringify(recorded.sent)).not.toContain("half a thought");
  });

  it("an unsent answer is still there when the member opens the form again, and a sent one is gone", async () => {
    const { user } = renderLiveSite();
    analyticsAnswers(ann);
    await capturing();

    await user.type(await openFeedback(user), "half a thought");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "What's confusing or missing here?" })).not.toBeInTheDocument());
    const reopened = await openFeedback(user);
    expect(reopened).toHaveValue("half a thought");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(await openFeedback(user)).toHaveValue("");
  });

  it("the thanks line describes the Close button that takes focus after Send", async () => {
    const { user } = renderLiveSite();
    analyticsAnswers(ann);
    await capturing();

    await user.type(await openFeedback(user), "Where is the Book?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const close = await screen.findByRole("button", { name: "Close", description: "Thanks, we read every answer." });
    await waitFor(() => expect(close).toHaveFocus());
  });

  it("Send waits for words, and each opening is its own submission", async () => {
    const { user } = renderLiveSite();
    analyticsAnswers(ann);
    await capturing();

    const answer = await openFeedback(user);
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.type(answer, "   ");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute("aria-disabled", "true");
    expect(surveyEvents().map(({ event }) => event)).toEqual(["survey shown"]);
    await user.type(answer, "first");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.keyboard("{Escape}");
    await user.type(await openFeedback(user), "second");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const submissions = surveyEvents().filter(({ event }) => event === "survey sent").map(({ properties }) => properties.$survey_submission_id);
    expect(submissions).toHaveLength(2);
    expect(new Set(submissions).size).toBe(2);
  });

  it("a member can open, write, send and close it by keyboard alone, and focus returns to the control", async () => {
    const { user } = renderLiveSite();
    analyticsAnswers(ann);
    const control = await screen.findByRole("button", { name: "Feedback" });

    control.focus();
    await user.keyboard("{Enter}");
    const answer = await screen.findByRole("textbox", { name: "What's confusing or missing here?" });
    await waitFor(() => expect(answer).toHaveFocus());
    await user.keyboard("The Book is hard to find");
    await user.tab();
    expect(screen.getByRole("button", { name: "Send" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(only(surveyEvents(), 1).properties.$survey_response).toBe("The Book is hard to find");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(control).toHaveFocus());
  });

  it("the form sits outside every ph-no-capture block and passes axe's WCAG AA rules", async () => {
    const { user } = renderLiveSite();
    analyticsAnswers(ann);
    await capturing();

    const answer = await openFeedback(user);
    const form = screen.getByRole("dialog", { name: "Feedback" });

    expect(form.closest(".ph-no-capture")).toBeNull();
    expect(screen.getByRole("button", { name: "Feedback" }).closest(".ph-no-capture")).toBeNull();
    expect(answer.closest(".ph-no-capture")).toBeNull();
    const results = await axe.run(form, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map(({ id, help }) => `${id}: ${help}`)).toEqual([]);
  });
});
