import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { seedTeam, setupConvex, type Team } from "./helpers";
import { generateRuin, PARTY, resolveTurn, startEncounter, turnRand, type Room } from "../convex/lib/rpg";
import { layout, type RuinTier } from "../convex/lib/tree";
import { xpForLevel } from "../convex/lib/xp";

/**
 * Parties (#163, design plan #152 S7; every rule is lib/rpg.ts): a leader forms a party at a ruin's
 * entrance, invites the players standing within reach, and sets out when 1–4 are in; every member
 * spends a stamina then. In a room each member chooses; the room resolves once everyone standing has
 * chosen, or a minute after the first choice. Loot is per member. Far (level 10) and deep (15) ruins
 * open to anyone at their level.
 */

let t: ReturnType<typeof setupConvex>;
let team: Team;

beforeEach(async () => {
  t = setupConvex();
  team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
});
afterEach(() => vi.useRealTimers());

/** An elder tree: every ruin tier is open. */
const ELDER = 3200;

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
type Viewer = Awaited<ReturnType<typeof session>>;

async function world({ seed = 7, peakGrowth = ELDER } = {}) {
  await t.run(async (ctx) => {
    await ctx.db.patch(team.workspaceId, { worldSeed: seed });
    await ctx.db.insert("trees", { workspaceId: team.workspaceId, sap: peakGrowth, fuel: 0, peakGrowth, plantings: 1 });
  });
}

async function makePlayer(memberId: Id<"members">, { level = 20, stamina = 3 } = {}) {
  await t.run((ctx) => ctx.db.insert("players", { workspaceId: team.workspaceId, memberId, since: Date.now() - 1, xp: xpForLevel(level), level, coins: 0, stamina }));
}

const player = (memberId: Id<"members">) =>
  t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique());
const run = () => t.run(async (ctx) => (await ctx.db.query("expeditions").order("desc").first())!);

/** Where a ruin stands on this world. */
const siteOf = (ruinId: string, seed = 7) => layout(seed, ELDER).ruins.find((r) => r.id === ruinId)!;

/** Stands a member's hog `dx` tiles east of the ruin's entrance. */
async function standAt(viewer: Viewer, ruinId: string, dx = 1, seed = 7) {
  const at = siteOf(ruinId, seed).at;
  await viewer.mutation(api.presence.heartbeat, { x: at.x + dx, y: at.y, facing: "right", animation: "idle" });
}

/** A world seed and ruin of `tier` whose generated rooms satisfy `fits`. */
function ruinWhere(tier: RuinTier, fits: (rooms: Room[]) => boolean) {
  for (let seed = 1; seed < 5000; seed++)
    for (let i = 0; i < 6; i++) {
      const ruinId = `ruin:${tier}:${i}`;
      if (fits(generateRuin(seed, ruinId).rooms)) return { seed, ruinId };
    }
  throw new Error("no such ruin");
}

/** Ana (the leader) and Ben (level 20, 3 stamina each) at the entrance of `ruinId`, Ana forming a party. */
async function forming(ruinId = "ruin:2:0", seed = 7) {
  await world({ seed });
  await makePlayer(team.ana);
  await makePlayer(team.ben);
  const ana = await session(team.ana);
  const ben = await session(team.ben);
  await standAt(ana, ruinId, 0, seed);
  await standAt(ben, ruinId, 2, seed);
  await ana.mutation(api.rpg.form, { ruinId });
  return { ana, ben };
}

/** Ana and Ben in a party that has set out into `ruinId`. */
async function setOut(ruinId = "ruin:2:0", seed = 7) {
  const { ana, ben } = await forming(ruinId, seed);
  await ana.mutation(api.rpg.invite, { memberId: team.ben });
  const runId = (await run())._id;
  await ben.mutation(api.rpg.accept, { runId });
  await ana.mutation(api.rpg.setOut, {});
  return { ana, ben, runId };
}

const events = (memberId: Id<"members">, kind: "party" | "expedition") =>
  t.run((ctx) => ctx.db.query("gameEvents").withIndex("by_member_kind", (q) => q.eq("memberId", memberId).eq("kind", kind)).collect());

describe("forming a party and inviting", () => {
  test("the leader invites a player standing within reach; the invite reaches them with its expiry", async () => {
    const { ana, ben } = await forming();
    await ana.mutation(api.rpg.invite, { memberId: team.ben });
    const invites = await ben.query(api.rpg.invites, {});
    expect(invites).toEqual([expect.objectContaining({ from: "Ana", tier: 2, ruinName: siteOf("ruin:2:0").name, expiresAt: Date.now() + PARTY.decideSeconds * 1000 })]);
    const view = (await ana.query(api.rpg.current, {}))!.run!;
    expect(view).toMatchObject({ state: "forming", leader: true, invited: [expect.objectContaining({ memberId: team.ben, name: "Ben" })] });
  });

  test("only players within eight tiles of the entrance can be invited, never yourself", async () => {
    const { ana } = await forming();
    await makePlayer(team.cleo);
    const cleo = await session(team.cleo);
    await standAt(cleo, "ruin:2:0", PARTY.inviteRadius + 1);
    await expect(ana.mutation(api.rpg.invite, { memberId: team.cleo })).rejects.toThrow(/too far/);
    await expect(ana.mutation(api.rpg.invite, { memberId: team.ana })).rejects.toThrow(/yourself/);
    // Someone who isn't in the world at all is out of reach too.
    await makePlayer(team.bot);
    await expect(ana.mutation(api.rpg.invite, { memberId: team.bot })).rejects.toThrow(/too far|isn't/);
  });

  test("the players within reach are listed for the leader, with whether each can join", async () => {
    const { ana } = await forming();
    await makePlayer(team.cleo, { level: 8 });
    const cleo = await session(team.cleo);
    await standAt(cleo, "ruin:2:0", -1);
    const reach = await ana.query(api.rpg.reach, { now: Date.now() });
    expect(reach).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ memberId: team.ben, name: "Ben", level: 20, canJoin: true }),
        expect.objectContaining({ memberId: team.cleo, name: "Cleo", level: 8, canJoin: false, reason: "level" }),
      ]),
    );
    expect(reach.some((r) => r.memberId === team.ana)).toBe(false);
  });

  test("a player below the ruin's level or without stamina can't be invited", async () => {
    const { ana } = await forming();
    await makePlayer(team.cleo, { level: 9 });
    const cleo = await session(team.cleo);
    await standAt(cleo, "ruin:2:0", 1);
    await expect(ana.mutation(api.rpg.invite, { memberId: team.cleo })).rejects.toThrow(/level 10/);
    await t.run(async (ctx) => {
      const p = (await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.cleo)).unique())!;
      await ctx.db.patch(p._id, { level: 12, stamina: 0 });
    });
    await expect(ana.mutation(api.rpg.invite, { memberId: team.cleo })).rejects.toThrow(/stamina/);
  });

  test("only the leader of a forming party invites", async () => {
    const { ben } = await forming();
    await expect(ben.mutation(api.rpg.invite, { memberId: team.ana })).rejects.toThrow(/form a party/i);
  });
});

describe("answering an invite", () => {
  test("accepting joins the party; nobody else can accept an invite meant for someone", async () => {
    const { ana, ben } = await forming();
    await makePlayer(team.cleo);
    const cleo = await session(team.cleo);
    await standAt(cleo, "ruin:2:0", 1);
    await ana.mutation(api.rpg.invite, { memberId: team.ben });
    const runId = (await run())._id;
    await expect(cleo.mutation(api.rpg.accept, { runId })).rejects.toThrow(/no invite/i);
    await ben.mutation(api.rpg.accept, { runId });
    expect((await run()).party.map((p) => p.name)).toEqual(["Ana", "Ben"]);
    expect(await player(team.ben)).toMatchObject({ expedition: runId });
    expect(await ben.query(api.rpg.invites, {})).toEqual([]);
    // In a party, you can't start another run.
    await expect(ben.mutation(api.rpg.start, { ruinId: "ruin:1:0" })).rejects.toThrow(/already/);
  });

  test("an invite expires after a minute", async () => {
    const { ana, ben } = await forming();
    await ana.mutation(api.rpg.invite, { memberId: team.ben });
    const runId = (await run())._id;
    vi.setSystemTime(Date.now() + PARTY.decideSeconds * 1000 + 1);
    await standAt(ben, "ruin:2:0", 2);
    await expect(ben.mutation(api.rpg.accept, { runId })).rejects.toThrow(/expired/);
    expect((await run()).party).toHaveLength(1);
  });

  test("declining removes the invite; a player who walked out of reach can't accept", async () => {
    const { ana, ben } = await forming();
    await ana.mutation(api.rpg.invite, { memberId: team.ben });
    const runId = (await run())._id;
    await ben.mutation(api.rpg.decline, { runId });
    expect(await ben.query(api.rpg.invites, {})).toEqual([]);
    expect((await run()).invites ?? []).toEqual([]);
    await ana.mutation(api.rpg.invite, { memberId: team.ben });
    vi.setSystemTime(Date.now() + 1000);
    await standAt(ben, "ruin:2:0", 20);
    await expect(ben.mutation(api.rpg.accept, { runId })).rejects.toThrow(/too far/);
  });

  test("a party holds four at most", async () => {
    const { ana, ben } = await forming();
    const others = [];
    for (const [slack, name] of [["UDAN", "Dan"], ["UEVE", "Eve"], ["UFIN", "Finn"]] as const) {
      const id = await t.run((ctx) => ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId: slack, name, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }));
      await makePlayer(id);
      const s = await session(id);
      await standAt(s, "ruin:2:0", 1);
      others.push({ id, s });
    }
    const runId = (await run())._id;
    for (const who of [{ id: team.ben, s: ben }, ...others.slice(0, 2)]) {
      await ana.mutation(api.rpg.invite, { memberId: who.id });
      await who.s.mutation(api.rpg.accept, { runId });
    }
    await expect(ana.mutation(api.rpg.invite, { memberId: others[2].id })).rejects.toThrow(/full/);
  });
});

describe("setting out", () => {
  test("only the leader sets out; every member spends one stamina, once", async () => {
    const { ana, ben } = await forming();
    await ana.mutation(api.rpg.invite, { memberId: team.ben });
    const runId = (await run())._id;
    await ben.mutation(api.rpg.accept, { runId });
    expect(await player(team.ben)).toMatchObject({ stamina: 3 });
    await expect(ben.mutation(api.rpg.setOut, {})).rejects.toThrow(/leader/);
    await ana.mutation(api.rpg.setOut, {});
    expect(await run()).toMatchObject({ state: "open", room: 0 });
    expect(await player(team.ana)).toMatchObject({ stamina: 2 });
    expect(await player(team.ben)).toMatchObject({ stamina: 2 });
    await expect(ana.mutation(api.rpg.setOut, {})).rejects.toThrow(/form a party/i);
    expect(await player(team.ana)).toMatchObject({ stamina: 2 });
  });

  test("each member's first party run is a `party` game event, once (the elder hog's step 10)", async () => {
    const { ana } = await setOut();
    expect(await events(team.ana, "party")).toHaveLength(1);
    expect(await events(team.ben, "party")).toHaveLength(1);
    await ana.mutation(api.rpg.abandon, {});
    const ben = await session(team.ben);
    await ben.mutation(api.rpg.abandon, {});
    await ana.mutation(api.rpg.form, { ruinId: "ruin:2:0" });
    await ana.mutation(api.rpg.invite, { memberId: team.ben });
    await ben.mutation(api.rpg.accept, { runId: (await run())._id });
    await ana.mutation(api.rpg.setOut, {});
    expect(await events(team.ana, "party")).toHaveLength(1);
    expect(await events(team.ben, "party")).toHaveLength(1);
  });

  test("going alone is no party: no `party` event", async () => {
    await world();
    await makePlayer(team.ana);
    const ana = await session(team.ana);
    await ana.mutation(api.rpg.form, { ruinId: "ruin:2:0" });
    await ana.mutation(api.rpg.setOut, {});
    expect(await run()).toMatchObject({ state: "open" });
    expect(await events(team.ana, "party")).toHaveLength(0);
  });

  test("a member leaving a forming party is released; the leader leaving disbands it", async () => {
    const { ana, ben } = await forming();
    await ana.mutation(api.rpg.invite, { memberId: team.ben });
    await ben.mutation(api.rpg.accept, { runId: (await run())._id });
    await ben.mutation(api.rpg.abandon, {});
    expect((await run()).party.map((p) => p.name)).toEqual(["Ana"]);
    expect((await player(team.ben))!.expedition).toBeUndefined();
    await ana.mutation(api.rpg.abandon, {});
    expect(await t.run((ctx) => ctx.db.query("expeditions").collect())).toEqual([]);
    expect((await player(team.ana))!.expedition).toBeUndefined();
    expect(await player(team.ana)).toMatchObject({ stamina: 3 });
  });
});

describe("the far and deep ruins", () => {
  test("open to anyone at their level: far from 10, deep from 15, alone or not", async () => {
    await world();
    await makePlayer(team.ana, { level: 9 });
    const ana = await session(team.ana);
    await expect(ana.mutation(api.rpg.start, { ruinId: "ruin:2:0" })).rejects.toThrow(/far ruins open to explorers at level 10/);
    await t.run(async (ctx) => {
      const p = (await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique())!;
      await ctx.db.patch(p._id, { level: 12 });
    });
    await expect(ana.mutation(api.rpg.start, { ruinId: "ruin:3:0" })).rejects.toThrow(/deep ruins open to explorers at level 15/);
    await ana.mutation(api.rpg.start, { ruinId: "ruin:2:0" });
    expect(await run()).toMatchObject({ ruinId: "ruin:2:0", tier: 2, state: "open" });
  });

  test("a tree that hasn't opened a tier has none of its ruins to enter", async () => {
    await world({ peakGrowth: 2100 }); // ancient: far ruins, no deep ones
    await makePlayer(team.ana);
    const ana = await session(team.ana);
    await expect(ana.mutation(api.rpg.form, { ruinId: "ruin:3:0" })).rejects.toThrow(/not open/);
  });
});

describe("a room, member by member", () => {
  const foeFirst = ruinWhere(2, (rooms) => rooms[0].kind === "foe");

  test("the room waits for everyone standing, then resolves once with every choice", async () => {
    const { ana, ben } = await setOut(foeFirst.ruinId, foeFirst.seed);
    const before = await run();
    await ana.mutation(api.rpg.act, { choice: { kind: "strike" }, at: { room: 0, turn: 0 } });
    const waiting = await run();
    expect(waiting).toMatchObject({ turn: 0, foeHp: before.foeHp });
    const view = (await ben.query(api.rpg.current, {}))!.run!;
    expect(view.party.map((p) => [p.name, p.chosen])).toEqual([["Ana", true], ["Ben", false]]);
    expect(view.decideBy).toBe(Date.now() + PARTY.decideSeconds * 1000);
    // What Ana chose stays hers until the room resolves.
    expect(JSON.stringify(view)).not.toMatch(/strike/);
    await ben.mutation(api.rpg.act, { choice: { kind: "outwit" }, at: { room: 0, turn: 0 } });
    const after = await run();
    const fighters = before.party.map((p) => ({ ...p, id: p.memberId as string, equipped: {} }));
    const expected = resolveTurn(
      startEncounter(before.rooms[0] as Room, fighters),
      { [team.ana]: { kind: "strike" }, [team.ben]: { kind: "outwit" } },
      turnRand(before.seed, 0, 0),
    );
    expect(after.foeHp).toBe(expected.foeHp);
    expect(after.party.map((p) => p.hp)).toEqual(expected.party.map((p) => p.hp));
    expect(after.choices).toEqual([
      expect.objectContaining({ memberId: team.ana, kind: "strike", room: 0, turn: 0 }),
      expect.objectContaining({ memberId: team.ben, kind: "outwit", room: 0, turn: 0 }),
    ]);
    expect(after.pending ?? []).toEqual([]);
    expect(after.log.map((l) => l.line).join(" ")).toMatch(/Ana strikes/);
  });

  test("the next room's log opens with the whole turn that cleared the last one, naming who did what", async () => {
    const { ana, ben } = await setOut(foeFirst.ruinId, foeFirst.seed);
    for (let guard = 0; guard < 40 && (await run()).room === 0 && (await run()).state === "open"; guard++) {
      const r = await run();
      for (const who of [ana, ben]) {
        const now = await run();
        if (now.room !== r.room || now.turn !== r.turn || now.state !== "open") break;
        await who.mutation(api.rpg.act, { choice: { kind: "strike" }, at: { room: r.room, turn: r.turn } });
      }
    }
    const r = await run();
    expect(r).toMatchObject({ state: "open", room: 1 });
    const lines = (await ana.query(api.rpg.current, {}))!.run!.log.filter((l) => l.room === 0).map((l) => l.line);
    expect(lines.some((l) => /^Ana strikes/.test(l))).toBe(true);
    expect(lines.some((l) => /^Ben strikes/.test(l))).toBe(true);
    expect(lines.at(-1)).toMatch(/falls\.$/);
  });

  test("a choice for a turn that has passed is refused", async () => {
    const { ana, ben } = await setOut(foeFirst.ruinId, foeFirst.seed);
    await ana.mutation(api.rpg.act, { choice: { kind: "strike" }, at: { room: 0, turn: 0 } });
    await ben.mutation(api.rpg.act, { choice: { kind: "strike" }, at: { room: 0, turn: 0 } });
    const r = await run();
    expect(r.state).toBe("open");
    await expect(ben.mutation(api.rpg.act, { choice: { kind: "strike" }, at: { room: 0, turn: 0 } })).rejects.toThrow(/moved on/);
  });

  test("a minute after the first choice the room resolves with whoever chose, exactly once", async () => {
    const { ana } = await setOut(foeFirst.ruinId, foeFirst.seed);
    const before = await run();
    await ana.mutation(api.rpg.act, { choice: { kind: "strike" }, at: { room: 0, turn: 0 } });
    vi.advanceTimersByTime(PARTY.decideSeconds * 1000);
    await t.finishInProgressScheduledFunctions();
    const after = await run();
    const fighters = before.party.map((p) => ({ ...p, id: p.memberId as string, equipped: {} }));
    const expected = resolveTurn(startEncounter(before.rooms[0] as Room, fighters), { [team.ana]: { kind: "strike" } }, turnRand(before.seed, 0, 0));
    expect(after.foeHp).toBe(expected.foeHp);
    expect(after.choices).toHaveLength(1);
    expect(after.pending ?? []).toEqual([]);
  });

  test("a room resolved early is not resolved again when the minute is up", async () => {
    const { ana, ben } = await setOut(foeFirst.ruinId, foeFirst.seed);
    await ana.mutation(api.rpg.act, { choice: { kind: "strike" }, at: { room: 0, turn: 0 } });
    await ben.mutation(api.rpg.act, { choice: { kind: "strike" }, at: { room: 0, turn: 0 } });
    const resolved = await run();
    vi.advanceTimersByTime(PARTY.decideSeconds * 1000);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const later = await run();
    expect(later.turn).toBe(resolved.turn);
    expect(later.room).toBe(resolved.room);
    expect(later.choices).toHaveLength(2);
  });

  test("a member returning to camp leaves the party; the others go on without waiting for them", async () => {
    const { ana, ben } = await setOut(foeFirst.ruinId, foeFirst.seed);
    await ben.mutation(api.rpg.abandon, {});
    expect(await run()).toMatchObject({ state: "open" });
    expect((await player(team.ben))!.expedition).toBeUndefined();
    await ana.mutation(api.rpg.act, { choice: { kind: "strike" }, at: { room: 0, turn: 0 } });
    const r = await run();
    expect(r.turn === 1 || r.room === 1 || r.state !== "open").toBe(true);
    expect(r.party.find((p) => p.name === "Ben")).toMatchObject({ left: true });
  });
});

describe("loot per member", () => {
  test("a cleared party run pays each member standing their own coins", async () => {
    const { seed, ruinId } = ruinWhere(2, (rooms) => rooms.every((r) => r.kind === "foe" || r.kind === "rest"));
    const { ana, ben } = await setOut(ruinId, seed);
    for (let guard = 0; guard < 200; guard++) {
      const r = await run();
      if (r.state !== "open") break;
      const kind = r.rooms[r.room].kind === "foe" ? "strike" : "onward";
      for (const [who, id] of [[ana, team.ana], [ben, team.ben]] as const) {
        const me = (await run()).party.find((p) => p.memberId === id)!;
        const now = await run();
        if (now.state !== "open" || now.room !== r.room || now.turn !== r.turn || me.hp <= 0) continue;
        await who.mutation(api.rpg.act, { choice: { kind }, at: { room: r.room, turn: r.turn } });
      }
    }
    const r = await run();
    expect(r.state).toBe("cleared");
    const paid = r.party.filter((p) => p.hp > 0).map((p) => p.memberId);
    expect(paid.length).toBeGreaterThanOrEqual(1);
    for (const id of paid) {
      const e = await events(id, "expedition");
      expect(e).toHaveLength(1);
      expect(e[0].coins).toBeGreaterThanOrEqual(12);
      expect(r.loot.find((l) => l.memberId === id)!.coins).toBe(e[0].coins);
    }
    // Both see the results of the run they were in.
    expect((await ben.query(api.rpg.current, {}))!.run).toMatchObject({ state: "cleared", id: r._id });
  });
});

describe("the overview map", () => {
  test("opens at the elder stage: the tree, its districts, the ruins you explored, the homes", async () => {
    await world({ peakGrowth: 2100 });
    await makePlayer(team.ana);
    const ana = await session(team.ana);
    expect(await ana.query(api.tree.overview, {})).toBeNull();
    await t.run(async (ctx) => {
      const tree = (await ctx.db.query("trees").first())!;
      await ctx.db.patch(tree._id, { sap: ELDER, peakGrowth: ELDER });
      const p = (await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique())!;
      await ctx.db.patch(p._id, { ruinsCleared: ["ruin:1:2"] });
      for (const [i, m] of [team.ana, team.ben, team.cleo].entries()) {
        await ctx.db.insert("homes", { workspaceId: team.workspaceId, memberId: m, name: "x", plot: i, stage: "sky", stageStartedAt: Date.now() });
      }
    });
    const map = (await ana.query(api.tree.overview, {}))!;
    expect(map).toMatchObject({ stage: "elder", homes: 3, blight: null });
    expect(map.districts.find((d) => d.id === "deep_ruins")).toMatchObject({ open: true, name: "The deep ruins" });
    expect(map.districts.find((d) => d.id === "canopy")).toMatchObject({ open: false });
    expect(map.ruins).toHaveLength(18);
    expect(map.ruins.filter((r) => r.explored).map((r) => r.id)).toEqual(["ruin:1:2"]);
  });

  test("stays bounded at a full ring of homes", async () => {
    t = setupConvex({ transactionLimits: { documentsRead: 900 } });
    team = await seedTeam(t, { gameEnabled: true, questsEnabled: false });
    await world({ peakGrowth: ELDER });
    await makePlayer(team.ana);
    const ana = await session(team.ana);
    await t.run(async (ctx) => {
      for (let i = 0; i < 600; i++) await ctx.db.insert("homes", { workspaceId: team.workspaceId, memberId: team.ben, name: "x", plot: i, stage: "sky", stageStartedAt: Date.now() });
    });
    expect((await ana.query(api.tree.overview, {}))!.homes).toBe(600);
  });
});

describe("review (#163)", () => {
  /** Ana, Ben and Cleo set out into `ruinId`. */
  async function threeSetOut(ruinId: string, seed: number) {
    const { ana, ben } = await forming(ruinId, seed);
    await makePlayer(team.cleo);
    const cleo = await session(team.cleo);
    await standAt(cleo, ruinId, 1, seed);
    const runId = (await run())._id;
    for (const [id, s] of [[team.ben, ben], [team.cleo, cleo]] as const) {
      await ana.mutation(api.rpg.invite, { memberId: id });
      await s.mutation(api.rpg.accept, { runId });
    }
    await ana.mutation(api.rpg.setOut, {});
    return { ana, ben, cleo };
  }
  const foeFirst = ruinWhere(2, (rooms) => rooms[0].kind === "foe");
  const at = async () => ({ room: (await run()).room, turn: (await run()).turn });

  test("a turn whose only chooser left still resolves a minute after the next choice", async () => {
    const { ana, ben } = await threeSetOut(foeFirst.ruinId, foeFirst.seed);
    await ana.mutation(api.rpg.act, { choice: { kind: "strike" }, at: await at() });
    await ana.mutation(api.rpg.abandon, {});
    vi.advanceTimersByTime(PARTY.decideSeconds * 1000);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await ben.mutation(api.rpg.act, { choice: { kind: "strike" }, at: await at() });
    const view = (await ben.query(api.rpg.current, {}))!.run!;
    expect(view.decideBy).toBe(Date.now() + PARTY.decideSeconds * 1000);
    vi.advanceTimersByTime(PARTY.decideSeconds * 1000);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const r = await run();
    expect(r.turn > 0 || r.room > 0 || r.state !== "open").toBe(true);
  });

  test("a puzzle takes the party's first answer at once; the next answer is another member's", async () => {
    const { seed, ruinId } = ruinWhere(2, (rooms) => rooms[0].kind === "puzzle");
    const { ana, ben } = await setOut(ruinId, seed);
    const stored = (await run()).puzzle!;
    const wrong = stored.options.map((_, i) => i).find((i) => i !== stored.answer && !stored.struck.includes(i))!;
    await ana.mutation(api.rpg.act, { choice: { kind: "answer", option: wrong }, at: await at() });
    expect(await run()).toMatchObject({ room: 0, turn: 1, wrong: 1 });
    await ben.mutation(api.rpg.act, { choice: { kind: "answer", option: stored.answer }, at: await at() });
    expect((await run()).room === 1 || (await run()).state !== "open").toBe(true);
  });

  test("invited by two parties, you join one; the other's invite can't take you too", async () => {
    const { ana, ben } = await forming("ruin:2:0");
    await makePlayer(team.cleo);
    const cleo = await session(team.cleo);
    await standAt(cleo, "ruin:2:0", -1);
    await ana.mutation(api.rpg.invite, { memberId: team.ben });
    const first = (await run())._id;
    await cleo.mutation(api.rpg.form, { ruinId: "ruin:2:0" });
    await cleo.mutation(api.rpg.invite, { memberId: team.ben });
    const second = (await run())._id;
    expect((await ben.query(api.rpg.invites, {})).map((i) => i.from).sort()).toEqual(["Ana", "Cleo"]);
    await ben.mutation(api.rpg.accept, { runId: first });
    await expect(ben.mutation(api.rpg.accept, { runId: second })).rejects.toThrow(/already/);
    expect(await ben.query(api.rpg.invites, {})).toEqual([expect.objectContaining({ from: "Cleo" })]);
    await ana.mutation(api.rpg.setOut, {});
    expect(await player(team.ben)).toMatchObject({ stamina: 2, expedition: first });
  });

  test("a party's rest waits for everyone to move on", async () => {
    const { seed, ruinId } = ruinWhere(2, (rooms) => rooms[0].kind === "rest");
    const { ana, ben } = await setOut(ruinId, seed);
    await ana.mutation(api.rpg.act, { choice: { kind: "onward" }, at: await at() });
    expect(await run()).toMatchObject({ room: 0 });
    await ben.mutation(api.rpg.act, { choice: { kind: "onward" }, at: await at() });
    expect(await run()).toMatchObject({ room: 1 });
  });

  test("a choice that does nothing in the room is refused: no striking a puzzle", async () => {
    const puzzle = ruinWhere(2, (rooms) => rooms[0].kind === "puzzle");
    const { ana } = await setOut(puzzle.ruinId, puzzle.seed);
    await expect(ana.mutation(api.rpg.act, { choice: { kind: "strike" }, at: await at() })).rejects.toThrow(/answer/);
  });

  test("nothing leaves a rest but moving on", async () => {
    const rest = ruinWhere(2, (rooms) => rooms[0].kind === "rest");
    const { ana } = await setOut(rest.ruinId, rest.seed);
    await expect(ana.mutation(api.rpg.act, { choice: { kind: "rally" }, at: await at() })).rejects.toThrow(/move on/);
  });

  test("someone who left keeps their own last run when the party's ends", async () => {
    const { ana, ben } = await setOut(foeFirst.ruinId, foeFirst.seed);
    await ben.mutation(api.rpg.abandon, {});
    await ben.mutation(api.rpg.start, { ruinId: "ruin:1:0" });
    const solo = (await run())._id;
    await ben.mutation(api.rpg.abandon, {});
    await ana.mutation(api.rpg.abandon, {});
    expect((await ben.query(api.rpg.current, {}))!.run!.id).toBe(solo);
  });

  test("a fallen member meets no more foes; the last one standing leaving is the party returning", async () => {
    const { seed, ruinId } = ruinWhere(2, (rooms) => rooms[0].kind === "foe" && rooms[1]?.kind === "foe" && rooms[1].foe !== rooms[0].foe);
    const { ana } = await setOut(ruinId, seed);
    await t.run(async (ctx) => {
      const r = (await ctx.db.query("expeditions").order("desc").first())!;
      await ctx.db.patch(r._id, { party: r.party.map((p) => (p.memberId === team.ben ? { ...p, hp: 0 } : p)) });
      const p = (await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ben)).unique())!;
      await ctx.db.patch(p._id, { expedition: undefined });
    });
    const second = ((await run()).rooms[1] as Extract<Room, { kind: "foe" }>).foe;
    for (let guard = 0; guard < 30 && (await run()).room === 0 && (await run()).state === "open"; guard++) {
      await ana.mutation(api.rpg.act, { choice: { kind: "strike" }, at: await at() });
    }
    expect(await run()).toMatchObject({ state: "open", room: 1 });
    expect((await player(team.ben))!.bestiary ?? []).not.toContain(second);
    await ana.mutation(api.rpg.abandon, {});
    expect((await run()).log.at(-1)!.line).toBe("The party returns to camp.");
  });
});
