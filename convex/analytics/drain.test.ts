import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, answersWith, postHogHost, projectToken } from "../../testing/fakePostHog";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";

const now = new Date("2026-10-13T10:00:00Z");

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
  vi.stubEnv("KUDOS_ENVIRONMENT", "production");
  vi.stubEnv("POSTHOG_HOST", postHogHost);
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", postHog.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("O13 O15: recording", () => {
  test("records the events in the outbox and makes no network call", async () => {
    const t = testBackend();

    await t.mutation(internal.analytics.subscribers.recordKudosGiven, { event: await kudosGiven(t) });

    expect(postHog.requests).toEqual([]);
    expect((await outbox(t)).map(({ event, state }) => [event, state])).toEqual([
      ["kudos given", "pending"],
      ["kudos received", "pending"],
    ]);
  });

  test("O16: only one drain is scheduled however many facts are recorded", async () => {
    const t = testBackend();

    for (let message = 0; message < 3; message += 1) {
      await t.mutation(internal.analytics.subscribers.recordKudosGiven, { event: await kudosGiven(t) });
    }

    expect(await scheduledDrains(t)).toBe(1);
  });
});

describe("O16: the drain", () => {
  test("sends at most 100 events per request, and delivered events leave the outbox", async () => {
    const t = testBackend();
    const event = await kudosGiven(t);

    for (let message = 0; message < 75; message += 1) {
      await t.mutation(internal.analytics.subscribers.recordKudosGiven, { event });
    }
    await settle(t);

    expect(postHog.requests.map((request) => request.events.length)).toEqual([100, 50]);
    expect(await outbox(t)).toEqual([]);
  });

  test("a fact recorded after the drain finished starts a new drain", async () => {
    const t = testBackend();
    await t.mutation(internal.analytics.subscribers.recordKudosGiven, { event: await kudosGiven(t) });
    await settle(t);

    await t.mutation(internal.analytics.subscribers.recordKudosGiven, { event: await kudosGiven(t) });
    await settle(t);

    expect(postHog.requests.map((request) => request.events.length)).toEqual([2, 2]);
  });

  test.each([
    ["503", answersWith(503)],
    ["a network error", () => { throw new TypeError("fetch failed"); }],
  ])("O14: a batch PostHog doesn't accept (%s) stays in the outbox and is sent later with the same identity", async (_, failure) => {
    const t = testBackend();
    postHog.answering(failure as () => Response);
    await t.mutation(internal.analytics.subscribers.recordKudosGiven, { event: await kudosGiven(t) });
    await settle(t);
    const kept = await outbox(t);

    await t.action(internal.analytics.drain.drain, {});

    const [failed, delivered] = postHog.requests.map((request) => request.events);
    expect(kept.map((row) => row.state)).toEqual(["pending", "pending"]);
    expect(delivered).toEqual(failed);
    expect(delivered!.map(({ uuid, event, distinct_id, timestamp }) => ({ uuid, event, distinct_id, timestamp }))).toEqual(
      kept.map((row) => ({ uuid: row.uuid, event: row.event, distinct_id: row.distinctId, timestamp: new Date(row.timestamp).toISOString() })),
    );
    expect(await outbox(t)).toEqual([]);
  });

  test("O26: with capture switched off, the drain sends nothing and leaves the outbox as it is", async () => {
    const t = testBackend();
    postHog.answering(answersWith(503));
    await t.mutation(internal.analytics.subscribers.recordKudosGiven, { event: await kudosGiven(t) });
    await settle(t);
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "");

    await t.action(internal.analytics.drain.drain, {});

    expect(postHog.requests).toHaveLength(1);
    expect((await outbox(t)).map((row) => row.state)).toEqual(["pending", "pending"]);
  });
});

async function kudosGiven(t: Backend): Promise<KudosGivenEvent> {
  const [giver, recipient] = await t.run(async (ctx) => [
    await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" }),
  ]);
  return {
    type: "kudosGiven",
    workspace: "T1",
    message: { workspace: "T1", conversation: "C1", message: "1760349600.000100" },
    giver: giver!,
    awards: [{ giver: giver!, recipient: recipient!, kudos: 1 }],
    kudosEmoji: "taco",
    annotations: {},
    allowance: { dailyOpening: 3, dailyLeft: 2 },
    skippedMentions: 0,
    retry: false,
    inThread: false,
    day: "2026-10-13",
    at: now.getTime(),
  };
}

async function outbox(t: Backend) {
  return t.run((ctx) => ctx.db.query("analyticsOutbox").collect());
}

async function scheduledDrains(t: Backend) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter((job) => job.name.includes("analytics/drain") && job.state.kind === "pending").length;
}
