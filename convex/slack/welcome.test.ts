import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack, httpStatus, networkFailure, rateLimitedFor, slackError } from "../../testing/fakeSlack";
import { post, settle, settleUntil, testBackend, type Backend } from "../../testing/slackBackend";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { emoji, mention, messageEvent, section, type MessageOptions } from "../../testing/slackMessages";
import { internal } from "../_generated/api";

const now = new Date("2026-10-13T10:00:00Z");

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
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("R42 R43: the welcome message", () => {
  test("a member's first Given award welcomes the giver and the recipient by DM with how HedgeHug works", async () => {
    const t = testBackend();

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(slack.callsTo("chat.postMessage")).toEqual([
      { channel: "U_ALICE", text: welcomeText({ emoji: ":taco:", base: 3 }) },
      { channel: "U_BOB", text: welcomeText({ emoji: ":taco:", base: 3 }) },
    ]);
  });

  test("a member is welcomed at most once, whatever Slack redelivers and whichever awards follow", async () => {
    const t = testBackend();
    const firstKudos = messageEvent([section(mention("U_BOB"), emoji("taco"))], { user: "U_ALICE", ts: "1760349600.000100" });

    await t.fetch("/slack/events", await signedRequest(firstKudos));
    await t.fetch("/slack/events", await signedRequest(firstKudos));
    await settle(t);
    await giveKudos(t, "U_BOB", "U_ALICE", { ts: "1760349601.000100" });
    await giveKudos(t, "U_ALICE", "U_CAROL", { ts: "1760349602.000100" });
    await giveKudos(t, "U_CAROL", "U_BOB", { ts: "1760349603.000100" });

    expect(attemptsPerUser()).toEqual({ U_ALICE: 1, U_BOB: 1, U_CAROL: 1 });
  });

  test("R46: the welcome names the workspace emoji and base in force", async () => {
    const t = testBackend();
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "pizza", baseAllowance: 5 }));

    await giveKudos(t, "U_ALICE", "U_BOB", {}, ["pizza"]);

    expect(slack.callsTo("chat.postMessage")[0]?.text).toBe(welcomeText({ emoji: ":pizza:", base: 5 }));
  });
});

function welcomeText({ emoji, base }: { emoji: string; base: number }) {
  return [
    `👋 Welcome to HedgeHug! Thank a teammate by mentioning them and adding ${emoji} to your message in any channel I'm in. Each ${emoji} gives everyone you mention 1 kudos.`,
    `You can give ${base} kudos a day, and they refill at midnight in your time zone.`,
    "To add me to a channel, type `/hedgehug` there.",
    "<slack://app?team=T1&id=A_KUDOS&tab=home|Open App Home>",
  ].join("\n");
}

describe("R44 R34: delivering the welcome message", () => {
  test("a welcome that keeps failing is tried 3 times and never again, and the award and the allowance stand", async () => {
    const t = testBackend();
    const failures = [networkFailure, httpStatus(500), slackError("internal_error"), networkFailure, httpStatus(500), slackError("internal_error")];
    slack.answering("chat.postMessage", ...failures);

    await giveKudos(t, "U_ALICE", "U_BOB", { ts: slackTs(now) });
    await giveKudos(t, "U_ALICE", "U_CAROL", { ts: slackTs(now, 1) }, ["taco", "taco"]);

    expect(attemptsPerUser()).toEqual({ U_ALICE: 3, U_BOB: 3, U_CAROL: 1 });
    expect(await homeFacts(t, "U_ALICE")).toMatchObject({ left: 0, given: 3, received: 0 });
    expect(await homeFacts(t, "U_BOB")).toMatchObject({ given: 0, received: 1 });
    expect(await homeFacts(t, "U_CAROL")).toMatchObject({ given: 0, received: 2 });
  });

  test("a rate-limited welcome is tried again after Slack's Retry-After, and then not again once it arrived", async () => {
    const t = testBackend();
    slack.answering("chat.postMessage", rateLimitedFor(30), rateLimitedFor(30));

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(attemptsPerUser()).toEqual({ U_ALICE: 2, U_BOB: 2 });
    for (const user of ["U_ALICE", "U_BOB"]) {
      const [first, retry] = slack.timesOf("chat.postMessage", (args) => args.channel === user);
      expect(retry! - first!).toBeGreaterThanOrEqual(30_000);
    }
  });

  test("R35: a rate limit on one welcome holds the next welcome until Slack's Retry-After", async () => {
    const t = testBackend();
    slack.answering("chat.postMessage", rateLimitedFor(30));
    await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: "U_ALICE", ts: slackTs(now) });
    await settleUntil(t, new Date(now.getTime() + 10_000));

    await post(t, [section(mention("U_ALICE"), emoji("taco"))], { user: "U_CAROL", ts: slackTs(now, 10) });
    await settleUntil(t, new Date(now.getTime() + 60_000));

    const [rateLimitedAt] = slack.timesOf("chat.postMessage");
    const [carolWelcomedAt] = slack.timesOf("chat.postMessage", (args) => args.channel === "U_CAROL");
    expect(carolWelcomedAt! - rateLimitedAt!).toBeGreaterThanOrEqual(30_000);
  });

  test("R35: a welcome Slack can't deliver to that person stops for good", async () => {
    const t = testBackend();
    slack.answering("chat.postMessage", slackError("channel_not_found"));

    await giveKudos(t, "U_ALICE", "U_BOB");

    expect(attemptsPerUser()).toEqual({ U_ALICE: 1, U_BOB: 1 });
  });
});


async function giveKudos(t: Backend, giver: string, recipient: string, options: MessageOptions = {}, kudosEmoji = ["taco"]) {
  const blocks = [section(mention(recipient), ...kudosEmoji.map((name) => emoji(name)))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ...options })));
  await settle(t);
}

function homeFacts(t: Backend, user: string) {
  return t.query(internal.engine.home.homeOf, { workspace: "T1", user });
}

function attemptsPerUser() {
  const attempts: Record<string, number> = {};
  const welcomes = slack.callsTo("chat.postMessage").filter(({ text }) => String(text).startsWith("👋 Welcome to HedgeHug!"));
  for (const { channel } of welcomes) attempts[String(channel)] = (attempts[String(channel)] ?? 0) + 1;
  return attempts;
}

function slackTs(at: Date, secondsLater = 0) {
  return `${Math.floor(at.getTime() / 1000) + secondsLater}.000100`;
}
