import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { profileKeys } from "../../convex/analytics/person";
import { browserAnalytics } from "./browserAnalytics/capture";

type Sent = { url: string; events: { event: string; properties: Record<string, unknown>; $set?: unknown; $set_once?: Record<string, unknown> }[] };

const capture = { kind: "capture", token: "phc_the_project_token", host: "https://us.i.posthog.com", distinctId: "member-analytics-id", environment: "sandbox" } as const;

const sent: Sent[] = [];

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
    return new Response(url.includes("/config") ? "{}" : '{"status":1}', { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

function flushed() {
  return new Promise((resolve) => setTimeout(resolve, 4_000));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sent.length = 0;
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
});
