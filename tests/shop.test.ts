import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { levelForXp } from "../convex/lib/xp";
import { all, NOW, seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

/** The Store priced in Hog coins (#91, #55 §G5, ADR 0002): built-in game items that apply instantly. */

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
});
afterEach(() => vi.useRealTimers());

/** XP at the floor of each level (the §G3 curve), so a fixture's level matches its XP. */
const FLOOR: Record<number, number> = { 1: 0, 2: 30, 3: 75, 4: 175, 5: 350, 6: 600, 9: 1650 };

/**
 * Makes `memberId` a player at `level` whose balance is exactly `balance`: level-up coins are
 * 10 per level reached, the rest comes from kudos.
 */
async function playerWith(memberId: Id<"members">, { level, balance }: { level: number; balance: number }) {
  expect(levelForXp(FLOOR[level])).toBe(level);
  await t.run(async (ctx) => {
    const existing = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique();
    const row = { xp: FLOOR[level], level, coins: balance - 10 * (level - 1) };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("players", { workspaceId: team.workspaceId, memberId, since: NOW.getTime(), ...row });
  });
}

const shopOf = async (memberId: Id<"members">) => (await signInAs(t, memberId)).query(api.store.shop, { today: TODAY });
const memberDoc = (id: Id<"members">) => t.run((ctx) => ctx.db.get(id)).then((m) => m!);

describe("the shop's door", () => {
  test("is locked below level 5, saying how to get there and without the balance below level 3", async () => {
    expect(await shopOf(team.ben)).toEqual({ access: "locked", level: 1, unlockLevel: 5, how: expect.stringMatching(/level 5/), balance: null });
    await playerWith(team.ben, { level: 4, balance: 45 });
    expect(await shopOf(team.ben)).toMatchObject({ access: "locked", level: 4, balance: 45 });
  });

  test("is gone while the game is off, and says so while the member hides the game", async () => {
    await playerWith(team.ben, { level: 6, balance: 90 });
    await t.run((ctx) => ctx.db.patch(team.ben, { gameHidden: true }));
    expect(await shopOf(team.ben)).toEqual({ access: "hidden" });
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    expect(await shopOf(team.ben)).toEqual({ access: "off" });
  });

  test("opens at level 5 with the balance and the game items, priced in Hog coins", async () => {
    await playerWith(team.ben, { level: 5, balance: 52 });
    const shop = await shopOf(team.ben);
    expect(shop).toMatchObject({ access: "open", balance: 52, realRewards: false });
    if (shop.access !== "open") throw new Error("closed");
    expect(shop.items.find((i) => i.key === "spreeJoin")).toMatchObject({ price: 8, perMonth: 5, boughtThisMonth: 0, blocked: null });
    // Nothing taken on the skill tree yet (#92): shown, but there's nothing to reset.
    expect(shop.items.find((i) => i.key === "skillReset")).toMatchObject({ price: 50, blocked: "Your tree has no skills to reset." });
  });

  test("the session tells the web app whether to show the Store, from the wallet's level", async () => {
    const ben = await signInAs(t, team.ben);
    expect((await ben.query(api.session.viewer, {})) as unknown).toMatchObject({ workspace: { storeEnabled: false } });
    await playerWith(team.ben, { level: 3, balance: 20 });
    expect((await ben.query(api.session.viewer, {})) as unknown).toMatchObject({ workspace: { storeEnabled: true, realRewardsEnabled: false } });
    await t.run((ctx) => ctx.db.patch(team.ben, { gameHidden: true }));
    expect((await ben.query(api.session.viewer, {})) as unknown).toMatchObject({ workspace: { storeEnabled: false } });
  });
});

describe("buying a game item", () => {
  const buy = async (memberId: Id<"members">, item: string, expectedPrice = 8) =>
    (await signInAs(t, memberId)).mutation(api.store.buyItem, { item, expectedPrice });

  test("applies instantly: the price leaves the balance and the purchase is recorded, no approval", async () => {
    await playerWith(team.ben, { level: 5, balance: 52 });
    expect(await buy(team.ben, "spreeJoin")).toEqual({ balance: 44 });
    expect(await memberDoc(team.ben)).toMatchObject({ coinsSpent: 8 });
    const [purchase] = await t.run((ctx) => ctx.db.query("itemPurchases").collect());
    expect(purchase).toMatchObject({ memberId: team.ben, item: "spreeJoin", price: 8, month: "2026-09" });
    const shop = await shopOf(team.ben);
    expect(shop).toMatchObject({ balance: 44 });
    if (shop.access === "open") expect(shop.items.find((i) => i.key === "spreeJoin")).toMatchObject({ boughtThisMonth: 1 });
  });

  test("is refused below level 5, when the game is off or hidden, and for bots", async () => {
    await playerWith(team.ben, { level: 4, balance: 500 });
    await expect(buy(team.ben, "spreeJoin")).rejects.toThrow(/level 5/);
    await playerWith(team.ben, { level: 5, balance: 500 });
    await t.run((ctx) => ctx.db.patch(team.ben, { gameHidden: true }));
    await expect(buy(team.ben, "spreeJoin")).rejects.toThrow(/hidden the game/);
    await t.run((ctx) => ctx.db.patch(team.ben, { gameHidden: undefined }));
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    await expect(buy(team.ben, "spreeJoin")).rejects.toThrow(/game isn't on/);
    expect((await memberDoc(team.ben)).coinsSpent).toBeUndefined();
  });

  test("needs the whole price in the balance", async () => {
    await playerWith(team.ben, { level: 5, balance: 47 });
    await t.run((ctx) => ctx.db.patch(team.ben, { coinsSpent: 40 })); // 7 left
    await expect(buy(team.ben, "spreeJoin")).rejects.toThrow("You need 1 more Hog coin for this.");
    expect(await all(t, "players")).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("itemPurchases").collect())).toHaveLength(0);
  });

  test("refuses an unknown item, a price that changed since the page rendered, and an item not for sale yet", async () => {
    await playerWith(team.ben, { level: 5, balance: 500 });
    await expect(buy(team.ben, "goldenTaco")).rejects.toThrow(/isn't in the Store/);
    await expect(buy(team.ben, "spreeJoin", 5)).rejects.toThrow(/price changed to 8 Hog coins/);
    await expect(buy(team.ben, "skillReset", 50)).rejects.toThrow(/no skills to reset/);
    expect((await memberDoc(team.ben)).coinsSpent).toBeUndefined();
  });

  test("stops at the monthly limit, and the next workspace month starts afresh", async () => {
    await playerWith(team.ben, { level: 5, balance: 500 });
    for (let i = 0; i < 5; i++) await buy(team.ben, "spreeJoin");
    await expect(buy(team.ben, "spreeJoin")).rejects.toThrow(/5 a month/);
    vi.setSystemTime(new Date("2026-09-30T22:30:00Z")); // already October in Berlin
    expect(await buy(team.ben, "spreeJoin")).toEqual({ balance: 500 - 6 * 8 });
    const shop = await (await signInAs(t, team.ben)).query(api.store.shop, { today: "2026-10-01" });
    if (shop.access === "open") expect(shop.items.find((i) => i.key === "spreeJoin")).toMatchObject({ boughtThisMonth: 1 });
  });

  test("signed-out visitors can't shop", async () => {
    await expect(t.query(api.store.shop, { today: TODAY })).rejects.toThrow();
    await expect(t.mutation(api.store.buyItem, { item: "spreeJoin", expectedPrice: 8 })).rejects.toThrow();
  });
});

describe("the skill-tree reset (#92)", () => {
  const skillsTaken = (memberId: Id<"members">, skills: Record<string, number>, skillResets?: number) =>
    t.run(async (ctx) => {
      const p = (await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique())!;
      await ctx.db.patch(p._id, { skills, skillResets });
    });

  test("returns every skill point for the price the skill tree charges, recorded like a reset on the tree", async () => {
    await playerWith(team.ben, { level: 6, balance: 120 });
    await skillsTaken(team.ben, { pathfinder: 2 }, 1);
    const ben = await signInAs(t, team.ben);
    const shop = await ben.query(api.store.shop, { today: TODAY });
    if (shop.access !== "open") throw new Error("closed");
    expect(shop.items.find((i) => i.key === "skillReset")).toMatchObject({ price: 100, blocked: null });
    expect(await ben.mutation(api.store.buyItem, { item: "skillReset", expectedPrice: 100 })).toEqual({ balance: 20 });
    const player = await t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ben)).unique());
    expect([player!.skills, player!.skillResets]).toEqual([undefined, 2]);
    expect(await t.run((ctx) => ctx.db.query("skillChanges").collect())).toMatchObject([{ memberId: team.ben, kind: "reset", coins: 100 }]);
    expect((await memberDoc(team.ben)).coinsSpent).toBe(100);
    // The skill tree page shows the next, dearer reset.
    expect(await ben.query(api.skills.mine, {})).toMatchObject({ resetCost: 200 });
  });

  test("can't be handed back in the demo: the points are already back", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { isDemo: true }));
    await playerWith(team.ben, { level: 6, balance: 120 });
    await skillsTaken(team.ben, { pathfinder: 1 });
    const ben = await signInAs(t, team.ben);
    await ben.mutation(api.store.buyItem, { item: "skillReset", expectedPrice: 50 });
    await ben.mutation(api.demo.handBackRewards, {});
    expect((await memberDoc(team.ben)).coinsSpent).toBe(50);
  });
});

describe("the balance behind a purchase", () => {
  const buy = async (memberId: Id<"members">) => (await signInAs(t, memberId)).mutation(api.store.buyItem, { item: "spreeJoin", expectedPrice: 8 });

  test("a revoke that takes the balance below zero blocks spending until it's positive again", async () => {
    // Ben reaches level 5 through kudos, spends, and then a kudos behind his coins is revoked.
    await playerWith(team.ben, { level: 5, balance: 48 });
    await buy(team.ben);
    await buy(team.ben);
    await buy(team.ben);
    await buy(team.ben);
    await buy(team.ben); // 8 left
    await t.run(async (ctx) => {
      const p = (await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ben)).unique())!;
      await ctx.db.patch(p._id, { coins: (p.coins ?? 0) - 11 }); // what a revoke of 11 coins' kudos does
    });
    const shop = await shopOf(team.ben);
    expect(shop).toMatchObject({ access: "open", balance: -3 });
    vi.setSystemTime(new Date("2026-10-05T10:00:00Z")); // a new month, so only the balance stands in the way
    await expect(buy(team.ben)).rejects.toThrow(/balance is below zero/);
  });

  test("two purchases sent at once for the same coins can't both spend them (each re-reads the balance in its transaction)", async () => {
    await playerWith(team.ben, { level: 5, balance: 12 });
    const ben = await signInAs(t, team.ben);
    const results = await Promise.allSettled([
      ben.mutation(api.store.buyItem, { item: "spreeJoin", expectedPrice: 8 }),
      ben.mutation(api.store.buyItem, { item: "spreeJoin", expectedPrice: 8 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await memberDoc(team.ben)).toMatchObject({ coinsSpent: 8 });
  });

  test("a helper holding a stale member document still sees what was spent since", async () => {
    await playerWith(team.ben, { level: 5, balance: 12 });
    const workspace = (await t.run((ctx) => ctx.db.get(team.workspaceId)))!;
    const stale = await memberDoc(team.ben);
    const { purchaseItem } = await import("../convex/store");
    await t.run((ctx) => purchaseItem(ctx, { workspace, member: stale, item: "spreeJoin", expectedPrice: 8, now: Date.now() }));
    await expect(t.run((ctx) => purchaseItem(ctx, { workspace, member: stale, item: "spreeJoin", expectedPrice: 8, now: Date.now() }))).rejects.toThrow(
      /need 4 more/,
    );
  });
});

describe("the invariant", () => {
  test("coins spent always equal what the recorded purchases cost, and no spend ever took the balance below zero", async () => {
    // A seeded walk of purchases, admin adjustments and revokes (coins taken back) for three players.
    let seed = 91;
    const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
    const players = [team.ben, team.cleo, team.ana];
    for (const id of players) await playerWith(id, { level: 5, balance: 40 });
    const as = new Map<Id<"members">, Awaited<ReturnType<typeof signInAs>>>();
    for (const id of players) as.set(id, await signInAs(t, id));
    const admin = as.get(team.ana)!;
    for (let step = 0; step < 60; step++) {
      const who = players[Math.floor(rand() * players.length)];
      const roll = rand();
      if (roll < 0.6) {
        const before = await as.get(who)!.query(api.store.shop, { today: TODAY });
        let bought = true;
        try {
          await as.get(who)!.mutation(api.store.buyItem, { item: "spreeJoin", expectedPrice: 8 });
        } catch (e) {
          if (!(e instanceof ConvexError)) throw e;
          bought = false; // refused: too little, below zero, or the monthly limit
        }
        if (bought) expect(before.access === "open" && before.balance).toBeGreaterThanOrEqual(8);
        else expect(before.access === "open" && (before.balance < 8 || before.items[0].blocked !== null)).toBe(true);
      } else if (roll < 0.8 && who !== team.ana) {
        await admin.mutation(api.storeAdmin.adjustBalance, { memberId: who, amount: Math.ceil(rand() * 20) - 5 || 3, reason: "walk" });
      } else {
        await t.run(async (ctx) => {
          const p = (await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", who)).unique())!;
          await ctx.db.patch(p._id, { coins: (p.coins ?? 0) - Math.ceil(rand() * 10) });
        });
      }
      if (step % 20 === 19) vi.setSystemTime(Date.now() + 31 * 24 * 3_600_000); // next month: the limit resets
    }
    const purchases = await t.run((ctx) => ctx.db.query("itemPurchases").collect());
    for (const id of players) {
      const m = await memberDoc(id);
      expect(m.coinsSpent ?? 0).toBe(purchases.filter((p) => p.memberId === id).reduce((s, p) => s + p.price, 0));
    }
    expect(purchases.length).toBeGreaterThan(5);
  });
});

describe("leaving and the demo", () => {
  test("in the shared demo, handing back gives the visitor's game items back too, coins and all", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { isDemo: true }));
    await playerWith(team.ben, { level: 5, balance: 40 });
    const ben = await signInAs(t, team.ben);
    await ben.mutation(api.store.buyItem, { item: "spreeJoin", expectedPrice: 8 });
    await ben.mutation(api.store.buyItem, { item: "spreeJoin", expectedPrice: 8 });
    await ben.mutation(api.demo.handBackRewards, {});
    expect(await ben.query(api.store.shop, { today: TODAY })).toMatchObject({ balance: 40 });
    expect(await t.run((ctx) => ctx.db.query("itemPurchases").collect())).toHaveLength(0);
    expect((await memberDoc(team.ben)).coinsSpent).toBe(0);
  });

  test("removing a member deletes their purchases", async () => {
    await playerWith(team.ben, { level: 5, balance: 40 });
    await (await signInAs(t, team.ben)).mutation(api.store.buyItem, { item: "spreeJoin", expectedPrice: 8 });
    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UBEN" });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 5000);
    expect(await t.run((ctx) => ctx.db.query("itemPurchases").collect())).toHaveLength(0);
  });
});
