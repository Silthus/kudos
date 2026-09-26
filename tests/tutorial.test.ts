import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { DEMO_SETTINGS } from "../convex/lib/settings";
import { claimAtTree, seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/**
 * The tutorial (#159, design plan #152 S4): the elder hog's chain of ten first steps. The server
 * detects each step from what the member did (their game events and state), in order; the two
 * steps done only in the world (arriving at the elder hog, looking round the Places list) the
 * client reports. Each completed step pays 5 Hog coins once, as a `tutorial` game event.
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
  await t.mutation(internal.kudos.ingestMessage, {
    workspaceId: team.workspaceId,
    botUserId: "UBOT",
    giverSlackId: giver,
    text,
    channelId: "CGENERAL",
    channelName: "general",
    messageTs: `${ts++}.0001`,
  });
  vi.setSystemTime(Date.now() + 60_000);
}

const as = (memberId: Id<"members">) => signInAs(t, memberId);
const state = async (memberId: Id<"members">) => (await as(memberId)).query(api.tutorial.state, {});
const advance = async (memberId: Id<"members">, did?: "arrive" | "look") => (await as(memberId)).mutation(api.tutorial.advance, did ? { did } : {});
const player = (memberId: Id<"members">) =>
  t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique());
const tutorialEvents = (memberId: Id<"members">) =>
  t.run((ctx) => ctx.db.query("gameEvents").withIndex("by_member_kind", (q) => q.eq("memberId", memberId).eq("kind", "tutorial")).collect());
/** Puts a player at `level` (its XP floor or more). */
const atLevel = (memberId: Id<"members">, level: number) =>
  t.run(async (ctx) => {
    const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique();
    await ctx.db.patch(p!._id, { level, xp: 5000 });
  });
/** A member some way along the chain: `done` steps completed and paid. */
const along = (memberId: Id<"members">, done: number) =>
  t.run((ctx) => ctx.db.patch(memberId, { tutorial: { completedAt: Array.from({ length: done }, () => Date.now()), paid: done } }));
/** Something a later system records as a game event (expeditions #162, homes #160, crews #161, parties #163). */
const event = (memberId: Id<"members">, kind: Doc<"gameEvents">["kind"]) =>
  t.run((ctx) => ctx.db.insert("gameEvents", { workspaceId: team.workspaceId, memberId, kind, batchId: `${kind}:${memberId}`, dayKey: "2026-09-23", at: Date.now(), xp: 0 }));

describe("the chain starts at the elder hog", () => {
  test("a new member is on step 1, arriving, which only the world can tell", async () => {
    expect(await state(team.ana)).toEqual({ step: 1, due: false });
  });

  test("walking to the elder hog completes it; with no player yet, its coins wait for the first kudos", async () => {
    expect(await advance(team.ana, "arrive")).toEqual({ completed: [{ step: 1, coins: null }] });
    expect(await state(team.ana)).toMatchObject({ step: 2, due: false });
    expect(await tutorialEvents(team.ana)).toEqual([]);

    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    expect(await state(team.ana)).toMatchObject({ step: 2, due: true });
    // Below level 3 the coins are paid silently: the wallet isn't open yet.
    expect(await advance(team.ana)).toEqual({ completed: [{ step: 2, coins: null }] });
    expect(await tutorialEvents(team.ana)).toHaveLength(2);
    expect(await player(team.ana)).toMatchObject({ coins: 10 });
  });
});

describe("step detection", () => {
  test("a kudos without a reason, or a thank-back, isn't the first thoughtful kudos", async () => {
    await advance(team.ana, "arrive");
    await message("UANA", "<@UBEN> :taco:");
    await message("UBEN", "<@UANA> :taco: thanks for pairing with me");
    await message("UANA", "<@UBEN> :taco: thank you right back Ben");
    // Only step 1's coins, owed since before Ana was a player, are due; "Say thanks" isn't.
    expect(await advance(team.ana)).toEqual({ completed: [] });
    expect(await state(team.ana)).toMatchObject({ step: 2, due: false });
  });

  test("feeding the tree is a claim at the stone, not one time made", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await along(team.ana, 2);
    await t.run((ctx) => ctx.db.insert("gameEvents", { workspaceId: team.workspaceId, memberId: team.ana, kind: "claim", batchId: "claim:time", dayKey: "2026-09-23", at: Date.now(), xp: 0, by: "time" }));
    expect(await state(team.ana)).toMatchObject({ step: 3, due: false });
    await claimAtTree(t, team.ana);
    expect(await state(team.ana)).toMatchObject({ step: 3, due: true });
    expect((await advance(team.ana)).completed.map((c) => c.step)).toEqual([3]);
  });

  test("looking around counts on step 4 only", async () => {
    expect(await advance(team.ana, "look")).toEqual({ completed: [] });
    expect(await state(team.ana)).toMatchObject({ step: 1 });
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await along(team.ana, 3);
    expect((await advance(team.ana, "look")).completed.map((c) => c.step)).toEqual([4]);
  });

  test("planting, taking a skill and trading at the stall complete steps 5 to 7", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await along(team.ana, 4);
    await t.run((ctx) =>
      ctx.db.insert("plants", { workspaceId: team.workspaceId, ownerId: team.ana, forId: team.ben, species: "oak", plantedAt: Date.now(), plantedDay: "2026-09-23", pickedThrough: "2026-09-23", announced: 0 }),
    );
    expect((await advance(team.ana)).completed.map((c) => c.step)).toEqual([5]);
    await t.run((ctx) => ctx.db.insert("skillChanges", { workspaceId: team.workspaceId, memberId: team.ana, kind: "take", skill: "wide_net", at: Date.now() }));
    expect((await advance(team.ana)).completed.map((c) => c.step)).toEqual([6]);
    await t.run((ctx) => ctx.db.insert("itemPurchases", { workspaceId: team.workspaceId, memberId: team.ana, item: "spreeJoin", price: 8, month: "2026-09", at: Date.now() }));
    expect((await advance(team.ana)).completed.map((c) => c.step)).toEqual([7]);
  });

  test("selling a fruit at the stall is a trade too", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await along(team.ana, 6);
    await event(team.ana, "sale");
    expect((await advance(team.ana)).completed.map((c) => c.step)).toEqual([7]);
  });

  test("later systems complete steps 8 to 10 with their own events: expedition, home, crew or party", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await along(team.ana, 7);
    await event(team.ana, "expedition");
    await event(team.ana, "home");
    expect((await advance(team.ana)).completed.map((c) => c.step)).toEqual([8, 9]);
    await event(team.ana, "party");
    expect((await advance(team.ana)).completed.map((c) => c.step)).toEqual([10]);
    expect(await state(team.ana)).toMatchObject({ step: 11, due: false });
    await along(team.ben, 0);
    await message("UBEN", "<@UANA> :taco: thanks for the thorough review");
    await along(team.ben, 9);
    await event(team.ben, "crew");
    expect((await advance(team.ben)).completed.map((c) => c.step)).toEqual([10]);
  });

  test("a member already past a step only the world sees isn't held there: someone who gave, claimed and planted before the chain", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await claimAtTree(t, team.ana);
    await t.run((ctx) =>
      ctx.db.insert("plants", { workspaceId: team.workspaceId, ownerId: team.ana, forId: team.ben, species: "oak", plantedAt: Date.now(), plantedDay: "2026-09-23", pickedThrough: "2026-09-23", announced: 0 }),
    );
    expect(await state(team.ana)).toMatchObject({ step: 1, due: true });
    expect((await advance(team.ana)).completed.map((c) => c.step)).toEqual([1, 2, 3, 4, 5]);
    expect(await state(team.ana)).toMatchObject({ step: 6, due: false });
  });

  test("the chain keeps its order: a step done early completes the moment it's reached", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await event(team.ana, "expedition");
    // Arriving completes step 1, then step 2 (already met) at once; step 3 waits for a claim.
    expect((await advance(team.ana, "arrive")).completed.map((c) => c.step)).toEqual([1, 2]);
    expect(await state(team.ana)).toMatchObject({ step: 3, due: false });
  });
});

describe("each step pays 5 Hog coins, once", () => {
  test("coins owed from before the first kudos are paid once there's a player, even if that kudos doesn't count", async () => {
    await advance(team.ana, "arrive");
    await message("UANA", "<@UBEN> :taco:");
    expect(await state(team.ana)).toMatchObject({ step: 2, due: true });
    expect(await advance(team.ana)).toEqual({ completed: [] });
    expect(await tutorialEvents(team.ana)).toHaveLength(1);
    expect(await player(team.ana)).toMatchObject({ tutorialCoins: 5 });
    expect(await state(team.ana)).toMatchObject({ step: 2, due: false });
  });

  test("the coins show in the result from level 3, where the wallet is open", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await atLevel(team.ana, 3);
    expect(await advance(team.ana, "arrive")).toEqual({
      completed: [
        { step: 1, coins: 5 },
        { step: 2, coins: 5 },
      ],
    });
    const coins = (await player(team.ana))!.coins;
    expect(await advance(team.ana, "arrive")).toEqual({ completed: [] });
    expect(await advance(team.ana)).toEqual({ completed: [] });
    expect((await player(team.ana))!.coins).toBe(coins);
    expect((await tutorialEvents(team.ana)).map((e) => [e.batchId, e.coins])).toEqual([
      [`tutorial:${team.ana}:1`, 5],
      [`tutorial:${team.ana}:2`, 5],
    ]);
  });

  test("the wallet counts them as the elder hog's, never as coins from kudos", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await atLevel(team.ana, 3);
    await advance(team.ana, "arrive");
    expect((await (await as(team.ana)).query(api.game.mine, {})).wallet).toMatchObject({ fromTutorial: 10, fromKudos: 0 });
    await t.mutation(internal.game.rebuildMember, { memberId: team.ana });
    expect(await player(team.ana)).toMatchObject({ tutorialCoins: 10 });
  });

  test("a game rebuild keeps the chain and what it paid", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await advance(team.ana, "arrive");
    const before = await player(team.ana);
    await t.mutation(internal.game.rebuildMember, { memberId: team.ana });
    expect(await tutorialEvents(team.ana)).toHaveLength(2);
    expect(await player(team.ana)).toMatchObject({ coins: before!.coins, xp: before!.xp });
    expect(await state(team.ana)).toMatchObject({ step: 3 });
  });
});

describe("only while the game is shown", () => {
  test("hidden or off, there is no chain and nothing advances", async () => {
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    expect(await state(team.ana)).toBeNull();
    expect(await advance(team.ana, "arrive")).toEqual({ completed: [] });
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: undefined }));
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    expect(await state(team.ana)).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(team.ana))).not.toHaveProperty("tutorial");
  });
});

describe("the shared demo", () => {
  test("an Alex from before the chain has walked it to its end the next time a visitor comes in", async () => {
    const alex = await t.run(async (ctx) => {
      const demo = await ctx.db.insert("workspaces", { slackTeamId: "T_DEMO_LUMEN", name: "Lumen Labs", isDemo: true, status: "active", ...DEMO_SETTINGS });
      return await ctx.db.insert("members", { isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0, workspaceId: demo, slackUserId: "UDEMOYOU", name: "Alex Rivera", isAdmin: true });
    });
    await t.mutation(internal.demo.ensureDemoUser, {});
    expect((await t.run((ctx) => ctx.db.get(alex)))?.tutorial).toMatchObject({ paid: 10, completedAt: expect.arrayContaining([expect.any(Number)]) });
  });
});

describe("the simulator", () => {
  test("starts a visitor on step 1, in the desert before the seed", async () => {
    const demoUser = await t.run(async (ctx) => {
      const sharedDemo = await ctx.db.insert("workspaces", { slackTeamId: "T_DEMO_LUMEN", name: "Lumen Labs", isDemo: true, status: "active", ...DEMO_SETTINGS });
      const demoUser = await ctx.db.insert("users", { name: "Alex Rivera", isDemo: true, slackUserId: "UDEMOYOU", slackTeamId: "T_DEMO_LUMEN" });
      await ctx.db.insert("members", { isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0, workspaceId: sharedDemo, slackUserId: "UDEMOYOU", name: "Alex Rivera", isAdmin: true, userId: demoUser, tutorial: { completedAt: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], paid: 10 } });
      return demoUser;
    });
    const visitor = t.withIdentity({ subject: `${demoUser}|a` });
    await visitor.mutation(api.simulator.start, { level: 5 });
    expect(await visitor.query(api.tree.state, {})).toMatchObject({ planted: false, stage: "seed" });
    expect(await visitor.query(api.tutorial.state, {})).toEqual({ step: 1, due: false });
    // Walk to the elder hog, give a kudos in the sandbox, claim at the stone.
    expect((await visitor.mutation(api.tutorial.advance, { did: "arrive" })).completed).toEqual([{ step: 1, coins: 5 }]);
    await visitor.mutation(api.demo.simulateMessage, { text: "<@UDEMOPRIYA> :seedling: thanks for the thorough review", channelName: "general" });
    expect((await visitor.mutation(api.tutorial.advance, {})).completed).toEqual([{ step: 2, coins: 5 }]);
    await visitor.mutation(api.offerings.claim, {});
    expect((await visitor.mutation(api.tutorial.advance, {})).completed).toEqual([{ step: 3, coins: 5 }]);
    expect((await visitor.mutation(api.tutorial.advance, { did: "look" })).completed).toEqual([{ step: 4, coins: 5 }]);
  });
});
