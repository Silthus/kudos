import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/**
 * Offerings (#157, design plan #152 S3): a thoughtful kudos no longer credits its giver's Hog coins.
 * They wait at the tree as an offering until the giver claims them at the offering stone (or time
 * does after 30 days): the coins go into the wallet, the tree takes the offering's fuel, and every
 * five coins claimed over a lifetime drop a tree fruit.
 */

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
});
afterEach(() => vi.useRealTimers());

let ts = 1000;
async function message(giver: string, text: string) {
  const result = await t.mutation(internal.kudos.ingestMessage, {
    workspaceId: team.workspaceId,
    botUserId: "UBOT",
    giverSlackId: giver,
    text,
    channelId: "CGENERAL",
    channelName: "general",
    messageTs: `${ts++}.0001`,
  });
  vi.setSystemTime(Date.now() + 60_000);
  return result;
}

const player = (memberId: Id<"members">) =>
  t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique());
const tree = () => t.run((ctx) => ctx.db.query("trees").withIndex("by_workspace", (q) => q.eq("workspaceId", team.workspaceId)).unique());
const as = (memberId: Id<"members">) => signInAs(t, memberId);
const pending = async (memberId: Id<"members">) => (await as(memberId)).query(api.offerings.pending, {});
const claim = async (memberId: Id<"members">) => (await as(memberId)).mutation(api.offerings.claim, {});
/** Puts a player at level 3, where the wallet shows amounts. */
const walletOpen = (memberId: Id<"members">) => t.run(async (ctx) => {
  const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique();
  await ctx.db.patch(p!._id, { level: 3, xp: 200 });
});

describe("a thoughtful kudos makes an offering", () => {
  test("its coins wait at the tree instead of reaching the wallet", async () => {
    await message("UANA", "<@UBEN> :taco::taco: thanks for the thorough review");
    expect(await player(team.ana)).toMatchObject({ coins: 0 });
    await walletOpen(team.ana);
    expect(await pending(team.ana)).toEqual({ coins: 2, fuel: 1, offerings: 1 });
    expect((await (await as(team.ana)).query(api.game.mine, {})).wallet).toMatchObject({ balance: 20, fromKudos: 0, waiting: 2 });
  });

  test("a kudos without a reason, or a thank-back, offers nothing", async () => {
    await message("UANA", "<@UBEN> :taco:");
    await message("UBEN", "<@UANA> :taco: thanks for pairing with me");
    await message("UANA", "<@UBEN> :taco: thank you right back Ben");
    await walletOpen(team.ana);
    expect(await pending(team.ana)).toEqual({ coins: 0, fuel: 0, offerings: 0 });
  });

  test("below level 3 the stone says something waits, never how many coins", async () => {
    await message("UANA", "<@UBEN> :taco::taco: thanks for the thorough review");
    expect(await pending(team.ana)).toEqual({ coins: null, fuel: 1, offerings: 1 });
  });

  test("the earnings reply says the coins are waiting at the tree", async () => {
    await walletOpen(await t.run(async (ctx) => {
      const id = await ctx.db.insert("players", { workspaceId: team.workspaceId, memberId: team.ana, since: Date.now() - 1, xp: 0, level: 1, coins: 0 });
      return (await ctx.db.get(id))!.memberId;
    }));
    await message("UANA", "<@UBEN> :taco::taco: thanks for the thorough review");
    const reply = await t.run((ctx) =>
      ctx.db.query("notifications").filter((q) => q.and(q.eq(q.field("memberId"), team.ana), q.eq(q.field("category"), "giver_success"))).first(),
    );
    expect(reply?.earnings?.coins).toBe(2);
    const { earningsText } = await import("../convex/lib/xp");
    expect(earningsText(reply!.earnings!)).toContain("+2 Hog coins waiting at the tree");
  });
});

describe("claiming at the offering stone", () => {
  test("claims every offering at once: coins to the wallet, fuel to the tree, a claim event", async () => {
    await message("UANA", "<@UBEN> :taco::taco: thanks for the thorough review");
    await message("UANA", "<@UCLEO> :taco: thanks for the lovely design work");
    await walletOpen(team.ana);
    const result = await claim(team.ana);
    expect(result).toMatchObject({ coins: 3, fuel: 2, offerings: 2 });
    expect(await player(team.ana)).toMatchObject({ coins: 3 });
    expect(await tree()).toMatchObject({ fuel: 2 });
    expect(await pending(team.ana)).toEqual({ coins: 0, fuel: 0, offerings: 0 });
    const events = await t.run((ctx) => ctx.db.query("gameEvents").filter((q) => q.eq(q.field("kind"), "claim")).collect());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ memberId: team.ana, claimed: 3, fuel: 2, by: "player" });
  });

  test("is idempotent: a second press claims nothing and writes nothing", async () => {
    await message("UANA", "<@UBEN> :taco::taco: thanks for the thorough review");
    await walletOpen(team.ana);
    await claim(team.ana);
    expect(await claim(team.ana)).toMatchObject({ coins: 0, fuel: 0, offerings: 0, fruit: [] });
    expect(await player(team.ana)).toMatchObject({ coins: 2 });
    expect(await tree()).toMatchObject({ fuel: 1 });
    const events = await t.run((ctx) => ctx.db.query("gameEvents").filter((q) => q.eq(q.field("kind"), "claim")).collect());
    expect(events).toHaveLength(1);
  });

  test("drops one fruit per five coins claimed over a lifetime, into the inventory", async () => {
    await message("UANA", "<@UBEN> :taco::taco::taco: thanks for the thorough review");
    expect((await claim(team.ana)).fruit).toHaveLength(0); // 3 claimed: none yet
    vi.setSystemTime(Date.now() + 24 * 3_600_000);
    await message("UANA", "<@UCLEO> :taco::taco::taco: thanks for the lovely design work");
    const second = await claim(team.ana); // 6 claimed in all: the fifth coin drops one
    expect(second.fruit).toHaveLength(1);
    const inventory = await (await as(team.ana)).query(api.offerings.inventory, {});
    expect(inventory.reduce((n, i) => n + i.count, 0)).toBe(1);
    expect(inventory[0].fruit).toBe(second.fruit[0]);
  });

  test("the claim needs the game shown to the claimer", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    await expect(claim(team.ana)).rejects.toThrow(/game/);
    expect(await player(team.ana)).toMatchObject({ coins: 0 });
  });
});

const DAY = 24 * 3_600_000;
const revoke = async (kudosId: Id<"kudos">) => (await as(team.ana)).mutation(api.admin.revoke, { kudosId });
const kudosTo = (receiverId: Id<"members">) => t.run(async (ctx) => (await ctx.db.query("kudos").collect()).find((k) => k.receiverId === receiverId)!);
const offerings = () => t.run((ctx) => ctx.db.query("offerings").collect());
const settle = () => t.finishAllScheduledFunctions(vi.runAllTimers);
const claimEvents = () => t.run(async (ctx) => (await ctx.db.query("gameEvents").collect()).filter((e) => e.kind === "claim"));
/** Gain DMs about offerings claimed by time (a first kudos also brings a level-up DM). */
const gainDms = () =>
  t.run(async (ctx) => (await ctx.db.query("notifications").collect()).filter((n) => n.category === "gains" && n.gains?.some((g) => g.kind === "offering_claimed")));

describe("revokes", () => {
  test("revoking a kudos before its offering is claimed takes its line out of the offering", async () => {
    await message("UANA", "<@UBEN> <@UCLEO> :taco::taco: thanks for the thorough review");
    await revoke((await kudosTo(team.ben))._id);
    expect((await offerings()).map((o) => [o.coins, o.fuel, o.claimedAt])).toEqual([[2, 1, undefined]]);
    await revoke((await kudosTo(team.cleo))._id);
    expect(await offerings()).toHaveLength(0);
    expect(await player(team.ana)).toMatchObject({ coins: 0 });
  });

  test("revoking a kudos whose offering was claimed takes its coins and fuel back", async () => {
    await message("UANA", "<@UBEN> <@UCLEO> :taco::taco: thanks for the thorough review");
    await claim(team.ana);
    expect(await player(team.ana)).toMatchObject({ coins: 4, claimedCoins: 4 });
    expect(await tree()).toMatchObject({ fuel: 2 });
    await revoke((await kudosTo(team.ben))._id);
    expect(await player(team.ana)).toMatchObject({ coins: 2, claimedCoins: 2 });
    expect(await tree()).toMatchObject({ fuel: 1 });
    expect(await offerings()).toMatchObject([{ coins: 2, fuel: 1 }]);
  });

  test("a batch from before offerings had its coins credited straight away: a revoke takes them from the wallet", async () => {
    await message("UANA", "<@UBEN> :taco::taco: thanks for the thorough review");
    // As history from before #157 left it: no offering, the coins already in the wallet.
    await t.run(async (ctx) => {
      for (const o of await ctx.db.query("offerings").collect()) await ctx.db.delete(o._id);
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { coins: 2 });
    });
    await revoke((await kudosTo(team.ben))._id);
    expect(await player(team.ana)).toMatchObject({ coins: 0 });
  });
});

describe("claimed by time", () => {
  test("after 30 days an offering nobody claimed claims itself, with a DM", async () => {
    await message("UANA", "<@UBEN> :taco::taco: thanks for the thorough review");
    await walletOpen(team.ana);
    await t.mutation(internal.offerings.autoClaim, {});
    await settle();
    expect(await player(team.ana)).toMatchObject({ coins: 0 });
    vi.setSystemTime(Date.now() + 30 * DAY);
    await t.mutation(internal.offerings.autoClaim, {});
    await settle();
    expect(await player(team.ana)).toMatchObject({ coins: 2 });
    expect(await tree()).toMatchObject({ fuel: 1 });
    const dms = await gainDms();
    expect(dms).toHaveLength(1);
    expect(dms[0].webText).toContain("Your appreciation from September fed the tree"); // the workspace's month
    expect(dms[0].webText).toContain("2 Hog coins went into your wallet");
    expect(await claimEvents()).toMatchObject([{ by: "time", claimed: 2 }]);
  });
});

describe("the rebuild", () => {
  const rebuild = async () => {
    await t.mutation(internal.game.rebuildWorkspace, { workspaceId: team.workspaceId });
    await settle();
  };
  const shape = (os: { batchId: string; coins: number; fuel: number; claimedAt?: number }[]) =>
    os.map(({ batchId, coins, fuel, claimedAt }) => ({ batchId, coins, fuel, claimedAt })).sort((a, b) => a.batchId.localeCompare(b.batchId));

  test("replays offerings from the surviving kudos and keeps what was claimed", async () => {
    await message("UANA", "<@UBEN> :taco::taco: thanks for the thorough review");
    await claim(team.ana);
    await message("UANA", "<@UCLEO> :taco: thanks for the lovely design work");
    const before = { player: await player(team.ana), tree: await tree(), offerings: await offerings() };
    await rebuild();
    expect(await player(team.ana)).toMatchObject({ coins: before.player!.coins, claimedCoins: 2, claimedPeak: 2 });
    expect(await tree()).toMatchObject({ fuel: before.tree!.fuel });
    expect(shape(await offerings())).toEqual(shape(before.offerings));
    expect(await claimEvents()).toHaveLength(1);
  });

  test("run twice, the rebuild changes nothing the second time", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { offeringsFrom: 0 }));
    await message("UANA", "<@UBEN> :taco::taco: thanks for the thorough review");
    await claim(team.ana);
    vi.setSystemTime(Date.now() + 40 * DAY);
    await message("UANA", "<@UCLEO> :taco: thanks for the lovely design work");
    await rebuild();
    const once = { player: await player(team.ana), tree: await tree(), offerings: shape(await offerings()) };
    await rebuild();
    expect({ player: await player(team.ana), tree: await tree(), offerings: shape(await offerings()) }).toEqual(once);
    expect(once.player).toMatchObject({ coins: 2, claimedCoins: 2 });
    expect(once.offerings.map((o) => o.claimedAt === undefined)).toEqual(expect.arrayContaining([true, false]));
  });

  test("in a workspace from before offerings, a recent kudos whose coins were credited straight away stays credited", async () => {
    // As #90 left a kudos given last week: its coins in the wallet, no offering, and already spent.
    await message("UANA", "<@UBEN> :taco::taco: thanks for the thorough review");
    await t.run(async (ctx) => {
      for (const o of await ctx.db.query("offerings").collect()) await ctx.db.delete(o._id);
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { coins: 2 });
      await ctx.db.patch(team.ana, { coinsSpent: 2 });
    });
    vi.setSystemTime(Date.now() + 7 * DAY);
    await rebuild();
    expect(await player(team.ana)).toMatchObject({ coins: 2, claimedCoins: 2, claimedPeak: 2 });
    expect(await pending(team.ana)).toMatchObject({ offerings: 0 });
    expect(await t.query(internal.game.verifyMember, { memberId: team.ana })).toMatchObject({ coins: 2, eventCoins: 2 });
  });

  test("history older than 30 days counts as claimed, silently and without fruit; the tree takes its fuel", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { offeringsFrom: 0 }));
    await message("UANA", "<@UBEN> :taco::taco::taco::taco::taco: thanks for the thorough review");
    // As the demo's seeded year leaves it: kudos without offerings, played as offerings from the start.
    await t.run(async (ctx) => {
      for (const o of await ctx.db.query("offerings").collect()) await ctx.db.delete(o._id);
    });
    vi.setSystemTime(Date.now() + 31 * DAY);
    await rebuild();
    expect(await player(team.ana)).toMatchObject({ coins: 5, claimedCoins: 5, claimedPeak: 5 });
    expect(await tree()).toMatchObject({ fuel: 1 });
    expect(await t.run((ctx) => ctx.db.query("inventory").collect())).toHaveLength(0);
    expect((await gainDms()).map((n) => n.gains)).toEqual([]);
    // A later claim drops fruit only past the peak: 9 claimed in all, under 10.
    await message("UANA", "<@UCLEO> :taco::taco::taco::taco: thanks for the lovely design work");
    expect((await claim(team.ana)).fruit).toHaveLength(0);
  });
});

describe("tree fruit at the stall", () => {
  const give = (fruit: "sun" | "moon" | "amber" | "star" | "heart", count = 1) =>
    t.run(async (ctx) => {
      // The stall opens at level 5 (the Store's level).
      if (!(await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique())) {
        await ctx.db.insert("players", { workspaceId: team.workspaceId, memberId: team.ana, since: Date.now() - 1, xp: 400, level: 5, coins: 0 });
      }
      await ctx.db.insert("inventory", { workspaceId: team.workspaceId, memberId: team.ana, fruit, count });
    });
  const apply = async (fruit: "sun" | "moon" | "amber" | "star" | "heart") => (await as(team.ana)).mutation(api.offerings.applyFruit, { fruit });
  const held = async () => (await (await as(team.ana)).query(api.offerings.inventory, {})).map((i) => [i.fruit, i.count]);

  test("sun fruit sells for 3 Hog coins, counted as fruit", async () => {
    await give("sun", 2);
    expect(await apply("sun")).toMatchObject({ coins: 3 });
    expect(await player(team.ana)).toMatchObject({ coins: 3, fruitCoins: 3 });
    expect(await held()).toEqual([["sun", 1]]);
    expect(await t.run(async (ctx) => (await ctx.db.query("gameEvents").collect()).filter((e) => e.kind === "sale"))).toMatchObject([{ coins: 3, fruits: ["sun"] }]);
  });

  test("moon fruit restores a stamina, and is kept when stamina is full", async () => {
    await give("moon", 2);
    await apply("moon");
    expect(await player(team.ana)).toMatchObject({ stamina: 1 });
    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { stamina: 5 });
    });
    await expect(apply("moon")).rejects.toThrow(/full/);
    expect(await held()).toEqual([["moon", 1]]);
  });

  test("amber fruit is a Lucky charm charge; star fruit a home discount, one at a time; heart fruit a Super seed", async () => {
    await give("amber");
    await give("star", 2);
    await give("heart");
    await apply("amber");
    await apply("star");
    await expect(apply("star")).rejects.toThrow(/already/);
    await apply("heart");
    expect(await player(team.ana)).toMatchObject({ luckyCharms: 1, homeDiscount: 25, superSeeds: 1 });
    expect(await held()).toEqual([["star", 1]]);
  });

  test("a fruit you don't have can't be used", async () => {
    await give("sun");
    await expect(apply("heart")).rejects.toThrow(/no heart fruit/);
  });

  test("the stall opens at level 5: before that fruit waits on the shelf, and no coins leave the server", async () => {
    await give("sun");
    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { level: 2, xp: 30 });
    });
    await expect(apply("sun")).rejects.toThrow(/opens at level 5/);
    expect(await held()).toEqual([["sun", 1]]);
    expect(await player(team.ana)).toMatchObject({ coins: 0 });
  });

  test("the rebuild keeps fruit sold, and the coins it paid", async () => {
    await give("sun");
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await apply("sun");
    await t.mutation(internal.game.rebuildWorkspace, { workspaceId: team.workspaceId });
    await settle();
    expect(await player(team.ana)).toMatchObject({ coins: 3, fruitCoins: 3 });
  });
});

describe("a Super seed from a heart fruit", () => {
  test("plants a garden plant that starts as a Sapling, for the seed instead of coins", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { level: 5, xp: 400 });
      await ctx.db.insert("inventory", { workspaceId: team.workspaceId, memberId: team.ana, fruit: "heart", count: 1 });
    });
    const ana = await as(team.ana);
    await ana.mutation(api.offerings.applyFruit, { fruit: "heart" });
    await ana.mutation(api.gardens.plant, { teammateId: team.ben, superSeed: true });
    const garden = await ana.query(api.gardens.mine, { today: "2026-09-23" });
    expect(garden.open && garden.plants.map((p) => p.stage)).toEqual(["sapling"]);
    expect(await player(team.ana)).toMatchObject({ superSeeds: 0 });
    expect((await t.run((ctx) => ctx.db.get(team.ana)))?.coinsSpent).toBeUndefined();
  });
});
