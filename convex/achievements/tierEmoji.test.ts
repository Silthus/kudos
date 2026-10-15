import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEvent } from "../../testing/busEvents";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone } from "../../testing/flags";
import type { FakePostHog } from "../../testing/fakePostHog";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { KudosGivenEvent } from "../bus/events";
import { balanceOf } from "../wallet/wallet";
import type { MemberId } from "../workspace/directory";
import type { TierFacts } from "./achievements";
import { ladders, type LadderId, type TierId } from "./ladders";

const now = new Date("2026-10-13T10:00:00Z");
const earnedBeforeTheDeploy = now.getTime() - 30 * 86_400_000;
const hourMs = 3_600_000;
const silverEmoji = ["kudos-emoji-ribbon", "kudos-emoji-sparkling-heart", "kudos-emoji-jigsaw", "kudos-emoji-anchor", "kudos-emoji-confetti", "kudos-emoji-maple-leaf", "kudos-emoji-teddy-bear"];
const ribbon = { item: "kudos-emoji-ribbon", name: "Ribbon", emoji: "ribbon", art: { kind: "unicode", glyph: "🎀" } };
const sparklingHeart = { item: "kudos-emoji-sparkling-heart", name: "Sparkling Heart", emoji: "sparkling_heart", art: { kind: "unicode", glyph: "💖" } };

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  postHog = flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "achievements");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ST16 ST17: a silver tier's emoji is granted once, whether it is earned live or by the backfill", { timeout: 120_000 }, () => {
  test("with every flag off, the kudos that earns Generous Soul writes one reward record and one collection row with 🎀 at the tier's earned time, however often its kudosGiven is delivered", async () => {
    const { t, alice, bob } = await withMembers();
    await flagsFromPostHog(t, postHog, offForEveryone("xp-levels"), offForEveryone("unlocks"), offForEveryone("achievements"));
    const reaching = await kudosGiven(t, alice, bob, { kudos: 25, at: now.getTime() - hourMs });

    await count(t, reaching);
    await count(t, reaching);

    expect(await silverRewardsOf(t, alice)).toEqual([{ key: "tier:generosity-silver-kudos-emoji", xp: 0, coins: 0, item: "kudos-emoji-ribbon", catalogueVersion: "1", at: reaching.at }]);
    expect(await collectionOf(t, alice)).toEqual([{ item: "kudos-emoji-ribbon", source: "tier", arrivedAt: reaching.at }]);
    expect(await collectionOf(t, bob)).toEqual([{ item: "kudos-emoji-sparkling-heart", source: "tier", arrivedAt: reaching.at }]);
    expect(await balanceIn(t, alice)).toBe(20);
  });

  test("members holding all 28 tiers are granted each silver emoji once, at the time the job ran; a second run writes nothing", async () => {
    const t = testBackend({ transactionLimits: true });
    const members = await membersHoldingEveryTier(t, 60);
    const ranAt = now.getTime() + hourMs;
    vi.setSystemTime(ranAt);

    const first = await t.action(internal.achievements.tierEmoji.backfillTierEmoji, {});
    const second = await t.action(internal.achievements.tierEmoji.backfillTierEmoji, {});

    expect(first).toEqual({ tiers: 60 * 28, granted: 60 * 7 });
    expect(second).toEqual({ tiers: 60 * 28, granted: 0 });
    for (const member of [members[0]!, members.at(-1)!]) {
      expect((await collectionOf(t, member)).map(({ item, source, arrivedAt }) => [item, source, arrivedAt])).toEqual(silverEmoji.map((item) => [item, "tier", ranAt]));
      expect(new Set((await silverRewardsOf(t, member)).map(({ coins, at }) => [coins, at].join()))).toEqual(new Set([`0,${ranAt}`]));
      expect(await balanceIn(t, member)).toBe(0);
    }
    expect(await t.run(async (ctx) => (await ctx.db.query("collection").collect()).length)).toBe(60 * 7);
  });

  test("a silver tier earned live while the job runs is granted once, at its earned time", async () => {
    const { t, alice, bob } = await withMembers();
    await membersHoldingEveryTier(t, 2);
    const firstPage = await t.mutation(internal.achievements.tierEmoji.grantTierEmojiPage, { cursor: null });
    expect(firstPage.isDone).toBe(false);

    const reaching = await kudosGiven(t, alice, bob, { kudos: 25, at: now.getTime() });
    await count(t, reaching);
    await restOfTheBackfill(t, firstPage.continueCursor);

    expect(await collectionOf(t, alice)).toEqual([{ item: "kudos-emoji-ribbon", source: "tier", arrivedAt: reaching.at }]);
    expect(await silverRewardsOf(t, alice)).toHaveLength(1);
  });
});

describe("ST17: the backfill tells nobody", () => {
  test("it tells nobody: a page schedules no DM and no public line, only the App Home refresh that follows a reward record, far below the scheduling limit", async () => {
    const t = testBackend();
    await membersHoldingEveryTier(t, 4);

    await t.mutation(internal.achievements.tierEmoji.grantTierEmojiPage, { cursor: null });

    const pending = await pendingJobNames(t);
    expect(new Set(pending)).toEqual(new Set(["feedback/homes:refreshHomeOnXp"]));
    expect(pending.length).toBeLessThanOrEqual(25);
  });
});

describe("ST28: achievementsOf answers each silver tier's emoji, and on an earned tier when it was recorded", () => {
  test("an unearned silver tier carries its item; an earned one carries the time its record was written, not the time the tier was earned", async () => {
    const { t, alice, bob } = await withMembers();
    const yesterday = now.getTime() - 86_400_000;

    await count(t, await kudosGiven(t, alice, bob, { kudos: 25, at: yesterday }));

    expect(silverRewardOf(await tierOf(t, bob, "recognition", "silver"))).toEqual({ kind: "kudosEmoji", reward: "recognition-silver-kudos-emoji", item: sparklingHeart, recordedAt: now.getTime() });
    expect(silverRewardOf(await tierOf(t, bob, "generosity", "silver"))).toEqual({ kind: "kudosEmoji", reward: "generosity-silver-kudos-emoji", item: ribbon });
  });

  test("a silver tier earned before the deploy answers recordedAt null until the job grants it, then the time it ran", async () => {
    const { t, alice } = await withMembers();
    await earnedBeforeDeploy(t, alice, "generosity", "silver");
    expect(silverRewardOf(await tierOf(t, alice, "generosity", "silver"))).toEqual({ kind: "kudosEmoji", reward: "generosity-silver-kudos-emoji", item: ribbon, recordedAt: null });
    const ranAt = now.getTime() + hourMs;
    vi.setSystemTime(ranAt);

    await t.action(internal.achievements.tierEmoji.backfillTierEmoji, {});

    expect(silverRewardOf(await tierOf(t, alice, "generosity", "silver"))).toEqual({ kind: "kudosEmoji", reward: "generosity-silver-kudos-emoji", item: ribbon, recordedAt: ranAt });
  });
});

async function withMembers() {
  const t = await bookShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  const [alice, bob] = await t.run(async (ctx) => [
    await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" }),
  ]);
  return { t, alice: alice!, bob: bob! };
}

async function membersHoldingEveryTier(t: Backend, howMany: number): Promise<MemberId[]> {
  return t.run(async (ctx) => {
    const members: MemberId[] = [];
    for (let index = 0; index < howMany; index += 1) {
      const member = await ctx.db.insert("members", { workspace: "T1", user: `U_HOLDER_${index}`, kind: "member" });
      const award = await ctx.db.insert("awards", { workspace: "T1", conversation: "C0", message: `holder-${index}`, giver: member, recipient: member, kudos: 500, day: "2026-09-13", at: earnedBeforeTheDeploy });
      for (const { ladder, tiers } of ladders.ladders) {
        for (const { tier, rewards } of tiers) await ctx.db.insert("earnedTiers", { member, ladder, tier, earnedAt: earnedBeforeTheDeploy, award, catalogueVersion: "1", rewards });
      }
      members.push(member);
    }
    return members;
  });
}

async function earnedBeforeDeploy(t: Backend, member: MemberId, ladder: LadderId, tier: TierId) {
  await t.run(async (ctx) => {
    const award = await ctx.db.insert("awards", { workspace: "T1", conversation: "C0", message: "before", giver: member, recipient: member, kudos: 25, day: "2026-09-13", at: earnedBeforeTheDeploy });
    const rewards = ladders.ladders.find((entry) => entry.ladder === ladder)!.tiers.find((entry) => entry.tier === tier)!.rewards;
    await ctx.db.insert("earnedTiers", { member, ladder, tier, earnedAt: earnedBeforeTheDeploy, award, catalogueVersion: "1", rewards });
  });
}

async function restOfTheBackfill(t: Backend, cursor: string) {
  for (let page = { isDone: false, continueCursor: cursor }; !page.isDone; ) {
    page = await t.mutation(internal.achievements.tierEmoji.grantTierEmojiPage, { cursor: page.continueCursor });
  }
}

async function kudosGiven(t: Backend, giver: MemberId, recipient: MemberId, { kudos, at }: { kudos: number; at: number }): Promise<KudosGivenEvent> {
  return t.run(async (ctx) => {
    const event = kudosGivenEvent(giver, recipient, { at });
    const { workspace, conversation, message } = event.message;
    const award = await ctx.db.insert("awards", { workspace, conversation, message, giver, recipient, kudos, day: event.day, at });
    return { ...event, awards: [{ award, giver, recipient, kudos }] };
  });
}

async function count(t: Backend, event: KudosGivenEvent) {
  await t.mutation(internal.achievements.achievements.countKudosGiven, { event });
}

async function silverRewardsOf(t: Backend, member: MemberId) {
  const rows = await t.run((ctx) =>
    ctx.db
      .query("rewardRecords")
      .withIndex("by_member_key", (q) => q.eq("member", member).gte("key", "tier:").lt("key", "tier;"))
      .collect(),
  );
  return rows.filter(({ key }) => key.endsWith("-silver-kudos-emoji")).map(({ key, xp, coins, item, catalogueVersion, at }) => ({ key, xp, coins, item, catalogueVersion, at }));
}

async function collectionOf(t: Backend, member: MemberId) {
  const rows = await t.run((ctx) =>
    ctx.db
      .query("collection")
      .withIndex("by_member_item", (q) => q.eq("member", member))
      .collect(),
  );
  return rows.sort((a, b) => silverEmoji.indexOf(a.item) - silverEmoji.indexOf(b.item)).map(({ item, source, arrivedAt }) => ({ item, source, arrivedAt }));
}

async function balanceIn(t: Backend, member: MemberId) {
  return t.run((ctx) => balanceOf(ctx, member));
}

async function pendingJobNames(t: Backend) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ state }) => state.kind === "pending").map(({ name }) => name);
}

async function tierOf(t: Backend, member: MemberId, ladder: LadderId, tier: TierId) {
  const facts = await t.query(internal.achievements.achievements.achievementsOf, { member });
  return facts!.ladders.find((entry) => entry.ladder === ladder)!.tiers.find((entry) => entry.tier === tier)!;
}

function silverRewardOf({ rewards }: TierFacts) {
  return rewards.find(({ kind }) => kind === "kudosEmoji");
}
