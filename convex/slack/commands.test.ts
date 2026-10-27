import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { signedRequest as signedSlackRequest, signingSecret, type SigningOptions } from "../../testing/signedSlack";
import { slashCommand, slashCommandResponseUrl, type Conversation } from "../../testing/slackMessages";

const botToken = "xoxb-test-token";
const responseUrl = slashCommandResponseUrl;
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
  test("acknowledges /hedgehug at once with an empty 200, before calling Slack", async () => {
    const t = testBackend();

    const response = await postSigned(t, hedgehugCommand(publicChannel));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(slack.calls).toEqual([]);
  });

  test("R39: in a public channel the app isn't in, it joins and says it's in now", async () => {
    const t = testBackend();
    slack.answerJoin({ ok: true, channel: { id: "C1" } });

    await runCommand(t, hedgehugCommand(publicChannel));

    expect(slack.calls.filter(({ url }) => !url.includes("/users.info?"))).toEqual([
      { url: "https://slack.com/api/conversations.info?channel=C1", authorization: `Bearer ${botToken}`, body: null },
      { url: "https://slack.com/api/conversations.join", authorization: `Bearer ${botToken}`, body: { channel: "C1" } },
      {
        url: responseUrl,
        authorization: null,
        body: { response_type: "ephemeral", text: "I'm in now. Mention teammates with a kudos emoji here and I'll pass the kudos on." },
      },
    ]);
  });

  test("R39: in a public channel the app is already in, it says so", async () => {
    const t = testBackend();
    slack.answerJoin({ ok: true, channel: { id: "C1" }, warning: "already_in_channel", response_metadata: { warnings: ["already_in_channel"] } });

    await runCommand(t, hedgehugCommand(publicChannel));

    expect(slack.privateReplies()).toEqual(["I'm already in this channel. Mention teammates with a kudos emoji to give kudos."]);
  });

  test.each(["channel_not_found", "method_not_supported_for_channel_type"])(
    "R40: in a private channel the app isn't in, where joining answers %s, it explains /invite",
    async (error) => {
      const t = testBackend();
      slack.answerJoin({ ok: false, error });

      await runCommand(t, hedgehugCommand({ channel_id: "C2", channel_name: "privategroup" }));

      expect(slack.privateReplies()).toEqual(["I can't join private channels by myself. Type `/invite @HedgeHug` here and I'll start counting kudos."]);
    },
  );

  test.each([
    ["a DM", { channel_id: "D1", channel_name: "directmessage" }],
    ["a group DM", { channel_id: "C3", channel_name: "mpdm-ann--bob--cy-1" }],
  ])("R41: in %s, which the app can't join, it points to channels", async (_, conversation) => {
    const t = testBackend();
    slack.answerJoin({ ok: false, error: "method_not_supported_for_channel_type" });

    await runCommand(t, hedgehugCommand(conversation));

    expect(slack.privateReplies()).toEqual(["I only count kudos in channels. Run `/hedgehug` in the channel you want me in."]);
  });

  test.each(["directmessage", "mpdm-roadmap"])("R39: a public channel named %s is still joined", async (channel_name) => {
    const t = testBackend();
    slack.answerJoin({ ok: true, channel: { id: "C4" } });

    await runCommand(t, hedgehugCommand({ channel_id: "C4", channel_name }));

    expect(slack.privateReplies()).toEqual(["I'm in now. Mention teammates with a kudos emoji here and I'll pass the kudos on."]);
  });

  test("R39: /kudos, the later alias of /hedgehug, adds the app the same way", async () => {
    const t = testBackend();
    slack.answerJoin({ ok: true, channel: { id: "C1" } });

    await runCommand(t, slashCommand(publicChannel, { command: "/kudos" }));

    expect(slack.privateReplies()).toEqual(["I'm in now. Mention teammates with a kudos emoji here and I'll pass the kudos on."]);
  });

  describe("the app stays out of shared and customer channels", () => {
    test.each([
      ["shared with another organization", { name: "partners", is_ext_shared: true }],
      ["being shared with another organization", { name: "partners", is_pending_ext_shared: true }],
      ["for a customer", { name: "customer-example-internal" }],
    ])("in a channel %s, it stays out and says why", async (_, channel) => {
      const t = testBackend();
      slack.answerInfo({ ok: true, channel: { id: "C1", ...channel } });

      await runCommand(t, hedgehugCommand(publicChannel));

      expect(slack.calls.filter(({ url }) => url.endsWith("/conversations.join"))).toEqual([]);
      expect(slack.privateReplies()).toEqual(["I stay out of customer channels and channels shared with another organization, since I quote kudos."]);
    });

    test("in a private channel the app is in, which Slack won't describe without groups:read, it doesn't join and explains /invite", async () => {
      const t = testBackend();
      slack.answerInfo({ ok: false, error: "missing_scope" });

      await runCommand(t, hedgehugCommand({ channel_id: "G1", channel_name: "privategroup" }));

      expect(slack.calls.filter(({ url }) => url.endsWith("/conversations.join"))).toEqual([]);
      expect(slack.privateReplies()).toEqual(["I can't join private channels by myself. Type `/invite @HedgeHug` here and I'll start counting kudos."]);
    });
  });

  describe("R48: a command Slack did not sign gets 401 and does nothing", () => {
    test.each([
      ["signed with another secret", () => signedRequest(hedgehugCommand(publicChannel), { secret: "someone-elses-secret" })],
      ["unsigned", async () => ({ method: "POST", body: hedgehugCommand(publicChannel) })],
      ["with a body changed after signing", async () => ({ ...(await signedRequest(hedgehugCommand(publicChannel))), body: hedgehugCommand({ channel_id: "C9", channel_name: "general" }) })],
      ["signed more than 5 minutes ago", () => signedRequest(hedgehugCommand(publicChannel), { signedAt: minutesBefore(now, 6) })],
    ])("%s", async (_, request) => {
      const t = testBackend();

      const response = await t.fetch("/slack/commands", await request());
      await settle(t);

      expect(response.status).toBe(401);
      expect(slack.calls).toEqual([]);
    });
  });
});

const publicChannel: Conversation = { channel_id: "C1", channel_name: "general" };

function hedgehugCommand(conversation: Conversation) {
  return slashCommand(conversation);
}

async function runCommand(t: Backend, body: string) {
  const response = await postSigned(t, body);
  expect(response.status).toBe(200);
  await settle(t);
}

async function postSigned(t: Backend, body: string) {
  return t.fetch("/slack/commands", await signedRequest(body));
}

function signedRequest(body: string, options: SigningOptions = {}) {
  return signedSlackRequest(body, { contentType: "application/x-www-form-urlencoded", ...options });
}

function minutesBefore(date: Date, minutes: number) {
  return new Date(date.getTime() - minutes * 60 * 1000);
}

type SlackCall = { url: string; authorization: string | null; body: Record<string, unknown> };
type FakeSlack = ReturnType<typeof fakeSlack>;

function fakeSlack() {
  const calls: SlackCall[] = [];
  let joinAnswer: unknown = { ok: false, error: "not_stubbed" };
  let infoAnswer: unknown = { ok: true, channel: { id: "C1", name: "general" } };
  return {
    calls,
    answerJoin(answer: unknown) {
      joinAnswer = answer;
    },
    answerInfo(answer: unknown) {
      infoAnswer = answer;
    },
    privateReplies() {
      return calls.filter((call) => call.url === responseUrl && call.body.response_type === "ephemeral").map((call) => call.body.text);
    },
    fetch: vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      const headers = new Headers(init?.headers);
      calls.push({ url, authorization: headers.get("authorization"), body: init?.body === undefined ? null : JSON.parse(String(init.body)) });
      if (url.startsWith("https://slack.com/api/conversations.info?")) return Response.json(infoAnswer);
      if (url === "https://slack.com/api/conversations.join") return Response.json(joinAnswer);
      if (url === responseUrl) return new Response("ok");
      return new Response("unexpected Slack call", { status: 404 });
    }),
  };
}
