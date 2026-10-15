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
const coinsOfEveryTier = 7 * (10 + 100);
const coinRewardsOfEveryTier = 7 * 2;

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

describe("CO1 CO7: a tier's coins are paid once, whether it is earned live or by the backfill", { timeout: 120_000 }, () => {
  test("with every flag off, the kudos that earns Generosity and Seasons bronze writes one reward record per coin reward and credits the wallet once, however often its kudosGiven is delivered", async () => {
    const { t, alice, bob } = await withMembers();
    await flagsFromPostHog(t, postHog, offForEveryone("xp-levels"), offForEveryone("unlocks"), offForEveryone("achievements"));
    const reaching = await kudosGiven(t, alice, bob, { kudos: 1, at: now.getTime() });

    await count(t, reaching);
    await count(t, reaching);

    expect(await tierRewardsOf(t, alice)).toEqual([
      { key: "tier:generosity-bronze-coins", xp: 0, coins: 10, item: null, catalogueVersion: "1", at: reaching.at },
      { key: "tier:seasons-bronze-coins", xp: 0, coins: 10, item: null, catalogueVersion: "1", at: reaching.at },
    ]);
    expect(await tierRewardsOf(t, bob)).toEqual([{ key: "tier:recognition-bronze-coins", xp: 0, coins: 10, item: null, catalogueVersion: "1", at: reaching.at }]);
    expect(await balanceIn(t, alice)).toBe(20);
    expect(await balanceIn(t, bob)).toBe(10);
  });

  test("members holding all 28 tiers are paid every coin reward once, at the time the backfill ran; a second run writes nothing", async () => {
    const t = testBackend({ transactionLimits: true });
    const members = await membersHoldingEveryTier(t, 60);
    const ranAt = now.getTime() + hourMs;
    vi.setSystemTime(ranAt);

    const first = await t.action(internal.achievements.tierCoins.backfillTierCoins, {});
    const second = await t.action(internal.achievements.tierCoins.backfillTierCoins, {});

    expect(first).toEqual({ tiers: 60 * 28, paid: 60 * coinRewardsOfEveryTier });
    expect(second).toEqual({ tiers: 60 * 28, paid: 0 });
    for (const member of [members[0]!, members.at(-1)!]) {
      const rewards = await tierRewardsOf(t, member);
      expect(rewards).toHaveLength(coinRewardsOfEveryTier);
      expect(new Set(rewards.map(({ at }) => at))).toEqual(new Set([ranAt]));
      expect(await balanceIn(t, member)).toBe(coinsOfEveryTier);
    }
    expect(await t.run(async (ctx) => (await ctx.db.query("rewardRecords").collect()).length)).toBe(60 * coinRewardsOfEveryTier);
  });

  test("a tier earned live while the backfill runs is paid once, at its earned time", async () => {
    const { t, alice, bob } = await withMembers();
    await membersHoldingEveryTier(t, 2);
    const firstPage = await t.mutation(internal.achievements.tierCoins.payTierCoinsPage, { cursor: null });
    expect(firstPage.isDone).toBe(false);

    const reaching = await kudosGiven(t, alice, bob, { kudos: 1, at: now.getTime() });
    await count(t, reaching);
    await restOfTheBackfill(t, firstPage.continueCursor);

    expect(await tierRewardsOf(t, alice)).toEqual([
      { key: "tier:generosity-bronze-coins", xp: 0, coins: 10, item: null, catalogueVersion: "1", at: reaching.at },
      { key: "tier:seasons-bronze-coins", xp: 0, coins: 10, item: null, catalogueVersion: "1", at: reaching.at },
    ]);
    expect(await balanceIn(t, alice)).toBe(20);
  });
});

describe("CO7: bronze pays 10 coins and diamond 100, and the backfill tells nobody", () => {
  test("a diamond tier pays 100 coins, and silver and gold tiers pay none", async () => {
    const { t, alice, bob } = await withMembers();

    await count(t, await kudosGiven(t, alice, bob, { kudos: 500, at: now.getTime() }));

    expect((await tierRewardsOf(t, bob)).map(({ key, coins }) => [key, coins])).toEqual([
      ["tier:recognition-bronze-coins", 10],
      ["tier:recognition-diamond-coins", 100],
    ]);
    expect(await balanceIn(t, bob)).toBe(110);
  });

  test("it tells nobody: a page schedules no DM and no public line, only the App Home refresh that follows a balance", async () => {
    const t = testBackend();
    await membersHoldingEveryTier(t, 2);

    await t.mutation(internal.achievements.tierCoins.payTierCoinsPage, { cursor: null });

    expect(new Set(await pendingJobNames(t))).toEqual(new Set(["feedback/homes:refreshHomeOnXp"]));
  });
});

describe("CO28: achievementsOf answers each coin reward's coins, and on an earned tier when it was recorded", () => {
  test("an unearned tier's coin rewards carry their coins; an earned tier's carry the time their record was written, not the time the tier was earned", async () => {
    const { t, alice, bob } = await withMembers();
    const yesterday = now.getTime() - 86_400_000;

    await count(t, await kudosGiven(t, alice, bob, { kudos: 1, at: yesterday }));

    expect(await tiersOf(t, bob, "recognition")).toEqual([
      { tier: "bronze", name: "Noticed", count: 1, earnedAt: yesterday, catalogueVersion: "1", rewards: [{ kind: "coins", reward: "recognition-bronze-coins", coins: 10, recordedAt: now.getTime() }] },
      { tier: "silver", name: "Appreciated", count: 25, earnedAt: null, catalogueVersion: null, rewards: [{ kind: "kudosEmoji", reward: "recognition-silver-kudos-emoji" }] },
      { tier: "gold", name: "Highly Valued", count: 100, earnedAt: null, catalogueVersion: null, rewards: [{ kind: "hedgehog", reward: "recognition-gold-hedgehog" }] },
      {
        tier: "diamond",
        name: "Hall of Fame",
        count: 500,
        earnedAt: null,
        catalogueVersion: null,
        rewards: [
          { kind: "coins", reward: "recognition-diamond-coins", coins: 100 },
          { kind: "hedgehog", reward: "recognition-diamond-hedgehog" },
        ],
      },
    ]);
  });

  test("a tier earned before the deploy answers recordedAt null until the backfill pays it, then the time it ran", async () => {
    const { t, alice } = await withMembers();
    await earnedBeforeDeploy(t, alice, "generosity", "diamond");
    expect(coinRewardOf(await tierOf(t, alice, "generosity", "diamond"))).toEqual({ kind: "coins", reward: "generosity-diamond-coins", coins: 100, recordedAt: null });
    const ranAt = now.getTime() + hourMs;
    vi.setSystemTime(ranAt);

    await t.action(internal.achievements.tierCoins.backfillTierCoins, {});

    expect(coinRewardOf(await tierOf(t, alice, "generosity", "diamond"))).toEqual({ kind: "coins", reward: "generosity-diamond-coins", coins: 100, recordedAt: ranAt });
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
    const award = await ctx.db.insert("awards", { workspace: "T1", conversation: "C0", message: "before", giver: member, recipient: member, kudos: 500, day: "2026-09-13", at: earnedBeforeTheDeploy });
    const rewards = ladders.ladders.find((entry) => entry.ladder === ladder)!.tiers.find((entry) => entry.tier === tier)!.rewards;
    await ctx.db.insert("earnedTiers", { member, ladder, tier, earnedAt: earnedBeforeTheDeploy, award, catalogueVersion: "1", rewards });
  });
}

async function restOfTheBackfill(t: Backend, cursor: string) {
  for (let page = { isDone: false, continueCursor: cursor }; !page.isDone; ) {
    page = await t.mutation(internal.achievements.tierCoins.payTierCoinsPage, { cursor: page.continueCursor });
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

async function tierRewardsOf(t: Backend, member: MemberId) {
  const rows = await t.run((ctx) =>
    ctx.db
      .query("rewardRecords")
      .withIndex("by_member_key", (q) => q.eq("member", member).gte("key", "tier:").lt("key", "tier;"))
      .collect(),
  );
  return rows.map(({ key, xp, coins, item, catalogueVersion, at }) => ({ key, xp, coins, item, catalogueVersion, at }));
}

async function balanceIn(t: Backend, member: MemberId) {
  return t.run((ctx) => balanceOf(ctx, member));
}

async function pendingJobNames(t: Backend) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter(({ state }) => state.kind === "pending").map(({ name }) => name);
}

async function tiersOf(t: Backend, member: MemberId, ladder: LadderId) {
  const facts = await t.query(internal.achievements.achievements.achievementsOf, { member });
  return facts!.ladders.find((entry) => entry.ladder === ladder)!.tiers;
}

async function tierOf(t: Backend, member: MemberId, ladder: LadderId, tier: TierId) {
  return (await tiersOf(t, member, ladder)).find((entry) => entry.tier === tier)!;
}

function coinRewardOf({ rewards }: TierFacts) {
  return rewards.find(({ kind }) => kind === "coins");
}
