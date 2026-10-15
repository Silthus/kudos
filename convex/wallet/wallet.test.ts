import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signingSecret } from "../../testing/signedSlack";
import { everythingStored, post, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { recordReward } from "../progression/progression";
import type { RewardRecord } from "../progression/rewards";
import { openQuestCrate } from "../quests/open";
import type { MemberId } from "../workspace/directory";
import { balanceOf as balanceRead, spend } from "./wallet";

const saysWhy = "thanks for untangling the release notes";

let sentMessages = 0;
let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-14T08:00:00Z") });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  vi.stubGlobal("fetch", slack.fetch);
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CO9 CO10: a member's balance equals their coin lines and reward coins minus their spends, and never goes below 0", () => {
  test("after every step of kudos, rewards and spends, the cached balance is what the records add up to", async () => {
    const t = await withDirectory();
    const alice = await memberOf(t, "U_ALICE");
    const steps: Array<[string, () => Promise<unknown>, number]> = [
      ["a kudos that says why", () => thank(t, "U_BOB", "2026-10-14T09:00:00Z"), 4],
      ["a quest reward of 10 coins", () => t.run((ctx) => rewardOf(ctx, alice, "weekly:2026-10-12:0", 10)), 14],
      ["the same reward again", () => t.run((ctx) => rewardOf(ctx, alice, "weekly:2026-10-12:0", 10)), 14],
      ["a reward without coins", () => t.run((ctx) => rewardOf(ctx, alice, "journey:first-quest", 0)), 14],
      ["a spend of 6", () => spendOf(t, alice, 6), 8],
      ["a spend of 9 it can't cover", () => spendOf(t, alice, 9), 8],
      ["a kudos that doesn't say why", () => thank(t, "U_CAROL", "2026-10-14T10:00:00Z", "thanks"), 8],
      ["a kudos that says why to someone new", () => thank(t, "U_CAROL", "2026-10-14T11:00:00Z"), 12],
      ["a spend of the whole balance", () => spendOf(t, alice, 12), 0],
      ["a spend of 1 from nothing", () => spendOf(t, alice, 1), 0],
    ];

    for (const [step, take, balance] of steps) {
      await take();

      expect({ step, balance: await balanceOf(t, alice) }).toEqual({ step, balance });
      expect({ step, balance: await recordedCoinsOf(t, alice) }).toEqual({ step, balance });
    }
  }, 30_000);

  test("a held reward's coins count from its crate's open, once, beside a reward that counted at its finish", async () => {
    const t = await withQuests(await withDirectory());
    const alice = await memberOf(t, "U_ALICE");
    const steps: Array<[string, () => Promise<unknown>, number]> = [
      ["a quest reward of 3 coins that counts at its finish", () => t.run((ctx) => rewardOf(ctx, alice, "weekly:2026-10-12:0", 3)), 3],
      ["a held quest reward of 5 coins", () => t.run((ctx) => rewardOf(ctx, alice, "weekly:2026-10-12:1", 5, { held: true })), 3],
      ["the counted reward's crate opened", () => openCrateOf(t, alice, 0), 3],
      ["the held reward's crate opened", () => openCrateOf(t, alice, 1), 8],
      ["the held reward's crate opened again", () => openCrateOf(t, alice, 1), 8],
      ["a spend of the whole balance", () => spendOf(t, alice, 8), 0],
    ];

    for (const [step, take, balance] of steps) {
      await take();

      expect({ step, balance: await balanceOf(t, alice) }).toEqual({ step, balance });
      expect({ step, balance: await recordedCoinsOf(t, alice) }).toEqual({ step, balance });
    }
  }, 30_000);

  test("a spend answers spent when the balance covers the price, and no-coins when it doesn't", async () => {
    const t = await withDirectory();
    const alice = await memberOf(t, "U_ALICE");
    await t.run((ctx) => rewardOf(ctx, alice, "tier:generosity-bronze-coins", 10));

    expect(await spendOf(t, alice, 11)).toBe("no-coins");
    expect(await spendOf(t, alice, 10)).toBe("spent");
    expect(await t.run((ctx) => ctx.db.query("coinSpends").collect())).toEqual([
      expect.objectContaining({ member: alice, coins: 10, for: { perk: "spark" }, at: Date.now() }),
    ]);
  }, 30_000);

  test("a spend answering no-coins writes nothing", async () => {
    const t = await withDirectory();
    const alice = await memberOf(t, "U_ALICE");
    await thank(t, "U_BOB", "2026-10-14T09:00:00Z");
    const before = await everythingStored(t);

    expect(await spendOf(t, alice, 5)).toBe("no-coins");

    expect(await everythingStored(t)).toEqual(before);
  }, 30_000);

  test.each([
    ["a negative price", -5],
    ["a fraction of a coin", 1.5],
    ["NaN", Number.NaN],
  ])("a spend of %s is refused before it writes anything", async (_, coins) => {
    const t = await withDirectory();
    const alice = await memberOf(t, "U_ALICE");
    await t.run((ctx) => rewardOf(ctx, alice, "tier:generosity-bronze-coins", 10));
    const before = await everythingStored(t);

    await expect(spendOf(t, alice, coins)).rejects.toThrow("not a whole number of coins");

    expect(await everythingStored(t)).toEqual(before);
  }, 30_000);

  test.each([
    ["a negative reward", -1],
    ["a fraction of a coin", 0.5],
  ])("%s is refused with its record, so the balance never parts from the records", async (_, coins) => {
    const t = await withDirectory();
    const alice = await memberOf(t, "U_ALICE");
    const before = await everythingStored(t);

    await expect(t.run((ctx) => rewardOf(ctx, alice, "weekly:2026-10-12:0", coins))).rejects.toThrow("not a whole number of coins");

    expect(await everythingStored(t)).toEqual(before);
  }, 30_000);

  test("a spend of 0 coins answers spent and writes nothing", async () => {
    const t = await withDirectory();
    const alice = await memberOf(t, "U_ALICE");
    const before = await everythingStored(t);

    expect(await spendOf(t, alice, 0)).toBe("spent");

    expect(await everythingStored(t)).toEqual(before);
  }, 30_000);

  test("a member who never earned a coin has a balance of 0", async () => {
    const t = await withDirectory();

    expect(await balanceOf(t, await memberOf(t, "U_BOB"))).toBe(0);
  }, 30_000);
});

async function withDirectory() {
  const t = testBackend();
  await t.run(async (ctx) => {
    for (const user of ["U_ALICE", "U_BOB", "U_CAROL"]) await ctx.db.insert("members", { workspace: "T1", user, kind: "member", timeZone: "UTC" });
  });
  return t;
}

async function withQuests(t: Backend) {
  flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "quests");
  return unlocksShippedBeforeAnyoneJoined(await flagsLoaded(t));
}

async function thank(t: Backend, recipient: string, at: string, words = saysWhy) {
  sentMessages += 1;
  vi.setSystemTime(new Date(at));
  const ts = `${Date.parse(at) / 1000}.${String(sentMessages).padStart(6, "0")}`;
  await post(t, [section(text(`${words} `), mention(recipient), emoji("taco"))], { user: "U_ALICE", ts });
  await settleInTimeOrder(t);
}

function rewardOf(ctx: MutationCtx, member: MemberId, key: string, coins: number, held: Pick<RewardRecord, "held"> = {}) {
  return recordReward(ctx, "T1", { member, key, xp: 0, coins, item: null, catalogueVersion: "2", at: Date.now(), ...held });
}

function openCrateOf(t: Backend, member: MemberId, slot: number) {
  return t.run((ctx) => openQuestCrate(ctx, member, { kind: "weekly", week: "2026-10-12", slot }));
}

function spendOf(t: Backend, member: MemberId, coins: number) {
  return t.run((ctx) => spend(ctx, { member, coins, for: { perk: "spark" }, at: Date.now() }));
}

function balanceOf(t: Backend, member: MemberId) {
  return t.run((ctx) => balanceRead(ctx, member));
}

async function recordedCoinsOf(t: Backend, member: MemberId) {
  return t.run(async (ctx) => {
    const effects = (await ctx.db.query("effectsRecords").collect()).filter((record) => record.member === member);
    const rewards = (await ctx.db.query("rewardRecords").collect()).filter((reward) => reward.member === member);
    const openings = (await ctx.db.query("crateOpenings").collect()).filter((opening) => opening.member === member);
    const spends = (await ctx.db.query("coinSpends").collect()).filter((spent) => spent.member === member);
    const rewardCoinsOf = ({ key, coins, held }: RewardRecord) => (held === true ? (openings.find((opening) => opening.key === key)?.applied?.coins ?? 0) : coins);
    const earned = effects.flatMap(({ coins = [] }) => coins).reduce((sum, line) => sum + line.coins, 0) + rewards.reduce((sum, reward) => sum + rewardCoinsOf(reward), 0);
    return earned - spends.reduce((sum, spent) => sum + spent.coins, 0);
  });
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
