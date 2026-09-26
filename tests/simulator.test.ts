import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { DEMO_SETTINGS } from "../convex/lib/settings";
import { DAY_MS } from "../convex/lib/time";
import { xpForLevel } from "../convex/lib/xp";
import { DEMO_TIMEOUT, seedTeam, setupConvex, signInAs } from "./helpers";

/**
 * The simulator (#143): a demo visitor's private workspace with its own clock, joined at a level.
 * Everyone shares the demo user, so a simulator belongs to the visitor's sign-in session.
 */

// Fast-forwards play dozens of days through the engine; a loaded machine gets the demo's timeout.
vi.setConfig({ testTimeout: DEMO_TIMEOUT });

let t: ReturnType<typeof setupConvex>;
let demoUser: Id<"users">;
let sharedDemo: Id<"workspaces">;

beforeEach(async () => {
  t = setupConvex();
  // The shared demo without its seeded year (entering it for real takes ~15 s): its workspace and
  // the shared demo user, Alex.
  ({ demoUser, sharedDemo } = await t.run(async (ctx) => {
    const sharedDemo = await ctx.db.insert("workspaces", { slackTeamId: "T_DEMO_LUMEN", name: "Lumen Labs", isDemo: true, status: "active", ...DEMO_SETTINGS });
    const demoUser = await ctx.db.insert("users", { name: "Alex Rivera", isDemo: true, slackUserId: "UDEMOYOU", slackTeamId: "T_DEMO_LUMEN" });
    const member = { isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 };
    await ctx.db.insert("members", { ...member, workspaceId: sharedDemo, slackUserId: "UDEMOYOU", name: "Alex Rivera", isAdmin: true, userId: demoUser });
    await ctx.db.insert("members", { ...member, workspaceId: sharedDemo, slackUserId: "UDEMOPRIYA", name: "Priya Raman", isAdmin: false });
    return { demoUser, sharedDemo };
  }));
});
afterEach(() => vi.useRealTimers());

/** A visitor: the shared demo user in their own sign-in session. */
const visitor = (session: string) => t.withIdentity({ subject: `${demoUser}|${session}` });

async function viewerOf(session: string) {
  const v = await visitor(session).query(api.session.viewer, {});
  if (v.status !== "ready") throw new Error(v.status);
  return v;
}

/** Runs everything the simulator scheduled (wipes, fast-forward days). */
const settle = () => t.finishAllScheduledFunctions(vi.runAllTimers, 5_000);

const rowsIn = (workspaceId: Id<"workspaces">) =>
  t.run(async (ctx) => ({
    workspace: await ctx.db.get(workspaceId),
    members: (await ctx.db.query("members").collect()).filter((m) => m.workspaceId === workspaceId).length,
    kudos: (await ctx.db.query("kudos").collect()).filter((k) => k.workspaceId === workspaceId).length,
    events: (await ctx.db.query("gameEvents").collect()).filter((e) => e.workspaceId === workspaceId).length,
    players: (await ctx.db.query("players").collect()).filter((p) => p.workspaceId === workspaceId).length,
  }));

describe("starting a simulator", () => {
  test("gives the visitor a private workspace with 12 teammates, shown as their current one", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    const v = await viewerOf("a");
    expect(v.workspace).toMatchObject({ name: "Simulator", isDemo: true, gameEnabled: true, questsEnabled: true, spreesEnabled: true });
    expect(v.workspace.clockOffsetMs).toBeGreaterThanOrEqual(0);
    expect(v.member).toMatchObject({ name: "Alex Rivera", isAdmin: true });
    expect(v.workspaces.map((w) => [w.name, w.current])).toEqual([
      ["Simulator", true],
      ["Lumen Labs", false],
    ]);
    const teammates = await visitor("a").query(api.demo.teammates, {});
    expect(teammates).toHaveLength(13);
  });

  test("another visitor (the same demo user, another session) never sees it", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    const other = await viewerOf("b");
    expect(other.workspace._id).toBe(sharedDemo);
    expect(other.workspaces.map((w) => w.name)).toEqual(["Lumen Labs"]);
    expect(await visitor("b").query(api.simulator.state, {})).toMatchObject({ active: false });
  });

  test("joins at level 1 with 0 XP by default", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    expect(await visitor("a").query(api.simulator.state, {})).toMatchObject({ active: true, level: 1, xp: 0, dayIndex: 0 });
  });

  test("joins at a level: its XP floor, skill points and level-up coins, and nothing else", async () => {
    await visitor("a").mutation(api.simulator.start, { level: 4 });
    expect(await visitor("a").query(api.simulator.state, {})).toMatchObject({ active: true, level: 4, xp: xpForLevel(4) });
    const game = await visitor("a").query(api.game.mine, {});
    expect(game.wallet).toMatchObject({ balance: 30, fromLevels: 30, fromKudos: 0 });
    const skills = await visitor("a").query(api.skills.mine, {});
    expect(skills).toMatchObject({ level: 4, skills: {} });
    const { workspace } = await viewerOf("a");
    // One seed event: no kudos, no stats, no garden, no discoveries.
    const rows = await rowsIn(workspace._id);
    expect(rows).toMatchObject({ kudos: 0, events: 1, players: 1 });
    const [event] = await t.run((ctx) => ctx.db.query("gameEvents").collect());
    expect(event).toMatchObject({ kind: "seed", xp: xpForLevel(4) });
  });

  test("refuses a level outside 1–25", async () => {
    await expect(visitor("a").mutation(api.simulator.start, { level: 26 })).rejects.toThrow(/level/i);
    await expect(visitor("a").mutation(api.simulator.start, { level: 0 })).rejects.toThrow(/level/i);
  });

  test("only demo visitors can start one", async () => {
    const team = await seedTeam(t);
    const ana = await signInAs(t, team.ana);
    await expect(ana.mutation(api.simulator.start, {})).rejects.toThrow(/demo/i);
  });

  test("a game rebuild keeps the seeded level", async () => {
    await visitor("a").mutation(api.simulator.start, { level: 6 });
    const { workspace } = await viewerOf("a");
    await t.mutation(internal.game.rebuildWorkspace, { workspaceId: workspace._id });
    await settle();
    expect(await visitor("a").query(api.simulator.state, {})).toMatchObject({ level: 6, xp: xpForLevel(6) });
  });
});

describe("resetting and stopping", () => {
  test("starting again resets it: a fresh simulator, the old one wiped", async () => {
    await visitor("a").mutation(api.simulator.start, { level: 3 });
    const first = (await viewerOf("a")).workspace._id;
    await visitor("a").mutation(api.simulator.reset, {});
    const second = (await viewerOf("a")).workspace._id;
    expect(second).not.toBe(first);
    expect(await visitor("a").query(api.simulator.state, {})).toMatchObject({ level: 3 }); // the level it started at
    await settle();
    expect(await rowsIn(first)).toMatchObject({ workspace: null, members: 0, events: 0, players: 0 });
    expect((await viewerOf("a")).workspaces.map((w) => w.name)).toEqual(["Simulator", "Lumen Labs"]);
  });

  test("stopping wipes it and switches back to the shared demo", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    const sim = (await viewerOf("a")).workspace._id;
    await visitor("a").mutation(api.simulator.stop, {});
    expect((await viewerOf("a")).workspace._id).toBe(sharedDemo);
    await settle();
    expect(await rowsIn(sim)).toMatchObject({ workspace: null, members: 0 });
    expect(await rowsIn(sharedDemo)).toMatchObject({ members: 2 });
  });

  test("the switcher moves between the simulator and the shared demo", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    const v = await viewerOf("a");
    const demoMember = v.workspaces.find((w) => w.name === "Lumen Labs")!.memberId;
    await visitor("a").mutation(api.session.switchWorkspace, { memberId: demoMember });
    expect((await viewerOf("a")).workspace._id).toBe(sharedDemo);
    await visitor("a").mutation(api.session.switchWorkspace, { memberId: v.member._id });
    expect((await viewerOf("a")).workspace.name).toBe("Simulator");
  });

  test("simulators are wiped 7 days after they started", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    const sim = (await viewerOf("a")).workspace._id;
    vi.setSystemTime(Date.now() + 6 * DAY_MS);
    await t.mutation(internal.simulator.wipeExpired, {});
    await settle();
    expect((await rowsIn(sim)).workspace).not.toBeNull();
    vi.setSystemTime(Date.now() + 1 * DAY_MS + 1);
    await t.mutation(internal.simulator.wipeExpired, {});
    await settle();
    expect(await rowsIn(sim)).toMatchObject({ workspace: null, members: 0 });
    expect((await viewerOf("a")).workspace._id).toBe(sharedDemo);
  });

  test("the shared demo's own functions refuse to touch it", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    await expect(visitor("a").mutation(api.demo.resetDemo, {})).rejects.toThrow(/simulator/i);
  });

  test("simulator controls refuse outside a simulator", async () => {
    await expect(visitor("a").mutation(api.simulator.advance, { days: 1 })).rejects.toThrow(/simulator/i);
    await expect(visitor("a").mutation(api.simulator.fastForward, { levels: 1 })).rejects.toThrow(/simulator/i);
  });
});

/** The visitor's simulator: its workspace and visitor member. */
async function simulator(session = "a") {
  const v = await viewerOf(session);
  return { workspaceId: v.workspace._id, memberId: v.member._id };
}

const say = (text: string, session = "a") => visitor(session).mutation(api.demo.simulateMessage, { text, channelName: "general" });
const NOTE = "thanks for walking the new joiners through the release process so patiently";

describe("advancing the clock", () => {
  test("moves to the next morning: a new day, and the allowance is back", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    const before = await visitor("a").query(api.simulator.state, {});
    expect((await say(`<@UDEMOPRIYA> :taco::taco::taco::taco::taco: ${NOTE}`)).status).toBe("given");
    expect((await say(`<@UDEMOJONAS> :taco: ${NOTE}`)).status).toBe("limit");

    const res = await visitor("a").mutation(api.simulator.advance, { days: 1 });
    expect(res.dayIndex).toBe(1);
    expect(res.changes[0]).toMatch(/your 5 kudos for today are back/);
    const after = await visitor("a").query(api.simulator.state, {});
    expect(after).toMatchObject({ dayIndex: 1, day: res.day });
    expect(after.active && after.clockOffsetMs).toBeGreaterThan(before.active ? before.clockOffsetMs : 0);
    expect((await viewerOf("a")).workspace.clockOffsetMs).toBe(after.active && after.clockOffsetMs);
    expect((await say(`<@UDEMOJONAS> :taco: ${NOTE}`)).status).toBe("given");
    const kudos = await t.run((ctx) => ctx.db.query("kudos").collect());
    expect(kudos.at(-1)!.dayKey).toBe(res.day);
  });

  test("a new week brings a new quest board, and today's daily quest from level 5", async () => {
    await visitor("a").mutation(api.simulator.start, { level: 5 });
    const res = await visitor("a").mutation(api.simulator.advance, { days: 7 });
    expect(res.dayIndex).toBe(7);
    expect(res.changes).toContain("A new week: a new quest board.");
    expect(res.changes.some((c) => c.startsWith("Today's quest: "))).toBe(true);
  });

  test("a bonus day starts", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    const { workspaceId } = await simulator();
    const state = await visitor("a").query(api.simulator.state, {});
    const tomorrow = await t.run(async (ctx) => {
      const { addDays, startOfDayUtc } = await import("../convex/lib/time");
      const day = addDays(state.active ? state.day : "", 1);
      await ctx.db.insert("boosts", { workspaceId, dayKey: day, from: startOfDayUtc(day, "Europe/Berlin"), kind: "double", source: "schedule", createdAt: 0 });
      return day;
    });
    const res = await visitor("a").mutation(api.simulator.advance, { days: 1 });
    expect(res.day).toBe(tomorrow);
    expect(res.changes).toContain("Bonus day today: every thoughtful kudos earns double XP and Hog coins.");
  });

  test("a spree whose window ran out lapses", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    const { workspaceId, memberId } = await simulator();
    const spreeId = await t.run(async (ctx) => {
      const ws = (await ctx.db.get(workspaceId))!;
      const at = Date.now() + (ws.clockOffsetMs ?? 0);
      return await ctx.db.insert("sprees", {
        workspaceId,
        batchId: "b1",
        channelId: "C_DEMO_GENERAL",
        messageTs: "1.0",
        giverId: memberId,
        receiverIds: [],
        text: "x",
        kudosAt: at,
        status: "open",
        tier: 0,
        joiners: 0,
        deadline: at + DAY_MS,
        tiers: [],
      });
    });
    const res = await visitor("a").mutation(api.simulator.advance, { days: 2 });
    expect(res.changes).toContain("A kudos spree ran out of time.");
    expect((await t.run((ctx) => ctx.db.get(spreeId)))!.status).toBe("lapsed");
  });

  test("a plant grows with the days", async () => {
    // Waterings count from the week after planting (lib/garden.ts): plant on Sunday, water on Monday,
    // and the plant's age alone makes it a Sprout on Wednesday, which the advance reports.
    await visitor("a").mutation(api.simulator.start, { level: 5 });
    expect((await visitor("a").mutation(api.simulator.advance, { days: 3 })).changes[0]).toMatch(/^Sunday/);
    await say(`<@UDEMOPRIYA> :taco: ${NOTE}`);
    const { workspaceId } = await simulator();
    const priya = await t.run(async (ctx) => (await ctx.db.query("members").collect()).find((m) => m.slackUserId === "UDEMOPRIYA" && m.workspaceId === workspaceId)!._id);
    await visitor("a").mutation(api.gardens.plant, { teammateId: priya });
    await visitor("a").mutation(api.simulator.advance, { days: 1 });
    await say(`<@UDEMOPRIYA> :taco: ${NOTE}`); // its first watering
    const res = await visitor("a").mutation(api.simulator.advance, { days: 2 });
    expect(res.changes).toContain("Your plant for Priya Raman grew: Sprout.");
  });

  test("moves 1 to 30 days at a time", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    await expect(visitor("a").mutation(api.simulator.advance, { days: 0 })).rejects.toThrow(/1 to 30/);
    await expect(visitor("a").mutation(api.simulator.advance, { days: 31 })).rejects.toThrow(/1 to 30/);
    await expect(visitor("a").mutation(api.simulator.advance, { days: 1.5 })).rejects.toThrow(/1 to 30/);
  });
});

describe("fast-forward", () => {
  test("a bot plays day by day to the target level and sums up the journey", async () => {
    await visitor("a").mutation(api.simulator.start, { level: 4 });
    const { memberId } = await simulator();
    await visitor("a").mutation(api.simulator.fastForward, { levels: 2 });
    expect(await visitor("a").query(api.simulator.lastRun, {})).toMatchObject({ status: "running", fromLevel: 4, toLevel: 6 });
    await settle();

    const state = await visitor("a").query(api.simulator.state, {});
    if (!state.active) throw new Error("no simulator");
    expect(state.level).toBeGreaterThanOrEqual(6);
    const run = state.lastRun!;
    expect(run.status).toBe("done");
    const s = run.summary;
    expect(s.daysPlayed).toBeGreaterThan(1);
    expect(state.dayIndex).toBe(s.daysPlayed); // the clock moved a day per day played
    expect(s.kudosGiven).toBeGreaterThan(0);
    expect(s.kudosGiven).toBeLessThanOrEqual(5 * s.daysPlayed);
    expect(s.thoughtfulKudos).toBe(s.kudosGiven); // every note says why, and nobody thanks back
    expect(s.newConnections).toBeGreaterThan(0);
    expect(s.levelsGained).toBe(state.level - 4);
    expect(s.coinsEarned).toBeGreaterThanOrEqual(s.kudosGiven + 10 * s.levelsGained);
    expect(s.questsCompleted.daily + s.questsCompleted.weekly).toBeGreaterThan(0); // quests are open from level 5
    expect(run.levelDays.map((l) => l.level)).toEqual([5, 6].slice(0, s.levelsGained));
    expect(run.levelDays.reduce((sum, l) => sum + l.days, 0)).toBeLessThanOrEqual(s.daysPlayed);

    // The real engine's limits held every day: the allowance and the daily XP cap.
    const days = await t.run((ctx) => ctx.db.query("memberDays").collect());
    expect(days.filter((d) => d.memberId === memberId).every((d) => d.given <= 5)).toBe(true);
    const gives = (await t.run((ctx) => ctx.db.query("gameEvents").collect())).filter((e) => e.memberId === memberId && e.kind === "give");
    const xpByDay = new Map<string, number>();
    for (const e of gives) xpByDay.set(e.dayKey, (xpByDay.get(e.dayKey) ?? 0) + e.xp);
    expect([...xpByDay.values()].every((xp) => xp <= 50)).toBe(true);
  });

  test("the bot plants in a free plot, waters its plants and picks their fruit", async () => {
    await visitor("a").mutation(api.simulator.start, { level: 3 });
    await visitor("a").mutation(api.simulator.fastForward, { levels: 2 });
    await settle();
    const run = await visitor("a").query(api.simulator.lastRun, {});
    expect(run!.summary.plantsPlanted).toBe(1); // one plot until the visitor takes More plots
    const { memberId } = await simulator();
    const [plant] = await t.run((ctx) => ctx.db.query("plants").collect());
    expect(plant.ownerId).toBe(memberId);
  });

  test("aborting stops it after the day it is playing", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    await visitor("a").mutation(api.simulator.fastForward, { levels: 10 });
    await visitor("a").mutation(api.simulator.abort, {});
    await settle();
    const run = await visitor("a").query(api.simulator.lastRun, {});
    expect(run).toMatchObject({ status: "aborted" });
    expect(run!.summary.daysPlayed).toBe(0);
  });

  test("one run at a time, and the clock waits for it", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    await visitor("a").mutation(api.simulator.fastForward, { levels: 1 });
    await expect(visitor("a").mutation(api.simulator.fastForward, { levels: 1 })).rejects.toThrow(/already/);
    await expect(visitor("a").mutation(api.simulator.advance, { days: 1 })).rejects.toThrow(/fast-forward/);
  });

  test("never past level 25", async () => {
    await visitor("a").mutation(api.simulator.start, { level: 25 });
    await expect(visitor("a").mutation(api.simulator.fastForward, { levels: 1 })).rejects.toThrow(/25/);
    await visitor("a").mutation(api.simulator.reset, { level: 24 });
    await expect(visitor("a").mutation(api.simulator.fastForward, { levels: 25 })).rejects.toThrow(/1 to 24/);
  });

  test("a reset stops a running fast-forward", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    await visitor("a").mutation(api.simulator.fastForward, { levels: 5 });
    await visitor("a").mutation(api.simulator.reset, {});
    await settle();
    expect(await visitor("a").query(api.simulator.lastRun, {})).toBeNull(); // the fresh simulator hasn't run one
    expect(await visitor("a").query(api.simulator.state, {})).toMatchObject({ level: 1, dayIndex: 0 });
  });
});

describe("review fixes", () => {
  test("a fast-forward never plants for a teammate it has no thoughtful kudos to (a thank-back)", async () => {
    await visitor("a").mutation(api.simulator.start, { level: 3 });
    const { workspaceId, memberId } = await simulator();
    // Everyone thanked Alex yesterday, so none of the bot's kudos today qualifies (all thank-backs).
    await t.run(async (ctx) => {
      const ws = (await ctx.db.get(workspaceId))!;
      const at = Date.now() + (ws.clockOffsetMs ?? 0) - 3_600_000;
      for (const m of await ctx.db.query("members").withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspaceId)).collect()) {
        if (m._id === memberId) continue;
        await ctx.db.insert("kudos", { workspaceId, batchId: `b-${m._id}`, giverId: m._id, receiverId: memberId, amount: 1, dayKey: "2026-09-24", source: "playground", channelId: "C", text: "x", at, hour: 9 });
      }
    });
    await visitor("a").mutation(api.simulator.fastForward, { levels: 1 });
    await settle();
    const run = await visitor("a").query(api.simulator.lastRun, {});
    expect(run!.status).toBe("done");
    expect(run!.summary.daysPlayed).toBeGreaterThan(0);
  });

  test("a fast-forward whose day failed doesn't block the simulator: a stale run is stopped", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    const { workspaceId, memberId } = await simulator();
    await t.run((ctx) =>
      ctx.db.insert("simulatorRuns", {
        workspaceId,
        memberId,
        status: "running",
        fromLevel: 1,
        toLevel: 2,
        startedAt: Date.now(),
        heartbeatAt: Date.now(),
        summary: { daysPlayed: 0, kudosGiven: 0, thoughtfulKudos: 0, questsCompleted: { weekly: 0, daily: 0, sweeps: 0 }, coinsEarned: 0, fruitPicked: 0, plantsPlanted: 0, levelsGained: 0, newConnections: 0 },
        levelDays: [],
      }),
    );
    await expect(visitor("a").mutation(api.simulator.advance, { days: 1 })).rejects.toThrow(/fast-forward/);
    vi.setSystemTime(Date.now() + 10 * 60_000); // no day played for ten minutes: the chain died
    await visitor("a").mutation(api.simulator.advance, { days: 1 });
    expect(await visitor("a").query(api.simulator.lastRun, {})).toMatchObject({ status: "stopped" });
  });

  test("advancing 10 days closes a spree that was open before", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    const { workspaceId, memberId } = await simulator();
    const spreeId = await t.run(async (ctx) => {
      const ws = (await ctx.db.get(workspaceId))!;
      const at = Date.now() + (ws.clockOffsetMs ?? 0);
      return await ctx.db.insert("sprees", {
        workspaceId,
        batchId: "b1",
        channelId: "C_DEMO_GENERAL",
        messageTs: "1.0",
        giverId: memberId,
        receiverIds: [],
        text: "x",
        kudosAt: at,
        status: "open",
        tier: 0,
        joiners: 0,
        deadline: at + DAY_MS,
        tiers: [],
      });
    });
    const res = await visitor("a").mutation(api.simulator.advance, { days: 10 });
    expect(res.changes).toContain("A kudos spree ran out of time.");
    expect((await t.run((ctx) => ctx.db.get(spreeId)))!.status).toBe("lapsed");
  });

  test("the bot's day never runs past midnight: late in the day, it plays the next morning", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    const { memberId } = await simulator();
    vi.setSystemTime(Date.now() + 14.5 * 3_600_000); // the simulator's clock reads 23:30
    await visitor("a").mutation(api.simulator.fastForward, { levels: 2 });
    await settle();
    const days = (await t.run((ctx) => ctx.db.query("memberDays").collect())).filter((d) => d.memberId === memberId);
    expect(days.every((d) => d.given === 5)).toBe(true);
    const run = await visitor("a").query(api.simulator.lastRun, {});
    expect(run!.summary.thoughtfulKudos).toBe(run!.summary.kudosGiven);
  });

  test("too many fast-forwards at once: the simulator asks to wait", async () => {
    for (let i = 0; i < 20; i++) {
      await visitor(`s${i}`).mutation(api.simulator.start, {});
      await visitor(`s${i}`).mutation(api.simulator.fastForward, { levels: 1 });
    }
    await visitor("late").mutation(api.simulator.start, {});
    await expect(visitor("late").mutation(api.simulator.fastForward, { levels: 1 })).rejects.toThrow(/busy/);
  });

  test("advancing across the autumn DST switch lands on each calendar day", async () => {
    vi.setSystemTime(new Date("2026-10-24T05:00:00Z")); // Saturday 07:00 in Berlin
    await visitor("a").mutation(api.simulator.start, {});
    expect((await visitor("a").mutation(api.simulator.advance, { days: 1 })).day).toBe("2026-10-25");
    expect((await visitor("a").mutation(api.simulator.advance, { days: 1 })).day).toBe("2026-10-26");
    expect(await visitor("a").query(api.simulator.state, {})).toMatchObject({ dayIndex: 2 });
  });

  test("wipe never touches a workspace that isn't a detached simulator", async () => {
    const team = await seedTeam(t);
    await t.mutation(internal.simulator.wipe, { workspaceId: team.workspaceId });
    await t.mutation(internal.simulator.wipe, { workspaceId: sharedDemo });
    await visitor("a").mutation(api.simulator.start, {});
    const live = (await viewerOf("a")).workspace._id;
    await t.mutation(internal.simulator.wipe, { workspaceId: live });
    await settle();
    expect((await rowsIn(team.workspaceId)).members).toBe(4);
    expect((await rowsIn(sharedDemo)).members).toBe(2);
    expect((await rowsIn(live)).members).toBe(13);
  });

  test("a real Slack user has no simulator to read", async () => {
    const team = await seedTeam(t);
    const ana = await signInAs(t, team.ana);
    expect(await ana.query(api.simulator.state, {})).toEqual({ active: false });
    expect(await ana.query(api.simulator.lastRun, {})).toBeNull();
  });
});

describe("the cabin in a simulator (#144)", () => {
  test("its DMs are timed on the simulator's clock, like the kudos they're about, not the wall clock", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    // A day on, the simulator's clock runs a day or more ahead of the wall clock.
    await visitor("a").mutation(api.simulator.advance, { days: 1 });
    expect((await say(`<@UDEMOPRIYA> :taco: ${NOTE}`)).status).toBe("given");
    const state = await visitor("a").query(api.simulator.state, {});
    if (!state.active) throw new Error("no simulator");
    expect(state.clockOffsetMs).toBeGreaterThan(DAY_MS / 2);
    const overview = await visitor("a").query(api.me.overview, { period: "month", today: state.day });
    const given = overview.activity[0];
    expect(Math.abs(given.at - (Date.now() + state.clockOffsetMs))).toBeLessThan(60_000);
    expect(overview.botMessages.length).toBeGreaterThan(0);
    for (const dm of overview.botMessages) expect(Math.abs(dm.at - given.at)).toBeLessThan(60_000);
  });
});
