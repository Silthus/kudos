import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";

const signingSecret = "test-signing-secret";
const botToken = "xoxb-test-token";
const responseUrl = "https://hooks.slack.com/commands/T1/1/abc";
const now = new Date("2026-10-13T10:00:00Z");

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", botToken);
  slack = fakeSlack();
  vi.stubGlobal("fetch", slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /slack/commands", () => {
  test("acknowledges /kudos at once with an empty 200, before calling Slack", async () => {
    const t = convexTest(schema, modules);

    const response = await postSigned(t, kudosCommand(publicChannel));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(slack.calls).toEqual([]);
  });

  test("R39: in a public channel the app isn't in, it joins and says it's in now", async () => {
    const t = convexTest(schema, modules);
    slack.answerJoin({ ok: true, channel: { id: "C1" } });

    await runCommand(t, kudosCommand(publicChannel));

    expect(slack.calls).toEqual([
      { url: "https://slack.com/api/conversations.join", authorization: `Bearer ${botToken}`, body: { channel: "C1" } },
      {
        url: responseUrl,
        authorization: null,
        body: { response_type: "ephemeral", text: "I'm in now. Mention teammates with a kudos emoji here and I'll pass the kudos on." },
      },
    ]);
  });

  test("R39: in a public channel the app is already in, it says so", async () => {
    const t = convexTest(schema, modules);
    slack.answerJoin({ ok: true, channel: { id: "C1" }, warning: "already_in_channel", response_metadata: { warnings: ["already_in_channel"] } });

    await runCommand(t, kudosCommand(publicChannel));

    expect(slack.privateReplies()).toEqual(["I'm already in this channel. Mention teammates with a kudos emoji to give kudos."]);
  });

  test.each(["channel_not_found", "method_not_supported_for_channel_type"])(
    "R40: in a private channel the app isn't in, where joining answers %s, it explains /invite",
    async (error) => {
      const t = convexTest(schema, modules);
      slack.answerJoin({ ok: false, error });

      await runCommand(t, kudosCommand({ channel_id: "C2", channel_name: "privategroup" }));

      expect(slack.privateReplies()).toEqual(["I can't join private channels by myself. Type `/invite @Kudos` here and I'll start counting kudos."]);
    },
  );

  test.each([
    ["a DM", { channel_id: "D1", channel_name: "directmessage" }],
    ["a group DM", { channel_id: "C3", channel_name: "mpdm-ann--bob--cy-1" }],
  ])("R41: in %s, which the app can't join, it points to channels", async (_, conversation) => {
    const t = convexTest(schema, modules);
    slack.answerJoin({ ok: false, error: "method_not_supported_for_channel_type" });

    await runCommand(t, kudosCommand(conversation));

    expect(slack.privateReplies()).toEqual(["I only count kudos in channels. Run /kudos in the channel you want me in."]);
  });

  test.each(["directmessage", "mpdm-roadmap"])("R39: a public channel named %s is still joined", async (channel_name) => {
    const t = convexTest(schema, modules);
    slack.answerJoin({ ok: true, channel: { id: "C4" } });

    await runCommand(t, kudosCommand({ channel_id: "C4", channel_name }));

    expect(slack.privateReplies()).toEqual(["I'm in now. Mention teammates with a kudos emoji here and I'll pass the kudos on."]);
  });

  describe("R48: a command Slack did not sign gets 401 and does nothing", () => {
    test.each([
      ["signed with another secret", () => signedRequest(kudosCommand(publicChannel), { secret: "someone-elses-secret" })],
      ["unsigned", async () => ({ method: "POST", body: kudosCommand(publicChannel) })],
      ["with a body changed after signing", async () => ({ ...(await signedRequest(kudosCommand(publicChannel))), body: kudosCommand({ channel_id: "C9", channel_name: "general" }) })],
      ["signed more than 5 minutes ago", () => signedRequest(kudosCommand(publicChannel), { signedAt: minutesBefore(now, 6) })],
    ])("%s", async (_, request) => {
      const t = convexTest(schema, modules);

      const response = await t.fetch("/slack/commands", await request());
      await t.finishAllScheduledFunctions(vi.runAllTimers);

      expect(response.status).toBe(401);
      expect(slack.calls).toEqual([]);
    });
  });
});

type Backend = ReturnType<typeof convexTest>;
type Conversation = { channel_id: string; channel_name: string };

const publicChannel: Conversation = { channel_id: "C1", channel_name: "general" };

function kudosCommand(conversation: Conversation) {
  return new URLSearchParams({
    token: "legacy-verification-token",
    team_id: "T1",
    team_domain: "acme",
    ...conversation,
    user_id: "U1",
    user_name: "ann",
    command: "/kudos",
    text: "",
    api_app_id: "A1",
    response_url: responseUrl,
    trigger_id: "1.2.3",
  }).toString();
}

async function runCommand(t: Backend, body: string) {
  const response = await postSigned(t, body);
  expect(response.status).toBe(200);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

async function postSigned(t: Backend, body: string) {
  return t.fetch("/slack/commands", await signedRequest(body));
}

type SigningOptions = { secret?: string; signedAt?: Date };

async function signedRequest(body: string, options: SigningOptions = {}): Promise<RequestInit> {
  const timestamp = Math.floor((options.signedAt ?? now).getTime() / 1000).toString();
  const signature = await sign(options.secret ?? signingSecret, `v0:${timestamp}:${body}`);
  return {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": `v0=${signature}`,
    },
    body,
  };
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

type SlackCall = { url: string; authorization: string | null; body: Record<string, unknown> };
type FakeSlack = ReturnType<typeof fakeSlack>;

function fakeSlack() {
  const calls: SlackCall[] = [];
  let joinAnswer: unknown = { ok: false, error: "not_stubbed" };
  return {
    calls,
    answerJoin(answer: unknown) {
      joinAnswer = answer;
    },
    privateReplies() {
      return calls.filter((call) => call.url === responseUrl && call.body.response_type === "ephemeral").map((call) => call.body.text);
    },
    fetch: vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      const headers = new Headers(init?.headers);
      calls.push({ url, authorization: headers.get("authorization"), body: JSON.parse(String(init?.body)) });
      if (url === "https://slack.com/api/conversations.join") return Response.json(joinAnswer);
      if (url === responseUrl) return new Response("ok");
      return new Response("unexpected Slack call", { status: 404 });
    }),
  };
}
