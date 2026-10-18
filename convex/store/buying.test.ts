import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { opens, reachesLevel } from "../../testing/unlocks";
import { internal } from "../_generated/api";
import { runCommand } from "../commands/commands";
import { recordReward } from "../progression/progression";
import { balanceOf } from "../wallet/wallet";
import { lookup, type MemberId } from "../workspace/directory";
import { grantItem } from "./inventory";

const openedAt = Date.parse("2026-10-14T10:00:00Z");
const shipit = "custom:shipit";
const partyparrot = "custom:partyparrot";
const storeOn = ["xp-levels", "unlocks", "coins", "store", "custom-kudos-emoji"].map(onForEveryone);

let postHog: FakePostHog;
let rewards = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: openedAt });
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ST13 ST27: buyItem through D17, as the website calls it", () => {
  test("with 100 🪙, it spends them, adds the item to the collection with source store", async () => {
    const { t, member } = await memberWhoOpenedCoins(storeOn, { coins: 100 });

    expect(await buyItem(t, member, shipit, "website:juno:1")).toEqual({ kind: "bought", item: shipit });

    const inventory = await t.query(internal.store.inventory.inventoryOf, { member });
    expect(inventory?.owned.at(-1)).toEqual({ item: shipit, arrivedAt: openedAt });
    expect(inventory?.catalogue.find(({ item }) => item === shipit)?.onSale).toBe(false);
    expect(await collectionOf(t, member)).toEqual([{ item: shipit, source: "store" }]);
    expect(await coinsOf(t, member)).toBe(0);
  });

  test("with 60 🪙, it is refused no-coins and changes nothing", async () => {
    const { t, member } = await memberWhoOpenedCoins(storeOn, { coins: 60 });

    expect(await buyItem(t, member, shipit, "website:juno:1")).toEqual({ kind: "refused", item: shipit, reason: "no-coins" });

    expect(await collectionOf(t, member)).toEqual([]);
    expect(await coinsOf(t, member)).toBe(60);
  });

  test("an owned item is refused owned, before the coins are counted", async () => {
    const { t, member } = await memberWhoOpenedCoins(storeOn, { coins: 100 });
    await buyItem(t, member, shipit, "website:juno:1");

    expect(await buyItem(t, member, shipit, "website:juno:2")).toEqual({ kind: "refused", item: shipit, reason: "owned" });
    expect(await coinsOf(t, member)).toBe(0);
  });

  test.each([
    ["the workspace's own emoji", shipit, "shipit"],
    ["a standard emoji", "kudos-emoji-rocket", "taco"],
    ["an unknown ID", "kudos-emoji-unicorn", "taco"],
    ["the starter", "kudos-emoji-hedgehog", "taco"],
    ["a silver tier's emoji", "kudos-emoji-ribbon", "taco"],
  ])("%s is refused not-for-sale, before ownership", async (_, item, kudosEmoji) => {
    const { t, member } = await memberWhoOpenedCoins(storeOn, { coins: 100, kudosEmoji });
    await t.run((ctx) => grantItem(ctx, { member, item: "kudos-emoji-ribbon", source: "tier", arrivedAt: openedAt }));

    expect(await buyItem(t, member, item, "website:juno:1")).toEqual({ kind: "refused", item, reason: "not-for-sale" });
    expect(await coinsOf(t, member)).toBe(100);
  });

  test("with the store shown and Coins unopened, it is refused coins-not-open, first of all", async () => {
    const { t, member } = await memberWhoOpenedCoins(storeOn, { coins: 0, opening: [] });

    expect(await buyItem(t, member, "kudos-emoji-unicorn", "website:juno:1")).toEqual({ kind: "refused", item: "kudos-emoji-unicorn", reason: "coins-not-open" });
  });

  test.each([
    ["the store is off", [...["xp-levels", "unlocks", "coins"].map(onForEveryone), offForEveryone("store")]],
    ["the store isn't created", ["xp-levels", "unlocks", "coins"].map(onForEveryone)],
    ["coins are off", [...["xp-levels", "unlocks", "store"].map(onForEveryone), offForEveryone("coins")]],
  ])("where %s, it answers null and writes nothing", async (_, definitions) => {
    const { t, member } = await memberWhoOpenedCoins(storeOn, { coins: 100 });
    await flagsFromPostHog(t, postHog, ...definitions);
    const before = await storedRowsOf(t);

    expect(await buyItem(t, member, shipit, "website:juno:1")).toBeNull();

    expect(await storedRowsOf(t)).toEqual(before);
  });
});

describe("a purchase spends coins once per idempotency key", () => {
  test("the same key answers its stored outcome and does nothing else, whatever changed since", async () => {
    const { t, member } = await memberWhoOpenedCoins(storeOn, { coins: 160 });

    expect(await buyItem(t, member, shipit, "slack:1")).toEqual({ kind: "bought", item: shipit });
    expect(await buyItem(t, member, shipit, "slack:1")).toEqual({ kind: "bought", item: shipit });
    expect(await buyItem(t, member, partyparrot, "slack:1")).toEqual({ kind: "bought", item: shipit });
    expect(await buyItem(t, member, partyparrot, "slack:2")).toEqual({ kind: "refused", item: partyparrot, reason: "no-coins" });
    await earn(t, member, 100);
    expect(await buyItem(t, member, partyparrot, "slack:2")).toEqual({ kind: "refused", item: partyparrot, reason: "no-coins" });
    expect(await buyItem(t, member, partyparrot, "slack:3")).toEqual({ kind: "bought", item: partyparrot });

    expect(await collectionOf(t, member)).toEqual([
      { item: shipit, source: "store" },
      { item: partyparrot, source: "store" },
    ]);
    expect(await spendsOf(t, member)).toEqual([
      { coins: 100, for: { item: shipit } },
      { coins: 100, for: { item: partyparrot } },
    ]);
    expect(await coinsOf(t, member)).toBe(60);
    expect(await coinsOf(t, member)).toBe(await recordedCoinsOf(t, member));
  });
});

async function buyItem(t: Backend, member: MemberId, item: string, key: string) {
  return t.run(async (ctx) => {
    const person = await lookup(ctx, "T1", (await ctx.db.get(member))!.user);
    if (person?.kind !== "member") throw new Error("not a member");
    return runCommand(ctx, "T1", person, { type: "buyItem", item }, { surface: "slack", idempotencyKey: key });
  });
}

async function earn(t: Backend, member: MemberId, coins: number) {
  rewards += 1;
  await t.run((ctx) => recordReward(ctx, "T1", { member, key: `test:earned:${rewards}`, xp: 0, coins, item: null, catalogueVersion: "2", at: Date.now() }));
}

async function coinsOf(t: Backend, member: MemberId) {
  return t.run((ctx) => balanceOf(ctx, member));
}

async function collectionOf(t: Backend, member: MemberId) {
  return (await t.run((ctx) => ctx.db.query("collection").collect())).filter((row) => row.member === member).map(({ item, source }) => ({ item, source }));
}

async function spendsOf(t: Backend, member: MemberId) {
  return (await t.run((ctx) => ctx.db.query("coinSpends").collect())).filter((row) => row.member === member).map(({ coins, for: paidFor }) => ({ coins, for: paidFor }));
}

async function recordedCoinsOf(t: Backend, member: MemberId) {
  return t.run(async (ctx) => {
    const rewards = (await ctx.db.query("rewardRecords").collect()).filter((reward) => reward.member === member);
    const spends = (await ctx.db.query("coinSpends").collect()).filter((spent) => spent.member === member);
    return rewards.reduce((sum, reward) => sum + reward.coins, 0) - spends.reduce((sum, spent) => sum + spent.coins, 0);
  });
}

async function storedRowsOf(t: Backend) {
  return t.run(async (ctx) => ({
    collection: await ctx.db.query("collection").collect(),
    itemPurchases: await ctx.db.query("itemPurchases").collect(),
    coinSpends: await ctx.db.query("coinSpends").collect(),
    wallets: await ctx.db.query("wallets").collect(),
  }));
}

async function memberWhoOpenedCoins(definitions: FlagDefinition[], { coins, kudosEmoji = "taco", opening = ["coins"] as Array<"coins"> }: { coins: number; kudosEmoji?: string; opening?: Array<"coins"> }) {
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji, baseAllowance: 10 }));
  await unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
  const member = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_JUNO", kind: "member", asOf: 0 }));
  await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: 1000, pointsSpent: 0 }));
  await reachesLevel(t, member, 6);
  for (const feature of opening) await opens(t, member, feature);
  if (coins > 0) await earn(t, member, coins);
  await t.run(async (ctx) => {
    for (const name of ["shipit", "partyparrot"]) await ctx.db.insert("customKudosEmoji", { workspace: "T1", name, url: `https://emoji.slack-edge.com/T1/${name}/0a1b2c.png`, pickedAt: openedAt });
  });
  return { t, member };
}
