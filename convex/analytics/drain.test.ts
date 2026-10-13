import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, answersWith, failsToConnect, neverAnswers, postHogHost, projectToken, stallsUntilReleased, type BatchRequest } from "../../testing/fakePostHog";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";

const now = new Date("2026-10-13T10:00:00Z");
const minutes = (count: number) => count * 60_000;
const days = (count: number) => count * 24 * 60 * minutes(1);

let postHog: FakePostHog;
let warnings: ReturnType<typeof vi.spyOn>;
let errors: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
  vi.stubEnv("KUDOS_ENVIRONMENT", "production");
  vi.stubEnv("POSTHOG_HOST", postHogHost);
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", postHog.fetch);
  warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("O13 O15: recording", () => {
  test("records the events in the outbox and makes no network call", async () => {
    const t = testBackend();

    await recordKudosGiven(t);

    expect(postHog.requests).toEqual([]);
    expect((await outbox(t)).map(({ event, state }) => [event, state])).toEqual([
      ["kudos given", "pending"],
      ["kudos received", "pending"],
    ]);
  });

  test("O16: only one drain is scheduled however many facts are recorded", async () => {
    const t = testBackend();

    for (let message = 0; message < 3; message += 1) await recordKudosGiven(t);

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
    await recordKudosGiven(t);
    await settle(t);

    await recordKudosGiven(t);
    await settle(t);

    expect(postHog.requests.map((request) => request.events.length)).toEqual([2, 2]);
  });
});

describe("O18: a batch PostHog doesn't accept is retried", () => {
  test.each([
    ["429", answersWith(429)],
    ["503", answersWith(503)],
    ["401", answersWith(401)],
    ["a network error", failsToConnect],
    ["no answer within 10 seconds", neverAnswers],
  ])("on %s, every event is retried after successive delays of 1, 5, 30, 120 and 360 minutes and given up on its sixth failure", async (_, failure) => {
    const t = testBackend();
    postHog.answering(...Array(7).fill(failure));

    await recordKudosGiven(t);
    await settleInTimeOrder(t);

    const delays = postHog.requests.slice(1).map((retry, index) => (retry.startedAt - postHog.requests[index]!.endedAt!) / minutes(1));
    expect(delays).toEqual([1, 5, 30, 120, 360]);
    expect((await outbox(t)).map(({ state, reason }) => ({ state, reason }))).toEqual([
      { state: "exhausted", reason: "exhausted" },
      { state: "exhausted", reason: "exhausted" },
    ]);
    expect(warnings.mock.calls).toEqual([["analytics.events_given_up", { reason: "exhausted", events: ["kudos given", "kudos received"] }]]);
  });

  test("failures that PostHog answers at once fall 1, 6, 36, 156 and 516 minutes after the first", async () => {
    const t = testBackend();
    postHog.answering(...Array(6).fill(answersWith(503)));

    await recordKudosGiven(t);
    await settleInTimeOrder(t);

    const [first, ...retries] = postHog.requests;
    expect(retries.map((retry) => (retry.startedAt - first!.endedAt!) / minutes(1))).toEqual([1, 6, 36, 156, 516]);
  });

  test("O14: every retry sends the same UUID, name, distinct_id and timestamp as the first attempt", async () => {
    const t = testBackend();
    postHog.answering(answersWith(429), answersWith(503), answersWith(401), failsToConnect, neverAnswers, answersWith(200));
    await recordKudosGiven(t);
    const recorded = await outbox(t);

    await settle(t);

    const identities = postHog.requests.map((request) => request.events.map(identity));
    expect(identities).toHaveLength(6);
    for (const attempt of identities) {
      expect(attempt).toEqual(recorded.map((row) => ({ uuid: row.uuid, event: row.event, distinct_id: row.distinctId, timestamp: new Date(row.timestamp).toISOString() })));
    }
    expect(await outbox(t)).toEqual([]);
  });

  test.each([400, 413])("a batch PostHog answers with %i is given up at once as rejected", async (status) => {
    const t = testBackend();
    postHog.answering(answersWith(status));

    await recordKudosGiven(t);
    await settle(t);

    expect(postHog.requests).toHaveLength(1);
    expect((await outbox(t)).map(({ state, reason }) => ({ state, reason }))).toEqual([
      { state: "exhausted", reason: "rejected" },
      { state: "exhausted", reason: "rejected" },
    ]);
    expect(warnings.mock.calls).toEqual([["analytics.events_given_up", { reason: "rejected", events: ["kudos given", "kudos received"] }]]);
  });
});

describe("O19: given-up events are kept for 7 days", () => {
  test("the daily cleanup deletes an event 7 days after it was given up, not earlier", async () => {
    const t = testBackend();
    postHog.answering(answersWith(400));
    await recordKudosGiven(t);
    await settle(t);
    const givenUpAt = postHog.requests[0]!.endedAt!;

    vi.setSystemTime(givenUpAt + days(7) - minutes(1));
    await t.mutation(internal.analytics.drain.cleanUp, {});
    expect(await outbox(t)).toHaveLength(2);

    vi.setSystemTime(givenUpAt + days(7));
    await t.mutation(internal.analytics.drain.cleanUp, {});
    expect(await outbox(t)).toEqual([]);
  });
});

describe("O16 O17: leases", () => {
  test("a drain that dies mid-batch has its batch released at its lease's expiry and sent within 3 minutes", async () => {
    const t = testBackend();
    await recordKudosGiven(t);
    const recordedAt = Date.now();

    await drainDiesHoldingItsBatch(t);
    await settleInTimeOrder(t);

    expect(postHog.requests).toHaveLength(1);
    expect(postHog.requests[0]!.startedAt - recordedAt).toBeLessThanOrEqual(minutes(3));
    expect(await outbox(t)).toEqual([]);
  });

  test("a drain whose lease expired changes nothing, before the recovery check and after another drain claimed its rows", async () => {
    const t = testBackend();
    await recordKudosGiven(t);
    const late = await claimAsTheDrain(t);
    const settleLate = (answer: "delivered" | "rejected" | "failed") =>
      t.mutation(internal.analytics.drain.settle, { token: late!.token, rows: late!.rows.map((row) => row._id), answer });

    vi.setSystemTime(Date.now() + minutes(2));
    const heldByLate = await outbox(t);
    await settleLate("delivered");
    expect(await outbox(t)).toEqual(heldByLate);

    await t.mutation(internal.analytics.drain.recover, {});
    const current = await claimAsTheDrain(t);
    const heldByCurrent = await outbox(t);
    await settleLate("delivered");
    await settleLate("rejected");
    await settleLate("failed");

    expect(current!.token).not.toBe(late!.token);
    expect(await outbox(t)).toEqual(heldByCurrent);
  });

  test("a drain stalled past its lease is replaced at the lease's expiry, and changes nothing when it resumes", async () => {
    const t = testBackend();
    const stall = stallsUntilReleased();
    postHog.answering(stall.answer);
    await recordKudosGiven(t);
    const recordedAt = Date.now();

    await settleInTimeOrder(t, { until: recordedAt + minutes(3) });
    expect(postHog.requests).toHaveLength(2);
    expect(postHog.requests[1]!.startedAt - recordedAt).toBeLessThanOrEqual(minutes(3));

    stall.release();
    await settleInTimeOrder(t);
    await recordKudosGiven(t);
    await settleInTimeOrder(t);

    expect(postHog.requests.map((request) => request.events.length)).toEqual([2, 2, 2]);
    expect(await outbox(t)).toEqual([]);
  });

  test("an event recorded while a dead drain holds its batch is still sent, and so is the batch", async () => {
    const t = testBackend();
    await recordKudosGiven(t);
    await drainDiesHoldingItsBatch(t);

    vi.setSystemTime(Date.now() + minutes(1));
    await recordKudosGiven(t);
    await settleInTimeOrder(t);

    expect(postHog.requests.map((request) => request.events.length)).toEqual([2, 2]);
    expect(await outbox(t)).toEqual([]);
  });

  test("the backstop starts a drain when the drain is gone and events are due", async () => {
    const t = testBackend();
    await recordKudosGiven(t);
    await drainDies(t);

    await t.mutation(internal.analytics.drain.recover, {});
    await settle(t);

    expect(postHog.events()).toHaveLength(2);
    expect(await outbox(t)).toEqual([]);
  });
});

describe("O26: capture switched off pauses the outbox", () => {
  test("the drain makes no request and counts no failure, and switching capture back on sends the events", async () => {
    const t = testBackend();
    await recordKudosGiven(t);
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "");

    await settle(t);
    expect(postHog.requests).toEqual([]);
    expect((await outbox(t)).map(({ state, failures }) => ({ state, failures }))).toEqual([
      { state: "pending", failures: 0 },
      { state: "pending", failures: 0 },
    ]);

    vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
    await t.mutation(internal.analytics.drain.recover, {});
    await settle(t);
    expect(postHog.events()).toHaveLength(2);
    expect(await outbox(t)).toEqual([]);
  });

  test.each([503, 400])("capture switched off while PostHog answers %i neither counts a failure nor gives the batch up", async (status) => {
    const t = testBackend();
    postHog.answering(() => {
      vi.stubEnv("POSTHOG_PROJECT_TOKEN", "");
      return new Response(null, { status });
    });
    await recordKudosGiven(t);

    await settleInTimeOrder(t);

    expect((await outbox(t)).map(({ state, failures }) => ({ state, failures }))).toEqual([
      { state: "pending", failures: 0 },
      { state: "pending", failures: 0 },
    ]);
    expect(warnings).not.toHaveBeenCalled();
  });

  test("an event still pending 7 days after it was recorded is given up as expired", async () => {
    const t = testBackend();
    await recordKudosGiven(t);
    const recordedAt = Date.now();
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "");
    await settle(t);

    vi.setSystemTime(recordedAt + days(7) - minutes(1));
    await t.mutation(internal.analytics.drain.cleanUp, {});
    expect((await outbox(t)).map((row) => row.state)).toEqual(["pending", "pending"]);

    vi.setSystemTime(recordedAt + days(7) + minutes(1));
    await t.mutation(internal.analytics.drain.cleanUp, {});
    expect((await outbox(t)).map(({ state, reason }) => ({ state, reason }))).toEqual([
      { state: "exhausted", reason: "expired" },
      { state: "exhausted", reason: "expired" },
    ]);
    expect(warnings.mock.calls).toEqual([["analytics.events_given_up", { reason: "expired", events: ["kudos given", "kudos received"] }]]);
  });
});

describe("O20: the analytics module's own failures", () => {
  test("a failing drain is logged with a fixed code and recorded as nothing", async () => {
    const t = testBackend();
    await recordKudosGiven(t);
    vi.spyOn(crypto, "randomUUID").mockImplementationOnce(() => {
      throw new Error("leases ran out");
    });

    await settle(t);

    expect(errors.mock.calls).toContainEqual(["analytics.drain_failed", { error: "Error" }]);
    expect((await outbox(t)).map(({ event, state }) => [event, state])).toEqual([
      ["kudos given", "pending"],
      ["kudos received", "pending"],
    ]);
  });

  test("a failing recovery check is logged with a fixed code", async () => {
    const t = testBackend();
    await recordKudosGiven(t);
    await drainDies(t);
    vi.spyOn(crypto, "randomUUID").mockImplementationOnce(() => {
      throw new Error("no generation");
    });

    await expect(t.mutation(internal.analytics.drain.recover, {})).rejects.toThrow();

    expect(errors.mock.calls).toEqual([["analytics.recovery_failed", { error: "Error" }]]);
  });
});

async function recordKudosGiven(t: Backend) {
  await t.mutation(internal.analytics.subscribers.recordKudosGiven, { event: await kudosGiven(t) });
}

async function drainDies(t: Backend) {
  await t.run(async (ctx) => {
    const drain = await ctx.db.query("analyticsDrain").first();
    await ctx.scheduler.cancel(drain!.job);
  });
}

async function claimAsTheDrain(t: Backend) {
  const drain = await t.run((ctx) => ctx.db.query("analyticsDrain").first());
  return t.mutation(internal.analytics.drain.claim, { generation: drain!.generation });
}

async function drainDiesHoldingItsBatch(t: Backend) {
  await claimAsTheDrain(t);
  await drainDies(t);
}

function identity({ uuid, event, distinct_id, timestamp }: BatchRequest["events"][number]) {
  return { uuid, event, distinct_id, timestamp };
}

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
