import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { signingSecret } from "../../testing/signedSlack";
import { post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";

const now = new Date("2026-10-13T10:00:00Z");
const postedTs = "1760349600.000100";

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

describe("P64: the public level notice", () => {
  test("a level reached through a kudos message is celebrated in that message's thread", async () => {
    const t = testBackend();

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.messagesIn("C1")).toEqual([{ channel: "C1", ts: expect.any(String), threadTs: postedTs, text: "🎉 <@U_ALICE> reached level 2." }]);
  });

  test("two members levelling up from one message share the one reply", async () => {
    const t = testBackend();
    await withXp(t, "U_BOB", 15);

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "C1")).toHaveLength(1);
    expect(slack.messagesIn("C1").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 2.\n🎉 <@U_BOB> reached level 2."]);
  });

  test("D18: a second level-up under the same message edits the one reply in place", async () => {
    const t = testBackend();
    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);
    const [notice] = slack.messagesIn("C1");

    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_ALICE", 3) });
    await settle(t);

    expect(slack.messagesIn("C1")).toEqual([{ ...notice, text: "🎉 <@U_ALICE> reached level 3." }]);
    expect(slack.callsTo("chat.update")).toEqual([{ channel: "C1", ts: notice!.ts, text: "🎉 <@U_ALICE> reached level 3." }]);
  });

  test("D18: a level reached while the reply is being posted is added by an edit, never by a second post", async () => {
    const t = testBackend();
    await memberOf(t, "U_BOB");
    slack.holdingBack("chat.postMessage", "C1", async () => {
      await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    });

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "C1")).toHaveLength(1);
    expect(slack.messagesIn("C1").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 2.\n🎉 <@U_BOB> reached level 2."]);
  });
});

async function memberOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const existing = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return existing?._id ?? ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: "UTC", asOf: now.getTime() });
  });
}

async function withXp(t: Backend, user: string, xp: number) {
  const member = await memberOf(t, user);
  await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp, pointsSpent: 0 }));
}

async function levelReached(t: Backend, user: string, level: number) {
  return {
    type: "levelReached" as const,
    workspace: "T1",
    member: await memberOf(t, user),
    level,
    skillPointsGained: 1,
    message: { workspace: "T1", conversation: "C1", message: postedTs },
    at: now.getTime(),
  };
}
