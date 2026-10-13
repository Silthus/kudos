import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { FakeSlack, landsButTimesOut, slackError, type ScriptedAnswer } from "../../testing/fakeSlack";
import { signingSecret } from "../../testing/signedSlack";
import { everythingStored, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { LevelReachedEvent } from "../bus/events";

const now = new Date("2026-10-13T10:00:00Z");
const postedTs = "1760349600.000100";

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  flagsOnForEveryone(slack.fetch, "xp-levels");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P64: the public level notice", () => {
  test("a level reached through a kudos message is celebrated in that message's thread", async () => {
    const t = await flagsLoaded(testBackend());

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.messagesIn("C1")).toEqual([{ channel: "C1", ts: expect.any(String), threadTs: postedTs, text: "🎉 <@U_ALICE> reached level 2." }]);
  });

  test("R45: a recipient's notice states only their progress, never the giver or the thank-you, and no text is stored", async () => {
    const t = await flagsLoaded(testBackend());
    await withXp(t, "U_BOB", 15);

    await post(t, [section(text("thanks for rescuing the deploy "), mention("U_BOB"), emoji("taco"))]);
    await settle(t);

    expect(slack.messagesIn("C1").map((message) => message.text)).toEqual(["🎉 <@U_BOB> reached level 2."]);
    const stored = JSON.stringify(await everythingStored(t), (_, value) => (typeof value === "bigint" ? String(value) : value));
    expect(stored).not.toContain("rescuing");
  });
});

describe("D18: the one public reply", () => {
  test("two members levelling up from one message share the one reply", async () => {
    const t = await flagsLoaded(testBackend());
    await withXp(t, "U_BOB", 15);

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "C1")).toHaveLength(1);
    expect(slack.messagesIn("C1").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 2.\n🎉 <@U_BOB> reached level 2."]);
  });

  test("a second level-up under the same message edits the one reply in place", async () => {
    const t = await flagsLoaded(testBackend());
    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);
    const [notice] = slack.messagesIn("C1");

    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_ALICE", 3) });
    await settle(t);

    expect(slack.messagesIn("C1")).toEqual([{ ...notice, text: "🎉 <@U_ALICE> reached level 3." }]);
    expect(slack.callsTo("chat.update")).toEqual([{ channel: "C1", ts: notice!.ts, text: "🎉 <@U_ALICE> reached level 3." }]);
  });

  test("a level reached while the reply is being posted is added by an edit, never by a second post", async () => {
    const t = await flagsLoaded(testBackend());
    await memberOf(t, "U_BOB");
    slack.holdingBack("chat.postMessage", "C1", async () => {
      await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    });

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "C1")).toHaveLength(1);
    expect(slack.messagesIn("C1").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 2.\n🎉 <@U_BOB> reached level 2."]);
  });

  test("a post whose answer is lost is never posted again", async () => {
    const t = await flagsLoaded(testBackend());
    await onlyPublicRepliesPosted(t, "U_ALICE", "U_BOB");
    slack.answering("chat.postMessage", landsButTimesOut);

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);
    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    await settle(t);

    expect(slack.messagesIn("C1").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 2."]);
  });

  test("a post that fails after Slack accepted it is never posted again", async () => {
    const t = await flagsLoaded(testBackend());
    await onlyPublicRepliesPosted(t, "U_ALICE", "U_BOB");
    slack.answering("chat.postMessage", acceptedButAnsweredWithoutTs);

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.messagesIn("C1").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 2."]);
  });
});

describe("P64: routing", () => {
  test("a kudos message posted in a thread gets its notice in that thread", async () => {
    const t = await flagsLoaded(testBackend());
    const threadRoot = "1760349000.000100";

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))], { threadTs: threadRoot });
    await settle(t);

    expect(slack.messagesIn("C1")).toEqual([{ channel: "C1", ts: expect.any(String), threadTs: threadRoot, text: "🎉 <@U_ALICE> reached level 2." }]);
  });

  test("with an announcement channel set, the notice goes there instead and the thread gets nothing", async () => {
    const t = await flagsLoaded(testBackend());
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", announcementChannel: "C_NEWS" }));

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.messagesIn("C_NEWS")).toEqual([{ channel: "C_NEWS", ts: expect.any(String), text: "🎉 <@U_ALICE> reached level 2." }]);
    expect(slack.messagesIn("C1")).toEqual([]);
  });
});

describe("P64: a level reached through a reward record", () => {
  const saysWhy = "thanks for untangling the release notes today";

  beforeEach(() => flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "quests"));

  test("with an announcement channel set, the level 2 that first-thanks reaches is celebrated there once, and nowhere else", async () => {
    const t = await journeyWorkspace({ announcementChannel: "C_NEWS" });

    await post(t, [section(mention("U_BOB"), text(` ${saysWhy} `), emoji("taco"))]);
    await settle(t);

    expect(publicNotices()).toEqual([{ channel: "C_NEWS", text: "🎉 <@U_ALICE> reached level 2." }]);
  });

  test("without an announcement channel, nothing is posted and the level-up DM still goes out", async () => {
    const t = await journeyWorkspace();

    await post(t, [section(mention("U_BOB"), text(` ${saysWhy} `), emoji("taco"))]);
    await settle(t);

    expect(publicNotices()).toEqual([]);
    expect(slack.messagesIn("U_ALICE").map(({ text }) => text)).toContainEqual(expect.stringContaining("You reached level 2!"));
  });

  test("a member who muted public notices gets no notice", async () => {
    const t = await journeyWorkspace({ announcementChannel: "C_NEWS" });
    await withSettings(t, "U_ALICE", { muteNotices: true });

    await post(t, [section(mention("U_BOB"), text(` ${saysWhy} `), emoji("taco"))]);
    await settle(t);

    expect(publicNotices()).toEqual([]);
  });

  test("a replayed levelReached posts nothing new", async () => {
    const t = await journeyWorkspace({ announcementChannel: "C_NEWS" });
    await post(t, [section(mention("U_BOB"), text(` ${saysWhy} `), emoji("taco"))]);
    await settle(t);

    const { message: _, ...withoutKudosMessage } = await levelReached(t, "U_ALICE", 2);
    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: withoutKudosMessage });
    await settle(t);

    expect(publicNotices()).toEqual([{ channel: "C_NEWS", text: "🎉 <@U_ALICE> reached level 2." }]);
    expect(slack.callsTo("chat.update")).toEqual([]);
  });
});

describe("P64: a change of route", () => {
  test("picking the kudos message's own channel as the announcement channel posts the next notice there, top level, and leaves the thread reply alone", async () => {
    const t = await flagsLoaded(testBackend());
    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);
    const [threadReply] = slack.messagesIn("C1");
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", announcementChannel: "C1" }));

    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    await settle(t);

    expect(slack.messagesIn("C1")).toEqual([threadReply, { channel: "C1", ts: expect.any(String), text: "🎉 <@U_BOB> reached level 2." }]);
  });

  test("a last attempt Slack accepted without answering its ts is never posted again when another level follows", async () => {
    const t = await flagsLoaded(testBackend());
    await onlyPublicRepliesPosted(t, "U_ALICE", "U_BOB");
    slack.answering("chat.postMessage", slackError("internal_error"), slackError("internal_error"), acceptedButAnsweredWithoutTs);

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);
    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    await settle(t);

    expect(slack.messagesIn("C1").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 2."]);
  });
});

describe("R35: delivering the public reply", () => {
  test("a notice that keeps failing is tried 3 times, and the next level under that message posts the reply afresh", async () => {
    const t = await flagsLoaded(testBackend());
    await onlyPublicRepliesPosted(t, "U_ALICE", "U_BOB");
    slack.answering("chat.postMessage", slackError("internal_error"), slackError("internal_error"), slackError("internal_error"));

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);
    expect(slack.callsTo("chat.postMessage")).toHaveLength(3);
    expect(slack.messagesIn("C1")).toEqual([]);

    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_ALICE", 3) });
    await settle(t);

    expect(slack.messagesIn("C1").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 3."]);
  });

  test("a notice Slack answers is gone is tried once, and the next level under that message posts the reply afresh", async () => {
    const t = await flagsLoaded(testBackend());
    await onlyPublicRepliesPosted(t, "U_ALICE", "U_BOB");
    slack.answering("chat.postMessage", slackError("not_in_channel"));

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);
    expect(slack.callsTo("chat.postMessage")).toHaveLength(1);

    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_ALICE", 3) });
    await settle(t);

    expect(slack.messagesIn("C1").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 3."]);
  });
});

describe("P65: privacy", () => {
  test.each([
    ["muted public notices", { muteNotices: true }],
  ])("a member who %s gets no public notice, while the other member's is posted", async (_, settings) => {
    const t = await flagsLoaded(testBackend());
    await withSettings(t, "U_ALICE", settings);
    await withXp(t, "U_BOB", 15);

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.messagesIn("C1").map((message) => message.text)).toEqual(["🎉 <@U_BOB> reached level 2."]);
  });

  test.each([
    ["mutes public notices", { muteNotices: true }],
  ])("a member who %s after reaching a level, before the reply is posted, is left out of it", async (_, settings) => {
    const t = await flagsLoaded(testBackend());
    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_ALICE", 2) });
    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    await withSettings(t, "U_ALICE", settings);

    await settle(t);

    expect(slack.messagesIn("C1").map((message) => message.text)).toEqual(["🎉 <@U_BOB> reached level 2."]);
  });

  test("a reply whose only member muted notices before it was posted is never posted, and a later level under that message is", async () => {
    const t = await flagsLoaded(testBackend());
    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_ALICE", 2) });
    await withSettings(t, "U_ALICE", { muteNotices: true });
    await settle(t);
    expect(slack.messagesIn("C1")).toEqual([]);

    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    await settle(t);

    expect(slack.messagesIn("C1").map((message) => message.text)).toEqual(["🎉 <@U_BOB> reached level 2."]);
  });

  test("a member who muted notices and is the only one levelling up leaves the thread empty", async () => {
    const t = await flagsLoaded(testBackend());
    await withSettings(t, "U_ALICE", { muteNotices: true });

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.messagesIn("C1")).toEqual([]);
  });
});

const acceptedButAnsweredWithoutTs: ScriptedAnswer = async (answerAsSlackWould) => {
  const { ts: _, ...withoutTs } = await answerAsSlackWould().json();
  return Response.json(withoutTs);
};

async function journeyWorkspace(settings: { announcementChannel?: string } = {}) {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", ...settings }));
  return t;
}

function publicNotices() {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel, text }) => !String(channel).startsWith("U") && String(text).includes("reached level"))
    .map(({ channel, text }) => ({ channel, text }));
}

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

async function onlyPublicRepliesPosted(t: Backend, ...users: string[]) {
  for (const user of users) {
    const member = await memberOf(t, user);
    await t.run(async (ctx) => {
      await ctx.db.insert("welcomes", { member });
      await ctx.db.insert("progressSettings", { member, dms: false });
    });
  }
}

async function withSettings(t: Backend, user: string, settings: { muteNotices?: boolean }) {
  const member = await memberOf(t, user);
  await t.run((ctx) => ctx.db.insert("progressSettings", { member, ...settings }));
}

async function levelReached(t: Backend, user: string, level: number): Promise<LevelReachedEvent> {
  return {
    type: "levelReached",
    workspace: "T1",
    member: await memberOf(t, user),
    level,
    skillPointsGained: 0,
    skillPoints: 0,
    xpToNextLevel: 80,
    message: { workspace: "T1", conversation: "C1", message: postedTs },
    at: now.getTime(),
  };
}
