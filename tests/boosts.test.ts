import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { startBonusDay } from "../convex/boosts";
import type { BoostSource } from "../convex/lib/boosts";
import { NOW, seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

/** Bonus days and company-wide boosters (#97, #55 §G9, G10): double XP and coins from qualifying kudos. */

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
});
afterEach(() => vi.useRealTimers());

const HOUR = 3_600_000;
let ts = 1000;
/** A Slack message; the clock moves on a minute after each one. */
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

/** The seam the team garden (#96) and the Block party capstone call. Today: a booster; later: scheduled. */
const bonusDay = (day: string, source: BoostSource = day === TODAY ? "booster" : "schedule", by?: Id<"members">) =>
  t.run(async (ctx) => {
    const workspace = (await ctx.db.get(team.workspaceId)) as Doc<"workspaces">;
    return await startBonusDay(ctx, workspace, day, source, { by });
  });

const lastEarnings = async (memberId: Id<"members">) => {
  const notes = await t.run((ctx) => ctx.db.query("notifications").withIndex("by_member", (q) => q.eq("memberId", memberId)).collect());
  return notes.filter((n) => n.category === "giver_success").at(-1)?.earnings;
};

/** XP at the floor of each level (the §G3 curve), so a fixture's level matches its XP. */
const FLOOR: Record<number, number> = { 1: 0, 2: 30, 3: 75, 4: 175, 5: 350, 6: 600 };

/** Makes `memberId` a player at `level` with exactly `balance` Hog coins (10 per level reached, the rest from kudos). */
async function playerWith(memberId: Id<"members">, { level, balance, skills }: { level: number; balance: number; skills?: Record<string, number> }) {
  await t.run(async (ctx) => {
    const existing = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique();
    const row = { xp: FLOOR[level], level, coins: balance - 10 * (level - 1), ...(skills ? { skills } : {}) };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("players", { workspaceId: team.workspaceId, memberId, since: NOW.getTime() - 1, ...row });
  });
}

const shopItem = async (memberId: Id<"members">, key: string) => {
  const shop = await (await signInAs(t, memberId)).query(api.store.shop, { today: TODAY });
  if (shop.access !== "open") throw new Error(`shop ${shop.access}`);
  return shop.items.find((i) => i.key === key)!;
};
const buy = async (memberId: Id<"members">, item: string) => {
  const { price } = await shopItem(memberId, item);
  return await (await signInAs(t, memberId)).mutation(api.store.buyItem, { item, expectedPrice: price });
};
const boosts = () => t.run((ctx) => ctx.db.query("boosts").collect());

const giveEvents = () =>
  t.run(async (ctx) =>
    (await ctx.db.query("gameEvents").collect())
      .map(({ _id, _creationTime, ...e }) => e)
      .sort((a, b) => a.at - b.at || a.memberId.localeCompare(b.memberId) || a.kind.localeCompare(b.kind)),
  );

describe("a bonus day doubles XP and Hog coins from qualifying kudos", () => {
  test("started today, a thoughtful kudos earns double and the reply says so", async () => {
    expect(await bonusDay(TODAY)).not.toBeNull();
    await message("UANA", "<@UBEN> :taco::taco: thanks for the thorough review");
    // 10 + new connection 10, doubled; two tacos to one person: 2 coins, doubled.
    expect(await player(team.ana)).toMatchObject({ xp: 40, coins: 4 });
    expect(await lastEarnings(team.ana)).toMatchObject({ xp: 40, boost: "double", bonuses: [{ kind: "new_connection", xp: 10 }, { kind: "boost", xp: 20 }] });
  });

  test("never doubles kudos amounts, the allowance, thin kudos or receiving XP", async () => {
    await message("UBEN", "<@UCLEO> :taco: you made the launch smooth"); // Ben is a player now
    await bonusDay(TODAY);
    await message("UANA", "<@UBEN> :taco::taco: thanks for all the help today");
    await message("UCLEO", "<@UANA> :taco:"); // no reason: thin
    const ben = await t.run((ctx) => ctx.db.get(team.ben));
    expect(ben?.totalReceived).toBe(2);
    expect((await player(team.ben))?.xp).toBe(20 + 5); // receiving: 5, as any day
    expect(await player(team.cleo)).toMatchObject({ xp: 2, coins: 0 });
  });

  test("the day before and the day after earn as usual; a boost started mid-day only counts from then", async () => {
    await bonusDay("2026-09-24");
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    expect(await player(team.ana)).toMatchObject({ xp: 20, coins: 1 });
    vi.setSystemTime(NOW.getTime() + 24 * HOUR);
    await message("UANA", "<@UCLEO> :taco: thanks for the thorough review");
    expect(await player(team.ana)).toMatchObject({ xp: 20 + 40, coins: 1 + 2 });
    vi.setSystemTime(NOW.getTime() + 48 * HOUR);
    await message("UANA", "<@UBEN> :taco: thanks for the design review");
    expect(await player(team.ana)).toMatchObject({ xp: 60 + 8, coins: 3 + 1 }); // same week, a day later: 8
  });

  test("a booster bought mid-day doubles only what comes after it", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await bonusDay(TODAY, "booster", team.cleo);
    await message("UBEN", "<@UCLEO> :taco: thanks for the thorough review");
    expect(await player(team.ana)).toMatchObject({ xp: 20, coins: 1 });
    expect(await player(team.ben)).toMatchObject({ xp: 40, coins: 2 });
  });

  test("a booster bought while a kudos was in flight never starts before a kudos already given (review #1)", async () => {
    // Convex fixes Date.now() when a mutation starts: a purchase that started a moment before a give
    // committed may commit after it. It must not start before that kudos, or a rebuild would double it.
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    const [given] = await t.run((ctx) => ctx.db.query("kudos").collect());
    const id = await t.run(async (ctx) => startBonusDay(ctx, (await ctx.db.get(team.workspaceId))!, TODAY, "booster", { now: given.at - 1 }));
    expect((await t.run((ctx) => ctx.db.get(id!)))?.from).toBe(given.at + 1);
    const before = await giveEvents();
    await t.mutation(internal.game.rebuildWorkspace, { workspaceId: team.workspaceId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await giveEvents()).toEqual(before);
    expect(await player(team.ana)).toMatchObject({ xp: 20, coins: 1 });
  });

  test("the team garden and the capstone can only start a bonus day in advance (review #9)", async () => {
    expect(await bonusDay(TODAY, "team_garden")).toBeNull();
    expect(await bonusDay(TODAY, "capstone")).toBeNull();
    expect(await bonusDay(TODAY, "schedule")).toBeNull();
    expect(await bonusDay("2026-09-24", "team_garden")).not.toBeNull();
  });

  test("only one boost a day: a second one for the same day is refused", async () => {
    expect(await bonusDay(TODAY)).not.toBeNull();
    expect(await bonusDay(TODAY, "team_garden")).toBeNull();
  });

  test("a revoke takes back exactly what the boosted kudos earned, and a rebuild replays the boost", async () => {
    await message("UBEN", "<@UCLEO> :taco: thanks for the thorough review"); // Ben: 20, 1 coin
    await bonusDay(TODAY);
    await message("UANA", "<@UCLEO> :taco::taco: thanks for the thorough review"); // 20 × 2 = 40, 2 × 2 = 4 coins
    await message("UANA", "<@UBEN> :taco: and for the pairing afterwards"); // 40, cut to the cap's last 10; 2 coins
    expect(await player(team.ana)).toMatchObject({ xp: 50, coins: 6 });
    expect(await player(team.ben)).toMatchObject({ xp: 20 + 5, coins: 1 }); // receiving is never doubled
    const before = await giveEvents();
    await t.mutation(internal.game.rebuildWorkspace, { workspaceId: team.workspaceId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await giveEvents()).toEqual(before);
    expect(await player(team.ana)).toMatchObject({ xp: 50, coins: 6 });

    const toCleo = await t.run(async (ctx) => (await ctx.db.query("kudos").collect()).find((k) => k.giverId === team.ana && k.receiverId === team.cleo)!);
    await (await signInAs(t, team.ana)).mutation(api.admin.revoke, { kudosId: toCleo._id });
    expect(await player(team.ana)).toMatchObject({ xp: 10, coins: 2 }); // later kudos keep what they earned
  });
});

describe("company-wide boosters in the Store", () => {
  test("buying one starts it for the whole workspace until the end of the day", async () => {
    await playerWith(team.ben, { level: 5, balance: 60 });
    expect(await shopItem(team.ben, "boosterDouble")).toMatchObject({ name: "Kudos booster: Double", price: 40, perMonth: 1, blocked: null });
    expect(await buy(team.ben, "boosterDouble")).toEqual({ balance: 20 });
    expect(await boosts()).toMatchObject([{ dayKey: TODAY, kind: "double", source: "booster", by: team.ben, from: NOW.getTime() }]);
    await message("UANA", "<@UCLEO> :taco: thanks for the thorough review");
    expect(await player(team.ana)).toMatchObject({ xp: 40, coins: 2 });
  });

  test("the conditional ones double only their kind of kudos", async () => {
    await playerWith(team.ben, { level: 5, balance: 60 });
    await buy(team.ben, "boosterNewConnections");
    await message("UANA", "<@UCLEO> :taco: thanks for the thorough review"); // a new connection: 40
    await message("UANA", "<@UCLEO> :taco: and for the pairing afterwards"); // 2nd today: 2, not doubled
    expect(await player(team.ana)).toMatchObject({ xp: 42, coins: 3 });
  });

  test("only one at a time: once a boost is on today, every booster waits until tomorrow", async () => {
    await playerWith(team.ben, { level: 5, balance: 100 });
    await playerWith(team.cleo, { level: 5, balance: 100 });
    await buy(team.ben, "boosterRekindles");
    expect(await shopItem(team.cleo, "boosterDouble")).toMatchObject({ blocked: "The rekindle booster is on today already. One at a time: try again tomorrow." });
    await expect(buy(team.cleo, "boosterDouble")).rejects.toThrow(/on today already/);
    expect((await t.run((ctx) => ctx.db.get(team.cleo)))?.coinsSpent).toBeUndefined();
  });

  test("the unsung booster doubles thanks for someone nobody thanked in 14 days, and nothing else", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility: "everyone" }));
    await playerWith(team.cleo, { level: 5, balance: 60 });
    await buy(team.cleo, "boosterUnsung");
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review"); // 10 + new connection 10 + unsung 5, doubled
    expect(await player(team.ana)).toMatchObject({ xp: 50, coins: 2 });
    await message("UCLEO", "<@UBEN> :taco: thanks for the thorough review"); // Ben was thanked a minute ago: 20, as usual
    expect(await player(team.cleo)).toMatchObject({ xp: 350 + 20, coins: 20 + 1 });
  });

  test("the unsung booster needs received counts visible to everyone", async () => {
    await playerWith(team.ben, { level: 5, balance: 100 });
    expect(await shopItem(team.ben, "boosterUnsung")).toMatchObject({ blocked: expect.stringMatching(/received counts visible to everyone/) });
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility: "everyone" }));
    expect(await shopItem(team.ben, "boosterUnsung")).toMatchObject({ blocked: null, price: 20 });
  });
});

describe("members who leave", () => {
  test("removing the member who bought a booster keeps the boost for everyone else's history, without their name", async () => {
    await playerWith(team.ben, { level: 5, balance: 60 });
    await buy(team.ben, "boosterDouble");
    await message("UANA", "<@UCLEO> :taco: thanks for the thorough review");
    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UBEN" });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 5000);
    const [boost] = await boosts();
    expect(boost).toMatchObject({ dayKey: TODAY, kind: "double" });
    expect(boost.by).toBeUndefined();
    expect(boost.purchaseId).toBeUndefined();
    await t.mutation(internal.game.rebuildWorkspace, { workspaceId: team.workspaceId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await player(team.ana)).toMatchObject({ xp: 40, coins: 2 });
  });
});

describe("the Lucky charm", () => {
  const receiverRarities = async (memberId: Id<"members">) =>
    (await t.run((ctx) => ctx.db.query("notifications").withIndex("by_member", (q) => q.eq("memberId", memberId)).collect()))
      .filter((n) => n.category === "receiver_success")
      .map((n) => n.rarity);

  test("costs 12 Hog coins, 3 less for each rank of Charm maker", async () => {
    await playerWith(team.ben, { level: 5, balance: 100 });
    expect(await shopItem(team.ben, "luckyCharm")).toMatchObject({ name: "Lucky charm", price: 12 });
    await playerWith(team.ben, { level: 6, balance: 100, skills: { emoji_variants: 1, charm_discount: 2 } });
    expect(await shopItem(team.ben, "luckyCharm")).toMatchObject({ price: 6 });
  });

  test("the next 3 thoughtful kudos roll their receivers' messages at Uncommon or better", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // without a charm: always Common
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { dailyLimit: 10 }));
    await playerWith(team.ana, { level: 5, balance: 50 });
    await buy(team.ana, "luckyCharm");
    expect(await player(team.ana)).toMatchObject({ luckyCharms: 3 });
    expect(await (await signInAs(t, team.ana)).query(api.game.mine, {})).toMatchObject({ luckyCharms: 3 });
    await message("UANA", "<@UBEN> <@UCLEO> :taco: thanks for the launch"); // one message: one charge, both receivers
    await message("UANA", "<@UBEN> :taco:"); // no reason: not thoughtful, keeps the charge
    await message("UANA", "<@UCLEO> :taco: thanks for the review");
    await message("UANA", "<@UBEN> :taco: thanks for the pairing");
    await message("UANA", "<@UBEN> :taco: thanks again for the pairing");
    expect(await receiverRarities(team.ben)).toEqual(["uncommon", "common", "uncommon", "common"]);
    expect(await receiverRarities(team.cleo)).toEqual(["uncommon", "uncommon"]);
    expect(await player(team.ana)).toMatchObject({ luckyCharms: 0 });
  });

  test("waits while the giver hides the game: no use is spent where they can't see it (review #7)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    await playerWith(team.ana, { level: 5, balance: 50 });
    await buy(team.ana, "luckyCharm");
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    await message("UANA", "<@UBEN> :taco: thanks for the launch");
    expect(await receiverRarities(team.ben)).toEqual(["common"]);
    expect(await player(team.ana)).toMatchObject({ luckyCharms: 3 });
  });

  test("isn't sold where receivers get no kudos messages", async () => {
    await playerWith(team.ana, { level: 5, balance: 50 });
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { notifyReceiver: false }));
    expect(await shopItem(team.ana, "luckyCharm")).toMatchObject({ blocked: expect.stringMatching(/receivers get no message/) });
  });
});
