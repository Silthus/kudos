import { afterEach, beforeEach, describe, expect, test, vi, type MockInstance } from "vitest";
import { FakeSlack, networkFailure, rateLimitedFor, slackError } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { channelRenameEvent, channelSharedEvent, kudosAppBotUser, memberJoinedChannelEvent } from "../../testing/slackMessages";
import { internal } from "../_generated/api";

const now = new Date("2026-10-26T10:00:00Z");

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

describe("the app leaves shared and customer channels", () => {
  test("the channel leave takes the app out of every shared, invited and customer channel it is in, public or private, across every page", async () => {
    const t = testBackend();
    slack
      .listingChannelsPerPage(2)
      .withChannel("C_GENERAL", { name: "general", joined: true })
      .withChannel("C_SHARED", { name: "partners", kind: "shared", joined: true })
      .withChannel("C_INVITED", { name: "invited", kind: "pending-shared", joined: true })
      .withChannel("G_SHARED", { name: "partners-private", kind: "private-shared", joined: true })
      .withChannel("C_CUSTOMER", { name: "customer-example-internal", joined: true })
      .withChannel("G_TEAM", { name: "team-private", kind: "private", joined: true })
      .withChannel("C_OUTSIDE", { name: "customer-other-internal" });

    await leaveOffLimitsChannels(t);

    expect(slack.callsTo("conversations.leave")).toEqual([{ channel: "C_SHARED" }, { channel: "C_INVITED" }, { channel: "G_SHARED" }, { channel: "C_CUSTOMER" }]);
    expect(["C_GENERAL", "G_TEAM"].filter((channel) => slack.hasJoined(channel))).toEqual(["C_GENERAL", "G_TEAM"]);
    expect(logged).toHaveBeenLastCalledWith("channel leaves finished: left 4, missed 0");
  });

  test("a rate-limited leave waits out the Retry-After and leaves the channel", async () => {
    const t = testBackend();
    slack.withChannel("C_CUSTOMER", { name: "customer-example-internal", joined: true }).answering("conversations.leave", rateLimitedFor(20));

    await leaveOffLimitsChannels(t);

    const [limited, retried] = slack.timesOf("conversations.leave");
    expect(retried! - limited!).toBeGreaterThanOrEqual(20_000);
    expect(slack.hasJoined("C_CUSTOMER")).toBe(false);
  });

  test("a channel renamed out of customer- between the listing and its leave keeps the app", async () => {
    const t = testBackend();
    slack.withChannel("G_RENAMED", { name: "customer-example-internal", kind: "private", joined: true }).answering("conversations.info", () => Response.json({ ok: true, channel: { id: "G_RENAMED", name: "team-private", is_private: true } }));

    await leaveOffLimitsChannels(t);

    expect(slack.callsTo("conversations.leave")).toEqual([]);
    expect(logged).toHaveBeenLastCalledWith("channel leaves finished: left 0, missed 0");
  });

  test("a channel the app already left by the time of its leave counts as left", async () => {
    const t = testBackend();
    slack.withChannel("C_CUSTOMER", { name: "customer-example-internal", joined: true }).answering("conversations.leave", () => Response.json({ ok: false, not_in_channel: true }));

    await leaveOffLimitsChannels(t);

    expect(logged).toHaveBeenLastCalledWith("channel leaves finished: left 1, missed 0");
  });

  test("a channel Slack gives no answer about counts as missed, and the sweep goes on to the next", async () => {
    const t = testBackend();
    slack.withChannel("C_FIRST", { name: "customer-first-internal", joined: true }).withChannel("C_SECOND", { name: "customer-second-internal", joined: true }).answering("conversations.info", networkFailure);

    await leaveOffLimitsChannels(t);

    expect(slack.callsTo("conversations.leave")).toEqual([{ channel: "C_SECOND" }]);
    expect(logged).toHaveBeenLastCalledWith("channel leaves finished: left 1, missed 1");
  });

  test("an archived channel Slack won't let the app leave counts as missed", async () => {
    const t = testBackend();
    slack.withChannel("C_CUSTOMER", { name: "customer-example-internal", joined: true }).answering("conversations.leave", slackError("is_archived"));

    await leaveOffLimitsChannels(t);

    expect(logged).toHaveBeenLastCalledWith("channel leaves finished: left 0, missed 1");
  });

  test("a channel shared with another organization while the app is in it is left at once, once even when Slack delivers the event again", async () => {
    const t = testBackend();
    slack.withChannel("C_TEAM", { name: "team", joined: true }).shareChannel("C_TEAM");

    await deliver(t, channelSharedEvent("C_TEAM", { eventId: "Ev_SHARED" }));
    await deliver(t, channelSharedEvent("C_TEAM", { eventId: "Ev_SHARED" }));

    expect(slack.callsTo("conversations.leave")).toEqual([{ channel: "C_TEAM" }]);
  });

  test.each([
    ["public", "C_TEAM", { name: "team", joined: true }, false],
    ["private", "G_TEAM", { name: "team", kind: "private" as const, joined: true }, true],
  ])("a %s channel renamed into customer- is left", async (_, id, channel, isPrivate) => {
    const t = testBackend();
    slack.withChannel(id, channel).renameChannel(id, "customer-example-internal");

    await deliver(t, channelRenameEvent(id, "customer-example-internal", { isPrivate }));

    expect(slack.hasJoined(id)).toBe(false);
  });

  test("a channel renamed to anything else keeps the app", async () => {
    const t = testBackend();
    slack.withChannel("C_TEAM", { name: "team", joined: true }).renameChannel("C_TEAM", "team-customers");

    await deliver(t, channelRenameEvent("C_TEAM", "team-customers"));

    expect(slack.callsTo("conversations.leave")).toEqual([]);
    expect(slack.hasJoined("C_TEAM")).toBe(true);
  });

  test("an invite of the app into a shared private channel is left at once", async () => {
    const t = testBackend();
    slack.withChannel("G_SHARED", { name: "partners-private", kind: "private-shared", joined: true });

    await deliver(t, memberJoinedChannelEvent("G_SHARED", kudosAppBotUser, { isPrivate: true }));

    expect(slack.hasJoined("G_SHARED")).toBe(false);
  });

  test("someone else joining a channel asks Slack nothing", async () => {
    const t = testBackend();
    slack.withChannel("C_SHARED", { name: "partners", kind: "shared", joined: true });

    await deliver(t, memberJoinedChannelEvent("C_SHARED", "U_ALICE"));

    expect(slack.calls).toEqual([]);
  });

  test("a check Slack keeps rate limiting gives up after 3 tries", async () => {
    const t = testBackend();
    slack.withChannel("C_TEAM", { name: "team", joined: true }).shareChannel("C_TEAM").answering("conversations.info", rateLimitedFor(1), rateLimitedFor(1), rateLimitedFor(1));

    await deliver(t, channelSharedEvent("C_TEAM"));

    expect(slack.callsTo("conversations.info")).toHaveLength(3);
    expect(slack.hasJoined("C_TEAM")).toBe(true);
  });
});

async function leaveOffLimitsChannels(t: Backend) {
  await t.action(internal.slack.channelLeaves.leaveOffLimitsChannels, {});
  await settleInTimeOrder(t);
}

async function deliver(t: Backend, event: string) {
  expect((await t.fetch("/slack/events", await signedRequest(event))).status).toBe(200);
  await settleInTimeOrder(t);
}
