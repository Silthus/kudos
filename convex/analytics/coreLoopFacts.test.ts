import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, postHogHost, projectToken, routedFetch, type CapturedEvent } from "../../testing/fakePostHog";
import { FakeSlack, httpStatus, slackError, type ScriptedAnswer } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { edit, memberChanged, post, settle, settleInTimeOrder, settleUntil, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, messageEvent, section, slashCommand, slashCommandResponseUrl, text, type Conversation } from "../../testing/slackMessages";
import { recordUsage } from "./usage";

vi.mock("./usage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./usage")>();
  return { ...actual, recordUsage: vi.fn(actual.recordUsage) };
});

const now = new Date("2026-10-13T10:00:00Z");
const postedAt = new Date(1760349600_000);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const shared = { environment: "sandbox", workspace_key: expect.stringMatching(uuid), taxonomy_version: 1 };

let slack: FakeSlack;
let postHog: FakePostHog;
let actualRecordUsage: typeof recordUsage;

beforeAll(async () => {
  actualRecordUsage = (await vi.importActual<typeof import("./usage")>("./usage")).recordUsage;
});

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
  vi.stubEnv("KUDOS_ENVIRONMENT", "sandbox");
  vi.stubEnv("POSTHOG_HOST", postHogHost);
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
});

afterEach(() => {
  vi.mocked(recordUsage).mockImplementation(actualRecordUsage);
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const fourTacosToBob = [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"), emoji("taco"), emoji("taco"))];
const oneTacoToBob = [section(text("thanks "), mention("U_BOB"), emoji("taco"))];
const tacoToMyself = [section(text("note to self "), mention("U_ALICE"), emoji("taco"))];

describe("O3: attempt failed", () => {
  test("an Over allowance message sends attempt failed on the giver at the spend instant, with exactly O3's properties", async () => {
    const t = testBackend();

    await post(t, fourTacosToBob);
    await settle(t);

    expect(withoutWelcomes(coreLoopEvents()).map(shapeOf)).toEqual([
      {
        event: "attempt failed",
        timestamp: postedAt.toISOString(),
        properties: {
          ...shared,
          outcome: "over allowance",
          recipients: 1,
          kudos_per_recipient: 4,
          kudos_total: 4,
          skipped_mentions: 0,
          retry: false,
          in_thread: false,
          daily_allowance_left: 3,
        },
      },
    ]);
  });

  test("an Invalid message sends attempt failed with the outcome invalid", async () => {
    const t = testBackend();

    await post(t, tacoToMyself, { threadTs: "1760349000.000100" });
    await settle(t);

    expect(coreLoopEvents().map(shapeOf)).toEqual([
      {
        event: "attempt failed",
        timestamp: postedAt.toISOString(),
        properties: {
          ...shared,
          outcome: "invalid",
          recipients: 0,
          kudos_per_recipient: 1,
          kudos_total: 0,
          skipped_mentions: 1,
          retry: false,
          in_thread: true,
          daily_allowance_left: 3,
        },
      },
    ]);
  });

  test("O4: editing the Over allowance message into one that gives sends kudos given with retry, after the failure", async () => {
    const t = testBackend();
    const editedAt = new Date(now.getTime() + 60_000);

    await post(t, fourTacosToBob);
    await settleInTimeOrder(t);
    vi.setSystemTime(editedAt);
    await edit(t, oneTacoToBob, { editedTs: "1760349660.000100" });
    await settleInTimeOrder(t);

    const events = withoutWelcomes(coreLoopEvents());
    expect(events.map((event) => [event.event, event.properties.retry])).toEqual([
      ["attempt failed", false],
      ["kudos given", true],
      ["kudos received", true],
      ["packs earned", undefined],
      ["person collected", undefined],
      ["person collected", undefined],
    ]);
    expect(events[0]!.distinct_id).toBe(events[1]!.distinct_id);
  });

  test("O4: redelivering the Over allowance message sends attempt failed once", async () => {
    const t = testBackend();
    const body = messageEvent(fourTacosToBob);

    await t.fetch("/slack/events", await signedRequest(body));
    await t.fetch("/slack/events", await signedRequest(body));
    await settle(t);

    expect(coreLoopEvents().map((event) => event.event)).toEqual(["attempt failed"]);
  });
});

describe("O3: attempts that send nothing", () => {
  test("an ordinary message and a withdrawn attempt send nothing", async () => {
    const t = testBackend();

    await post(t, [section(text("lunch at noon? "), mention("U_BOB"))], { ts: "1760349500.000100" });
    await post(t, fourTacosToBob);
    await settle(t);
    await edit(t, [section(text("thanks "), mention("U_BOB"))]);
    await settle(t);

    expect(coreLoopEvents().map((event) => event.event)).toEqual(["attempt failed"]);
  });

  test("a message waiting on the directory sends nothing, nor does it once abandoned", async () => {
    const t = testBackend();
    slack = new FakeSlack().withMember("U_ALICE");
    slack.answering("users.info", ...Array.from({ length: 12 }, () => httpStatus(500)));
    vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));

    await post(t, oneTacoToBob);
    await settleUntil(t, new Date(now.getTime() + 2 * 60_000));
    const whileWaiting = postHog.requests.length;
    await settle(t);

    const [row] = await t.run((ctx) => ctx.db.query("kudosMessages").collect());
    expect(row?.state).toBe("abandoned");
    expect([whileWaiting, postHog.requests.length]).toEqual([0, 0]);
  });
});

describe("O3 R42: member welcomed", () => {
  test("a member's first Given award sends member welcomed once, as giver or as recipient, on that member", async () => {
    const t = testBackend();
    const thanksBobAndCarol = messageEvent([section(mention("U_BOB"), mention("U_CAROL"), emoji("taco"))]);

    await t.fetch("/slack/events", await signedRequest(thanksBobAndCarol));
    await t.fetch("/slack/events", await signedRequest(thanksBobAndCarol));
    await settle(t);
    await post(t, [section(mention("U_ALICE"), emoji("taco"))], { user: "U_BOB", ts: "1760349601.000100" });
    await settle(t);

    const events = coreLoopEvents();
    const [given, toBob, toCarol] = events.filter((event) => event.event !== "member welcomed");
    expect(events.filter((event) => event.event === "member welcomed").map(({ distinct_id, timestamp, properties }) => ({ distinct_id, timestamp, properties }))).toEqual([
      { distinct_id: given!.distinct_id, timestamp: now.toISOString(), properties: { ...shared, as: "giver" } },
      { distinct_id: toBob!.distinct_id, timestamp: now.toISOString(), properties: { ...shared, as: "recipient" } },
      { distinct_id: toCarol!.distinct_id, timestamp: now.toISOString(), properties: { ...shared, as: "recipient" } },
    ]);
  });
});

describe("O3 R45: app home opened", () => {
  test("a member opening App Home sends app home opened on them at the event's time, with only O2's properties", async () => {
    const t = testBackend();
    const openedAt = new Date(now.getTime() - 2_000);
    await memberChanged(t, "team_join", { id: "U_BOB" });

    await t.fetch("/slack/events", await signedRequest(appHomeOpened("U_BOB", { eventTime: openedAt })));
    await settle(t);

    expect(coreLoopEvents().map(shapeOf)).toEqual([{ event: "app home opened", timestamp: openedAt.toISOString(), properties: shared }]);
  });

  test("O4 R49: a redelivered app_home_opened and a retried views.publish send nothing more", async () => {
    const t = testBackend();
    slack.answering("views.publish", httpStatus(500));
    await memberChanged(t, "team_join", { id: "U_BOB" });
    const opened = appHomeOpened("U_BOB");

    await t.fetch("/slack/events", await signedRequest(opened));
    await t.fetch("/slack/events", await signedRequest(opened));
    await settle(t);

    expect(slack.callsTo("views.publish")).toHaveLength(2);
    expect(coreLoopEvents().map((event) => event.event)).toEqual(["app home opened"]);
  });

  test("a member the directory doesn't know yet sends app home opened once, at the event's time, through a failed lookup and a failed publish", async () => {
    const t = testBackend();
    const openedAt = new Date(now.getTime() - 2_000);
    slack.answering("users.info", httpStatus(500)).answering("views.publish", httpStatus(500));

    await t.fetch("/slack/events", await signedRequest(appHomeOpened("U_BOB", { eventTime: openedAt })));
    await settle(t);

    expect(slack.callsTo("views.publish")).toHaveLength(2);
    expect(coreLoopEvents().map(shapeOf)).toEqual([{ event: "app home opened", timestamp: openedAt.toISOString(), properties: shared }]);
  });

  test("O15 O20: an opening whose recording fails still publishes App Home, logs a fixed code and reports no exception", async () => {
    const t = testBackend();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(recordUsage).mockRejectedValue(new Error("recording failed"));

    await t.fetch("/slack/events", await signedRequest(appHomeOpened("U_BOB")));
    await settle(t);

    expect(slack.callsTo("views.publish")).toHaveLength(1);
    expect(console.error).toHaveBeenCalledWith("analytics.usage_not_recorded", { error: "Error" });
    expect(coreLoopEvents()).toEqual([]);
  });

  test("R47: someone the directory doesn't know, who turns out not to be a member, sends nothing", async () => {
    const t = testBackend();
    slack.withMember("U_GONE", { deleted: true });

    await t.fetch("/slack/events", await signedRequest(appHomeOpened("U_GONE")));
    await settle(t);

    expect(slack.callsTo("views.publish")).toHaveLength(1);
    expect(postHog.requests).toEqual([]);
  });

  test("R47: someone who isn't a member opening App Home sends nothing", async () => {
    const t = testBackend();
    slack.withMember("U_GONE", { deleted: true });
    await memberChanged(t, "team_join", { id: "U_GONE", deleted: true });

    await t.fetch("/slack/events", await signedRequest(appHomeOpened("U_GONE")));
    await settle(t);

    expect(slack.callsTo("views.publish")).toHaveLength(1);
    expect(postHog.requests).toEqual([]);
  });
});

describe("O3 O5: command used", () => {
  const publicChannel: Conversation = { channel_id: "C1", channel_name: "general" };
  const responseUrlMethod = new URL(slashCommandResponseUrl).pathname.split("/").pop()!;

  test.each<[string, Conversation, ScriptedAnswer, string]>([
    ["joined", publicChannel, () => Response.json({ ok: true, channel: { id: "C1" } }), "joined"],
    ["already in", publicChannel, () => Response.json({ ok: true, warning: "already_in_channel" }), "already in"],
    ["private channel", { channel_id: "C2", channel_name: "privategroup" }, slackError("channel_not_found"), "private channel"],
    ["direct message", { channel_id: "D1", channel_name: "directmessage" }, slackError("method_not_supported_for_channel_type"), "direct message"],
  ])("/hedgehug that ends %s sends command used with that result, at the time the command arrived", async (_, conversation, joinAnswer, result) => {
    const t = testBackend();
    slack.answering("conversations.join", joinAnswer);
    await memberChanged(t, "team_join", { id: "U1" });

    await runCommand(t, slashCommand(conversation));

    expect(coreLoopEvents().map(shapeOf)).toEqual([
      { event: "command used", timestamp: now.toISOString(), properties: { ...shared, command: "hedgehug", alias: false, result } },
    ]);
  });

  test("/kudos sends command used as the alias, on the member who typed it", async () => {
    const t = testBackend();
    slack.answering("conversations.join", () => Response.json({ ok: true }));
    await memberChanged(t, "team_join", { id: "U1" });
    await t.fetch("/slack/events", await signedRequest(appHomeOpened("U1")));
    await settle(t);

    await runCommand(t, slashCommand(publicChannel, { command: "/kudos" }));

    const [opened, used] = coreLoopEvents();
    expect(used).toMatchObject({ event: "command used", distinct_id: opened!.distinct_id, properties: { alias: true, result: "joined" } });
  });

  test("a member the directory doesn't know yet sends command used", async () => {
    const t = testBackend();
    slack.answering("conversations.join", () => Response.json({ ok: true }));

    await runCommand(t, slashCommand(publicChannel, { user: "U_ALICE" }));

    expect(coreLoopEvents().map(shapeOf)).toEqual([
      { event: "command used", timestamp: now.toISOString(), properties: { ...shared, command: "hedgehug", alias: false, result: "joined" } },
    ]);
  });

  test("a member the directory doesn't know yet sends command used once Slack's lookup recovers", async () => {
    const t = testBackend();
    slack.answering("conversations.join", () => Response.json({ ok: true })).answering("users.info", httpStatus(500));

    await runCommand(t, slashCommand(publicChannel, { user: "U_ALICE" }));

    expect(coreLoopEvents().map(shapeOf)).toEqual([
      { event: "command used", timestamp: now.toISOString(), properties: { ...shared, command: "hedgehug", alias: false, result: "joined" } },
    ]);
  });

  test("a command whose reply Slack refuses still sends command used", async () => {
    const t = testBackend();
    slack.answering("conversations.join", () => Response.json({ ok: true })).answering(responseUrlMethod, httpStatus(503));
    await memberChanged(t, "team_join", { id: "U1" });

    await runCommand(t, slashCommand(publicChannel));

    expect(coreLoopEvents().filter((event) => event.event !== "$exception").map(shapeOf)).toEqual([
      { event: "command used", timestamp: now.toISOString(), properties: { ...shared, command: "hedgehug", alias: false, result: "joined" } },
    ]);
  });

  test("O15 O20: a command whose recording fails still gets its reply, logs a fixed code and reports no exception", async () => {
    const t = testBackend();
    vi.spyOn(console, "error").mockImplementation(() => {});
    slack.answering("conversations.join", () => Response.json({ ok: true }));
    await memberChanged(t, "team_join", { id: "U1" });
    vi.mocked(recordUsage).mockRejectedValue(new Error("recording failed"));

    await runCommand(t, slashCommand(publicChannel));

    expect(slack.callsTo(responseUrlMethod)).toEqual([
      { response_type: "ephemeral", text: "I'm in now. Mention teammates with a kudos emoji here and I'll pass the kudos on." },
    ]);
    expect(console.error).toHaveBeenCalledWith("analytics.usage_not_recorded", { error: "Error" });
    expect(coreLoopEvents()).toEqual([]);
  });

  test("a non-member's command sends nothing", async () => {
    const t = testBackend();
    slack.answering("conversations.join", () => Response.json({ ok: true }));
    slack.withMember("U_GONE", { deleted: true });

    await runCommand(t, slashCommand(publicChannel, { user: "U_GONE" }));

    expect(slack.callsTo("conversations.join")).toHaveLength(1);
    expect(postHog.requests).toEqual([]);
  });
});

function shapeOf({ event, timestamp, properties }: CapturedEvent) {
  return { event, timestamp, properties };
}

function withoutWelcomes(events: CapturedEvent[]) {
  return events.filter((event) => event.event !== "member welcomed");
}

async function runCommand(t: Backend, body: string) {
  const response = await t.fetch("/slack/commands", await signedRequest(body, { contentType: "application/x-www-form-urlencoded" }));
  expect(response.status).toBe(200);
  await settle(t);
}

function coreLoopEvents() {
  return postHog.productEvents().filter((event) => event.event !== "$feature_flag_called");
}
