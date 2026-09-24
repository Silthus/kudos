import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { levelForXp } from "../convex/lib/xp";
import { NOW, seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";

/** Cosmetics (#98, #55 §G5, §G12): frames, banners, hoggie stickers and kudos-emoji variants from the Store. */

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
});
afterEach(() => vi.useRealTimers());

const FLOOR: Record<number, number> = { 1: 0, 3: 75, 5: 350, 6: 600 };

async function playerWith(memberId: Id<"members">, { level, balance, skills }: { level: number; balance: number; skills?: Record<string, number> }) {
  expect(levelForXp(FLOOR[level])).toBe(level);
  await t.run(async (ctx) => {
    const existing = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique();
    const row = { xp: FLOOR[level], level, coins: balance - 10 * (level - 1), ...(skills ? { skills } : {}) };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("players", { workspaceId: team.workspaceId, memberId, since: NOW.getTime(), ...row });
  });
}

const as = (memberId: Id<"members">) => signInAs(t, memberId);
const memberDoc = (id: Id<"members">) => t.run((ctx) => ctx.db.get(id)).then((m) => m!);

describe("cosmetics in the Store", () => {
  test("are on the shelves with their price, and a bought one is worn at once and can't be bought twice", async () => {
    await playerWith(team.ben, { level: 5, balance: 100 });
    const ben = await as(team.ben);
    const shop = await ben.query(api.store.shop, { today: TODAY });
    if (shop.access !== "open") throw new Error("closed");
    expect(shop.items.find((i) => i.key === "frameSunrise")).toMatchObject({ name: "Sunrise frame", price: 30, blocked: null });
    expect(shop.items.find((i) => i.key === "emojiGolden")).toMatchObject({ price: 60, blocked: null });

    expect(await ben.mutation(api.store.buyItem, { item: "frameSunrise", expectedPrice: 30 })).toEqual({ balance: 70 });
    expect((await memberDoc(team.ben)).look).toEqual({ frame: "frameSunrise" });
    const after = await ben.query(api.store.shop, { today: TODAY });
    if (after.access !== "open") throw new Error("closed");
    expect(after.items.find((i) => i.key === "frameSunrise")).toMatchObject({ blocked: "It's yours already." });
    await expect(ben.mutation(api.store.buyItem, { item: "frameSunrise", expectedPrice: 30 })).rejects.toThrow(/yours already/);
  });

  test("can be handed back in the demo: it comes off and the coins return", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { isDemo: true }));
    await playerWith(team.ben, { level: 5, balance: 100 });
    const ben = await as(team.ben);
    await ben.mutation(api.store.buyItem, { item: "bannerStarfield", expectedPrice: 35 });
    await ben.mutation(api.demo.handBackRewards, {});
    expect(await memberDoc(team.ben)).toMatchObject({ coinsSpent: 0, look: {} });
  });
});

describe("wearing cosmetics", () => {
  test("switches between cosmetics you own, per slot, or takes one off", async () => {
    await playerWith(team.ben, { level: 5, balance: 200 });
    const ben = await as(team.ben);
    await ben.mutation(api.store.buyItem, { item: "frameSunrise", expectedPrice: 30 });
    await ben.mutation(api.store.buyItem, { item: "frameMeadow", expectedPrice: 30 });
    await ben.mutation(api.store.buyItem, { item: "stickerParty", expectedPrice: 25 });
    expect((await memberDoc(team.ben)).look).toEqual({ frame: "frameMeadow", sticker: "stickerParty" });
    await ben.mutation(api.cosmetics.wear, { slot: "frame", key: "frameSunrise" });
    await ben.mutation(api.cosmetics.wear, { slot: "sticker", key: null });
    expect((await memberDoc(team.ben)).look).toEqual({ frame: "frameSunrise" });
  });

  test("refuses a cosmetic you don't own, or one for another slot", async () => {
    await playerWith(team.ben, { level: 5, balance: 200 });
    const ben = await as(team.ben);
    await expect(ben.mutation(api.cosmetics.wear, { slot: "frame", key: "frameSunrise" })).rejects.toThrow(/don't have/);
    await ben.mutation(api.store.buyItem, { item: "frameSunrise", expectedPrice: 30 });
    await expect(ben.mutation(api.cosmetics.wear, { slot: "banner", key: "frameSunrise" })).rejects.toThrow(/isn't a banner/);
  });

  test("your cosmetics and kudos emoji: what you own, what you wear, and each emoji's Slack shortcode", async () => {
    await playerWith(team.ben, { level: 6, balance: 200, skills: { emoji_variants: 1 } });
    const ben = await as(team.ben);
    await ben.mutation(api.store.buyItem, { item: "frameSunrise", expectedPrice: 30 });
    await ben.mutation(api.store.buyItem, { item: "emojiGolden", expectedPrice: 60 });
    const mine = await ben.query(api.cosmetics.mine, { today: TODAY });
    expect(mine).toMatchObject({
      look: { frame: "frameSunrise" },
      owned: ["frameSunrise"],
      emoji: [
        { shortcode: ":taco:", name: "Kudos emoji", source: "workspace" },
        { shortcode: ":taco-golden:", name: "Golden kudos emoji", source: "store" },
        { shortcode: ":taco-sparkle:", name: "Sparkling kudos emoji", source: "skill" },
      ],
      superKudos: null,
    });
  });

  test("nothing while the game is off or you hide it", async () => {
    await playerWith(team.ben, { level: 5, balance: 200 });
    await t.run((ctx) => ctx.db.patch(team.ben, { gameHidden: true }));
    expect(await (await as(team.ben)).query(api.cosmetics.mine, { today: TODAY })).toBeNull();
    await expect((await as(team.ben)).mutation(api.cosmetics.wear, { slot: "frame", key: null })).rejects.toThrow(/hidden the game/);
  });
});

describe("your profile (§G12)", () => {
  test("shows your level, title, kudos given and what you wear; never a rank", async () => {
    await playerWith(team.ben, { level: 5, balance: 100 });
    await t.run((ctx) => ctx.db.patch(team.ben, { totalGiven: 42, look: { frame: "frameSunrise", banner: "bannerStarfield" } }));
    const profile = await (await as(team.ana)).query(api.cosmetics.profile, { memberId: team.ben });
    expect(profile).toEqual({ name: "Ben", avatarUrl: null, level: 5, title: "Gardener", given: 42, look: { frame: "frameSunrise", banner: "bannerStarfield" } });
  });

  test("a member who hides the game shows no level or cosmetics; nor does anyone while the game is off", async () => {
    await playerWith(team.ben, { level: 5, balance: 100 });
    await t.run((ctx) => ctx.db.patch(team.ben, { totalGiven: 3, gameHidden: true, look: { frame: "frameSunrise" } }));
    expect(await (await as(team.ana)).query(api.cosmetics.profile, { memberId: team.ben })).toEqual({ name: "Ben", avatarUrl: null, level: null, title: null, given: 3, look: {} });
    await t.run((ctx) => ctx.db.patch(team.ben, { gameHidden: undefined }));
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    expect(await (await as(team.ana)).query(api.cosmetics.profile, { memberId: team.ben })).toMatchObject({ level: null, look: {} });
  });

  test("next to your name on the leaderboard: what you wear, unless you or the viewer hide the game", async () => {
    await t.run(async (ctx) => {
      await ctx.db.patch(team.ben, { look: { frame: "frameSunrise", sticker: "stickerParty" } });
      const today = { workspaceId: team.workspaceId, dayKey: TODAY, given: 1, received: 0, maxed: false, capped: 1 };
      await ctx.db.insert("memberDays", { ...today, memberId: team.ben });
    });
    const board = async (viewer: Id<"members">) => (await (await as(viewer)).query(api.leaderboard.get, { period: "week", metric: "given", today: TODAY })).rows;
    expect((await board(team.ana)).find((r) => r.member._id === team.ben)?.member.look).toEqual({ frame: "frameSunrise", sticker: "stickerParty" });
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    expect((await board(team.ana)).find((r) => r.member._id === team.ben)?.member.look).toEqual({});
  });

  test("only for members of your own workspace", async () => {
    const other = await seedTeam(t, { gameEnabled: true }, "T2");
    await expect((await as(other.ana)).query(api.cosmetics.profile, { memberId: team.ben })).rejects.toThrow(/not found/);
  });
});
