import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { profileKeys } from "../../convex/analytics/person";
import { browserAnalytics, type Capturer } from "./browserAnalytics/capture";

type Sent = { url: string; events: { event: string; properties: Record<string, unknown>; $set?: unknown; $set_once?: Record<string, unknown> }[] };

const capture = { kind: "capture", token: "phc_the_project_token", host: "https://us.i.posthog.com", distinctId: "member-analytics-id", environment: "sandbox" } as const;

const sent: Sent[] = [];
const snapshots: unknown[] = [];
let remoteConfig: Record<string, unknown> = {};

async function bodyOf(body: unknown): Promise<string> {
  if (typeof body === "string") return body;
  const bytes = new Uint8Array(body instanceof Blob ? await body.arrayBuffer() : (body as ArrayBuffer));
  return bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes).toString("utf8") : new TextDecoder().decode(bytes);
}

function recordingFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (/\/(e|i\/v0\/e|batch)\//.test(url)) {
      const parsed = JSON.parse(await bodyOf(init?.body));
      sent.push({ url, events: Array.isArray(parsed) ? parsed : (parsed.batch ?? [parsed]) });
    }
    if (/\/s\//.test(url)) snapshots.push(decompressed(JSON.parse(await bodyOf(init?.body))));
    return new Response(url.includes("/config") ? JSON.stringify(remoteConfig) : '{"status":1}', { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

function decompressed(value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("\x1f\x8b")) return decompressed(JSON.parse(gunzipSync(Buffer.from(value, "latin1")).toString("utf8")));
  if (Array.isArray(value)) return value.map(decompressed);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, decompressed(inner)]));
  return value;
}

function flushed() {
  return new Promise((resolve) => setTimeout(resolve, 4_000));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sent.length = 0;
  snapshots.length = 0;
  remoteConfig = {};
  document.body.replaceChildren();
});

describe("MS18 MS22: the pinned posthog-js sends only what the spec allows", () => {
  it("its request bodies carry no $set, first-visit $set_once only on the first event and never a property Analytics writes, no identify, flags or scripts, and one page leave per navigation", { timeout: 60_000 }, async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36");
    const fetch = recordingFetch();
    vi.stubGlobal("fetch", fetch);
    window.history.replaceState(null, "", "/?code=SIGNIN-CODE-1234");
    const analytics = browserAnalytics(() => import("posthog-js/dist/module.full.no-external").then((module) => module.default));

    analytics.follow(capture);
    await flushed();
    window.history.pushState(null, "", "/leaderboard");
    await flushed();

    const events = sent.flatMap(({ events }) => events);
    expect(events.map(({ event }) => event)).toEqual(["$pageview", "$pageleave", "$pageview"]);
    expect(events.every((event) => event.$set === undefined && !("$set" in event.properties))).toBe(true);
    const setOnce = events.map((event) => Object.keys(event.$set_once ?? {}));
    expect(setOnce.slice(1)).toEqual([[], []]);
    expect(setOnce[0]).toEqual(expect.arrayContaining(["$initial_current_url", "$initial_referrer"]));
    expect(setOnce[0]!.filter((key) => (profileKeys as readonly string[]).includes(key))).toEqual([]);
    expect(events.every(({ properties }) => properties.distinct_id === capture.distinctId && properties.environment === "sandbox")).toBe(true);
    expect(JSON.stringify(sent)).not.toContain("SIGNIN-CODE-1234");
    expect(fetch.mock.calls.map(([input]) => new URL(String(input)).pathname).filter((path) => /flags|decide|static/.test(path))).toEqual([]);

    analytics.follow({ kind: "signed-out" });
    const before = sent.length;
    window.history.pushState(null, "", "/quests");
    await flushed();
    expect(sent).toHaveLength(before);
  });

  it("the Feedback form's survey events carry no $set, though the pinned SDK adds one to each", { timeout: 60_000 }, async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36");
    vi.stubGlobal("fetch", recordingFetch());
    let capturer: Capturer | null = null;
    const analytics = browserAnalytics(
      () => import("posthog-js/dist/module.full.no-external").then((module) => module.default),
      (next) => (capturer = next),
    );

    analytics.follow({ ...capture, distinctId: "feedback-analytics-id" });
    await vi.waitFor(() => expect(capturer).not.toBeNull());
    capturer!.capture("survey shown", { $survey_id: "a-survey" });
    capturer!.capture("survey sent", { $survey_id: "a-survey", $survey_response: "my own words", $survey_completed: true });
    capturer!.capture("survey dismissed", { $survey_id: "a-survey" });
    await flushed();
    analytics.stop();

    const events = sent.flatMap(({ events }) => events).filter(({ event }) => event.startsWith("survey "));
    expect(events.map(({ event }) => event)).toEqual(["survey shown", "survey sent", "survey dismissed"]);
    expect(events.every((event) => event.$set === undefined && !("$set" in event.properties))).toBe(true);
    expect(events[1]!.properties.$survey_response).toBe("my own words");
  });
});

describe("nothing private reaches PostHog from the browser", { timeout: 60_000 }, () => {
  it("MS21 MS26 MS27: the pinned recorder's replay snapshots hold no blocked words, no typed input, no console line and no sign-in code, though the project asks for console logs, payloads, canvas and unmasked inputs, and nothing is recorded after the stop", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36");
    remoteConfig = { sessionRecording: { endpoint: "/s/", consoleLogRecordingEnabled: true, recordCanvas: true, canvasFps: 4, networkPayloadCapture: { recordHeaders: true, recordBody: true }, masking: { maskAllInputs: false } } };
    vi.stubGlobal("fetch", recordingFetch());
    window.history.replaceState(null, "", "/activity?code=SIGNIN-CODE-1234");
    document.body.innerHTML = '<main><h1>Your kudos story</h1><p class="ph-no-capture">BLOCKED-KUDOS-WORDS</p><input aria-label="Command" /></main>';
    const analytics = browserAnalytics(() => import("posthog-js/dist/module.full.no-external").then((module) => module.default));

    analytics.follow(capture);
    await flushed();
    const input = document.querySelector("input")!;
    input.value = "TYPED-SECRET";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    console.log("CONSOLE-SECRET");
    window.history.pushState(null, "", "/book?code=SIGNIN-CODE-1234#teams");
    await flushed();
    analytics.follow({ kind: "signed-out" });
    await flushed();
    const recordedBeforeTheStop = snapshots.length;
    input.value = "TYPED-AFTER-THE-STOP";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    window.history.pushState(null, "", "/quests");
    await flushed();

    const recorded = JSON.stringify(snapshots);
    expect(snapshots.length, "the recorder sent snapshots").toBeGreaterThan(0);
    expect(recorded, "the page was recorded").toContain("Your kudos story");
    expect(recorded, "a ph-no-capture block's words").not.toContain("BLOCKED-KUDOS-WORDS");
    expect(recorded, "a typed input's value").not.toContain("TYPED-SECRET");
    expect(recorded, "a console line").not.toContain("CONSOLE-SECRET");
    expect(recorded, "the sign-in code").not.toContain("SIGNIN-CODE-1234");
    expect(recorded, "a replay URL keeps its path").toContain("/book");
    expect(snapshots, "nothing recorded after the stop").toHaveLength(recordedBeforeTheStop);
  });
});
