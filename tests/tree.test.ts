import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { DAY_MS } from "../convex/lib/time";
import { seedTeam, setupConvex, signInAs, type Team } from "./helpers";

/**
 * The Ancient Tree's backend (#154, design plan #152 S1 + the seeds amendment): a qualifying kudos
 * sows a seed per person thanked, the receiver plants them at the tree (or time does after 30
 * days), a planted seed is one sap, and the first planting is the seed moment.
 */

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

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

const as = (memberId: Id<"members">) => signInAs(t, memberId);
const state = async (memberId: Id<"members">) => (await as(memberId)).query(api.tree.state, {});

describe("seeds", () => {
  test("a thoughtful kudos sows one seed per person thanked, for them to plant", async () => {
    await message("UANA", "<@UBEN> <@UCLEO> :taco: thanks for the thorough review");
    expect(await state(team.ben)).toMatchObject({ planted: false, seedsToPlant: 1, sap: 0 });
    expect(await state(team.cleo)).toMatchObject({ seedsToPlant: 1 });
    expect(await state(team.ana)).toMatchObject({ seedsToPlant: 0 });
  });

  test("a kudos without a reason, or a thank-back, sows nothing", async () => {
    await message("UANA", "<@UBEN> :taco:");
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await message("UBEN", "<@UANA> :taco: thank you right back, Ana");
    expect(await state(team.ben)).toMatchObject({ seedsToPlant: 1 });
    expect(await state(team.ana)).toMatchObject({ seedsToPlant: 0 });
  });

  test("a revoked kudos takes its seed away", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    const [row] = await t.run((ctx) => ctx.db.query("kudos").collect());
    await (await as(team.ana)).mutation(api.admin.revoke, { kudosId: row._id });
    expect(await state(team.ben)).toMatchObject({ seedsToPlant: 0 });
  });
});

const plant = async (memberId: Id<"members">) => (await as(memberId)).mutation(api.tree.plantSeeds, {});
const treeGains = () =>
  t.run(async (ctx) => (await ctx.db.query("notifications").collect()).filter((n) => n.gains?.some((g) => g.kind === "tree_seed")));
const REASONS = ["thanks for the thorough review", "great pairing session today", "thanks for the careful rollout", "loved the demo you gave", "thanks for fixing the flaky test"];

describe("planting and the seed moment", () => {
  test("the receiver plants all their seeds at once: each is one sap", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await message("UCLEO", "<@UBEN> :taco: great pairing session today");
    expect(await plant(team.ben)).toEqual({ planted: 2, left: 0 });
    expect(await state(team.ben)).toMatchObject({ planted: true, sap: 2, growth: 2, peakGrowth: 2, stage: "seed", seedsToPlant: 0 });
    expect(await plant(team.ben)).toEqual({ planted: 0, left: 0 });
  });

  test("the first planting is the seed moment, once: the first seed's giver planted the tree and is told so", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await message("UCLEO", "<@UBEN> :taco: great pairing session today");
    await plant(team.ben);
    expect(await state(team.cleo)).toMatchObject({ plantedBy: "Ana", plantedAt: expect.any(Number) });
    const dms = await treeGains();
    expect(dms.map((n) => n.memberId)).toEqual([team.ana]);
    expect(dms[0].gains).toEqual([{ kind: "tree_seed", receiver: { slackUserId: "UBEN", name: "Ben" } }]);

    await message("UANA", "<@UCLEO> :taco: thanks for the design review");
    await plant(team.cleo);
    expect(await treeGains()).toHaveLength(1);
    expect(await state(team.cleo)).toMatchObject({ plantedBy: "Ana", sap: 3 });
    const kinds = (await state(team.ana))!.events.map((e) => e.kind);
    expect(kinds).toEqual(["growth", "growth", "seed"]);
  });

  test("the log names who planted, and says how many only where received counts show", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await plant(team.ben);
    const growthFor = async (viewer: Id<"members">) => (await state(viewer))!.events.find((e) => e.kind === "growth");
    // "self" (the default): Ben sees his count, Ana only his name.
    expect(await growthFor(team.ben)).toMatchObject({ who: "Ben", seeds: 1, by: "receiver" });
    expect(await growthFor(team.ana)).toMatchObject({ who: "Ben", seeds: null });
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { receivedVisibility: "everyone" }));
    expect(await growthFor(team.ana)).toMatchObject({ who: "Ben", seeds: 1 });
  });

  test("the tree is part of the game: hidden, there's no state and no planting", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await t.run((ctx) => ctx.db.patch(team.ben, { gameHidden: true }));
    expect(await state(team.ben)).toBeNull();
    await expect(plant(team.ben)).rejects.toThrow(/part of the game/);
  });

  test("seeds are sown with the game off too, so switching it on shows the company's tree", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: true }));
    expect(await state(team.ben)).toMatchObject({ seedsToPlant: 1 });
  });
});

describe("revokes and the peak", () => {
  test("revoking a planted seed's kudos takes its sap back, but the stage stays (the peak never falls)", async () => {
    for (const [i, text] of REASONS.entries()) await message(i % 2 ? "UCLEO" : "UANA", `<@UBEN> :taco: ${text}`);
    await plant(team.ben);
    expect(await state(team.ben)).toMatchObject({ sap: 5, stage: "sprout", peakGrowth: 5 });
    const [row] = await t.run((ctx) => ctx.db.query("kudos").collect());
    await (await as(team.ana)).mutation(api.admin.revoke, { kudosId: row._id });
    expect(await state(team.ben)).toMatchObject({ sap: 4, growth: 4, peakGrowth: 5, stage: "sprout", next: { stage: "sprout", growth: 1 } });
  });
});

/** Runs everything scheduled (DMs, posts, backfill and rebuild steps). */
const settle = () => t.finishAllScheduledFunctions(vi.runAllTimers, 5_000);

function stubSlack() {
  const calls: { method: string; params: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ method: String(url).split("/api/")[1], params: Object.fromEntries(new URLSearchParams(String(init?.body ?? ""))) });
      return Response.json({ ok: true });
    }),
  );
  return calls;
}

describe("seeds plant themselves", () => {
  test("after 30 days a seed nobody planted plants itself, and that can be the seed moment", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await t.mutation(internal.tree.autoPlant, {});
    expect(await state(team.ben)).toMatchObject({ planted: false, seedsToPlant: 1 });
    vi.setSystemTime(Date.now() + 30 * DAY_MS);
    await t.mutation(internal.tree.autoPlant, {});
    expect(await state(team.ben)).toMatchObject({ planted: true, sap: 1, seedsToPlant: 0, plantedBy: "Ana" });
    expect((await state(team.cleo))!.events.find((e) => e.kind === "growth")).toMatchObject({ who: null, seeds: 1, by: "time" });
    expect(await treeGains()).toHaveLength(1);
  });
});

describe("stages", () => {
  test("a stage reached is an event and one post in the announcement channel, never again after a revoke and regrowth", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { announceChannel: { id: "CANNOUNCE", name: "announcements" } }));
    const calls = stubSlack();
    for (const [i, text] of REASONS.entries()) await message(i % 2 ? "UCLEO" : "UANA", `<@UBEN> :taco: ${text}`);
    await plant(team.ben);
    await settle();
    const posts = () => calls.filter((c) => c.method === "chat.postMessage" && c.params.channel === "CANNOUNCE").map((c) => c.params.text);
    expect(posts()).toEqual(["The Ancient Tree is now a sprout. Next: a sapling at 25 growth."]);
    expect((await state(team.ana))!.events[0]).toMatchObject({ kind: "stage", stage: "sprout" });

    const [row] = await t.run((ctx) => ctx.db.query("kudos").collect());
    await (await as(team.ana)).mutation(api.admin.revoke, { kudosId: row._id });
    await message("UANA", "<@UCLEO> :taco: thanks for the lovely docs");
    await plant(team.cleo);
    await settle();
    expect(await state(team.ana)).toMatchObject({ sap: 5, stage: "sprout" });
    expect(posts()).toHaveLength(1);
    expect((await state(team.ana))!.events.filter((e) => e.kind === "stage")).toHaveLength(1);
  });

  test("nothing is posted while the game is off, or without an announcement channel", async () => {
    const calls = stubSlack();
    for (const [i, text] of REASONS.entries()) await message(i % 2 ? "UCLEO" : "UANA", `<@UBEN> :taco: ${text}`);
    await plant(team.ben);
    await settle();
    expect(calls.filter((c) => c.method === "chat.postMessage" && c.params.text?.startsWith("The Ancient Tree"))).toEqual([]);
  });
});

/** `n` kudos rows written straight into history (as the demo seeds them): Ana to Ben, a Note of 5 words. */
async function history(n: number, extra: (i: number) => { noteWords?: number; from?: Id<"members">; to?: Id<"members"> } = () => ({})) {
  await t.run(async (ctx) => {
    const start = Date.now() - 400 * DAY_MS;
    for (let i = 0; i < n; i++) {
      const { noteWords = 5, from = team.ana, to = team.ben } = extra(i);
      await ctx.db.insert("kudos", {
        workspaceId: team.workspaceId,
        batchId: `seed:${i}`,
        giverId: from,
        receiverId: to,
        amount: 1,
        dayKey: "2025-08-19",
        source: "seed",
        channelId: "CGENERAL",
        text: "history",
        at: start + i * 60 * 60_000,
        noteWords,
      });
    }
  });
}

describe("backfill, rebuild and verify", () => {
  test("the backfill sows history's qualifying kudos as seeds planted by time: the tree matches a recount", async () => {
    // 450 kudos from Ana to Ben (two steps), every tenth without a reason; Cleo's first kudos came before them all.
    await history(1, () => ({ from: team.cleo }));
    await history(450, (i) => ({ noteWords: i % 10 === 0 ? 0 : 5 }));
    await t.mutation(internal.tree.backfillAll, {});
    await settle();
    expect(await state(team.ana)).toMatchObject({ planted: true, sap: 406, peakGrowth: 406, stage: "grown", plantedBy: "Cleo", seedsToPlant: 0 });
    expect(await t.action(internal.tree.verify, { workspaceId: team.workspaceId })).toEqual({ stored: 406, planted: 406, unplanted: 0, peakGrowth: 406, ok: true });
    const kinds = (await state(team.ana))!.events.map((e) => [e.kind, e.stage ?? null]);
    expect(kinds).toEqual([
      ["stage", "grown"],
      ["stage", "young"],
      ["stage", "sapling"],
      ["stage", "sprout"],
      ["seed", null],
    ]);
    expect((await t.run((ctx) => ctx.db.get(team.workspaceId)))!.worldSeed).toEqual(expect.any(Number));

    // Running it again changes nothing.
    await t.mutation(internal.tree.backfillAll, {});
    await settle();
    expect(await t.action(internal.tree.verify, { workspaceId: team.workspaceId })).toMatchObject({ stored: 406, planted: 406, ok: true });
  });

  test("the rebuild recounts sap from the planted seeds, exactly while members plant and revoke meanwhile; the peak never falls", async () => {
    await history(800);
    await t.mutation(internal.tree.backfillAll, {});
    await settle();
    const tree = () => t.run(async (ctx) => (await ctx.db.query("trees").unique())!);
    await t.run(async (ctx) => ctx.db.patch((await ctx.db.query("trees").unique())!._id, { sap: 5 })); // drifted
    // The first step counts the first 700 seeds; then a revoke there and one beyond, and a new planting.
    await t.mutation(internal.tree.rebuild, { workspaceId: team.workspaceId });
    const rows = await t.run((ctx) => ctx.db.query("kudos").collect());
    const admin = await as(team.ana);
    await admin.mutation(api.admin.revoke, { kudosId: rows[10]._id });
    await admin.mutation(api.admin.revoke, { kudosId: rows[790]._id });
    await message("UANA", "<@UCLEO> :taco: thanks for the lovely docs");
    await plant(team.cleo);
    await settle();
    expect(await tree()).toMatchObject({ sap: 799, peakGrowth: 800 });
    expect(await t.action(internal.tree.verify, { workspaceId: team.workspaceId })).toMatchObject({ stored: 799, planted: 799, ok: true });
  });

  test("the rebuild drops seeds whose kudos is gone", async () => {
    await history(3);
    await t.mutation(internal.tree.backfillAll, {});
    await settle();
    await t.run(async (ctx) => ctx.db.delete((await ctx.db.query("kudos").first())!._id));
    await t.mutation(internal.tree.rebuild, { workspaceId: team.workspaceId });
    await settle();
    expect(await state(team.ana)).toMatchObject({ sap: 2, peakGrowth: 3 });
  });
});

describe("reads are bounded", () => {
  test("the state reads the last 20 events and counts at most 1,000 seeds, within Convex's limits", async () => {
    t = setupConvex({ transactionLimits: true });
    team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
    await history(1200);
    await t.run(async (ctx) => {
      for (const k of await ctx.db.query("kudos").collect()) {
        await ctx.db.insert("seeds", { workspaceId: team.workspaceId, kudosId: k._id, giverId: k.giverId, receiverId: k.receiverId, sownAt: k.at });
      }
      for (let i = 0; i < 205; i++) await ctx.db.insert("treeEvents", { workspaceId: team.workspaceId, kind: "growth", at: i, seeds: 1, by: "time" });
    });
    const s = (await state(team.ben))!;
    expect(s.seedsToPlant).toBe(1000);
    expect(s.events).toHaveLength(20);
    const page = await (await as(team.ben)).query(api.tree.events, { paginationOpts: { numItems: 50, cursor: null } });
    expect(page.page).toHaveLength(50);
    expect(await plant(team.ben)).toEqual({ planted: 500, left: 700 });
    // The log keeps the last 200 events.
    expect(await t.run(async (ctx) => (await ctx.db.query("treeEvents").collect()).length)).toBe(200);
  });
});

describe("removing a member", () => {
  test("takes their seeds and sap, and their name off the tree and its log; the tree and its stage stay", async () => {
    for (const [i, text] of REASONS.entries()) await message(i % 2 ? "UCLEO" : "UANA", `<@UBEN> :taco: ${text}`);
    await plant(team.ben); // Ana's seed was first: she planted the tree
    await message("UBEN", "<@UANA> :taco: thanks for the kind words today"); // a thank-back: no seed
    await message("UCLEO", "<@UANA> :taco: thanks for the release notes");
    await plant(team.ana);
    await message("UCLEO", "<@UANA> :taco: thanks for the second review"); // a seed for Ana, unplanted
    await t.run((ctx) => ctx.db.patch(team.cleo, { isAdmin: true }));
    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UANA" });
    await settle();
    const s = (await state(team.ben))!;
    // Ana's three kudos to Ben and the two to her are revoked: Cleo's two seeds for Ben are left.
    expect(s).toMatchObject({ planted: true, plantedBy: null, sap: 2, peakGrowth: 6, stage: "sprout" });
    expect(s.events.filter((e) => e.kind === "growth").map((e) => e.who)).toEqual([null, "Ben"]);
    const left = await t.run(async (ctx) => ({
      seeds: (await ctx.db.query("seeds").collect()).length,
      tree: await ctx.db.query("trees").unique(),
      naming: (await ctx.db.query("treeEvents").collect()).filter((e) => e.memberId === team.ana).length,
    }));
    expect(left).toMatchObject({ seeds: 2, naming: 0 });
    expect(left.tree!.plantedBy).toBeUndefined();
  });
});
