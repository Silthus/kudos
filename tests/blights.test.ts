import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { NOW, seedTeam, setupConvex, signInAs, type Team } from "./helpers";
import { BLIGHT, blightHp, nextBlightAt } from "../convex/lib/blight";
import { generateRuin } from "../convex/lib/rpg";
import { xpForLevel } from "../convex/lib/xp";
import { addDays, DAY_MS, dayKeyFor, startOfDayUtc } from "../convex/lib/time";

/**
 * Blights (#164, design plan #152 S8; the rules are lib/blight.ts): from the ancient stage a blight
 * is planned on the workspace clock, announced two days ahead, arrives with hit points from the
 * company's active members, is worn down by thoughtful kudos and cleared rooms (the blight raid most
 * of all) and ends won (a bonus day, coins and a crest for everyone who fought) or lost (dim lanterns,
 * a smaller next blight).
 */

let t: ReturnType<typeof setupConvex>;
let team: Team;
const SEED = 7;
const TZ = "Europe/Berlin";

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false, worldSeed: SEED, timezone: TZ });
});
afterEach(() => vi.useRealTimers());

/** The tree reached the ancient stage at `at` (default: now). */
async function ancientTree(at = Date.now(), peakGrowth = 2000) {
  await t.run(async (ctx) => {
    await ctx.db.insert("trees", { workspaceId: team.workspaceId, sap: peakGrowth, fuel: 0, peakGrowth, plantings: 1, plantedAt: at - 100 * DAY_MS });
    await ctx.db.insert("treeEvents", { workspaceId: team.workspaceId, kind: "stage", stage: "ancient", at });
  });
}

/** Members who gave or received a kudos on `day`. */
async function activeOn(day: string, ...memberIds: Id<"members">[]) {
  await t.run(async (ctx) => {
    for (const memberId of memberIds) await ctx.db.insert("memberDays", { workspaceId: team.workspaceId, memberId, dayKey: day, given: 1, received: 0, maxed: false });
  });
}

const settle = () => t.mutation(internal.blights.settleIn, { workspaceId: team.workspaceId });
const blights = () => t.run((ctx) => ctx.db.query("blights").collect());
const events = (kind: Doc<"treeEvents">["kind"]) => t.run((ctx) => ctx.db.query("treeEvents").filter((q) => q.eq(q.field("kind"), kind)).collect());
/** When the first blight after the ancient stage at NOW arrives: the start of its day, in the workspace's timezone. */
const firstArrival = () => startOfDayUtc(dayKeyFor(nextBlightAt(SEED, NOW.getTime(), 0), TZ), TZ);

describe("the schedule", () => {
  test("nothing comes before the ancient stage", async () => {
    await t.run((ctx) => ctx.db.insert("trees", { workspaceId: team.workspaceId, sap: 1999, fuel: 0, peakGrowth: 1999, plantings: 1 }));
    vi.setSystemTime(NOW.getTime() + 60 * DAY_MS);
    await settle();
    expect(await blights()).toEqual([]);
  });

  test("from the ancient stage a blight is planned on the seed, announced two days ahead, once", async () => {
    await ancientTree();
    const arrives = firstArrival();
    vi.setSystemTime(arrives - BLIGHT.announceAheadDays * DAY_MS - 60_000);
    await settle();
    expect(await blights()).toEqual([]);

    vi.setSystemTime(arrives - BLIGHT.announceAheadDays * DAY_MS + 60_000);
    await settle();
    await settle();
    const [b] = await blights();
    expect(await blights()).toHaveLength(1);
    expect(b).toMatchObject({ number: 1, status: "announced", arrivesAt: arrives, endsAt: arrives + BLIGHT.windowDays * DAY_MS, hp: 0, damage: 0, source: "schedule", defeatedBefore: false });
    expect(await events("blight_announced")).toHaveLength(1);
  });

  test("arrives with hit points from the members active in the 30 days before, on the workspace clock", async () => {
    await ancientTree();
    const arrives = firstArrival();
    const day = dayKeyFor(arrives, TZ);
    await activeOn(addDays(day, -3), team.ana, team.ben);
    await activeOn(addDays(day, -29), team.cleo);
    await activeOn(addDays(day, -40), team.bot); // too long ago
    // A simulator's clock runs ahead of the wall clock: its blight comes on its own clock.
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { clockOffsetMs: arrives + 60_000 - NOW.getTime() }));
    await settle();
    const [b] = await blights();
    expect(b).toMatchObject({ status: "active", hp: blightHp(3), tier: 1 });
    expect(b.hp).toBe(120);
    expect(await events("blight_arrived")).toHaveLength(1);
  });

  test("the cron settles every workspace whose tree is ancient", async () => {
    await ancientTree();
    vi.setSystemTime(firstArrival() + 60_000);
    await t.mutation(internal.blights.tick, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await blights()).map((b) => b.status)).toEqual(["active"]);
  });
});

// ── The fight ───────────────────────────────────────────────────────────────

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

/** A blight at the tree, arrived a minute ago, with `hp` hit points (set, so a test can finish it). */
async function blightHere(hp?: number) {
  await ancientTree();
  vi.setSystemTime(firstArrival() + 60_000);
  await settle();
  const [b] = await blights();
  if (hp !== undefined) await t.run((ctx) => ctx.db.patch(b._id, { hp }));
  return b._id;
}
const blight = async () => (await blights())[0];
const contributor = (memberId: Id<"members">) =>
  t.run((ctx) => ctx.db.query("blightContributors").filter((q) => q.eq(q.field("memberId"), memberId)).unique());
const player = (memberId: Id<"members">) => t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique());

describe("damage from thoughtful kudos", () => {
  test("each thoughtful line deals one, credited to its giver; nothing before the blight arrives", async () => {
    await ancientTree();
    vi.setSystemTime(firstArrival() - DAY_MS);
    await settle();
    await message("UANA", "<@UBEN> :taco: thanks for the careful review today");
    expect(await blight()).toMatchObject({ status: "announced", damage: 0 });

    vi.setSystemTime(firstArrival() + 60_000);
    await settle();
    await message("UANA", "<@UBEN> <@UCLEO> :taco: thanks for the thorough reviews");
    expect(await blight()).toMatchObject({ status: "active", damage: 2, contributors: 1 });
    expect(await contributor(team.ana)).toMatchObject({ damage: 2 });
  });

  test("a thank-back or a kudos without a reason deals nothing", async () => {
    await blightHere();
    await message("UBEN", "<@UANA> :taco: thanks for pairing with me today");
    await message("UANA", "<@UBEN> :taco: thank you right back Ben");
    await message("UCLEO", "<@UANA> :taco:");
    expect(await blight()).toMatchObject({ damage: 1, contributors: 1 });
    expect(await contributor(team.cleo)).toBeNull();
  });
});

describe("victory", () => {
  test("the winning blow beats it: a bonus day tomorrow, and 20 coins, a crest and a DM for each who fought, once", async () => {
    await blightHere(3);
    await message("UANA", "<@UBEN> <@UCLEO> :taco: thanks for the thorough reviews");
    await message("UBEN", "<@UCLEO> :taco: thanks for the new dashboard");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const won = await blight();
    const today = dayKeyFor(Date.now(), TZ);
    expect(won).toMatchObject({ status: "won", damage: 3, bonusDay: addDays(today, 1) });
    const boost = await t.run((ctx) => ctx.db.query("boosts").collect());
    expect(boost).toEqual([expect.objectContaining({ source: "blight", kind: "double", dayKey: addDays(today, 1) })]);
    expect(await player(team.ana)).toMatchObject({ blightCoins: BLIGHT.rewardCoins });
    expect(await player(team.ben)).toMatchObject({ blightCoins: BLIGHT.rewardCoins });
    const paid = await t.run((ctx) => ctx.db.query("gameEvents").withIndex("by_batch", (q) => q.eq("batchId", `blight:${won._id}`)).collect());
    expect(paid.map((e) => [e.memberId, e.coins, e.xp]).sort()).toEqual([[team.ana, 20, 0], [team.ben, 20, 0]].sort());
    const dms = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(dms.filter((n) => n.gains?.some((g) => g.kind === "blight_won"))).toHaveLength(2);

    // Paying again, or striking a beaten blight, changes nothing.
    await t.mutation(internal.blights.payOut, { blightId: won._id });
    await message("UCLEO", "<@UANA> :taco: thanks for the planning session");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await player(team.ana)).toMatchObject({ blightCoins: BLIGHT.rewardCoins });
    expect(await blight()).toMatchObject({ damage: 3, contributors: 2 });
    expect(await events("blight_won")).toHaveLength(1);
  });

  test("a game rebuild keeps what a blight paid", async () => {
    await blightHere(1);
    await message("UANA", "<@UBEN> :taco: thanks for the careful review today");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const before = (await player(team.ana))!;
    await t.mutation(internal.game.rebuildMember, { memberId: team.ana });
    const after = (await player(team.ana))!;
    expect(after).toMatchObject({ blightCoins: BLIGHT.rewardCoins, coins: before.coins });
  });

  test("the crests hang in the gallery of those who fought", async () => {
    await blightHere(1);
    await message("UANA", "<@UBEN> :taco: thanks for the careful review today");
    const ana = await signInAs(t, team.ana);
    const ben = await signInAs(t, team.ben);
    expect(await ana.query(api.discoveries.crests, {})).toEqual([expect.objectContaining({ number: 1, damage: 1 })]);
    expect(await ben.query(api.discoveries.crests, {})).toEqual([]);
  });
});

describe("defeat", () => {
  test("when its days run out it is lost: the lanterns dim a week, and the next blight is half as strong", async () => {
    await blightHere();
    await activeOn(dayKeyFor(Date.now(), TZ), team.ana, team.ben, team.cleo);
    const lost = await blight();
    vi.setSystemTime(lost.endsAt + 60_000);
    await settle();
    expect(await blight()).toMatchObject({ status: "lost", endedAt: lost.endsAt });
    const tree = await t.run((ctx) => ctx.db.query("trees").first());
    expect(tree?.lanternsDimUntil).toBe(lost.endsAt + 7 * DAY_MS);
    expect(await events("blight_lost")).toHaveLength(1);

    const next = startOfDayUtc(dayKeyFor(nextBlightAt(SEED, lost.endsAt, 1), TZ), TZ);
    vi.setSystemTime(next + 60_000);
    await settle();
    const second = (await blights()).find((b) => b.number === 2)!;
    expect(second).toMatchObject({ status: "active", defeatedBefore: true, hp: blightHp(3, true) });
    expect(second.hp).toBe(BLIGHT.minHp);
  });
});

// ── Rooms and the raid ──────────────────────────────────────────────────────

/** Ana as a player at `level` with `stamina`. */
async function explorer(level: number, stamina: number) {
  await t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId: team.ana, since: Date.now() - 1, xp: xpForLevel(level), level, coins: 0, stamina }));
  return await signInAs(t, team.ana);
}
const run = () => t.run(async (ctx) => (await ctx.db.query("expeditions").order("desc").first())!);
async function playOut(viewer: Awaited<ReturnType<typeof explorer>>) {
  for (let guard = 0; guard < 300; guard++) {
    const r = await run();
    if (r.state !== "open") return r;
    const room = r.rooms[r.room];
    if (room.kind === "foe") await viewer.mutation(api.rpg.act, { choice: { kind: "strike" } });
    else if (room.kind === "puzzle") await viewer.mutation(api.rpg.act, { choice: { kind: "answer", option: r.puzzle!.answer } });
    else await viewer.mutation(api.rpg.act, { choice: { kind: "onward" } });
  }
  throw new Error("the run never ended");
}
/** Rooms of a cleared run that took effort: foes and puzzles (rests and secrets deal nothing). */
const effortRooms = (seed: number, ruinId: string) => generateRuin(seed, ruinId).rooms.filter((r) => r.kind === "foe" || r.kind === "puzzle").length;

describe("rooms and the blight raid", () => {
  test("each room an expedition clears deals two, once for the party", async () => {
    await blightHere(10_000);
    const ana = await explorer(25, 2);
    await ana.mutation(api.rpg.start, { ruinId: "ruin:1:0" });
    const done = await playOut(ana);
    expect(done.state).toBe("cleared");
    expect(await blight()).toMatchObject({ damage: 2 * effortRooms(SEED, "ruin:1:0"), contributors: 1 });
  });

  test("the raid opens only while a blight is at the tree, costs a stamina, waives the level, and deals ten a room", async () => {
    await ancientTree();
    const ana = await explorer(1, 2);
    await expect(ana.mutation(api.rpg.startRaid, {})).rejects.toThrow(/No blight is at the tree/);
    vi.setSystemTime(firstArrival() + 60_000);
    await settle();
    await t.run(async (ctx) => ctx.db.patch((await ctx.db.query("blights").first())!._id, { hp: 10_000 }));
    await ana.mutation(api.rpg.startRaid, {});
    const r = await run();
    expect(r).toMatchObject({ ruinId: "raid:1", tier: 1, state: "open" });
    expect(r.rooms).toEqual(generateRuin(SEED, "raid:1").rooms);
    expect(await player(team.ana)).toMatchObject({ stamina: 1 });
    // Level 1 against the raid: whatever the party clears before it falls counts, ten a room.
    const done = await playOut(ana);
    const cleared = done.rooms.slice(0, done.state === "cleared" ? done.rooms.length : done.room).filter((room) => room.kind === "foe" || room.kind === "puzzle").length;
    expect(await blight()).toMatchObject({ damage: 10 * cleared });
  });
});

// ── Reading it, the gatehouse, housekeeping ────────────────────────────────

describe("what players see", () => {
  test("the blight at the tree with their own damage, and the ones that came before", async () => {
    await blightHere(2);
    await message("UANA", "<@UBEN> :taco: thanks for the careful review today");
    const ana = await signInAs(t, team.ana);
    expect(await ana.query(api.blights.current, {})).toEqual({
      blight: expect.objectContaining({ number: 1, status: "active", hp: 2, damage: 1, contributors: 1, mine: 1, tier: 1 }),
      lanternsDimUntil: null,
    });
    expect(await ana.query(api.blights.history, {})).toEqual([]);
    await message("UBEN", "<@UCLEO> :taco: thanks for the lovely dashboard");
    expect(await ana.query(api.blights.history, {})).toEqual([expect.objectContaining({ number: 1, status: "won", damage: 2, mine: 1 })]);
    const cleo = await signInAs(t, team.cleo);
    expect((await cleo.query(api.blights.current, {}))?.blight).toMatchObject({ mine: 0 });
  });

  test("nothing while the game is hidden from them", async () => {
    await blightHere();
    await t.run((ctx) => ctx.db.patch(team.ben, { gameHidden: true }));
    const ben = await signInAs(t, team.ben);
    expect(await ben.query(api.blights.current, {})).toBeNull();
    expect(await ben.query(api.blights.history, {})).toEqual([]);
  });
});

describe("the gatehouse", () => {
  test("an admin sends a blight for a day ahead and calls it off before it comes; the schedule goes on from then", async () => {
    await ancientTree();
    const ana = await signInAs(t, team.ana);
    const today = dayKeyFor(Date.now(), TZ);
    await expect(ana.mutation(api.blights.schedule, { dayKey: today })).rejects.toThrow(/pick tomorrow or a later day/);
    const id = await ana.mutation(api.blights.schedule, { dayKey: addDays(today, 1) });
    expect(await blight()).toMatchObject({ _id: id, status: "announced", source: "admin", by: team.ana, arrivesAt: startOfDayUtc(addDays(today, 1), TZ) });
    await expect(ana.mutation(api.blights.schedule, { dayKey: addDays(today, 2) })).rejects.toThrow(/on its way already/);

    await ana.mutation(api.blights.cancel, { blightId: id });
    expect(await blight()).toMatchObject({ status: "called_off" });
    expect(await events("blight_called_off")).toHaveLength(1);
    // The seeded schedule doesn't send it straight back: the next is planned from the call-off.
    await settle();
    expect(await blights()).toHaveLength(1);
  });

  test("only admins, only from the ancient stage, and never one that has arrived", async () => {
    const ben = await signInAs(t, team.ben);
    const ana = await signInAs(t, team.ana);
    const tomorrow = addDays(dayKeyFor(Date.now(), TZ), 1);
    await expect(ana.mutation(api.blights.schedule, { dayKey: tomorrow })).rejects.toThrow(/ancient tree/);
    await ancientTree();
    await expect(ben.mutation(api.blights.schedule, { dayKey: tomorrow })).rejects.toThrow(/admins/);
    const id = await ana.mutation(api.blights.schedule, { dayKey: tomorrow });
    vi.setSystemTime(startOfDayUtc(tomorrow, TZ) + 60_000);
    await settle();
    await expect(ana.mutation(api.blights.cancel, { blightId: id })).rejects.toThrow(/has arrived/);
  });
});

describe("housekeeping", () => {
  test("removing a member takes them off the ledgers; the blight keeps its damage", async () => {
    await blightHere();
    await message("UBEN", "<@UCLEO> :taco: thanks for the lovely dashboard");
    await message("UANA", "<@UCLEO> :taco: thanks for the careful review");
    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UBEN" });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 5000);
    expect(await t.run((ctx) => ctx.db.query("blightContributors").collect())).toEqual([expect.objectContaining({ memberId: team.ana })]);
    expect(await blight()).toMatchObject({ damage: 2, contributors: 1 });
  });

  test("a demo reset or a simulator's wipe clears every blight and ledger", async () => {
    await blightHere();
    await message("UANA", "<@UCLEO> :taco: thanks for the careful review");
    const { wipeActivity } = await import("../convex/demo");
    await t.run(async (ctx) => {
      const members = await ctx.db.query("members").collect();
      while ((await wipeActivity(ctx, team.workspaceId, members)) > 0);
    });
    expect(await blights()).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("blightContributors").collect())).toEqual([]);
  });
});
