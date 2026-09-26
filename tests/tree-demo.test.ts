import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { DEMO_SETTINGS } from "../convex/lib/settings";
import { DAY_MS } from "../convex/lib/time";
import { DEMO_TIMEOUT, setupConvex } from "./helpers";

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
    // On the reference date (2026-09-23) the demo's year (~2,400 kudos rows) makes an ancient tree:
    // elder needs 5,000 growth, which the seeded year can't reach (a decision for the conductor, #154).
    expect(tree).toMatchObject({ planted: true, stage: "ancient", seedsToPlant: 0 });
    // Sap is one per qualifying line: a Note of 3+ words, no thank-back within 72 h, never a spree's.
    const kudos = await t.run((ctx) => ctx.db.query("kudos").collect());
    const thankBack = (k: (typeof kudos)[number]) =>
      kudos.some((b) => b.giverId === k.receiverId && b.receiverId === k.giverId && b.source !== "spree" && b.at < k.at && b.at > k.at - 72 * 3_600_000);
    const qualifying = kudos.filter((k) => (k.noteWords ?? 0) >= 3 && k.source !== "spree" && !thankBack(k)).length;
    expect(tree!.sap).toBe(qualifying);
    expect(tree!.peakGrowth).toBe(qualifying);
    const workspaceId = (await t.run((ctx) => ctx.db.query("workspaces").first()))!._id;
    expect(await t.action(internal.tree.verify, { workspaceId })).toMatchObject({ ok: true, unplanted: 0 });

    await t.mutation(internal.demo.startDemoReset, {});
    await settle();
    const again = await alex.query(api.tree.state, {});
    expect(again).toMatchObject({ stage: "ancient", sap: tree!.sap, worldSeed: tree!.worldSeed, plantedBy: tree!.plantedBy });
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
