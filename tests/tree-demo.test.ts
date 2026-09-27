import { growthFor, layout, stageForGrowth, TREE_STAGE_BY_ID } from "../convex/lib/tree";
import { generateRuin } from "../convex/lib/rpg";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { DEMO_SETTINGS, DEMO_WORLD_SEED } from "../convex/lib/settings";
import { DAY_MS } from "../convex/lib/time";
import { DEMO_TIMEOUT, setupConvex, TODAY } from "./helpers";

/** The Ancient Tree in the demo and the simulator (#154, design plan #152 S10). */

vi.setConfig({ testTimeout: DEMO_TIMEOUT });

let t: ReturnType<typeof setupConvex>;
afterEach(() => vi.useRealTimers());

const settle = () => t.finishAllScheduledFunctions(vi.runAllTimers, 5_000);

describe("the demo", () => {
  beforeEach(() => {
    // Every demo transaction must fit Convex's limits, as it would on a real deployment.
    t = setupConvex({ transactionLimits: true });
  });

  test("its seeded year grows the tree by every thoughtful kudos, planted by time, with a fixed world seed; a reset grows the same tree", async () => {
    const userId = await t.mutation(internal.demo.ensureDemoUser, {});
    await settle();
    const alex = t.withIdentity({ subject: `${userId}|s` });
    const tree = await alex.query(api.tree.state, {});
    // Alex has walked the elder hog's chain to its end (#159, S10): nothing dims, nothing waits.
    expect(await alex.query(api.tutorial.state, {})).toMatchObject({ step: 11, due: false });
    // A blight the company beat three weeks ago (#164, S10): Alex fought it, so its crest is in the gallery.
    expect(await alex.query(api.blights.history, {})).toEqual([expect.objectContaining({ number: 1, status: "won", mine: expect.any(Number) })]);
    const [past] = await alex.query(api.blights.history, {});
    expect(past.damage).toBe(past.hp);
    expect(past.mine).toBeGreaterThan(0);
    expect(await alex.query(api.discoveries.crests, {})).toEqual([expect.objectContaining({ number: 1, damage: past.mine })]);
    // On the reference date (2026-09-23) the demo's year (~2,400 kudos rows) makes an ancient tree from sap
    // alone; its givers' offerings count as claimed (#157): since the launch once older than 30 days, and the
    // year before the launch as the company fed the tree then (#165). Their fuel grows it on to an elder tree.
    expect(tree).toMatchObject({ planted: true, seedsToPlant: 0, stage: "elder" });
    const offerings = await t.run((ctx) => ctx.db.query("offerings").collect());
    const fuel = offerings.filter((o) => o.claimedAt !== undefined).reduce((s, o) => s + o.fuel, 0);
    expect(fuel).toBeGreaterThan(0);
    expect(offerings.some((o) => o.claimedAt === undefined)).toBe(true); // the last 30 days wait at the stone
    expect(tree!.fuel).toBe(fuel);
    expect(tree!.stage).toBe(stageForGrowth(tree!.peakGrowth));
    // Sap is one per qualifying line: a Note of 3+ words, no thank-back within 72 h, never a spree's.
    const kudos = await t.run((ctx) => ctx.db.query("kudos").collect());
    const thankBack = (k: (typeof kudos)[number]) =>
      kudos.some((b) => b.giverId === k.receiverId && b.receiverId === k.giverId && b.source !== "spree" && b.at < k.at && b.at > k.at - 72 * 3_600_000);
    const qualifying = kudos.filter((k) => (k.noteWords ?? 0) >= 3 && k.source !== "spree" && !thankBack(k)).length;
    expect(tree!.sap).toBe(qualifying);
    expect(tree!.peakGrowth).toBe(growthFor({ sap: qualifying, fuel }));
    const workspaceId = (await t.run((ctx) => ctx.db.query("workspaces").first()))!._id;
    expect(await t.action(internal.tree.verify, { workspaceId })).toMatchObject({ ok: true, unplanted: 0 });
    // A game rebuild (the release's backfill) replays the offerings since the launch and keeps the year's before it.
    await t.mutation(internal.game.rebuildWorkspace, { workspaceId });
    await settle();
    expect(await alex.query(api.tree.state, {})).toMatchObject({ stage: "elder", fuel: tree!.fuel, growth: tree!.growth });
    // The crew (#161, S10): the bell built, with its contributors on the plaque, and the market awnings 60 % funded.
    const crew = async () => ({ built: (await alex.query(api.crew.built, { paginationOpts: { numItems: 5, cursor: null } })).page, open: await alex.query(api.crew.open, {}) });
    const seeded = await crew();
    expect(seeded.built).toEqual([expect.objectContaining({ part: "structure_bell", contributed: 300 })]);
    expect(seeded.built[0].contributors.length).toBeGreaterThanOrEqual(4);
    expect(seeded.open.quests).toEqual([expect.objectContaining({ part: "structure_market_awnings", goal: 500, contributed: 300, status: "proposed" })]);
    expect((await alex.query(api.tree.state, {}))!.cosmetics).toEqual([expect.objectContaining({ part: "structure_bell" })]);
    // Alex's expeditions (#162, #163, S10): three near ruins explored, one secret found, the Scout's cap worn,
    // and the latest run a party with the two teammates Alex thanks most who can go into the ruins.
    expect(await alex.query(api.rpg.camp, {})).toMatchObject({ ruinsCleared: 3, lore: 1, equipped: { hat: "scout_cap" } });
    const party = (await alex.query(api.rpg.current, {}))!.run!;
    expect(party).toMatchObject({ state: "cleared", tier: 1 });
    expect(party.party.map((p) => p.you)).toEqual([true, false, false]);
    expect(party.loot.coins).toBeGreaterThan(0);
    for (const { memberId } of party.party) {
      const { player, events } = await t.run(async (ctx) => ({
        player: await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique(),
        events: await ctx.db.query("gameEvents").withIndex("by_member_kind", (q) => q.eq("memberId", memberId)).collect(),
      }));
      expect(player).toMatchObject({ lastExpedition: party.id, ruinsCleared: expect.arrayContaining([party.ruinId]) });
      expect(player!.level).toBeGreaterThanOrEqual(6);
      expect(events.filter((e) => e.kind === "party")).toHaveLength(1);
      expect(events.filter((e) => e.kind === "expedition" && e.batchId === `expedition:${party.id}`)).toEqual([expect.objectContaining({ xp: 0, coins: expect.any(Number) })]);
    }
    // The team came to the stone and into the ruins: the admin's game success metrics have something to show (#165, S11).
    const months = (await alex.query(api.analytics.successMetrics, { today: TODAY })).months;
    const august = months.find((m) => m.month === "2026-08")!;
    expect(august.claimsPerPlayerWeek).toBeGreaterThan(0.5);
    expect(august.claimedSoonShare).toBeGreaterThan(0.5);
    expect(months.find((m) => m.month === "2026-09")!.expeditionsPerPlayer).toBeGreaterThan(0);
    expect((await t.query(internal.rollups.verify, { workspaceId, buckets: ["m:2026-08", "m:2026-09"] })).mismatches).toEqual([]);
    // …and a few fruits from the stone to use at the stall (#157, S10).
    expect((await alex.query(api.offerings.inventory, {})).map((f) => [f.fruit, f.count])).toEqual([["sun", 3], ["moon", 1], ["star", 1]]);

    await t.mutation(internal.demo.startDemoReset, {});
    await settle();
    const again = await alex.query(api.tree.state, {});
    expect(again).toMatchObject({ stage: tree!.stage, sap: tree!.sap, fuel: tree!.fuel, worldSeed: tree!.worldSeed, plantedBy: tree!.plantedBy });
    expect(await alex.query(api.tutorial.state, {})).toMatchObject({ step: 11 });
    const reseeded = await crew();
    expect(reseeded.built.map((b) => b.part)).toEqual(["structure_bell"]);
    expect(reseeded.open.quests.map((q) => [q.part, q.contributed])).toEqual([["structure_market_awnings", 300]]);
    // Neither the seeding nor the reset tells anyone the tree grew: stage DMs are for stages reached live.
    const told = await t.run(async (ctx) => (await ctx.db.query("notifications").collect()).filter((n) => n.gains?.some((g) => g.kind === "tree_stage")));
    expect(told).toEqual([]);
    // A teammate starts over at the elder hog.
    expect((await t.run((ctx) => ctx.db.query("members").collect())).filter((m) => m.tutorial).map((m) => m.slackUserId)).toEqual(["UDEMOYOU"]);
    expect(await t.run(async (ctx) => (await ctx.db.query("trees").collect()).length)).toBe(1);
  });
});

describe("a simulator", () => {
  let demoUser: Id<"users">;
  let sharedDemo: Id<"workspaces">;

  beforeEach(async () => {
    t = setupConvex();
    // The shared demo without its seeded year, and its shared demo user, Alex.
    ({ demoUser, sharedDemo } = await t.run(async (ctx) => {
      const sharedDemo = await ctx.db.insert("workspaces", { slackTeamId: "T_DEMO_LUMEN", name: "Lumen Labs", isDemo: true, status: "active", ...DEMO_SETTINGS });
      const demoUser = await ctx.db.insert("users", { name: "Alex Rivera", isDemo: true, slackUserId: "UDEMOYOU", slackTeamId: "T_DEMO_LUMEN" });
      const member = { isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 };
      await ctx.db.insert("members", { ...member, workspaceId: sharedDemo, slackUserId: "UDEMOYOU", name: "Alex Rivera", isAdmin: true, userId: demoUser });
      return { demoUser, sharedDemo };
    }));
  });

  const visitor = () => t.withIdentity({ subject: `${demoUser}|a` });
  const say = (text: string) => visitor().mutation(api.demo.simulateMessage, { text, channelName: "general" });
  const rows = (table: "seeds" | "trees" | "treeEvents") => t.run((ctx) => ctx.db.query(table).collect());

  test("a fast-forward grows the company's tree: the bot's kudos and the teammates' few a day, planted and offered as they go; the summary tells the tree", async () => {
    const { memberId: alexId } = await visitor().mutation(api.simulator.start, {});
    // A teammate thanks the visitor in the sandbox (#180): the bot plants that seed when it plays.
    expect(await visitor().mutation(api.demo.beThanked, {})).toMatchObject({ status: "thanked" });
    expect(await visitor().query(api.tree.state, {})).toMatchObject({ planted: false, seedsToPlant: 1 });

    await visitor().mutation(api.simulator.fastForward, { levels: 7 });
    await settle();
    const run = (await visitor().query(api.simulator.lastRun, {}))!;
    expect(run).toMatchObject({ status: "done", toLevel: 8 });
    const tree = (await visitor().query(api.tree.state, {}))!;
    expect(tree).toMatchObject({ planted: true, seedsToPlant: 0 });
    // Districts opened as a company's would: at least the young tree's (the stall, the oak, the pool).
    expect(TREE_STAGE_BY_ID[tree.stage].index).toBeGreaterThanOrEqual(TREE_STAGE_BY_ID.young.index);
    expect(run.summary.tree).toEqual({ from: "seed", stage: tree.stage, growth: tree.growth });

    // The teammates gave a few thoughtful kudos a day among themselves, never a thank-back of each other.
    const kudos = await t.run((ctx) => ctx.db.query("kudos").collect());
    const theirs = kudos.filter((k) => k.giverId !== alexId && k.receiverId !== alexId);
    expect(theirs.length).toBe(3 * run.summary.daysPlayed);
    expect(theirs.every((k) => (k.noteWords ?? 0) >= 3)).toBe(true);
    const pairs = new Set(theirs.map((k) => `${k.giverId}>${k.receiverId}`));
    expect(theirs.some((k) => pairs.has(`${k.receiverId}>${k.giverId}`))).toBe(false);
    // Every seed is planted, and what the givers offered is claimed: the tree is all of it.
    const seeds = await rows("seeds");
    expect(seeds.every((s) => s.plantedAt !== undefined)).toBe(true);
    const offerings = await t.run((ctx) => ctx.db.query("offerings").collect());
    expect(offerings.every((o) => o.claimedAt !== undefined)).toBe(true);
    expect(tree).toMatchObject({ sap: seeds.length, fuel: offerings.reduce((s, o) => s + o.fuel, 0) });
  });

  test("starts as a desert with its own world seed, grows its own tree as its clock moves, and is wiped with it", async () => {
    const { workspaceId } = await visitor().mutation(api.simulator.start, {});
    expect(await visitor().query(api.tree.state, {})).toMatchObject({ planted: false, stage: "seed", sap: 0 });
    const sim = (await t.run((ctx) => ctx.db.get(workspaceId)))!;
    expect(sim.worldSeed).toEqual(expect.any(Number));

    await say("<@UDEMOPRIYA> :seedling: thanks for the thorough review");
    expect((await rows("seeds")).map((s) => s.workspaceId)).toEqual([workspaceId]);
    // Nobody plants Priya's seed: 30 simulated days on, it plants itself (the cron's wall clock never reaches it).
    await visitor().mutation(api.simulator.advance, { days: 29 });
    expect(await visitor().query(api.tree.state, {})).toMatchObject({ planted: false });
    const res = await visitor().mutation(api.simulator.advance, { days: 2 });
    expect(res.changes).toContain("1 seed planted itself at the Ancient Tree.");
    expect(await visitor().query(api.tree.state, {})).toMatchObject({ planted: true, sap: 1, plantedBy: "Alex Rivera" });
    vi.setSystemTime(Date.now() + 31 * DAY_MS);
    await t.mutation(internal.tree.autoPlant, {});
    expect((await rows("trees")).map((tr) => tr.workspaceId)).toEqual([workspaceId]); // the shared demo has no tree

    await visitor().mutation(api.simulator.stop, {});
    await settle();
    expect(await rows("seeds")).toEqual([]);
    expect(await rows("trees")).toEqual([]);
    expect(await rows("treeEvents")).toEqual([]);
    expect(sharedDemo).toBeDefined();
  });
});

describe("the demo's ruins (#162)", () => {
  test("its fixed world seed holds a puzzle room in at least two near ruins and a secret room in at least one, the first included", () => {
    const near = layout(DEMO_WORLD_SEED, TREE_STAGE_BY_ID.elder.growth).ruins.filter((r) => r.tier === 1);
    expect(near).toHaveLength(6);
    const kinds = near.map((r) => generateRuin(DEMO_WORLD_SEED, r.id).rooms.map((room) => room.kind));
    expect(kinds.filter((k) => k.includes("puzzle")).length).toBeGreaterThanOrEqual(2);
    expect(kinds.filter((k) => k.includes("secret")).length).toBeGreaterThanOrEqual(1);
    // Alex's first seeded run (demo.ts `seedAlexRuins`) finds its lore card in a real secret room.
    expect(kinds[0]).toContain("secret");
  });
});
