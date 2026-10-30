import { getFunctionName, makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined, onForEveryone } from "../../testing/flags";
import { post, testBackend, type Backend } from "../../testing/slackBackend";
import { signingSecret } from "../../testing/signedSlack";
import { emoji, mention, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { LadderId, TierRef } from "../achievements/ladders";
import { subscribers } from "../bus/publish";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-13T10:00:00Z");
const everyFeature = ["xp-levels", "unlocks", "quests", "skill-tree", "achievements", "coins", "crate-rewards", "website", "groups", "everyone-board", "activity"];
const kudosTs = `${now.getTime() / 1000}.000100`;
const convexScheduleLimit = 1000;
const kudosGivenSubscribers = new Set(subscribers.kudosGiven.map((subscription) => getFunctionName("subscriber" in subscription ? subscription.subscriber : subscription)));

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", "https://kudos-site.test");
  slack = new FakeSlack().withMember("U_ALICE");
  postHog = flagsOnForEveryone(slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("kudosGiven subscribers stay within Convex's limits: one kudos naming 700 new members counts each of them once, and no subscriber mutation is refused or schedules 1,000 functions or more", () => {
  test("with every feature on, each member named is counted once, and the giver hears of every tier they earned in one DM", { timeout: 600_000 }, async () => {
    const t = await everyFeatureOn();
    const alice = await withTheBookOpen(t, "U_ALICE");
    const recipients = newMembers(700);

    await post(t, [section(...recipients.map((user) => mention(user)), emoji("taco"))], { user: "U_ALICE", ts: kudosTs });
    const subscriberRuns = await settleRunningSubscribersOneByOne(t);

    expect(subscriberRuns.filter(({ refused, scheduled }) => refused !== undefined || scheduled >= convexScheduleLimit)).toEqual([]);
    expect(await countedOf(t, recipients)).toEqual(recipients.map((user) => ({ user, recognition: 1, xp: true })));
    expect(await ladderCountOf(t, alice, "generosity")).toBe(700);
    const alicesTiers = [
      { ladder: "generosity", tier: "bronze" },
      { ladder: "generosity", tier: "silver" },
      { ladder: "generosity", tier: "gold" },
      { ladder: "generosity", tier: "diamond" },
      { ladder: "connections", tier: "bronze" },
      { ladder: "connections", tier: "silver" },
      { ladder: "connections", tier: "gold" },
      { ladder: "connections", tier: "diamond" },
      { ladder: "seasons", tier: "bronze" },
    ];
    expect(await tiersToldTo(t, alice)).toEqual([alicesTiers]);
    expect(await tierNoticesOf(t, alice)).toEqual([{ message: kudosTs, tiers: alicesTiers }]);
  });
});

async function everyFeatureOn() {
  const t = await flagsFromPostHog(testBackend({ transactionLimits: true }), postHog, ...everyFeature.map(onForEveryone));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 700 }));
  await unlocksShippedBeforeAnyoneJoined(t);
  return bookShippedBeforeAnyoneJoined(t);
}

async function withTheBookOpen(t: Backend, user: string): Promise<MemberId> {
  return t.run(async (ctx) => {
    const member = await ctx.db.insert("members", { workspace: "T1", user, kind: "member" });
    await ctx.db.insert("unlocks", { member, feature: "book", readyAt: now.getTime(), openedAt: now.getTime() });
    return member;
  });
}

function newMembers(count: number) {
  const users = Array.from({ length: count }, (_, index) => `U_NEW${String(index).padStart(3, "0")}`);
  for (const user of users) slack.withMember(user);
  return users;
}

type SubscriberRun = { name: string; scheduled: number; refused?: string };

async function settleRunningSubscribersOneByOne(t: Backend) {
  for (let fired = 0; fired < 100; fired += 1) {
    await t.finishInProgressScheduledFunctions();
    if ((await pendingSubscriberJobs(t)).length > 0) return runSubscribersAlone(t);
    vi.advanceTimersToNextTimer();
  }
  throw new Error("the kudos was never given");
}

async function runSubscribersAlone(t: Backend) {
  const runs: SubscriberRun[] = [];
  for (let pending = await pendingSubscriberJobs(t); pending.length > 0; pending = await pendingSubscriberJobs(t)) {
    for (const job of pending) runs.push(await runCounting(t, job));
  }
  await t.run(async (ctx) => {
    for (const job of await pendingJobsOf(ctx).collect()) await ctx.scheduler.cancel(job._id);
  });
  return runs;
}

function pendingSubscriberJobs(t: Backend) {
  return t.run((ctx) =>
    pendingJobsOf(ctx)
      .filter((q) => q.or(...[...kudosGivenSubscribers].map((name) => q.eq(q.field("name"), name))))
      .collect(),
  );
}

function pendingJobsOf(ctx: MutationCtx) {
  return ctx.db.system.query("_scheduled_functions").filter((q) => q.eq(q.field("state.kind"), "pending"));
}

type ScheduledJob = Awaited<ReturnType<typeof pendingSubscriberJobs>>[number];

async function runCounting(t: Backend, { _id, name, args }: ScheduledJob): Promise<SubscriberRun> {
  await t.run((ctx) => ctx.scheduler.cancel(_id));
  const lastScheduledBefore = await lastScheduledAt(t);
  try {
    await t.mutation(makeFunctionReference<"mutation">(name), args[0] as Record<string, unknown>);
  } catch (error) {
    return { name, scheduled: 0, refused: (error as Error).message };
  }
  return { name, scheduled: await countScheduledAfter(t, lastScheduledBefore) };
}

async function lastScheduledAt(t: Backend) {
  const last = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").order("desc").first());
  return last?._creationTime ?? 0;
}

async function countScheduledAfter(t: Backend, creationTime: number) {
  const scheduled = await t.run((ctx) =>
    ctx.db.system
      .query("_scheduled_functions")
      .withIndex("by_creation_time", (q) => q.gt("_creationTime", creationTime))
      .collect(),
  );
  return scheduled.length;
}

async function countedOf(t: Backend, users: string[]) {
  return t.run(async (ctx) => {
    const counted = [];
    for (const user of users) {
      const member = await ctx.db
        .query("members")
        .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
        .unique();
      if (member === null) {
        counted.push({ user, recognition: 0, xp: false });
        continue;
      }
      const recognition = await ctx.db
        .query("ladderCounts")
        .withIndex("by_member_ladder", (q) => q.eq("member", member._id).eq("ladder", "recognition"))
        .unique();
      const progress = await ctx.db
        .query("memberProgress")
        .withIndex("by_member", (q) => q.eq("member", member._id))
        .unique();
      counted.push({ user, recognition: recognition?.count ?? 0, xp: (progress?.xp ?? 0) > 0 });
    }
    return counted;
  });
}

async function ladderCountOf(t: Backend, member: MemberId, ladder: LadderId) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("ladderCounts")
      .withIndex("by_member_ladder", (q) => q.eq("member", member).eq("ladder", ladder))
      .unique(),
  );
  return row?.count ?? 0;
}

type TierNotification = { member: MemberId; notification: { kind: string; tiers?: TierRef[] } };

async function tiersToldTo(t: Backend, member: MemberId) {
  const deliveries = await t.run((ctx) =>
    ctx.db.system
      .query("_scheduled_functions")
      .filter((q) => q.eq(q.field("name"), "slack/directMessages:deliverDirectMessage"))
      .collect(),
  );
  return deliveries
    .map(({ args }) => args[0] as TierNotification)
    .filter((delivery) => delivery.member === member && delivery.notification.kind === "tiers-earned")
    .map(({ notification }) => notification.tiers);
}

async function tierNoticesOf(t: Backend, member: MemberId) {
  const notices = await t.run((ctx) => ctx.db.query("tierNotices").collect());
  return notices.filter((notice) => notice.member === member).map(({ message, tiers }) => ({ message, tiers }));
}
