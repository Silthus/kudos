import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";
import { processEvent } from "./processEvent";

vi.mock("./processEvent", () => ({ processEvent: vi.fn(async () => null) }));

const signingSecret = "test-signing-secret";
const now = new Date("2026-10-13T10:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.mocked(processEvent).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("POST /slack/events", () => {
  test("R48 R49: a correctly signed event gets 200, one receipt and one run of the processing step", async () => {
    const t = convexTest(schema, modules);

    const response = await postSigned(t, eventCallback("T1", "Ev1"));

    expect(response.status).toBe(200);
    expect(await receiptsIn(t)).toEqual([{ workspace: "T1", eventId: "Ev1" }]);
    expect(processEvent).toHaveBeenCalledOnce();
    expect(processEvent).toHaveBeenCalledWith(expect.anything(), { workspace: "T1", eventId: "Ev1" }, expect.objectContaining({ kind: "posted", author: "U1" }));
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
      const t = convexTest(schema, modules);

      const response = await t.fetch("/slack/events", await request());

      expect(response.status).toBe(401);
      expect(await receiptsIn(t)).toEqual([]);
      expect(processEvent).not.toHaveBeenCalled();
    });
  });

  test("R48: a request signed 4 minutes ago is still accepted", async () => {
    const t = convexTest(schema, modules);

    const response = await postSigned(t, eventCallback("T1", "Ev1"), { signedAt: minutesBefore(now, 4) });

    expect(response.status).toBe(200);
    expect(await receiptsIn(t)).toEqual([{ workspace: "T1", eventId: "Ev1" }]);
  });

  test("R49: a redelivery of the same team_id and event_id gets 200 and runs nothing", async () => {
    const t = convexTest(schema, modules);
    await postSigned(t, eventCallback("T1", "Ev1"));

    const redelivery = await postSigned(t, eventCallback("T1", "Ev1"));

    expect(redelivery.status).toBe(200);
    expect(await receiptsIn(t)).toEqual([{ workspace: "T1", eventId: "Ev1" }]);
    expect(processEvent).toHaveBeenCalledOnce();
  });

  test("R49: the same event_id from another workspace is a different event", async () => {
    const t = convexTest(schema, modules);
    await postSigned(t, eventCallback("T1", "Ev1"));

    await postSigned(t, eventCallback("T2", "Ev1"));

    expect(await receiptsIn(t)).toEqual([
      { workspace: "T1", eventId: "Ev1" },
      { workspace: "T2", eventId: "Ev1" },
    ]);
    expect(processEvent).toHaveBeenCalledTimes(2);
  });

  test("R49: the receipt and the processing step share one transaction", async () => {
    const t = convexTest(schema, modules);
    vi.mocked(processEvent).mockRejectedValueOnce(new Error("processing failed"));

    await expect(postSigned(t, eventCallback("T1", "Ev1"))).rejects.toThrow("processing failed");

    expect(await receiptsIn(t)).toEqual([]);
  });

  test("an envelope of another type, such as app_rate_limited, is acknowledged and records nothing", async () => {
    const t = convexTest(schema, modules);

    const response = await postSigned(t, JSON.stringify({ type: "app_rate_limited", team_id: "T1", minute_rate_limited: 1760349600 }));

    expect(response.status).toBe(200);
    expect(await receiptsIn(t)).toEqual([]);
    expect(processEvent).not.toHaveBeenCalled();
  });

  test("R2: a new message without a mention or an emoji is acknowledged before any mutation and records nothing", async () => {
    const t = convexTest(schema, modules);
    const chat = JSON.stringify({
      type: "event_callback",
      team_id: "T1",
      event_id: "Ev1",
      event: { type: "message", channel: "C1", channel_type: "channel", user: "U1", ts: "1760349600.000100", text: "lunch?", blocks: [] },
    });

    const response = await postSigned(t, chat);

    expect(response.status).toBe(200);
    expect(await receiptsIn(t)).toEqual([]);
    expect(processEvent).not.toHaveBeenCalled();
  });

  test("url_verification returns the challenge", async () => {
    const t = convexTest(schema, modules);

    const response = await postSigned(t, JSON.stringify({ type: "url_verification", challenge: "c-123", token: "legacy" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ challenge: "c-123" });
    expect(await receiptsIn(t)).toEqual([]);
  });
});

type Backend = ReturnType<typeof convexTest>;

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

type SigningOptions = { secret?: string; signedAt?: Date };

async function signedRequest(body: string, options: SigningOptions = {}): Promise<RequestInit> {
  const timestamp = Math.floor((options.signedAt ?? now).getTime() / 1000).toString();
  const signature = await sign(options.secret ?? signingSecret, `v0:${timestamp}:${body}`);
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": `v0=${signature}`,
    },
    body,
  };
}

function withByteOrderMark(body: string) {
  return new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(body)]);
}

function minutesBefore(date: Date, minutes: number) {
  return new Date(date.getTime() - minutes * 60 * 1000);
}

async function sign(secret: string, payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Buffer.from(mac).toString("hex");
}

async function receiptsIn(t: Backend) {
  const receipts = await t.run((ctx) => ctx.db.query("slackReceipts").collect());
  return receipts.map(({ workspace, eventId }) => ({ workspace, eventId }));
}
