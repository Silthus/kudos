import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { DAY_MS } from "../convex/lib/time";
import { seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/**
 * Homes on the tree (#160, design plan #152 S5): a member buys one branch plot on the homes ring for
 * 40 Hog coins and builds a home on it in stages, each paid in coins and taking real days on the
 * workspace clock. Visitors leave a lantern in its guestbook, one a week.
 */

let t: ReturnType<typeof setupConvex>;
let team: Team;

/** A grown tree has the homes ring open: 24 plots. */
async function growTree(peakGrowth = 300) {
  await t.run(async (ctx) => {
    await ctx.db.insert("trees", { workspaceId: team.workspaceId, sap: peakGrowth, fuel: 0, peakGrowth, plantings: 0, plantedAt: Date.now() - DAY_MS });
  });
}

/** A player at `level` with `coins` earned: their balance is coins + 10 per level above 1. */
async function makePlayer(memberId: Id<"members">, { level = 3, coins = 200, homeDiscount }: { level?: number; coins?: number; homeDiscount?: number } = {}) {
  await t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId, since: Date.now() - DAY_MS, xp: 0, level, coins, ...(homeDiscount ? { homeDiscount } : {}) }));
}

const as = (memberId: Id<"members">) => signInAs(t, memberId);
const spent = (memberId: Id<"members">) => t.run(async (ctx) => (await ctx.db.get(memberId))!.coinsSpent ?? 0);
const later = (days: number) => vi.setSystemTime(Date.now() + days * DAY_MS);
/** The client's `now` on the workspace clock, as the web app passes it. */
const clock = () => ({ now: Date.now() });

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
  await growTree();
  await makePlayer(team.ana);
  await makePlayer(team.ben);
});
afterEach(() => vi.useRealTimers());

describe("buying a plot", () => {
  test("costs 40 Hog coins and starts the home under the sky, with a home game event", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.homes.buy, { plot: 3 });
    expect(await spent(team.ana)).toBe(40);
    const mine = await ana.query(api.homes.mine, clock());
    expect(mine).toMatchObject({ open: true, plots: 24, price: 40, home: { plot: 3, stage: "sky", building: null, next: { id: "planks", cost: 30, days: 2 } } });
    const events = await t.run((ctx) => ctx.db.query("gameEvents").collect());
    expect(events.filter((e) => e.kind === "home").map((e) => e.memberId)).toEqual([team.ana]);
  });

  test("one plot per member", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.homes.buy, { plot: 3 });
    await expect(ana.mutation(api.homes.buy, { plot: 4 })).rejects.toThrow(/already have a home/);
    expect(await spent(team.ana)).toBe(40);
  });

  test("a plot is one member's: two buying the same plot at once, only one gets it", async () => {
    const [ana, ben] = [await as(team.ana), await as(team.ben)];
    const results = await Promise.allSettled([ana.mutation(api.homes.buy, { plot: 5 }), ben.mutation(api.homes.buy, { plot: 5 })]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const homes = await t.run((ctx) => ctx.db.query("homes").collect());
    expect(homes.map((h) => h.plot)).toEqual([5]);
    expect((await spent(team.ana)) + (await spent(team.ben))).toBe(40);
  });

  test("the plot must exist on the tree: none before the homes ring opens, 24 on a grown tree", async () => {
    const ana = await as(team.ana);
    await expect(ana.mutation(api.homes.buy, { plot: 24 })).rejects.toThrow(/isn't a plot/);
    await expect(ana.mutation(api.homes.buy, { plot: -1 })).rejects.toThrow(/isn't a plot/);
    await expect(ana.mutation(api.homes.buy, { plot: 1.5 })).rejects.toThrow(/isn't a plot/);
    await t.run(async (ctx) => {
      const tree = await ctx.db.query("trees").first();
      await ctx.db.patch(tree!._id, { peakGrowth: 100, sap: 100 });
    });
    await expect(ana.mutation(api.homes.buy, { plot: 0 })).rejects.toThrow(/homes ring opens/);
    expect(await ana.query(api.homes.mine, clock())).toMatchObject({ open: false, plots: 0, home: null });
  });

  test("needs the 40 coins and the wallet", async () => {
    await makePlayer(team.cleo, { level: 3, coins: 10 });
    await expect((await as(team.cleo)).mutation(api.homes.buy, { plot: 0 })).rejects.toThrow(/costs 40 Hog coins; you have 30/);
    const newcomer = await t.run((ctx) =>
      ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId: "UDEV", name: "Dev", isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }),
    );
    await makePlayer(newcomer, { level: 2, coins: 500 });
    await expect((await as(newcomer)).mutation(api.homes.buy, { plot: 0 })).rejects.toThrow(/level 3/);
  });

  test("the game off or hidden: no homes", async () => {
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    const ana = await as(team.ana);
    expect(await ana.query(api.homes.mine, clock())).toBeNull();
    await expect(ana.mutation(api.homes.buy, { plot: 0 })).rejects.toThrow(/game/);
  });
});

describe("building the next stage", () => {
  test("pays the stage's cost and takes its days on the workspace clock, finished lazily", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.homes.buy, { plot: 0 });
    await ana.mutation(api.homes.build, {});
    expect(await spent(team.ana)).toBe(70);
    let mine = await ana.query(api.homes.mine, clock());
    expect(mine?.home).toMatchObject({ stage: "sky", building: { to: "planks", daysLeft: 2 }, next: null });
    await expect(ana.mutation(api.homes.build, {})).rejects.toThrow(/still building/);

    later(1);
    expect((await ana.query(api.homes.mine, clock()))?.home).toMatchObject({ stage: "sky", building: { to: "planks", daysLeft: 1 } });
    later(1.01);
    mine = await ana.query(api.homes.mine, clock());
    expect(mine?.home).toMatchObject({ stage: "planks", building: null, next: { id: "leaf_hut", cost: 60, days: 5 } });
    await ana.mutation(api.homes.build, {});
    expect(await spent(team.ana)).toBe(130);
  });

  test("the days run on the workspace's clock: a simulator's day ahead finishes it", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.homes.buy, { plot: 0 });
    await ana.mutation(api.homes.build, {});
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { clockOffsetMs: 3 * DAY_MS }));
    expect((await ana.query(api.homes.mine, clock()))?.home).toMatchObject({ stage: "planks", building: null });
  });

  test("a star fruit takes a quarter off one stage and is used up by it", async () => {
    await makePlayer(team.cleo, { coins: 300, homeDiscount: 25 });
    const cleo = await as(team.cleo);
    await cleo.mutation(api.homes.buy, { plot: 1 });
    expect((await cleo.query(api.homes.mine, clock()))?.home?.next).toMatchObject({ id: "planks", cost: 30, discounted: 23 });
    await cleo.mutation(api.homes.build, {});
    expect(await spent(team.cleo)).toBe(40 + 23);
    const player = await t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.cleo)).unique());
    expect(player?.homeDiscount).toBeUndefined();
    later(3);
    expect((await cleo.query(api.homes.mine, clock()))?.home?.next).toMatchObject({ id: "leaf_hut", cost: 60, discounted: null });
  });

  test("not without the coins, nothing past the canopy manor", async () => {
    await makePlayer(team.cleo, { coins: 40 });
    const cleo = await as(team.cleo);
    await cleo.mutation(api.homes.buy, { plot: 2 });
    await expect(cleo.mutation(api.homes.build, {})).rejects.toThrow(/costs 30 Hog coins; you have 20/);
    await t.run(async (ctx) => {
      const home = await ctx.db.query("homes").withIndex("by_member", (q) => q.eq("memberId", team.cleo)).unique();
      await ctx.db.patch(home!._id, { stage: "canopy_manor" });
    });
    await t.run((ctx) => ctx.db.patch(team.cleo, { coinsAdjusted: 1000 }));
    await expect(cleo.mutation(api.homes.build, {})).rejects.toThrow(/canopy manor/i);
  });

  test("without a home there's nothing to build", async () => {
    await expect((await as(team.ana)).mutation(api.homes.build, {})).rejects.toThrow(/buy a plot/i);
  });
});

describe("a stage finished", () => {
  const homeDms = () =>
    t.run(async (ctx) => (await ctx.db.query("notifications").collect()).filter((n) => n.gains?.some((g) => g.kind === "home_stage")));

  test("DMs the owner once, when its days are up", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.homes.buy, { plot: 0 });
    await ana.mutation(api.homes.build, {});
    expect(await homeDms()).toEqual([]);
    later(2.01);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const dms = await homeDms();
    expect(dms.map((n) => [n.memberId, n.webText])).toEqual([[team.ana, "Your home is built: Scarves and planks. Build its next stage when you're ready."]]);
    // The owner's next build settles nothing twice.
    await ana.mutation(api.homes.build, {});
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { clockOffsetMs: 10 * DAY_MS }));
    const { settleHomes } = await import("../convex/homes");
    const settleAll = () => t.run(async (ctx) => [...(await settleHomes(ctx, (await ctx.db.get(team.workspaceId))!)).entries()]);
    // A simulator's day goes by: the stage is built, told once, and the day's report names it.
    expect(await settleAll()).toEqual([[team.ana, "leaf_hut"]]);
    expect(await settleAll()).toEqual([]);
    expect((await homeDms()).length).toBe(2);
  });

  test("homes are state: a game rebuild keeps them and the home event", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.homes.buy, { plot: 7 });
    const member = await t.run(async (ctx) => (await ctx.db.get(team.ana))!);
    const workspace = await t.run(async (ctx) => (await ctx.db.get(team.workspaceId))!);
    await t.run(async (ctx) => {
      const { rebuildPlayer } = await import("../convex/game");
      await rebuildPlayer(ctx, workspace, member);
    });
    expect((await ana.query(api.homes.mine, clock()))?.home).toMatchObject({ plot: 7, stage: "sky" });
    const events = await t.run((ctx) => ctx.db.query("gameEvents").collect());
    expect(events.some((e) => e.kind === "home")).toBe(true);
  });
});

describe("visiting and the guestbook", () => {
  test("anyone sees a home; a visitor leaves one lantern a week, plain text of 80 characters at most", async () => {
    await (await as(team.ana)).mutation(api.homes.buy, { plot: 4 });
    const ben = await as(team.ben);
    const visit = await ben.query(api.homes.of, { memberId: team.ana, ...clock() });
    expect(visit).toMatchObject({ name: "Ana", plot: 4, stage: "sky", yours: false, canLeaveLantern: true, guestbook: [] });

    await expect(ben.mutation(api.homes.leaveLantern, { memberId: team.ana, note: "x".repeat(81) })).rejects.toThrow(/80 characters/);
    await expect(ben.mutation(api.homes.leaveLantern, { memberId: team.ana, note: " ​ " })).rejects.toThrow(/80 characters/);
    await ben.mutation(api.homes.leaveLantern, { memberId: team.ana, note: "  Thanks for\nthe tea  " });
    const after = await ben.query(api.homes.of, { memberId: team.ana, ...clock() });
    expect(after?.guestbook.map((l) => [l.by, l.note])).toEqual([["Ben", "Thanks for the tea"]]);
    expect(after?.canLeaveLantern).toBe(false);
    await expect(ben.mutation(api.homes.leaveLantern, { memberId: team.ana, note: "Again" })).rejects.toThrow(/this week/);

    // Monday is a new week.
    later(5);
    await ben.mutation(api.homes.leaveLantern, { memberId: team.ana, note: "A new week" });
    expect((await ben.query(api.homes.of, { memberId: team.ana, ...clock() }))?.guestbook.map((l) => l.note)).toEqual(["A new week", "Thanks for the tea"]);
  });

  test("not in your own guestbook; no home, no guestbook", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.homes.buy, { plot: 4 });
    await expect(ana.mutation(api.homes.leaveLantern, { memberId: team.ana, note: "Me" })).rejects.toThrow(/your own/);
    expect(await ana.query(api.homes.of, { memberId: team.ben, ...clock() })).toBeNull();
    await expect(ana.mutation(api.homes.leaveLantern, { memberId: team.ben, note: "Hi" })).rejects.toThrow(/no home/);
  });

  test("the guestbook keeps the latest 50", async () => {
    await (await as(team.ana)).mutation(api.homes.buy, { plot: 4 });
    const home = await t.run(async (ctx) => (await ctx.db.query("homes").first())!);
    await t.run(async (ctx) => {
      for (let i = 0; i < 50; i++) await ctx.db.insert("homeLanterns", { workspaceId: team.workspaceId, homeId: home._id, by: team.cleo, note: `old ${i}`, at: Date.now() - (60 - i) * DAY_MS, week: "2026-01-05" });
    });
    await (await as(team.ben)).mutation(api.homes.leaveLantern, { memberId: team.ana, note: "Newest" });
    const book = (await (await as(team.ben)).query(api.homes.of, { memberId: team.ana, ...clock() }))!.guestbook;
    expect(book.length).toBe(50);
    expect(book[0].note).toBe("Newest");
    expect(book.map((l) => l.note)).not.toContain("old 0");
    expect(await t.run(async (ctx) => (await ctx.db.query("homeLanterns").collect()).length)).toBe(50);
  });

  test("the owner or an admin takes a lantern down (moderation), not its writer", async () => {
    await (await as(team.ben)).mutation(api.homes.buy, { plot: 4 });
    await (await as(team.cleo)).mutation(api.homes.leaveLantern, { memberId: team.ben, note: "Nice planks" });
    const [lantern] = (await (await as(team.ben)).query(api.homes.of, { memberId: team.ben, ...clock() }))!.guestbook;
    expect(lantern.canTakeDown).toBe(true);
    await expect((await as(team.cleo)).mutation(api.homes.takeDownLantern, { lanternId: lantern._id })).rejects.toThrow(/can't take/);
    await (await as(team.ana)).mutation(api.homes.takeDownLantern, { lanternId: lantern._id });
    expect((await (await as(team.ben)).query(api.homes.of, { memberId: team.ben, ...clock() }))!.guestbook).toEqual([]);
  });
});

describe("the ring", () => {
  test("every home by plot, with its owner and stage, for drawing the ring", async () => {
    await (await as(team.ana)).mutation(api.homes.buy, { plot: 4 });
    await (await as(team.ben)).mutation(api.homes.buy, { plot: 1 });
    await (await as(team.ben)).mutation(api.homes.build, {});
    later(3);
    expect(await (await as(team.cleo)).query(api.homes.all, clock())).toEqual([
      { plot: 1, memberId: team.ben, name: "Ben", stage: "planks", building: false },
      { plot: 4, memberId: team.ana, name: "Ana", stage: "sky", building: false },
    ]);
  });

  test("the presence card knows who has a home", async () => {
    await makePlayer(team.cleo);
    await (await as(team.ana)).mutation(api.homes.buy, { plot: 1 });
    await (await as(team.ana)).mutation(api.presence.heartbeat, { x: 3, y: 4, facing: "right", animation: "idle" });
    await (await as(team.ben)).mutation(api.presence.heartbeat, { x: 4, y: 4, facing: "right", animation: "idle" });
    const seen = await (await as(team.cleo)).query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() });
    expect(Object.fromEntries(seen.map((h) => [h.name, h.hasHome]))).toEqual({ Ana: true, Ben: false });
  });
});

describe("owners out of view, other workspaces, odd input", () => {
  test("an owner who hides the game, or leaves, drops off the ring: no visit, no lantern, no card; back when they show it again", async () => {
    await (await as(team.ana)).mutation(api.homes.buy, { plot: 4 });
    await (await as(team.ana)).mutation(api.game.setHidden, { hidden: true });
    const ben = await as(team.ben);
    expect(await ben.query(api.homes.all, clock())).toEqual([]);
    expect(await ben.query(api.homes.of, { memberId: team.ana, ...clock() })).toBeNull();
    await expect(ben.mutation(api.homes.leaveLantern, { memberId: team.ana, note: "Hi" })).rejects.toThrow(/no home/);
    const { hasHome } = await import("../convex/homes");
    expect(await t.run((ctx) => hasHome(ctx, team.ana))).toBe(false);

    await (await as(team.ana)).mutation(api.game.setHidden, { hidden: false });
    expect((await ben.query(api.homes.all, clock())).map((h) => h.name)).toEqual(["Ana"]);

    // Deactivated in Slack: the user sync takes the home out of view, and their lanterns out of guestbooks.
    await ben.mutation(api.homes.leaveLantern, { memberId: team.ana, note: "From Ben" });
    await t.mutation(internal.slackData.upsertSlackUsers, {
      workspaceId: team.workspaceId,
      users: [{ slackUserId: "UBEN", name: "Ben", isBot: false, deactivated: true, isSlackAdmin: false }],
    });
    expect((await (await as(team.ana)).query(api.homes.mine, clock()))?.home?.guestbook).toEqual([]);
  });

  test("a renamed owner's home shows the new name", async () => {
    await (await as(team.ana)).mutation(api.homes.buy, { plot: 4 });
    await t.mutation(internal.slackData.upsertSlackUsers, {
      workspaceId: team.workspaceId,
      users: [{ slackUserId: "UANA", name: "Ana Lima", isBot: false, deactivated: false, isSlackAdmin: true }],
    });
    expect((await (await as(team.ben)).query(api.homes.all, clock())).map((h) => h.name)).toEqual(["Ana Lima"]);
  });

  test("another workspace's member can't see, write in or moderate a guestbook", async () => {
    await (await as(team.ana)).mutation(api.homes.buy, { plot: 4 });
    await (await as(team.ben)).mutation(api.homes.leaveLantern, { memberId: team.ana, note: "Hello" });
    const lantern = await t.run(async (ctx) => (await ctx.db.query("homeLanterns").first())!);
    const other = await seedTeam(t, { gameEnabled: true }, "T2");
    const outsider = await as(other.ana);
    expect(await outsider.query(api.homes.of, { memberId: team.ana, ...clock() })).toBeNull();
    expect(await outsider.query(api.homes.all, clock())).toEqual([]);
    await expect(outsider.mutation(api.homes.leaveLantern, { memberId: team.ana, note: "Hi" })).rejects.toThrow(/no home/);
    await expect(outsider.mutation(api.homes.takeDownLantern, { lanternId: lantern._id })).rejects.toThrow(/can't take/);
    expect(await outsider.query(api.homes.of, { memberId: "not-an-id", ...clock() })).toBeNull();
  });

  test("plot -0 is plot 0", async () => {
    await (await as(team.ana)).mutation(api.homes.buy, { plot: 0 });
    await expect((await as(team.ben)).mutation(api.homes.buy, { plot: -0 })).rejects.toThrow(/built on that plot/);
  });

  test("a look scheduled for an earlier stage, or for a home that's gone, changes nothing", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.homes.buy, { plot: 0 });
    await ana.mutation(api.homes.build, {});
    // The simulator's clock ran ahead: the owner built the planks' next stage before the planks' look came.
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { clockOffsetMs: 3 * DAY_MS }));
    await ana.mutation(api.homes.build, {});
    const home = await t.run(async (ctx) => (await ctx.db.query("homes").first())!);
    await t.mutation(internal.homes.finish, { homeId: home._id });
    expect(await t.run(async (ctx) => (await ctx.db.get(home._id))!)).toMatchObject({ stage: "planks", buildingTo: "leaf_hut" });
    await t.run((ctx) => ctx.db.delete(home._id));
    await t.mutation(internal.homes.finish, { homeId: home._id });
  });

  test("a stage due while the game is off is written down, and nobody is told", async () => {
    const ana = await as(team.ana);
    await ana.mutation(api.homes.buy, { plot: 0 });
    await ana.mutation(api.homes.build, {});
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    later(2.01);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(async (ctx) => (await ctx.db.query("homes").first())!.stage)).toBe("planks");
    expect(await t.run(async (ctx) => (await ctx.db.query("notifications").collect()).filter((n) => n.gains?.some((g) => g.kind === "home_stage")))).toEqual([]);
  });

  test("the DM says which stage, and after the manor that there's nothing left", async () => {
    const { gainText } = await import("../convex/lib/gains");
    expect(gainText({ kind: "home_stage", stage: "leaf_hut" }, "web")).toBe("Your home is built: Leaf hut. Build its next stage when you're ready.");
    expect(gainText({ kind: "home_stage", stage: "canopy_manor" }, "web")).toBe("Your home is built: Canopy manor. The last stage: the finest home on the tree.");
  });

  test("a star fruit isn't eaten for a home with every stage built", async () => {
    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { level: 5 });
      await ctx.db.insert("inventory", { workspaceId: team.workspaceId, memberId: team.ana, fruit: "star", count: 1 });
    });
    await (await as(team.ana)).mutation(api.homes.buy, { plot: 0 });
    await t.run(async (ctx) => ctx.db.patch((await ctx.db.query("homes").first())!._id, { stage: "canopy_manor" }));
    await expect((await as(team.ana)).mutation(api.offerings.applyFruit, { fruit: "star" })).rejects.toThrow(/every stage built/);
  });
});

describe("the demo's homes", () => {
  test("ten teammates' homes at the story's stages, some building, some guestbooks, none for Alex; their wallets untouched", async () => {
    const { DEMO_HOMES, DEMO_LANTERNS } = await import("../convex/lib/demoHomes");
    const cast = [...new Set([...DEMO_HOMES.map((h) => h.who), ...DEMO_LANTERNS.map((l) => l.by), "UDEMOYOU"])];
    const demo = await t.run(async (ctx) => {
      const workspaceId = await ctx.db.insert("workspaces", { ...(await ctx.db.get(team.workspaceId))!, _id: undefined, _creationTime: undefined, slackTeamId: "TDEMO", isDemo: true } as never);
      await ctx.db.insert("trees", { workspaceId, sap: 3500, fuel: 0, peakGrowth: 3500, plantings: 0, plantedAt: Date.now() - 300 * DAY_MS });
      const ids: Record<string, Id<"members">> = {};
      for (const who of cast) {
        ids[who] = await ctx.db.insert("members", { workspaceId, slackUserId: who, name: who, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 });
        await ctx.db.insert("players", { workspaceId, memberId: ids[who], since: 0, xp: 0, level: 3, coins: 50 });
      }
      return { workspaceId, ids };
    });
    await t.mutation(internal.demo.seedHomes, { workspaceId: demo.workspaceId });
    const homes = await t.run((ctx) => ctx.db.query("homes").withIndex("by_workspace_plot", (q) => q.eq("workspaceId", demo.workspaceId)).collect());
    const byWho = Object.fromEntries(homes.map((h) => [cast.find((w) => demo.ids[w] === h.memberId)!, h]));
    expect(homes).toHaveLength(10);
    expect(byWho.UDEMOYOU).toBeUndefined();
    expect(byWho.UDEMOLENA).toMatchObject({ plot: 12, stage: "canopy_manor" });
    expect(byWho.UDEMOLENA.buildingTo).toBeUndefined();
    expect(byWho.UDEMOFREYA).toMatchObject({ plot: 22, stage: "timber_house", buildingTo: "lantern_lodge" });
    expect(byWho.UDEMOJONAS).toMatchObject({ plot: 9, stage: "timber_house" });
    expect(byWho.UDEMOJONAS.buildingTo).toBeUndefined();
    // Scenery: a canopy manor is 1,000 coins in all, more than 18 weeks of the demo's game earn.
    expect(await t.run(async (ctx) => (await ctx.db.get(demo.ids.UDEMOLENA))!.coinsSpent ?? 0)).toBe(0);
    const lanterns = await t.run((ctx) => ctx.db.query("homeLanterns").withIndex("by_workspace", (q) => q.eq("workspaceId", demo.workspaceId)).collect());
    expect(lanterns).toHaveLength(DEMO_LANTERNS.length);
    // Seeding twice (a retried step) changes nothing.
    await t.mutation(internal.demo.seedHomes, { workspaceId: demo.workspaceId });
    expect(await t.run(async (ctx) => (await ctx.db.query("homes").collect()).length)).toBe(10);
  });
});

describe("when members leave, days go by, and resets", () => {
  test("removing a member takes their home, the lanterns on it and the ones they left", async () => {
    await makePlayer(team.cleo);
    await (await as(team.ben)).mutation(api.homes.buy, { plot: 1 });
    await (await as(team.cleo)).mutation(api.homes.buy, { plot: 2 });
    await (await as(team.ben)).mutation(api.homes.leaveLantern, { memberId: team.cleo, note: "From Ben" });
    await (await as(team.cleo)).mutation(api.homes.leaveLantern, { memberId: team.ben, note: "From Cleo" });
    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UBEN" });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 5000);
    expect(await t.run((ctx) => ctx.db.query("homes").collect())).toEqual([expect.objectContaining({ memberId: team.cleo, plot: 2 })]);
    expect(await t.run((ctx) => ctx.db.query("homeLanterns").collect())).toEqual([]);
  });

  test("a demo reset or a simulator's wipe clears every home and lantern", async () => {
    await (await as(team.ana)).mutation(api.homes.buy, { plot: 1 });
    await (await as(team.ben)).mutation(api.homes.leaveLantern, { memberId: team.ana, note: "Hello" });
    const { wipeActivity } = await import("../convex/demo");
    await t.run(async (ctx) => {
      const members = await ctx.db.query("members").collect();
      while ((await wipeActivity(ctx, team.workspaceId, members)) > 0);
    });
    expect(await t.run((ctx) => ctx.db.query("homes").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("homeLanterns").collect())).toEqual([]);
  });
});
