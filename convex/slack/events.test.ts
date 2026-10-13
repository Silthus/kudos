import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { everythingStored, kudosReceived, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { signedRequest, signingSecret, type SigningOptions } from "../../testing/signedSlack";

const now = new Date("2026-10-13T10:00:00Z");

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U1").withMember("U2");
  vi.stubGlobal("fetch", slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /slack/events", () => {
  test("R48 R49: a correctly signed event gets 200, one receipt and its kudos", async () => {
    const t = testBackend();

    const response = await postSigned(t, eventCallback("T1", "Ev1"));
    await settle(t);

    expect(response.status).toBe(200);
    expect(await receiptsIn(t)).toEqual([{ workspace: "T1", eventId: "Ev1" }]);
    expect(await kudosReceived(t, "U2")).toBe(1);
  });

  describe("R48: a request Slack did not sign gets 401 and records nothing", () => {
    test.each([
      ["signed with another secret", () => signedRequest(eventCallback("T1", "Ev1"), { secret: "someone-elses-secret" })],
      ["unsigned", async () => ({ method: "POST", body: eventCallback("T1", "Ev1") })],
      ["with a body changed after signing", async () => ({ ...(await signedRequest(eventCallback("T1", "Ev1"))), body: eventCallback("T1", "Ev2") })],
      ["with a byte order mark added after signing", async () => ({ ...(await signedRequest(eventCallback("T1", "Ev1"))), body: withByteOrderMark(eventCallback("T1", "Ev1")) })],
      ["signed more than 5 minutes ago", () => signedRequest(eventCallback("T1", "Ev1"), { signedAt: minutesBefore(now, 6) })],
      ["signed more than 5 minutes ahead", () => signedRequest(eventCallback("T1", "Ev1"), { signedAt: minutesBefore(now, -6) })],
      ["unsigned url_verification", async () => ({ method: "POST", body: JSON.stringify({ type: "url_verification", challenge: "c-123" }) })],
    ])("%s", async (_, request) => {
      const t = testBackend();

      const response = await t.fetch("/slack/events", await request());
      await settle(t);

      expect(response.status).toBe(401);
      expect(await everythingStored(t)).toEqual([]);
      expect(slack.calls).toEqual([]);
    });
  });

  test("R48: a request signed 4 minutes ago is still accepted", async () => {
    const t = testBackend();

    const response = await postSigned(t, eventCallback("T1", "Ev1"), { signedAt: minutesBefore(now, 4) });

    expect(response.status).toBe(200);
    expect(await receiptsIn(t)).toEqual([{ workspace: "T1", eventId: "Ev1" }]);
  });

  test("R49: a redelivery of the same team_id and event_id gets 200 and runs nothing", async () => {
    const t = testBackend();
    await postSigned(t, eventCallback("T1", "Ev1"));

    const redelivery = await postSigned(t, eventCallback("T1", "Ev1"));
    await settle(t);

    expect(redelivery.status).toBe(200);
    expect(await receiptsIn(t)).toEqual([{ workspace: "T1", eventId: "Ev1" }]);
    expect(await kudosReceived(t, "U2")).toBe(1);
    expect(slack.callsTo("reactions.add")).toHaveLength(1);
  });

  test("R49: the same event_id from another workspace is a different event", async () => {
    const t = testBackend();
    await postSigned(t, eventCallback("T1", "Ev1"));

    await postSigned(t, eventCallback("T2", "Ev1"));

    expect(await receiptsIn(t)).toEqual([
      { workspace: "T1", eventId: "Ev1" },
      { workspace: "T2", eventId: "Ev1" },
    ]);
  });

  test("R49: the receipt and the processing step share one transaction", async () => {
    const t = testBackend();
    await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U1", kind: "member" }));
    await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U1", kind: "member" }));

    await expect(postSigned(t, eventCallback("T1", "Ev1"))).rejects.toThrow();

    expect(await receiptsIn(t)).toEqual([]);
  });

  test("an envelope of another type, such as app_rate_limited, is acknowledged and records nothing", async () => {
    const t = testBackend();

    const response = await postSigned(t, JSON.stringify({ type: "app_rate_limited", team_id: "T1", minute_rate_limited: 1760349600 }));

    expect(response.status).toBe(200);
    expect(await everythingStored(t)).toEqual([]);
  });

  test("R2: a new message without a mention or an emoji is acknowledged before any mutation and records nothing", async () => {
    const t = testBackend();
    const chat = JSON.stringify({
      type: "event_callback",
      team_id: "T1",
      event_id: "Ev1",
      event: { type: "message", channel: "C1", channel_type: "channel", user: "U1", ts: "1760349600.000100", text: "lunch?", blocks: [] },
    });

    const response = await postSigned(t, chat);
    await settle(t);

    expect(response.status).toBe(200);
    expect(await everythingStored(t)).toEqual([]);
    expect(slack.calls).toEqual([]);
  });

  test("url_verification returns the challenge", async () => {
    const t = testBackend();

    const response = await postSigned(t, JSON.stringify({ type: "url_verification", challenge: "c-123", token: "legacy" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ challenge: "c-123" });
    expect(await receiptsIn(t)).toEqual([]);
  });
});

function eventCallback(teamId: string, eventId: string) {
  return JSON.stringify({
    type: "event_callback",
    team_id: teamId,
    event_id: eventId,
    event: {
      type: "message",
      channel: "C1",
      channel_type: "channel",
      user: "U1",
      ts: "1760349600.000100",
      text: "thanks <@U2> :taco:",
      blocks: [{ type: "rich_text", elements: [{ type: "rich_text_section", elements: [{ type: "user", user_id: "U2" }, { type: "emoji", name: "taco" }] }] }],
    },
  });
}

async function postSigned(t: Backend, body: string, options: SigningOptions = {}) {
  return t.fetch("/slack/events", await signedRequest(body, options));
}

function withByteOrderMark(body: string) {
  return new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(body)]);
}

function minutesBefore(date: Date, minutes: number) {
  return new Date(date.getTime() - minutes * 60 * 1000);
}

async function receiptsIn(t: Backend) {
  const receipts = await t.run((ctx) => ctx.db.query("slackReceipts").collect());
  return receipts.map(({ workspace, eventId }) => ({ workspace, eventId }));
}
