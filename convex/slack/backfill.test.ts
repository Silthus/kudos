import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { signingSecret } from "../../testing/signedSlack";
import { FakeSlack, httpStatus, networkFailure, rateLimitedFor, slackError, type ScriptedAnswer } from "../../testing/fakeSlack";
import { deleteMessage, edit, everythingStored, kudosReceived, memberChanged, post, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { channelMessage, emoji, mention, section, text, type ChannelMessage, type ChannelMessageOptions, type RichElement } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { wordsOf } from "../engine/kudosText";

const capture = vi.hoisted(() => ({ shipped: true }));

vi.mock("../engine/kudosText", async (importOriginal) => {
  const original = await importOriginal<typeof import("../engine/kudosText")>();
  return {
    ...original,
    keepWords: async (...args: Parameters<typeof original.keepWords>) => (capture.shipped ? original.keepWords(...args) : undefined),
  };
});

const now = new Date("2026-10-13T10:00:00Z");
const topLevelTs = "1760349600.000100";
const threadRootTs = "1760349500.000100";
const replyTs = "1760349700.000100";
const reason = "for the calm rollback of the billing service";
const replyReason = "for pairing on the flaky checkout test";
const thanksBob = [section(text(`thanks ${reason} `), mention("U_BOB"), text(" "), emoji("taco"))];
const thanksCarol = [section(text(`thanks ${replyReason} `), mention("U_CAROL"), text(" "), emoji("taco"))];

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  vi.stubGlobal("fetch", slack.fetch);
});

afterEach(() => {
  capture.shipped = true;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AT35: the backfill fills the words of kudos given before capture shipped", () => {
  test("a top-level message through conversations.history and a thread reply through conversations.replies, each by its exact ts, with unknown visibility", async () => {
    const t = testBackend();
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs });
    await givenBeforeCapture(t, thanksCarol, { ts: replyTs, threadTs: threadRootTs });
    slack.withMessage("C1", channelMessage([section(text("ordinary root"))], { ts: threadRootTs }));

    await backfill(t);

    expect(await wordsAt(t, topLevelTs)).toEqual({
      kind: "text",
      segments: [{ kind: "text", text: `thanks ${reason} ` }, { kind: "person", user: "U_BOB" }, { kind: "text", text: " " }, { kind: "emoji", name: "taco" }],
      edited: false,
      visibility: "unknown",
      author: "U_ALICE",
      gate: { version: 1, thoughtful: true },
    });
    expect(await wordsAt(t, replyTs)).toMatchObject({ kind: "text", visibility: "unknown", segments: expect.arrayContaining([{ kind: "text", text: `thanks ${replyReason} ` }]) });
    expect(slack.callsTo("conversations.history")).toEqual([{ channel: "C1", oldest: topLevelTs, latest: topLevelTs, inclusive: "true", limit: "1" }]);
    expect(slack.callsTo("conversations.replies")).toEqual([{ channel: "C1", ts: threadRootTs, oldest: replyTs, latest: replyTs, inclusive: "true" }]);
  });

  test("an edit the engine already saw is filled from Slack's edited message and marked edited", async () => {
    const t = testBackend();
    const editedTs = "1760349660.000100";
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs, editedTs });

    await backfill(t);

    expect(await wordsAt(t, topLevelTs)).toMatchObject({ kind: "text", edited: true, visibility: "unknown" });
  });

  test("a history answer holding only an earlier message writes deleted, never that message's words", async () => {
    const t = testBackend();
    const earlierWords = "the earlier lunch plans in the channel";
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs });
    slack.answering("conversations.history", answeringWith(channelMessage([section(text(`${earlierWords} `), mention("U_BOB"), emoji("taco"))], { ts: "1760349500.000100" })));

    await backfill(t);

    expect(await wordsAt(t, topLevelTs)).toEqual({ kind: "unavailable", reason: "deleted" });
    expect(await storedAndScheduled(t)).not.toContain(earlierWords);
  });

  test("a thread whose reply is gone, where conversations.replies answers only its parent, writes deleted", async () => {
    const t = testBackend();
    await givenBeforeCapture(t, thanksCarol, { ts: replyTs, threadTs: threadRootTs, inSlack: false });
    slack.withMessage("C1", channelMessage(thanksBob, { ts: threadRootTs }));

    await backfill(t);

    expect(await wordsAt(t, replyTs)).toEqual({ kind: "unavailable", reason: "deleted" });
    expect(await storedAndScheduled(t)).not.toContain(reason);
  });

  test.each<[string, ScriptedAnswer]>([
    ["a permission error", slackError("not_in_channel")],
    ["a missing channel", slackError("channel_not_found")],
    ["an HTTP 5xx", httpStatus(503)],
    ["a network failure", networkFailure],
  ])("%s leaves the message not captured, and a later run fills it", async (_, failure) => {
    const t = testBackend();
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs });
    slack.answering("conversations.history", failure);

    await backfill(t);
    expect(await wordsAt(t, topLevelTs)).toEqual({ kind: "unavailable", reason: "not-captured" });

    await backfill(t);
    expect(await wordsAt(t, topLevelTs)).toMatchObject({ kind: "text", visibility: "unknown" });
  });

  test.each(["not_in_channel", "channel_not_found", "thread_not_found"])("a %s answer is logged by its Slack code, never with the words", async (error) => {
    const t = testBackend();
    await givenBeforeCapture(t, thanksCarol, { ts: replyTs, threadTs: threadRootTs });
    slack.answering("conversations.replies", slackError(error));
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});

    await backfill(t);

    expect(warnings.mock.calls.map((call) => call.join(" "))).toContain(`backfill: conversations.replies failed: ${error}`);
    expect(stringify(warnings.mock.calls)).not.toContain(replyReason);
  });

  test("only Given messages without words are fetched: an ordinary message and a kudos message captured live make no Slack call", async () => {
    const t = testBackend();
    await post(t, [section(text("lunch at noon? "), mention("U_BOB"))], { ts: "1760349400.000100" });
    await post(t, thanksBob, { ts: topLevelTs });
    await settle(t);

    await backfill(t);

    expect(slack.callsTo("conversations.history")).toEqual([]);
    expect(slack.callsTo("conversations.replies")).toEqual([]);
  });
});

describe("AT35: hydrate refuses", () => {
  test("a message whose newest revision the engine knows is newer than Slack's answer", async () => {
    const t = testBackend();
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs, editedTs: "1760349660.000100", inSlack: false });
    slack.withMessage("C1", channelMessage(thanksBob, { ts: topLevelTs }));

    await backfill(t);

    expect(await wordsAt(t, topLevelTs)).toEqual({ kind: "unavailable", reason: "not-captured" });
  });

  test("a message deleted in Slack while its answer was on the way", async () => {
    const t = testBackend();
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs });
    slack.withMessage("C1", channelMessage(thanksBob, { ts: topLevelTs }));
    const answer = slack.holdNext("conversations.history");

    const run = t.action(internal.slack.backfill.backfillWords, {});
    await answer.reached;
    await deleteMessage(t, { ts: topLevelTs, previous: thanksBob });
    answer.release();
    await run;
    await settleInTimeOrder(t);

    expect(await wordsAt(t, topLevelTs)).toEqual({ kind: "unavailable", reason: "deleted" });
    expect(await storedAndScheduled(t)).not.toContain(reason);
  });

  test("a message whose author is no longer a member", async () => {
    const t = testBackend();
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs });
    await memberChanged(t, "user_change", { id: "U_ALICE", team_id: "T1", deleted: true });
    await settle(t);

    await backfill(t, { answering: channelMessage(thanksBob, { ts: topLevelTs }) });

    expect(await wordsAt(t, topLevelTs)).toEqual({ kind: "unavailable", reason: "not-captured" });
  });

  test("a message Slack answers that no longer parses as a kudos message", async () => {
    const t = testBackend();
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs });

    await backfill(t, { answering: channelMessage([section(text(`thanks ${reason} `), mention("U_BOB"))], { ts: topLevelTs, editedTs: "1760349660.000100" }) });

    expect(await wordsAt(t, topLevelTs)).toEqual({ kind: "unavailable", reason: "not-captured" });
    expect(await kudosReceived(t, "U_BOB")).toBe(1);
  });

  test("a message whose words were removed when its author left, even once they are back", async () => {
    const t = testBackend();
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs });
    await backfill(t);
    await memberChanged(t, "user_change", { id: "U_ALICE", team_id: "T1", deleted: true });
    await settle(t);
    await memberChanged(t, "user_change", { id: "U_ALICE", team_id: "T1", deleted: false }, { eventTs: `${Date.now() / 1000 + 60}` });
    await settle(t);
    const reads = slack.callsTo("conversations.history").length;

    await backfill(t);

    expect(await wordsAt(t, topLevelTs)).toEqual({ kind: "unavailable", reason: "removed" });
    expect(slack.callsTo("conversations.history")).toHaveLength(reads);
    expect(await storedAndScheduled(t)).not.toContain(reason);
  });

  test("a message that isn't Given", async () => {
    const t = testBackend();
    const thanksMyself = [section(text(`thanks ${reason} `), mention("U_ALICE"), text(" "), emoji("taco"))];
    capture.shipped = false;
    await post(t, thanksMyself, { ts: topLevelTs });
    await settle(t);
    capture.shipped = true;
    const ref = { workspace: "T1", conversation: "C1", message: topLevelTs };
    const segments = [{ kind: "text" as const, text: `thanks ${reason} ` }];

    const hydration = await t.mutation(internal.slack.backfill.hydrateWords, {
      fetched: { ref, author: "U_ALICE", revision: 1760349600000100n, edited: false, content: { mentions: [{ kind: "person", user: "U_BOB" }], emoji: ["taco"], text: `thanks ${reason} ` }, segments },
    });

    expect(hydration).toEqual({ kind: "refused", why: "not-given" });
    expect(await wordsAt(t, topLevelTs)).toEqual({ kind: "unavailable", reason: "not-captured" });
  });

  test("and never evaluates, awards or replies", async () => {
    const t = testBackend();
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs });
    const callsBefore = slack.calls.length;

    await backfill(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(slack.calls.slice(callsBefore).map((call) => call.method)).toEqual(["conversations.history"]);
  });
});

describe("AT4 AT35: a revision older than the one hydrate read changes nothing", () => {
  const [olderEditTs, fetchedEditTs] = ["1760349630.000100", "1760349660.000100"];

  test("a delayed edit that is ordinary chat leaves the newer filled words", async () => {
    const t = testBackend();
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs, inSlack: false });
    slack.withMessage("C1", channelMessage(thanksBob, { ts: topLevelTs, editedTs: fetchedEditTs }));
    await backfill(t);

    await edit(t, [section(text("lunch at noon? "), mention("U_BOB"))], { ts: topLevelTs, editedTs: olderEditTs });
    await settle(t);

    expect(await wordsAt(t, topLevelTs)).toMatchObject({ kind: "text", edited: true, segments: expect.arrayContaining([{ kind: "text", text: `thanks ${reason} ` }]) });
    expect(await storedAndScheduled(t, { besideKudosText: true })).not.toContain(reason);
  });

  test("a delayed edit that is a kudos message stores nothing once Slack's newer revision was ordinary chat", async () => {
    const t = testBackend();
    const olderWords = "an older revision that slack has since replaced";
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs, inSlack: false });
    slack.withMessage("C1", channelMessage([section(text("lunch at noon? "), mention("U_BOB"))], { ts: topLevelTs, editedTs: fetchedEditTs }));
    await backfill(t);

    await edit(t, [section(text(`thanks ${olderWords} `), mention("U_BOB"), emoji("taco"))], { ts: topLevelTs, editedTs: olderEditTs });
    await settle(t);

    expect(await wordsAt(t, topLevelTs)).toEqual({ kind: "unavailable", reason: "not-captured" });
    expect(await storedAndScheduled(t)).not.toContain(olderWords);
  });
});

describe("AT35: paging", () => {
  test("a page without a message to fill hands the next page to a new job, so no job scans without bound", async () => {
    const t = testBackend();
    for (let index = 0; index < 26; index += 1) await edit(t, [section(text("lunch at noon?"))], { ts: `17603491${String(index).padStart(2, "0")}.000100`, editedTs: `17603492${String(index).padStart(2, "0")}.000100` });
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs });

    await t.action(internal.slack.backfill.backfillWords, {});

    expect(slack.callsTo("conversations.history")).toEqual([]);
    expect(await pendingBackfillJobs(t)).toEqual([{ cursor: expect.any(String) }]);
    await settleInTimeOrder(t);
    expect(await wordsAt(t, topLevelTs)).toMatchObject({ kind: "text", visibility: "unknown" });
  });
});

describe("AT35: pacing", () => {
  test("a ratelimited answer waits for its Retry-After and resumes", async () => {
    const t = testBackend();
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs });
    slack.answering("conversations.history", rateLimitedFor(30));

    await backfill(t);

    const [refused, retried] = slack.timesOf("conversations.history");
    expect(retried! - refused!).toBeGreaterThanOrEqual(30_000);
    expect(await wordsAt(t, topLevelTs)).toMatchObject({ kind: "text", visibility: "unknown" });
  });

  test("Slack's reads are spaced under its Tier 3 limit of 50 a minute", async () => {
    const t = testBackend();
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs });
    await givenBeforeCapture(t, thanksCarol, { ts: "1760349800.000100" });

    await backfill(t);

    const [first, second] = slack.timesOf("conversations.history");
    expect(second! - first!).toBeGreaterThanOrEqual(60_000 / 50);
    expect(await wordsAt(t, "1760349800.000100")).toMatchObject({ kind: "text" });
  });

  test("it pages through more Given messages than one page holds", async () => {
    const t = testBackend();
    const givers = Array.from({ length: 30 }, (_, index) => `U_GIVER${index}`);
    for (const giver of givers) slack.withMember(giver);
    capture.shipped = false;
    for (const [index, giver] of givers.entries()) await post(t, thanksBob, { user: giver, ts: tsAt(index) });
    await settle(t);
    capture.shipped = true;
    for (const [index, giver] of givers.entries()) slack.withMessage("C1", channelMessage(thanksBob, { user: giver, ts: tsAt(index) }));

    await backfill(t);

    for (const index of givers.keys()) expect(await wordsAt(t, tsAt(index))).toMatchObject({ kind: "text", visibility: "unknown" });
  });
});

describe("AT35 AT36: safe to run again", () => {
  test("a second run makes no Slack call and changes nothing", async () => {
    const t = testBackend();
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs });
    await backfill(t);
    const stored = await everythingStored(t, { except: ["slackRateLimits"] });
    const calls = slack.calls.length;

    await backfill(t);

    expect(slack.calls.length).toBe(calls);
    expect(await everythingStored(t, { except: ["slackRateLimits"] })).toEqual(stored);
  });
});

describe("AT1 AT35: the words stay out of every job", () => {
  test("no job's arguments carry the words, during the run or after it", async () => {
    const t = testBackend();
    await givenBeforeCapture(t, thanksBob, { ts: topLevelTs });
    await givenBeforeCapture(t, thanksCarol, { ts: replyTs, threadTs: threadRootTs });
    slack.withMessage("C1", channelMessage([section(text("ordinary root"))], { ts: threadRootTs }));
    slack.answering("conversations.replies", rateLimitedFor(5));

    await backfill(t);

    expect(await wordsAt(t, replyTs)).toMatchObject({ kind: "text" });
    const jobs = stringify(await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()));
    expect(jobs).not.toContain(reason);
    expect(jobs).not.toContain(replyReason);
    expect(await storedAndScheduled(t, { besideKudosText: true })).not.toContain(reason);
  });
});

async function givenBeforeCapture(t: Backend, blocks: RichElement[], { inSlack = true, ...options }: ChannelMessageOptions & { ts: string; inSlack?: boolean }) {
  capture.shipped = false;
  await post(t, blocks, options);
  if (options.editedTs) await edit(t, blocks, options);
  await settle(t);
  capture.shipped = true;
  if (inSlack) slack.withMessage("C1", channelMessage(blocks, options));
}

async function backfill(t: Backend, { answering }: { answering?: ChannelMessage } = {}) {
  if (answering) slack.answering("conversations.history", answeringWith(answering));
  await t.action(internal.slack.backfill.backfillWords, {});
  await settleInTimeOrder(t);
}

function answeringWith(...messages: ChannelMessage[]): ScriptedAnswer {
  return () => Response.json({ ok: true, messages, has_more: false });
}

function wordsAt(t: Backend, ts: string) {
  return t.run((ctx) => wordsOf(ctx, { workspace: "T1", conversation: "C1", message: ts }));
}

async function pendingBackfillJobs(t: Backend) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter((job) => job.name.includes("backfillWords") && job.state.kind === "pending").map((job) => job.args[0]);
}

function tsAt(index: number) {
  return `17603496${String(index).padStart(2, "0")}.000100`;
}

async function storedAndScheduled(t: Backend, { besideKudosText = false } = {}) {
  const stored = besideKudosText ? await everythingStored(t, { except: ["kudosTexts"] }) : await everythingStored(t);
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return stringify([...stored, ...jobs]);
}

function stringify(value: unknown) {
  return JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item));
}
