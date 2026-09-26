import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { wipeActivity } from "../convex/demo";
import { DEMO_SETTINGS } from "../convex/lib/settings";
import type { Id } from "../convex/_generated/dataModel";
import { seedTeam, setupConvex, type Team } from "./helpers";

/**
 * Presence in the shared world (#155, design plan #152 S2): everyone in the workspace who has the
 * game shown sees the other hogs walking near them, and who is online now. Never who is offline.
 */

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true });
});
afterEach(() => vi.useRealTimers());

/** A member signed in on a session of their own (Convex Auth identities are "<userId>|<sessionId>"). */
async function session(memberId: Id<"members">, sessionId = "s1") {
  const userId = await t.run(async (ctx) => {
    const existing = (await ctx.db.get(memberId))!.userId;
    if (existing) return existing;
    const userId = await ctx.db.insert("users", {});
    await ctx.db.patch(memberId, { userId });
    return userId;
  });
  return t.withIdentity({ subject: `${userId}|${sessionId}` });
}

const walk = { facing: "right" as const, animation: "walk" as const };

describe("heartbeat and nearby", () => {
  test("a heartbeat puts your hog in the world, where a teammate nearby sees it", async () => {
    const ana = await session(team.ana);
    const ben = await session(team.ben);
    expect(await ana.mutation(api.presence.heartbeat, { x: 3, y: 4, ...walk })).toBe(true);

    const seen = await ben.query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() });
    expect(seen).toEqual([
      expect.objectContaining({ memberId: team.ana, name: "Ana", x: 3, y: 4, facing: "right", animation: "walk", title: "Seedling", hasHome: false, look: { color: null, accessory: null } }),
    ]);
  });

  test("the name tag carries the level title", async () => {
    await makePlayer(team.ana, 6);
    const ana = await session(team.ana);
    const ben = await session(team.ben);
    await ana.mutation(api.presence.heartbeat, { x: 3, y: 4, ...walk });
    expect(await ben.query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() })).toEqual([expect.objectContaining({ title: "Gardener" })]);
  });
});

async function makePlayer(memberId: Id<"members">, level = 1, extra: Record<string, unknown> = {}) {
  return await t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId, since: Date.now(), xp: 0, level, ...extra }));
}

const advance = (ms: number) => vi.setSystemTime(Date.now() + ms);

describe("who is shown", () => {
  test("only hogs seen in the last minute: a hog that stopped beating goes offline", async () => {
    const ana = await session(team.ana);
    const ben = await session(team.ben);
    await ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk });
    advance(59_000);
    expect(await ben.query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() })).toHaveLength(1);
    advance(2_000);
    expect(await ben.query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() })).toEqual([]);
  });

  test("a client's clock can't look further back than the server's", async () => {
    const ana = await session(team.ana);
    const ben = await session(team.ben);
    await ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk });
    advance(5 * 60_000);
    expect(await ben.query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() - 5 * 60_000 })).toEqual([]);
  });

  test("only the chunks asked for, and never your own hog", async () => {
    const ana = await session(team.ana);
    const ben = await session(team.ben);
    await ana.mutation(api.presence.heartbeat, { x: 40, y: -3, ...walk }); // chunk 1:-1
    await ben.mutation(api.presence.heartbeat, { x: 2, y: 2, ...walk });
    expect(await ben.query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() })).toEqual([]);
    expect((await ben.query(api.presence.nearby, { chunks: ["0:0", "1:-1"], now: Date.now() })).map((h) => h.name)).toEqual(["Ana"]);
  });

  test("the same member signed in twice (every demo visitor is the same member) is two hogs", async () => {
    const tab1 = await session(team.ana, "s1");
    const tab2 = await session(team.ana, "s2");
    await tab1.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk });
    await tab2.mutation(api.presence.heartbeat, { x: 5, y: 5, ...walk });
    expect(await tab1.query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() })).toEqual([expect.objectContaining({ memberId: team.ana, x: 5, y: 5 })]);
  });

  test("never anyone from another workspace", async () => {
    const other = await seedTeam(t, { gameEnabled: true }, "T2");
    const stranger = await session(other.ana);
    await stranger.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk });
    const ben = await session(team.ben);
    expect(await ben.query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() })).toEqual([]);
  });

  test("reads are bounded: at most 9 chunks, 50 hogs a chunk", async () => {
    const ben = await session(team.ben);
    const ten = Array.from({ length: 10 }, (_, i) => `${i}:0`);
    await expect(ben.query(api.presence.nearby, { chunks: ten, now: Date.now() })).rejects.toThrow(/9 chunks/);
    await expect(ben.query(api.presence.nearby, { chunks: ["here"], now: Date.now() })).rejects.toThrow(/cx:cy/);
    await t.run(async (ctx) => {
      for (let i = 0; i < 60; i++) {
        const memberId = await ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId: `U${i}`, name: `M${i}`, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 });
        await ctx.db.insert("worldPresence", { workspaceId: team.workspaceId, memberId, sessionId: "x", x: 1, y: 1, chunk: "0:0", facing: "left", animation: "idle", name: `M${i}`, title: "Seedling", look: { color: null, accessory: null }, updatedAt: Date.now() });
      }
    });
    expect(await ben.query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() })).toHaveLength(50);
  });
});

describe("only while the game is shown", () => {
  test("a heartbeat is refused while the game is off, and nobody is seen", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    const ana = await session(team.ana);
    expect(await ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk })).toBe(false);
    expect(await t.run((ctx) => ctx.db.query("worldPresence").collect())).toEqual([]);
  });

  test("a member who hides the game leaves the world at once and sees nobody in it", async () => {
    const ana = await session(team.ana);
    const ben = await session(team.ben);
    await ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk });
    await ben.mutation(api.presence.heartbeat, { x: 2, y: 2, ...walk });
    await ana.mutation(api.game.setHidden, { hidden: true });
    expect(await ana.query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() })).toEqual([]);
    expect(await ben.query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() })).toEqual([]);
    expect(await ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk })).toBe(false);
  });

  test("a switched-off game shows nobody, even rows from before", async () => {
    const ana = await session(team.ana);
    const ben = await session(team.ben);
    await ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk });
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    expect(await ben.query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() })).toEqual([]);
  });

  test("signed-out callers are refused", async () => {
    await expect(t.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk })).rejects.toThrow(/Sign in/);
    await expect(t.query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() })).rejects.toThrow(/Sign in/);
  });

  test("tiles outside the world are refused", async () => {
    const ana = await session(team.ana);
    await expect(ana.mutation(api.presence.heartbeat, { x: Number.NaN, y: 1, ...walk })).rejects.toThrow(/outside the world/);
    await expect(ana.mutation(api.presence.heartbeat, { x: 2e6, y: 1, ...walk })).rejects.toThrow(/outside the world/);
  });
});

describe("where you left", () => {
  const at = async () => (await t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique()))!.at;
  const stand = { facing: "right" as const, animation: "idle" as const };

  test("a hog that stops is saved to players.at, at most every 10 s", async () => {
    await makePlayer(team.ana);
    const ana = await session(team.ana);
    await ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...stand });
    expect(await at()).toEqual({ x: 1, y: 1 });
    advance(5_000);
    await ana.mutation(api.presence.heartbeat, { x: 2, y: 1, ...stand });
    expect(await at()).toEqual({ x: 1, y: 1 });
    advance(5_000);
    await ana.mutation(api.presence.heartbeat, { x: 3, y: 1, ...stand });
    expect(await at()).toEqual({ x: 3, y: 1 });
  });

  test("a walking hog is saved only once a minute; the row moves every beat", async () => {
    await makePlayer(team.ana);
    const ana = await session(team.ana);
    await ana.mutation(api.presence.heartbeat, { x: 0, y: 0, ...walk });
    for (let i = 1; i <= 20; i++) {
      advance(1_000);
      await ana.mutation(api.presence.heartbeat, { x: i, y: 0, ...walk });
    }
    expect(await at()).toEqual({ x: 0, y: 0 });
    expect(await t.run((ctx) => ctx.db.query("worldPresence").unique())).toMatchObject({ x: 20, y: 0 });
    advance(40_000);
    await ana.mutation(api.presence.heartbeat, { x: 21, y: 0, ...walk });
    expect(await at()).toEqual({ x: 21, y: 0 });
  });

  test("members who haven't played yet walk too, and nothing is saved for them", async () => {
    const ana = await session(team.ana);
    expect(await ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...stand })).toBe(true);
    expect(await t.run((ctx) => ctx.db.query("players").collect())).toEqual([]);
  });
});

describe("your look", () => {
  test("a colour filter and an accessory from Hedgehog Mode's lists, worn at once in the world", async () => {
    await makePlayer(team.ana);
    const ana = await session(team.ana);
    const ben = await session(team.ben);
    await ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk });
    await ana.mutation(api.presence.setLook, { color: "rainbow", accessory: "xmas-antlers" });
    expect(await ben.query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() })).toEqual([
      expect.objectContaining({ look: { color: "rainbow", accessory: "xmas-antlers" } }),
    ]);
    expect(await ana.query(api.presence.mine, {})).toMatchObject({ look: { color: "rainbow", accessory: "xmas-antlers" } });
    await ana.mutation(api.presence.setLook, { color: null, accessory: "tophat" });
    expect(await ana.query(api.presence.mine, {})).toMatchObject({ look: { color: null, accessory: "tophat" } });
  });

  test("anything not in the lists is refused", async () => {
    await makePlayer(team.ana);
    const ana = await session(team.ana);
    await expect(ana.mutation(api.presence.setLook, { color: "gold" as "red", accessory: null })).rejects.toThrow();
    await expect(ana.mutation(api.presence.setLook, { color: null, accessory: "crown" as "cap" })).rejects.toThrow();
  });

  test("needs a player who sees the game", async () => {
    const ana = await session(team.ana);
    await expect(ana.mutation(api.presence.setLook, { color: "red", accessory: null })).rejects.toThrow(/first kudos/);
    await makePlayer(team.ana);
    await ana.mutation(api.game.setHidden, { hidden: true });
    await expect(ana.mutation(api.presence.setLook, { color: "red", accessory: null })).rejects.toThrow(/game/);
  });
});

describe("where you appear", () => {
  test("a newcomer appears at the base camp (no position) in the default look", async () => {
    const ana = await session(team.ana);
    expect(await ana.query(api.presence.mine, {})).toEqual({ at: null, look: { color: null, accessory: null } });
  });

  test("you reappear where you left: your freshest position, saved or still in this session", async () => {
    await makePlayer(team.ana, 1, { at: { x: -4, y: 7 } });
    const ana = await session(team.ana);
    expect(await ana.query(api.presence.mine, {})).toMatchObject({ at: { x: -4, y: 7 } });
    await ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk });
    advance(1_000);
    await ana.mutation(api.presence.heartbeat, { x: 2, y: 1, ...walk }); // walking: not saved yet
    expect(await ana.query(api.presence.mine, {})).toMatchObject({ at: { x: 2, y: 1 } });
    // Another device of theirs starts from the saved one.
    const phone = await session(team.ana, "phone");
    expect(await phone.query(api.presence.mine, {})).toMatchObject({ at: { x: 1, y: 1 } });
  });

  test("nothing while the game isn't shown", async () => {
    await t.run((ctx) => ctx.db.patch(team.workspaceId, { gameEnabled: false }));
    const ana = await session(team.ana);
    expect(await ana.query(api.presence.mine, {})).toBeNull();
  });
});

describe("who is online", () => {
  test("everyone in the world in the last minute, once each, you included; never who is offline", async () => {
    const ana = await session(team.ana, "s1");
    const anaTab = await session(team.ana, "s2");
    const ben = await session(team.ben);
    const cleo = await session(team.cleo);
    await cleo.mutation(api.presence.heartbeat, { x: 9, y: 9, ...walk });
    advance(61_000);
    await ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk });
    await anaTab.mutation(api.presence.heartbeat, { x: 70, y: 2, ...walk });
    await ben.mutation(api.presence.heartbeat, { x: 2, y: 2, ...walk });

    const online = await ben.query(api.presence.online, { now: Date.now() });
    expect(online.count).toBe(2);
    expect(online.players).toEqual([
      { memberId: team.ben, name: "Ben", x: 2, y: 2, you: true },
      { memberId: team.ana, name: "Ana", x: 70, y: 2, you: false },
    ]);
  });

  test("nobody while the game is hidden for the viewer", async () => {
    const ana = await session(team.ana);
    const ben = await session(team.ben);
    await ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk });
    await ben.mutation(api.game.setHidden, { hidden: true });
    expect(await ben.query(api.presence.online, { now: Date.now() })).toEqual({ count: 0, players: [] });
  });

  test("names at most 200 members", async () => {
    await t.run(async (ctx) => {
      for (let i = 0; i < 210; i++) {
        const memberId = await ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId: `U${i}`, name: `M${i}`, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 });
        await ctx.db.insert("worldPresence", { workspaceId: team.workspaceId, memberId, sessionId: "x", x: 1, y: 1, chunk: "0:0", facing: "left", animation: "idle", name: `M${i}`, title: "Seedling", look: { color: null, accessory: null }, updatedAt: Date.now() });
      }
    });
    const ben = await session(team.ben);
    const online = await ben.query(api.presence.online, { now: Date.now() });
    expect(online.players).toHaveLength(200);
    expect(online.count).toBe(200);
  });
});

const hogRow = (memberId: Id<"members">, updatedAt: number, workspaceId = team.workspaceId) => ({
  workspaceId, memberId, sessionId: "x", x: 1, y: 1, chunk: "0:0", facing: "left" as const, animation: "idle" as const,
  name: "Hog", title: "Seedling", look: { color: null, accessory: null }, updatedAt,
});

describe("sweeping", () => {
  test("rows not updated for 10 minutes are deleted; fresher ones stay", async () => {
    const ana = await session(team.ana);
    await ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk });
    advance(9 * 60_000);
    const ben = await session(team.ben);
    await ben.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk });
    advance(60_001);
    expect(await t.mutation(internal.presence.sweep, {})).toBe(1);
    expect((await t.run((ctx) => ctx.db.query("worldPresence").collect())).map((r) => r.memberId)).toEqual([team.ben]);
  });

  test("at most 1,500 rows a run; the next run takes the rest", async () => {
    const old = Date.now() - 11 * 60_000;
    await t.run(async (ctx) => {
      for (let i = 0; i < 1_600; i++) await ctx.db.insert("worldPresence", hogRow(team.cleo, old - i));
    });
    expect(await t.mutation(internal.presence.sweep, {})).toBe(1_500);
    expect(await t.mutation(internal.presence.sweep, {})).toBe(100);
    expect(await t.mutation(internal.presence.sweep, {})).toBe(0);
  });
});

describe("leaving for good", () => {
  test("removing a member deletes their presence and nobody else's", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("worldPresence", hogRow(team.cleo, Date.now()));
      await ctx.db.insert("worldPresence", hogRow(team.ben, Date.now()));
    });
    await t.mutation(internal.removal.removeMember, { slackTeamId: "T1", slackUserId: "UCLEO" });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 5_000);
    expect((await t.run((ctx) => ctx.db.query("worldPresence").collect())).map((r) => r.memberId)).toEqual([team.ben]);
  });
});

describe("demo and simulator", () => {
  let demoUser: Id<"users">;
  let sharedDemo: Id<"workspaces">;

  beforeEach(async () => {
    ({ demoUser, sharedDemo } = await t.run(async (ctx) => {
      const sharedDemo = await ctx.db.insert("workspaces", { slackTeamId: "T_DEMO_LUMEN", name: "Lumen Labs", isDemo: true, status: "active", ...DEMO_SETTINGS });
      const demoUser = await ctx.db.insert("users", { name: "Alex Rivera", isDemo: true, slackUserId: "UDEMOYOU", slackTeamId: "T_DEMO_LUMEN" });
      const member = { isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 };
      await ctx.db.insert("members", { ...member, workspaceId: sharedDemo, slackUserId: "UDEMOYOU", name: "Alex Rivera", isAdmin: true, userId: demoUser });
      return { demoUser, sharedDemo };
    }));
  });
  const visitor = (s: string) => t.withIdentity({ subject: `${demoUser}|${s}` });
  const workspaceOf = async (s: string) => {
    const v = await visitor(s).query(api.session.viewer, {});
    if (v.status !== "ready") throw new Error(v.status);
    return v.workspace;
  };

  test("demo visitors see each other; a simulator's hogs never leave it", async () => {
    await visitor("a").mutation(api.simulator.start, {});
    const sim = await workspaceOf("a");
    expect(sim.name).toBe("Simulator");
    await visitor("a").mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk });
    await visitor("b").mutation(api.presence.heartbeat, { x: 2, y: 2, ...walk });
    await visitor("c").mutation(api.presence.heartbeat, { x: 3, y: 3, ...walk });

    // In the simulator's own time (its clock runs ahead of the wall clock).
    const simNow = Date.now() + sim.clockOffsetMs;
    expect(await visitor("a").query(api.presence.nearby, { chunks: ["0:0"], now: simNow })).toEqual([]);
    expect(await visitor("a").query(api.presence.online, { now: simNow })).toMatchObject({ count: 1, players: [{ name: "Alex Rivera", you: true }] });
    expect((await visitor("b").query(api.presence.nearby, { chunks: ["0:0"], now: Date.now() })).map((h) => [h.x, h.y])).toEqual([[3, 3]]);

    // Stopping the simulator wipes its hog with it.
    await visitor("a").mutation(api.simulator.stop, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers, 5_000);
    expect((await t.run((ctx) => ctx.db.query("worldPresence").collect())).every((r) => r.workspaceId === sharedDemo)).toBe(true);
  });

  test("the demo's reset wipes the world, and no hog walks in while it runs", async () => {
    await visitor("b").mutation(api.presence.heartbeat, { x: 2, y: 2, ...walk });
    await t.run((ctx) => ctx.db.patch(sharedDemo, { resettingSince: Date.now() }));
    expect(await visitor("c").mutation(api.presence.heartbeat, { x: 2, y: 2, ...walk })).toBe(false);
    const members = await t.run((ctx) => ctx.db.query("members").collect());
    while ((await t.run((ctx) => wipeActivity(ctx, sharedDemo, members.filter((m) => m.workspaceId === sharedDemo)))) > 0);
    expect(await t.run((ctx) => ctx.db.query("worldPresence").collect())).toEqual([]);
  });
});

describe("heartbeats racing", () => {
  test("two heartbeats of the same hog at once both land (one retries); one row", async () => {
    await makePlayer(team.ana);
    const ana = await session(team.ana);
    await Promise.all([ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk }), ana.mutation(api.presence.heartbeat, { x: 2, y: 1, ...walk })]);
    expect(await t.run((ctx) => ctx.db.query("worldPresence").collect())).toHaveLength(1);
  });

  test("beats closer together than the client sends them are coalesced", async () => {
    const ana = await session(team.ana);
    await ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk });
    const first = (await t.run((ctx) => ctx.db.query("worldPresence").unique()))!;
    advance(50);
    await ana.mutation(api.presence.heartbeat, { x: 1, y: 1, ...walk });
    expect((await t.run((ctx) => ctx.db.query("worldPresence").unique()))!.updatedAt).toBe(first.updatedAt);
    advance(50);
    await ana.mutation(api.presence.heartbeat, { x: 2, y: 1, ...walk });
    expect(await t.run((ctx) => ctx.db.query("worldPresence").unique())).toMatchObject({ x: 2 });
  });
});
