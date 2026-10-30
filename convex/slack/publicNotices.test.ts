import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { FakeSlack, landsButTimesOut, slackError, type ScriptedAnswer } from "../../testing/fakeSlack";
import { signingSecret } from "../../testing/signedSlack";
import { deliverAgain, everythingStored, post, setWorkspaceSettings, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { LevelReachedEvent } from "../bus/events";

const now = new Date("2026-10-13T10:00:00Z");
const postedTs = "1760349600.000100";
const threadRoot = "1760349000.000100";
const thanksBobTwice = [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))];

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
  test("a level reached through a kudos message is celebrated at the announcement channel's top level", async () => {
    const t = await announcingIn("C_NEWS");

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.messagesIn("C_NEWS")).toEqual([{ channel: "C_NEWS", ts: expect.any(String), text: "🎉 <@U_ALICE> reached level 2." }]);
  });

  test("R45 AT1: a recipient's notice states only their progress, never the giver or the thank-you, whose words are only in the kudos text", async () => {
    const t = await announcingIn("C_NEWS");
    await withXp(t, "U_BOB", 15);

    await post(t, [section(text("thanks for rescuing the deploy "), mention("U_BOB"), emoji("taco"))]);
    await settle(t);

    expect(slack.messagesIn("C_NEWS").map((message) => message.text)).toEqual(["🎉 <@U_BOB> reached level 2."]);
    const stored = JSON.stringify(await everythingStored(t, { except: ["kudosTexts"] }), (_, value) => (typeof value === "bigint" ? String(value) : value));
    expect(stored).not.toContain("rescuing");
  });
});

describe("D18: the one public reply", () => {
  test("two members levelling up from one message share the one reply", async () => {
    const t = await announcingIn("C_NEWS");
    await withXp(t, "U_BOB", 15);

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "C_NEWS")).toHaveLength(1);
    expect(slack.messagesIn("C_NEWS").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 2.\n🎉 <@U_BOB> reached level 2."]);
  });

  test("a second level-up under the same message edits the one reply in place", async () => {
    const t = await announcingIn("C_NEWS");
    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);
    const [notice] = slack.messagesIn("C_NEWS");

    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_ALICE", 3) });
    await settle(t);

    expect(slack.messagesIn("C_NEWS")).toEqual([{ ...notice, text: "🎉 <@U_ALICE> reached level 3." }]);
    expect(slack.callsTo("chat.update")).toEqual([{ channel: "C_NEWS", ts: notice!.ts, text: "🎉 <@U_ALICE> reached level 3." }]);
  });

  test("a level-up delivered again neither posts nor edits the one reply", async () => {
    const t = await announcingIn("C_NEWS");
    await post(t, thanksBobTwice);
    await settle(t);

    await deliverAgain(t, "feedback/publicReplies:celebrateLevel");

    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "C_NEWS"), "the posts").toHaveLength(1);
    expect(slack.callsTo("chat.update"), "the edits").toEqual([]);
  });

  test("an older level-up delivered again after a newer one keeps the newer level", async () => {
    const t = await announcingIn("C_NEWS");
    await post(t, thanksBobTwice);
    await settle(t);
    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_ALICE", 3) });
    await settle(t);

    await deliverAgain(t, "feedback/publicReplies:celebrateLevel");

    expect(slack.messagesIn("C_NEWS").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 3."]);
    expect(slack.callsTo("chat.update"), "the edits").toHaveLength(1);
  });

  test("a level reached while the reply is being posted is added by an edit, never by a second post", async () => {
    const t = await announcingIn("C_NEWS");
    await memberOf(t, "U_BOB");
    slack.holdingBack("chat.postMessage", "C_NEWS", async () => {
      await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    });

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "C_NEWS")).toHaveLength(1);
    expect(slack.messagesIn("C_NEWS").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 2.\n🎉 <@U_BOB> reached level 2."]);
  });

  test("a post whose answer is lost is never posted again", async () => {
    const t = await announcingIn("C_NEWS");
    await onlyPublicRepliesPosted(t, "U_ALICE", "U_BOB");
    slack.answering("chat.postMessage", landsButTimesOut);

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);
    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    await settle(t);

    expect(slack.messagesIn("C_NEWS").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 2."]);
  });

  test("a post that fails after Slack accepted it is never posted again", async () => {
    const t = await announcingIn("C_NEWS");
    await onlyPublicRepliesPosted(t, "U_ALICE", "U_BOB");
    slack.answering("chat.postMessage", acceptedButAnsweredWithoutTs);

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.messagesIn("C_NEWS").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 2."]);
  });
});

describe("P64: a change of route", () => {
  test("QM1: a channel picked anew between two levels gets its own post for the later one, and the earlier post stays as it is", async () => {
    const t = await announcingIn("C_NEWS");
    await post(t, thanksBobTwice);
    await settle(t);
    await setWorkspaceSettings(t, { announcementChannel: "C_PICKED_ANEW" });

    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    await settle(t);

    expect(publicNotices()).toEqual([
      { channel: "C_NEWS", text: "🎉 <@U_ALICE> reached level 2." },
      { channel: "C_PICKED_ANEW", text: "🎉 <@U_BOB> reached level 2." },
    ]);
    expect(slack.callsTo("chat.update")).toEqual([]);
  });

  test("a last attempt Slack accepted without answering its ts is never posted again when another level follows", async () => {
    const t = await announcingIn("C_NEWS");
    await onlyPublicRepliesPosted(t, "U_ALICE", "U_BOB");
    slack.answering("chat.postMessage", slackError("internal_error"), slackError("internal_error"), acceptedButAnsweredWithoutTs);

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);
    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    await settle(t);

    expect(slack.messagesIn("C_NEWS").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 2."]);
  });
});

describe("R35: delivering the public reply", () => {
  test("a notice that keeps failing is tried 3 times, and the next level under that message posts the reply afresh", async () => {
    const t = await announcingIn("C_NEWS");
    await onlyPublicRepliesPosted(t, "U_ALICE", "U_BOB");
    slack.answering("chat.postMessage", slackError("internal_error"), slackError("internal_error"), slackError("internal_error"));

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);
    expect(slack.callsTo("chat.postMessage")).toHaveLength(3);
    expect(slack.messagesIn("C_NEWS")).toEqual([]);

    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_ALICE", 3) });
    await settle(t);

    expect(slack.messagesIn("C_NEWS").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 3."]);
  });

  test("a notice Slack answers is gone is tried once, and the next level under that message posts the reply afresh", async () => {
    const t = await announcingIn("C_NEWS");
    await onlyPublicRepliesPosted(t, "U_ALICE", "U_BOB");
    slack.answering("chat.postMessage", slackError("not_in_channel"));

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);
    expect(slack.callsTo("chat.postMessage")).toHaveLength(1);

    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_ALICE", 3) });
    await settle(t);

    expect(slack.messagesIn("C_NEWS").map((message) => message.text)).toEqual(["🎉 <@U_ALICE> reached level 3."]);
  });
});

describe("P65: privacy", () => {
  test.each([
    ["muted public notices", { muteNotices: true }],
  ])("a member who %s gets no public notice, while the other member's is posted", async (_, settings) => {
    const t = await announcingIn("C_NEWS");
    await withSettings(t, "U_ALICE", settings);
    await withXp(t, "U_BOB", 15);

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.messagesIn("C_NEWS").map((message) => message.text)).toEqual(["🎉 <@U_BOB> reached level 2."]);
  });

  test.each([
    ["mutes public notices", { muteNotices: true }],
  ])("a member who %s after reaching a level, before the reply is posted, is left out of it", async (_, settings) => {
    const t = await announcingIn("C_NEWS");
    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_ALICE", 2) });
    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    await withSettings(t, "U_ALICE", settings);

    await settle(t);

    expect(slack.messagesIn("C_NEWS").map((message) => message.text)).toEqual(["🎉 <@U_BOB> reached level 2."]);
  });

  test("a reply whose only member muted notices before it was posted is never posted, and a later level under that message is", async () => {
    const t = await announcingIn("C_NEWS");
    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_ALICE", 2) });
    await withSettings(t, "U_ALICE", { muteNotices: true });
    await settle(t);
    expect(slack.messagesIn("C_NEWS")).toEqual([]);

    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    await settle(t);

    expect(slack.messagesIn("C_NEWS").map((message) => message.text)).toEqual(["🎉 <@U_BOB> reached level 2."]);
  });

  test("a member who muted notices and is the only one levelling up leaves the announcement channel empty", async () => {
    const t = await announcingIn("C_NEWS");
    await withSettings(t, "U_ALICE", { muteNotices: true });

    await post(t, [section(text("thanks "), mention("U_BOB"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(slack.messagesIn("C_NEWS")).toEqual([]);
  });
});

describe("QM1 QM2 QM3: a public celebration is never posted in a work thread", () => {
  test.each([
    ["at a channel's top level", {}],
    ["in a thread", { threadTs: threadRoot }],
  ])("with no announcement channel, a level reached through a kudos posted %s is celebrated nowhere, stores no reply, and its DM still goes out", async (_, where) => {
    const t = await flagsLoaded(testBackend());

    await post(t, thanksBobTwice, where);
    await settle(t);

    expect(publicNotices()).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("publicReplies").collect())).toEqual([]);
    expect(slack.messagesIn("U_ALICE").map(({ text }) => text)).toContainEqual(expect.stringContaining("You reached level 2!"));
  });

  test("with an announcement channel, the notice goes there at top level and the kudos message's conversation gets nothing", async () => {
    const t = await announcingIn("C_NEWS");

    await post(t, thanksBobTwice, { threadTs: threadRoot });
    await settle(t);

    expect(publicNotices()).toEqual([{ channel: "C_NEWS", text: "🎉 <@U_ALICE> reached level 2." }]);
  });

  test("a kudos posted in a thread inside the announcement channel is celebrated at the channel's top level", async () => {
    const t = await announcingIn("C_NEWS");

    await post(t, thanksBobTwice, { channel: "C_NEWS", threadTs: threadRoot });
    await settle(t);

    expect(publicNotices()).toEqual([{ channel: "C_NEWS", text: "🎉 <@U_ALICE> reached level 2." }]);
  });

  test.each([
    ["in the kudos message's thread", { channel: "C1", threadTs: postedTs }],
    ["at the top level of the kudos message's own conversation, not the announcement channel,", { channel: "C1" }],
    ["in a thread of the announcement channel", { channel: "C_NEWS", threadTs: threadRoot }],
  ])("a reply stored %s before the fix and still posting is never posted", async (_, destination) => {
    const t = await announcingIn("C_NEWS");
    const reply = await storedReply(t, destination, { state: "posting" });

    await deliver(t, reply);

    expect(slack.callsTo("chat.postMessage")).toEqual([]);
    expect((await t.run((ctx) => ctx.db.get(reply)))?.shown).toEqual({ state: "unposted" });
  });

  test("QM2 QM4: a celebration still waiting when posting stops is never posted", async () => {
    const t = await announcingIn("C_NEWS");
    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    await clearAnnouncementChannel(t);

    await settle(t);

    expect(publicNotices()).toEqual([]);
    expect((await t.run((ctx) => ctx.db.query("publicReplies").collect())).map(({ shown }) => shown)).toEqual([{ state: "unposted" }]);
  });

  test("QM2 QM4: a celebration posted before posting stops is never edited again", async () => {
    const t = await announcingIn("C_NEWS");
    const reply = await storedReply(t, { channel: "C_NEWS" }, { state: "posted", ts: "1760349601.000100" });
    await clearAnnouncementChannel(t);

    await deliver(t, reply);

    expect(slack.callsTo("chat.update")).toEqual([]);
  });

  test("a reply posted in a thread before the fix is never edited again, and nothing is deleted", async () => {
    const t = await flagsLoaded(testBackend());
    const reply = await storedReply(t, { channel: "C1", threadTs: postedTs }, { state: "posted", ts: "1760349601.000100" });

    await deliver(t, reply);
    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    await settle(t);

    expect(slack.callsTo("chat.update")).toEqual([]);
    expect(slack.callsTo("chat.delete")).toEqual([]);
    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "C1")).toEqual([]);
  });

  test("a top-level reply in the announcement channel for a kudos posted there still posts, and is edited as sections arrive", async () => {
    const t = await announcingIn("C1");
    await post(t, thanksBobTwice);
    await settle(t);

    await t.mutation(internal.feedback.publicReplies.celebrateLevel, { event: await levelReached(t, "U_BOB", 2) });
    await settle(t);

    expect(publicNotices()).toEqual([{ channel: "C1", text: "🎉 <@U_ALICE> reached level 2." }]);
    expect(slack.callsTo("chat.update")).toEqual([{ channel: "C1", ts: slack.messagesIn("C1")[0]!.ts, text: "🎉 <@U_ALICE> reached level 2.\n🎉 <@U_BOB> reached level 2." }]);
  });
});

const acceptedButAnsweredWithoutTs: ScriptedAnswer = async (answerAsSlackWould) => {
  const { ts: _, ...withoutTs } = await answerAsSlackWould().json();
  return Response.json(withoutTs);
};

function publicNotices() {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel, text }) => !String(channel).startsWith("U") && String(text).includes("reached level"))
    .map(({ channel, text, thread_ts }) => ({ channel, text, ...(thread_ts !== undefined && { thread_ts }) }));
}

function announcingIn(announcementChannel: string) {
  return withAnnouncementChannel(flagsLoaded(testBackend()), announcementChannel);
}

async function withAnnouncementChannel(backend: Backend | Promise<Backend>, announcementChannel: string) {
  const t = await backend;
  await setWorkspaceSettings(t, { announcementChannel });
  return t;
}

function clearAnnouncementChannel(t: Backend) {
  return setWorkspaceSettings(t, { announcementChannel: undefined });
}

async function storedReply(t: Backend, destination: { channel: string; threadTs?: string }, shown: Doc<"publicReplies">["shown"]) {
  const sections = await aliceReachedLevel2(t);
  return t.run(async (ctx) => {
    await ctx.db.insert("workspaceKeys", { workspace: "T1", workspaceKey: "workspace-key" });
    return ctx.db.insert("publicReplies", { workspace: "T1", conversation: "C1", message: postedTs, ...destination, sections, version: 2, shown });
  });
}

async function aliceReachedLevel2(t: Backend) {
  const member = await memberOf(t, "U_ALICE");
  const line = [{ text: "🎉 " }, { mention: { kind: "person" as const, user: "U_ALICE" } }, { text: " reached level 2." }];
  return [{ key: "level:U_ALICE", member, about: "level" as const, line }];
}

async function deliver(t: Backend, reply: Id<"publicReplies">) {
  await t.action(internal.slack.publicReplies.deliverPublicReply, { reply });
  await settle(t);
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
