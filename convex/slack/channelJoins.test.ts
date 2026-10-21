import { afterEach, beforeEach, describe, expect, test, vi, type MockInstance } from "vitest";
import { FakeSlack, httpStatus, networkFailure, rateLimitedFor, slackError } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { post, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { channelCreatedEvent, kudosAppBotUser, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";

const now = new Date("2026-10-21T10:00:00Z");
const tier3Spacing = 60_000 / 50;
const postingMethods = ["chat.postMessage", "chat.postEphemeral", "reactions.add", "views.publish"];

let slack: FakeSlack;
let logged: MockInstance;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  slack = new FakeSlack();
  vi.stubGlobal("fetch", slack.fetch);
  logged = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the channel join puts the app in every public channel it isn't in yet", () => {
  test("it joins each public, unarchived channel it isn't in across every page, and skips private, archived and externally shared channels and those it is in", async () => {
    const t = testBackend();
    slack
      .listingChannelsPerPage(2)
      .withChannel("C_FIRST", { name: "first" })
      .withChannel("C_IN", { name: "already-in", joined: true })
      .withChannel("C_ARCHIVED", { name: "archived", kind: "archived" })
      .withChannel("C_PRIVATE", { name: "private", kind: "private" })
      .withChannel("C_SHARED", { name: "shared", kind: "shared" })
      .withChannel("C_INVITED", { name: "invited", kind: "pending-shared" })
      .withChannel("C_LAST", { name: "last" });

    await joinPublicChannels(t);

    expect(slack.callsTo("conversations.join")).toEqual([{ channel: "C_FIRST" }, { channel: "C_LAST" }]);
    expect(slack.callsTo("conversations.list")).toEqual([
      { types: "public_channel", exclude_archived: "true", limit: "200" },
      { types: "public_channel", exclude_archived: "true", limit: "200", cursor: "2" },
      { types: "public_channel", exclude_archived: "true", limit: "200", cursor: "4" },
    ]);
    expect(logged).toHaveBeenLastCalledWith("channel joins finished: joined 2, missed 0");
  });

  test("joining posts nothing in the channel beyond Slack's own join line", async () => {
    const t = testBackend();
    slack.withChannel("C_FIRST", { name: "first" });

    await joinPublicChannels(t);
    await post(t, [section(text("has joined the channel"))], { channel: "C_FIRST", user: kudosAppBotUser, subtype: "channel_join" });
    await settleInTimeOrder(t);

    expect(slack.hasJoined("C_FIRST")).toBe(true);
    expect(slack.calls.filter(({ method }) => postingMethods.includes(method))).toEqual([]);
  });

  test("a rerun joins nothing it joined before", async () => {
    const t = testBackend();
    slack.withChannel("C_FIRST", { name: "first" }).withChannel("C_SECOND", { name: "second" });
    await joinPublicChannels(t);
    const joinedBefore = slack.callsTo("conversations.join").length;

    await joinPublicChannels(t);

    expect(slack.callsTo("conversations.join")).toHaveLength(joinedBefore);
    expect(logged).toHaveBeenLastCalledWith("channel joins finished: joined 0, missed 0");
  });

  test("it joins at most one channel per Tier 3 slot and waits out the Retry-After Slack asks for", async () => {
    const t = testBackend();
    slack.withChannel("C_FIRST", { name: "first" }).withChannel("C_SECOND", { name: "second" }).withChannel("C_THIRD", { name: "third" });
    slack.answering("conversations.join", (answerAsSlackWould) => answerAsSlackWould(), rateLimitedFor(30));

    await joinPublicChannels(t);

    const [first, limited, retried, third] = slack.timesOf("conversations.join");
    expect(slack.callsTo("conversations.join")).toEqual([{ channel: "C_FIRST" }, { channel: "C_SECOND" }, { channel: "C_SECOND" }, { channel: "C_THIRD" }]);
    expect(limited! - first!).toBeGreaterThanOrEqual(tier3Spacing);
    expect(retried! - limited!).toBeGreaterThanOrEqual(30_000);
    expect(third! - retried!).toBeGreaterThanOrEqual(tier3Spacing);
    expect(["C_FIRST", "C_SECOND", "C_THIRD"].every((channel) => slack.hasJoined(channel))).toBe(true);
  });

  test("a rate-limited listing waits out the Retry-After and lists the same page again", async () => {
    const t = testBackend();
    slack.listingChannelsPerPage(1).withChannel("C_FIRST", { name: "first" }).withChannel("C_SECOND", { name: "second" });
    slack.answering("conversations.list", (answerAsSlackWould) => answerAsSlackWould(), rateLimitedFor(20));

    await joinPublicChannels(t);

    const [, limited, retried] = slack.timesOf("conversations.list");
    expect(slack.callsTo("conversations.list").map(({ cursor }) => cursor)).toEqual([undefined, "1", "1"]);
    expect(retried! - limited!).toBeGreaterThanOrEqual(20_000);
    expect(slack.hasJoined("C_SECOND")).toBe(true);
  });

  test("a channel someone added it to since the listing counts as neither joined nor missed", async () => {
    const t = testBackend();
    slack.withChannel("C_FIRST", { name: "first" }).withChannel("C_ADDED", { name: "added meanwhile" });
    slack.answering("conversations.list", (answerAsSlackWould) => {
      const listed = answerAsSlackWould();
      slack.withChannel("C_ADDED", { name: "added meanwhile", joined: true });
      return listed;
    });

    await joinPublicChannels(t);

    expect(slack.callsTo("conversations.join")).toEqual([{ channel: "C_FIRST" }, { channel: "C_ADDED" }]);
    expect(logged).toHaveBeenLastCalledWith("channel joins finished: joined 1, missed 0");
  });

  test("a channel it can't join is missed with Slack's reason and the run goes on to the rest", async () => {
    const t = testBackend();
    slack.withChannel("C_ARCHIVED_MEANWHILE", { name: "archived meanwhile" }).withChannel("C_UNREACHED", { name: "unreached" }).withChannel("C_LAST", { name: "last" });
    slack.answering("conversations.join", slackError("is_archived"), networkFailure);

    await joinPublicChannels(t);

    expect(slack.hasJoined("C_LAST")).toBe(true);
    expect(logged).toHaveBeenLastCalledWith("channel joins finished: joined 1, missed 2");
    expect(console.warn).toHaveBeenCalledWith("channel joins: conversations.join failed: is_archived");
  });

  test("a listing Slack refuses, as before the app has channels:read, ends the run with Slack's error code", async () => {
    const t = testBackend();
    slack.withChannel("C_FIRST", { name: "first" }).answering("conversations.list", slackError("missing_scope"));

    await expect(t.action(internal.slack.channelJoins.joinPublicChannels, {})).rejects.toThrow("Slack conversations.list failed: missing_scope");
    expect(slack.callsTo("conversations.join")).toEqual([]);
  });
});

describe("channel_created puts the app in the new public channel", () => {
  test("a new channel gets the app without anyone acting, once even when Slack delivers the event again", async () => {
    const t = testBackend();
    slack.withChannel("C_NEW", { name: "fresh-channel" });

    expect((await channelCreated(t, "C_NEW", { eventId: "Ev_CREATED" })).status).toBe(200);
    await channelCreated(t, "C_NEW", { eventId: "Ev_CREATED" });
    await settleInTimeOrder(t);

    expect(slack.callsTo("conversations.join")).toEqual([{ channel: "C_NEW" }]);
    expect(slack.calls.filter(({ method }) => postingMethods.includes(method))).toEqual([]);
  });

  test("a rate-limited join of a new channel waits out the Retry-After and joins it", async () => {
    const t = testBackend();
    slack.withChannel("C_NEW", { name: "fresh-channel" }).answering("conversations.join", rateLimitedFor(15));

    await channelCreated(t, "C_NEW");
    await settleInTimeOrder(t);

    const [limited, retried] = slack.timesOf("conversations.join");
    expect(retried! - limited!).toBeGreaterThanOrEqual(15_000);
    expect(slack.hasJoined("C_NEW")).toBe(true);
  });

  test("a join of a new channel that gets no answer is tried again, 3 tries at most", async () => {
    const t = testBackend();
    slack.withChannel("C_NEW", { name: "fresh-channel" }).withChannel("C_UNLUCKY", { name: "unlucky" });
    slack.answering("conversations.join", networkFailure, httpStatus(503));

    await channelCreated(t, "C_NEW");
    await settleInTimeOrder(t);
    slack.answering("conversations.join", networkFailure, httpStatus(503), networkFailure);
    await channelCreated(t, "C_UNLUCKY");
    await settleInTimeOrder(t);

    expect(slack.callsTo("conversations.join")).toEqual([...Array(3).fill({ channel: "C_NEW" }), ...Array(3).fill({ channel: "C_UNLUCKY" })]);
    expect(slack.hasJoined("C_NEW")).toBe(true);
    expect(slack.hasJoined("C_UNLUCKY")).toBe(false);
    expect(await lastTryOf(t, "C_UNLUCKY")).toEqual({ kind: "failed" });
  });

  test("a join of a new channel Slack keeps rate limiting is reported after 3 tries", async () => {
    const t = testBackend();
    slack.withChannel("C_NEW", { name: "fresh-channel" }).answering("conversations.join", rateLimitedFor(1), rateLimitedFor(1), rateLimitedFor(1));

    await channelCreated(t, "C_NEW");
    await settleInTimeOrder(t);

    expect(slack.callsTo("conversations.join")).toHaveLength(3);
    expect(await lastTryOf(t, "C_NEW")).toEqual({ kind: "failed" });
  });
});

async function joinPublicChannels(t: Backend) {
  await t.action(internal.slack.channelJoins.joinPublicChannels, {});
  await settleInTimeOrder(t);
}

async function lastTryOf(t: Backend, channel: string) {
  const tries = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return tries.filter(({ name, args }) => name.includes("joinCreatedChannel") && args[0]?.channel === channel).at(-1)?.state;
}

async function channelCreated(t: Backend, channel: string, options: { eventId?: string } = {}) {
  return t.fetch("/slack/events", await signedRequest(channelCreatedEvent(channel, options)));
}
