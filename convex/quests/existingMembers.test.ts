import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { readBlocks, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const saysWhy = "thanks for untangling the release notes today";
const finishedFirstThanks = "✅ You finished a Journey step: Give a kudos that says why. You earned *10 XP*.";
const finishedSomeoneNew = "✅ You finished a Journey step: Thank someone you haven't thanked before. You earned *30 XP*.";
const firstThanksReward = { xp: 10, coins: 0, item: null };
const someoneNewReward = { xp: 30, coins: 0, item: null };
const saysWhyDecision = { gate: { version: 1, thoughtful: true, words: 7 } };

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "everyone-board");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P91: members already playing join the Journey once, when it ships", () => {
  test("a member with an earlier kudos that says why gets first-thanks finished and paid once with one DM, and the Leaderboard opened for them makes someone-new active from then", async () => {
    const t = await workspaceWith("U_ALICE", "U_BOB", "U_CAROL");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await unlocksShippedBeforeAnyoneJoined(t);

    await questsTurnOn(t);
    const shipped = aMinuteLater();
    await hourlySweep(t);

    expect(await journeyOf(t, "U_ALICE")).toEqual([
      { step: "first-thanks", activatedAt: shipped, reward: firstThanksReward, catalogueVersion: "1", finishedAt: shipped, openedAt: null },
      { step: "someone-new", activatedAt: shipped, reward: someoneNewReward, catalogueVersion: "1", finishedAt: null, openedAt: null },
    ]);
    expect(await journeyOf(t, "U_BOB")).toEqual([
      { step: "first-thanks", activatedAt: shipped, reward: firstThanksReward, catalogueVersion: "1", finishedAt: null, openedAt: null },
      { step: "someone-new", activatedAt: shipped, reward: someoneNewReward, catalogueVersion: "1", finishedAt: null, openedAt: null },
    ]);
    expect(journeyDmsTo("U_ALICE").map(({ text }) => text)).toEqual([finishedFirstThanks]);
    expect(readBlocks(journeyDmsTo("U_ALICE")[0]!.blocks as Block[])).toEqual([`section: ${finishedFirstThanks} [button: Open]`]);
    expect(journeyDmsTo("U_BOB")).toEqual([]);

    const later = aMinuteLater();
    await giveKudos(t, "U_ALICE", "U_CAROL", "thanks");

    expect((await journeyOf(t, "U_ALICE")).find(({ step }) => step === "someone-new")?.finishedAt).toBe(later);
  });

  test("a member who had already thanked everyone gets first-thanks and someone-new finished at once, named together in one DM with Open for each", async () => {
    const t = await workspaceWith("U_ALICE", "U_BOB");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await unlocksShippedBeforeAnyoneJoined(t);

    await questsTurnOn(t);
    await hourlySweep(t);

    expect(journeyDmsTo("U_ALICE").map(({ text }) => text)).toEqual([`${finishedFirstThanks}\n${finishedSomeoneNew}`]);
    expect(readBlocks(journeyDmsTo("U_ALICE")[0]!.blocks as Block[])).toEqual([`section: ${finishedFirstThanks} [button: Open]`, `section: ${finishedSomeoneNew} [button: Open]`]);
    expect(await rewardKeysOf(t, "U_ALICE")).toEqual(["journey:first-thanks", "journey:someone-new"]);
  });

  test("one App Home opening that launches unlocks and ships the Journey leaves the launch's openings to the join, which sends its one DM", async () => {
    postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "everyone-board");
    const t = await workspaceWith("U_ALICE", "U_BOB");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("everyone-board"), onForEveryone("unlocks"), onForEveryone("quests"));

    await openHome(t, "U_ALICE");

    expect(journeyDmsTo("U_ALICE").map(({ text }) => text)).toEqual([`${finishedFirstThanks}\n${finishedSomeoneNew}`]);
  });

  test("quests turned on before unlocks is initialised does nothing until unlocks applies, and the join then runs once", async () => {
    postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "quests");
    const t = await workspaceWith("U_ALICE", "U_BOB", "U_CAROL");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await hourlySweep(t);

    expect(await rewardKeysOf(t, "U_ALICE")).toEqual([]);
    expect(journeyDmsTo("U_ALICE")).toEqual([]);

    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("quests"), onForEveryone("unlocks"));
    await openHome(t, "U_ALICE");
    await hourlySweep(t);
    await openHome(t, "U_BOB");

    expect(await rewardKeysOf(t, "U_ALICE")).toEqual(["journey:first-thanks"]);
    expect(journeyDmsTo("U_ALICE").map(({ text }) => text)).toEqual([finishedFirstThanks]);
  });

  test("turning quests off and on again, a second sweep or a replayed unlockOpened writes nothing more", async () => {
    const t = await workspaceWith("U_ALICE", "U_BOB", "U_CAROL");
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await unlocksShippedBeforeAnyoneJoined(t);
    await questsTurnOn(t);
    await hourlySweep(t);
    const afterTheJoin = await journeyStored(t);

    aMinuteLater();
    await hourlySweep(t);
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("everyone-board"));
    await hourlySweep(t);
    await questsTurnOn(t);
    await hourlySweep(t);
    await replayLeaderboardOpened(t, "U_BOB");

    expect(await journeyStored(t)).toEqual(afterTheJoin);
    expect(journeyDmsTo("U_ALICE")).toHaveLength(1);
  });

  test("an award recorded without a gate decision doesn't finish first-thanks, and the member's next kudos that says why finishes it once", async () => {
    const { t, alice, bob } = await membersBeforeTheJourney();
    await recordedWithoutDecision(t, await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { at: Date.now() })));

    await questsTurnOn(t);
    await hourlySweep(t);

    expect((await journeyOf(t, "U_ALICE")).find(({ step }) => step === "first-thanks")?.finishedAt).toBeNull();
    expect(journeyDmsTo("U_ALICE")).toEqual([]);

    const later = aMinuteLater();
    const saidWhy = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { annotations: saysWhyDecision, at: later }));
    for (const delivery of [1, 2]) await t.mutation(internal.quests.quests.followKudosGiven, { event: saidWhy });
    await settle(t);

    expect((await journeyOf(t, "U_ALICE")).find(({ step }) => step === "first-thanks")?.finishedAt).toBe(later);
    expect(await rewardKeysOf(t, "U_ALICE")).toEqual(["journey:first-thanks"]);
  });

  test("a Leaderboard opening from before the Journey shipped, delivered after it, activates someone-new from the ship moment and counts no kudos before it", async () => {
    const { t, alice, bob } = await membersBeforeTheJourney();
    const openedAt = Date.now();
    await t.run((ctx) => ctx.db.insert("unlocks", { member: alice, feature: "leaderboard", readyAt: openedAt, openedAt }));
    aMinuteLater();
    await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { at: Date.now() }));

    await questsTurnOn(t);
    const shipped = aMinuteLater();
    await t.mutation(internal.quests.journey.activateJourney, { event: { type: "unlockOpened", workspace: "T1", member: alice, feature: "leaderboard", at: openedAt } });
    await settle(t);

    expect((await journeyOf(t, "U_ALICE")).find(({ step }) => step === "someone-new")).toEqual({
      step: "someone-new",
      activatedAt: shipped,
      reward: someoneNewReward,
      catalogueVersion: "1",
      finishedAt: null,
      openedAt: null,
    });
  });

  test("a member who joins the workspace after the Journey ships follows the schedule, even before the join has run", async () => {
    const t = await workspaceWith("U_ALICE", "U_BOB");
    await unlocksShippedBeforeAnyoneJoined(t);
    await questsTurnOn(t);
    await t.mutation(internal.quests.newWeek.sweep, {});

    aMinuteLater();
    await directoryKnows(t, "U_CAROL");
    await settle(t);

    expect(await journeyOf(t, "U_ALICE")).toHaveLength(2);
    expect(await journeyOf(t, "U_CAROL")).toEqual([]);
  });
});

describe("P91: the Journey's join stays within Convex's limits", () => {
  test("each join page schedules at most one join per member of a page of 100 and one next page, and the whole run joins every member", async () => {
    const t = await workspaceWith(...Array.from({ length: 150 }, (_, index) => `U_${index}`));
    await unlocksShippedBeforeAnyoneJoined(t);
    await questsTurnOn(t);
    await t.mutation(internal.quests.newWeek.sweep, {});
    const launch = await t.run(async (ctx) => (await ctx.db.query("journeyLaunches").first())!._id);

    await t.mutation(internal.quests.join.joinJourneyPage, { launch });

    expect(await scheduledCount(t, "joinJourney")).toBeLessThanOrEqual(101);
    await settle(t);
    expect(await activationCount(t)).toBe(150);
  });
  test("a member's join reads within Convex's limits however many kudos they gave before the Journey shipped", async () => {
    const { t, alice, bob } = await membersBeforeTheJourney({ transactionLimits: true });
    for (let batch = 0; batch < 5; batch += 1) {
      await t.run(async (ctx) => {
        for (let kudos = 0; kudos < 820; kudos += 1) await recordWithoutDecisionIn(ctx, await kudosGivenEventWithAward(ctx, alice, bob, { at: Date.now() }));
      });
    }
    await t.mutation(internal.progression.progression.recordEffects, { event: await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { annotations: saysWhyDecision, at: Date.now() })) });

    await questsTurnOn(t);
    const shipped = aMinuteLater();
    await hourlySweep(t);

    expect((await journeyOf(t, "U_ALICE")).find(({ step }) => step === "first-thanks")?.finishedAt).toBe(shipped);
  }, 120_000);
});

async function workspaceWith(...users: string[]) {
  const t = await flagsLoaded(testBackend());
  await t.run(async (ctx) => {
    await ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 });
    for (const user of users) await ctx.db.insert("members", { workspace: "T1", user, kind: "member" });
  });
  return t;
}

async function membersBeforeTheJourney(options: { transactionLimits?: boolean } = {}) {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend(options)));
  const [alice, bob] = await t.run(async (ctx) => {
    await ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 });
    await ctx.db.insert("members", { workspace: "T1", user: "U_CAROL", kind: "member" });
    return [await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }), await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" })];
  });
  return { t, alice: alice!, bob: bob! };
}

async function recordedWithoutDecision(t: Backend, event: KudosGivenEvent) {
  await t.run((ctx) => recordWithoutDecisionIn(ctx, event));
}

async function recordWithoutDecisionIn(ctx: Parameters<Parameters<Backend["run"]>[0]>[0], event: KudosGivenEvent) {
  for (const { award, giver } of event.awards) {
    await ctx.db.insert("effectsRecords", { award, side: "giver", member: giver, day: event.day, baseXp: 10, gate: null, catalogueVersion: "1" });
  }
}

async function questsTurnOn(t: Backend) {
  await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("everyone-board"), onForEveryone("quests"));
}

function aMinuteLater() {
  vi.setSystemTime(Date.now() + minuteMs);
  return Date.now();
}

async function hourlySweep(t: Backend) {
  await t.mutation(internal.quests.newWeek.sweep, {});
  await settle(t);
}

async function giveKudos(t: Backend, giver: string, recipient: string, words: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Date.now() / 1000}.00010${sentMessages}` })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function replayLeaderboardOpened(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const openedAt = await t.run(async (ctx) => {
    const row = await ctx.db
      .query("unlocks")
      .withIndex("by_member_feature", (q) => q.eq("member", member).eq("feature", "leaderboard"))
      .unique();
    return row!.openedAt!;
  });
  await t.mutation(internal.quests.journey.activateJourney, { event: { type: "unlockOpened", workspace: "T1", member, feature: "leaderboard", at: openedAt } });
  await settle(t);
}

async function directoryKnows(t: Backend, user: string) {
  await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user, kind: "member" }));
}

async function journeyOf(t: Backend, user: string) {
  const quests = await t.query(internal.quests.quests.questsOf, { member: await memberOf(t, user) });
  return quests!.journey;
}

function journeyDmsTo(user: string): Array<{ text?: unknown; blocks?: unknown }> {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => channel === user && String(text).startsWith("✅ You finished a Journey step"));
}

async function rewardKeysOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => (await ctx.db.query("rewardRecords").collect()).filter((record) => record.member === member).map(({ key }) => key));
}

async function journeyStored(t: Backend) {
  return t.run(async (ctx) => ({
    launches: await ctx.db.query("journeyLaunches").collect(),
    steps: await ctx.db.query("journeySteps").collect(),
    rewards: await ctx.db.query("rewardRecords").collect(),
    progress: await ctx.db.query("memberProgress").collect(),
  }));
}

async function scheduledCount(t: Backend, name: string) {
  const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return scheduled.filter((job) => job.name.endsWith(`:${name}`) && job.state.kind === "pending").length;
}

async function activationCount(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("journeySteps").collect()).filter(({ step }) => step === "first-thanks").length);
}

async function memberOf(t: Backend, user: string): Promise<MemberId> {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return member!._id;
  });
}
