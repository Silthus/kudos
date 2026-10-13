import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { codeBlock, emoji, mention, messageEvent, quote, section, text, type MessageOptions, type RichElement } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const now = new Date("2026-10-13T10:00:00Z");
const postedTs = "1760349600.000100";

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  vi.stubGlobal("fetch", slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a kudos message in a channel the app is in", () => {
  test("R4 R8 R18 R32: thanks @Bob :taco: gives Bob 1 kudos and adds the :taco: reaction", async () => {
    const t = testBackend();

    const response = await post(t, [section(text("thanks "), mention("U_BOB"), text(" "), emoji("taco"))]);
    await settle(t);

    expect(response.status).toBe(200);
    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(slack.reactionsOn("C1", postedTs)).toEqual(["taco"]);
  });

  test("R28: the directory fills from users.info on a miss, one lookup per person, then the next message needs none", async () => {
    const t = testBackend();

    await post(t, [section(mention("U_BOB"), emoji("taco"))], { ts: "1760349600.000100" });
    await settle(t);
    await post(t, [section(mention("U_BOB"), emoji("taco"))], { ts: "1760349601.000100" });
    await settle(t);

    expect(slack.callsTo("users.info").map((args) => args.user).sort()).toEqual(["U_ALICE", "U_BOB"]);
    expect(await kudosReceived(t, "U_BOB")).toBe(2);
  });

  test("R32: a repeated indicator delivery leaves exactly one :taco: reaction", async () => {
    const t = testBackend();
    await post(t, [section(mention("U_BOB"), emoji("taco"))]);
    await settle(t);

    await t.action(internal.slack.delivery.deliverIndicator, { workspace: "T1", conversation: "C1", message: postedTs });

    expect(slack.reactionsOn("C1", postedTs)).toEqual(["taco"]);
  });

  test("R32: the indicator is the first kudos emoji the giver used", async () => {
    const t = testBackend();
    await setWorkspaceEmoji(t, "pizza");

    await post(t, [section(mention("U_BOB"), emoji("pizza"), emoji("pizza"))]);
    await settle(t);

    expect(slack.reactionsOn("C1", postedTs)).toEqual(["pizza"]);
    expect(await kudosReceived(t, "U_BOB")).toBe(2);
  });
});

describe("R1 R2: only countable content makes a kudos message", () => {
  test.each<[string, RichElement[], MessageOptions?]>([
    ["the emoji inside a quote", [section(mention("U_BOB")), quote(emoji("taco"))]],
    ["the mention inside a code block", [codeBlock(mention("U_BOB")), section(emoji("taco"))]],
    ["the emoji struck through", [section(mention("U_BOB"), emoji("taco", { strike: true }))]],
    ["the emoji as inline code", [section(mention("U_BOB"), emoji("taco", { code: true }))]],
    ["the mention struck through", [section(mention("U_BOB", { strike: true }), emoji("taco"))]],
    ["the emoji in an attachment", [section(mention("U_BOB"))], { extra: { attachments: [{ text: ":taco:", blocks: [{ type: "rich_text", elements: [section(emoji("taco"))] }] }] } }],
    ["a forwarded message", [section(text("look"))], { extra: { attachments: [{ is_share: true, blocks: [{ type: "rich_text", elements: [section(mention("U_BOB"), emoji("taco"))] }] }] } }],
    ["no mention", [section(text("thanks "), emoji("taco"))]],
    ["no emoji", [section(text("thanks "), mention("U_BOB"))]],
    ["an emoji that is not a kudos emoji", [section(mention("U_BOB"), emoji("pizza"))]],
  ])("%s is ordinary chat: no reaction, no lookup, nothing stored", async (_, blocks, options) => {
    const t = testBackend();

    const response = await post(t, blocks, options);
    await settle(t);

    expect(response.status).toBe(200);
    expect(slack.calls).toEqual([]);
    expect(await everythingStored(t)).toEqual([]);
  });

  test("R3: after the workspace emoji changes, the old one is ordinary chat", async () => {
    const t = testBackend();
    await setWorkspaceEmoji(t, "pizza");

    await post(t, [section(mention("U_BOB"), emoji("taco"))]);
    await settle(t);

    expect(slack.callsTo("reactions.add")).toEqual([]);
    expect(await kudosReceived(t, "U_BOB")).toBe(0);
  });
});

describe("R5 R6 R7: whose messages count, and where", () => {
  test.each<[string, MessageOptions]>([
    ["a bot's message", { botId: "B1" }],
    ["a bot_message", { subtype: "bot_message", botId: "B1" }],
    ["a DM", { channelType: "im", channel: "D1" }],
    ["a group DM", { channelType: "mpim", channel: "G1" }],
  ])("%s is ignored", async (_, options) => {
    const t = testBackend();

    await post(t, [section(mention("U_BOB"), emoji("taco"))], options);
    await settle(t);

    expect(slack.calls).toEqual([]);
    expect(await kudosReceived(t, "U_BOB")).toBe(0);
  });

  test("R5: a message by a person the directory knows as a bot is ignored", async () => {
    const t = testBackend();
    slack.withMember("U_HELPER", { is_bot: true });

    await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: "U_HELPER" });
    await settle(t);

    expect(slack.callsTo("reactions.add")).toEqual([]);
    expect(await kudosReceived(t, "U_BOB")).toBe(0);
  });

  test("R6: a private channel the app is in counts", async () => {
    const t = testBackend();

    await post(t, [section(mention("U_BOB"), emoji("taco"))], { channelType: "group", channel: "G2" });
    await settle(t);

    expect(slack.reactionsOn("G2", postedTs)).toEqual(["taco"]);
    expect(await kudosReceived(t, "U_BOB")).toBe(1);
  });

  test("R6: a thread reply counts", async () => {
    const t = testBackend();

    await post(t, [section(mention("U_BOB"), emoji("taco"))], { threadTs: "1760349000.000100" });
    await settle(t);

    expect(slack.reactionsOn("C1", postedTs)).toEqual(["taco"]);
    expect(await kudosReceived(t, "U_BOB")).toBe(1);
  });

  test("R7: a thread reply also sent to the channel gives once, even when Slack delivers it twice", async () => {
    const t = testBackend();
    const broadcast = { threadTs: "1760349000.000100", subtype: "thread_broadcast" };

    await post(t, [section(mention("U_BOB"), emoji("taco"))], broadcast);
    await post(t, [section(mention("U_BOB"), emoji("taco"))], broadcast);
    await settle(t);

    expect(slack.reactionsOn("C1", postedTs)).toEqual(["taco"]);
    expect(await kudosReceived(t, "U_BOB")).toBe(1);
  });
});

describe("R12 R13: the allowance day", () => {
  test("a message just before the giver's local midnight spends from that day, even when it is evaluated after midnight", async () => {
    const t = testBackend();
    slack.withMember("U_ALICE", { tz: "America/Los_Angeles" });
    const beforeMidnight = new Date("2026-10-13T06:59:00Z");
    const afterMidnight = new Date("2026-10-13T07:05:00Z");
    vi.setSystemTime(beforeMidnight);

    await post(t, [section(mention("U_BOB"), emoji("taco"), emoji("taco"), emoji("taco"))], { ts: slackTs(beforeMidnight) });
    vi.setSystemTime(afterMidnight);
    await settle(t);
    await post(t, [section(mention("U_BOB"), emoji("taco"), emoji("taco"), emoji("taco"))], { ts: slackTs(afterMidnight) });
    await settle(t);

    expect(slack.reactionsOn("C1", slackTs(beforeMidnight))).toEqual(["taco"]);
    expect(slack.reactionsOn("C1", slackTs(afterMidnight))).toEqual(["taco"]);
    expect(await kudosReceived(t, "U_BOB")).toBe(6);
  });
});

test("R51: no message text in any table or in any scheduled function's arguments", async () => {
  const t = testBackend();
  const secretNote = "the deploy rescue on friday";

  await post(t, [section(text(secretNote), mention("U_BOB"), emoji("taco"))]);
  await settle(t);

  expect(await kudosReceived(t, "U_BOB")).toBe(1);
  const everything = [...(await everythingStored(t)), ...(await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()))];
  expect(stringify(everything)).not.toContain(secretNote);
  expect(stringify(everything)).not.toContain("thanks for the help");
});

type Backend = ReturnType<typeof testBackend>;

function testBackend() {
  return convexTest(schema, modules);
}

async function post(t: Backend, blocks: RichElement[], options: MessageOptions = {}) {
  return t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { ts: postedTs, ...options })));
}

async function settle(t: Backend) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

async function setWorkspaceEmoji(t: Backend, kudosEmoji: string) {
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji }));
}

async function kudosReceived(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    if (member === null) return 0;
    const awards = await ctx.db
      .query("awards")
      .withIndex("by_recipient", (q) => q.eq("recipient", member._id))
      .collect();
    return awards.reduce((sum, award) => sum + award.kudos, 0);
  });
}

async function everythingStored(t: Backend) {
  return t.run(async (ctx) => {
    const tables = await Promise.all(Object.keys(schema.tables).map((table) => ctx.db.query(table as keyof typeof schema.tables).collect()));
    return tables.flat();
  });
}

function slackTs(at: Date) {
  return `${Math.floor(at.getTime() / 1000)}.000100`;
}

function stringify(value: unknown) {
  return JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item));
}
