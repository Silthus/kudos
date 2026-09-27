import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { seedTeam, setupConvex, signInAs, TODAY, type Team } from "./helpers";
import { generateRuin, PUZZLE_TRIES, resolveTurn, startEncounter, startingHp, turnRand, type Room } from "../convex/lib/rpg";
import { xpForLevel } from "../convex/lib/xp";

/**
 * The desert RPG (#162, design plan #152 S7; every rule is lib/rpg.ts): stamina from thoughtful
 * giving, solo expeditions into the near ruins resolved turn by turn from a stored seed and stored
 * rooms, loot into the inventory and the wallet (coins only, never XP), secrets as lore cards, and
 * gear worn in three slots.
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

const player = (memberId: Id<"members">) =>
  t.run((ctx) => ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", memberId)).unique());

describe("stamina comes from thoughtful giving", () => {
  test("a new player starts with none; one thoughtful message restores one, however many it thanks", async () => {
    await message("UANA", "<@UBEN> :taco:");
    expect((await player(team.ana))?.stamina ?? 0).toBe(0);
    await message("UANA", "<@UBEN> <@UCLEO> :taco: thanks for the thorough reviews");
    expect((await player(team.ana))?.stamina).toBe(1);
  });

  test("a thank-back restores nothing, and stamina stops at five", async () => {
    await message("UBEN", "<@UANA> :taco: thanks for pairing with me today");
    await message("UANA", "<@UBEN> :taco: thank you right back Ben");
    expect((await player(team.ana))?.stamina ?? 0).toBe(0);
    for (let i = 0; i < 7; i++) {
      vi.setSystemTime(Date.now() + 86_400_000); // a day apart: the daily allowance never stops them
      await message("UANA", `<@UCLEO> :taco: thanks for the design work number ${i}`);
    }
    expect((await player(team.ana))?.stamina).toBe(5);
  });
});

// ── Expeditions ─────────────────────────────────────────────────────────────

const as = (memberId: Id<"members">) => signInAs(t, memberId);

/** Ana as a player at `level` with `stamina`, in a workspace whose tree is great (the near ruins are open). */
async function ready({ level = 20, stamina = 3, seed = 7, peakGrowth = 900 } = {}) {
  await t.run(async (ctx) => {
    await ctx.db.patch(team.workspaceId, { worldSeed: seed });
    await ctx.db.insert("trees", { workspaceId: team.workspaceId, sap: peakGrowth, fuel: 0, peakGrowth, plantings: 1 });
    await ctx.db.insert("players", { workspaceId: team.workspaceId, memberId: team.ana, since: Date.now() - 1, xp: xpForLevel(level), level, coins: 0, stamina });
  });
  return await as(team.ana);
}

/** A world seed and near ruin whose generated rooms satisfy `fits`. */
function nearRuin(fits: (rooms: Room[]) => boolean) {
  for (let seed = 1; seed < 5000; seed++)
    for (let i = 0; i < 6; i++) {
      const ruinId = `ruin:1:${i}`;
      if (fits(generateRuin(seed, ruinId).rooms)) return { seed, ruinId };
    }
  throw new Error("no such ruin");
}

const run = () => t.run(async (ctx) => (await ctx.db.query("expeditions").order("desc").first())!);

type Viewer = Awaited<ReturnType<typeof as>>;
/** Plays the open run to its end: strikes foes, answers puzzles right (read from the server), moves on from rests and secrets. */
async function playOut(viewer: Viewer, { wrongAnswers = false } = {}) {
  for (let guard = 0; guard < 200; guard++) {
    const r = await run();
    if (r.state !== "open") return r;
    const room = r.rooms[r.room];
    if (room.kind === "foe") await viewer.mutation(api.rpg.act, { choice: { kind: "strike" } });
    else if (room.kind === "puzzle") {
      // A wrong answer nobody has given yet and the wits didn't rule out.
      const open = r.puzzle!.options.map((_, i) => i).filter((i) => i !== r.puzzle!.answer && !r.puzzle!.struck.includes(i) && !(r.puzzle!.tried ?? []).includes(i));
      const option = wrongAnswers ? open[0] : r.puzzle!.answer;
      await viewer.mutation(api.rpg.act, { choice: { kind: "answer", option } });
    } else await viewer.mutation(api.rpg.act, { choice: { kind: "onward" } });
  }
  throw new Error("the run never ended");
}

describe("starting an expedition", () => {
  test("costs one stamina and stores the ruin's rooms, generated from the world seed", async () => {
    const ana = await ready({ seed: 7 });
    await ana.mutation(api.rpg.start, { ruinId: "ruin:1:2" });
    const r = await run();
    expect(r).toMatchObject({ ruinId: "ruin:1:2", tier: 1, state: "open", room: 0, turn: 0 });
    expect(r.rooms).toEqual(generateRuin(7, "ruin:1:2").rooms);
    expect(r.party).toEqual([expect.objectContaining({ memberId: team.ana, name: "Ana", level: 20, hp: startingHp(20) })]);
    expect(await player(team.ana)).toMatchObject({ stamina: 2, expedition: r._id });
    const current = await ana.query(api.rpg.current, {});
    expect(current?.run).toMatchObject({ ruinId: "ruin:1:2", open: true, room: 0 });
    expect(current?.run?.name).toMatch(/^The /);
  });

  test("needs level 6, a stamina, a near ruin the tree has opened, and no run under way", async () => {
    const ana = await ready({ level: 5 });
    await expect(ana.mutation(api.rpg.start, { ruinId: "ruin:1:0" })).rejects.toThrow(/level 6/);
    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { level: 9, stamina: 0 });
    });
    await expect(ana.mutation(api.rpg.start, { ruinId: "ruin:1:0" })).rejects.toThrow(/stamina/);
    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { stamina: 2 });
    });
    // A great tree hasn't opened the far ruins (#163 opens them to anyone at level 10, alone or in a party).
    await expect(ana.mutation(api.rpg.start, { ruinId: "ruin:2:0" })).rejects.toThrow(/far ruins are not open yet/);
    await expect(ana.mutation(api.rpg.start, { ruinId: "ruin:9:9" })).rejects.toThrow(/no such ruin/);
    await ana.mutation(api.rpg.start, { ruinId: "ruin:1:0" });
    await expect(ana.mutation(api.rpg.start, { ruinId: "ruin:1:1" })).rejects.toThrow(/already/);
    expect(await player(team.ana)).toMatchObject({ stamina: 1 });
  });

  test("a tree that hasn't opened the near ruins has none to enter", async () => {
    const ana = await ready({ peakGrowth: 400 });
    await expect(ana.mutation(api.rpg.start, { ruinId: "ruin:1:0" })).rejects.toThrow(/not open/);
  });
});

describe("turn by turn", () => {
  test("a strike resolves one turn exactly as the rules do from the stored seed and rooms", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms[0].kind === "foe");
    const ana = await ready({ seed, level: 7 });
    await ana.mutation(api.rpg.start, { ruinId });
    const before = await run();
    await ana.mutation(api.rpg.act, { choice: { kind: "strike" } });
    const after = await run();
    const fighter = { ...before.party[0], id: before.party[0].memberId, equipped: {} };
    const expected = resolveTurn(startEncounter(before.rooms[0] as Room, [fighter]), { [fighter.id]: { kind: "strike" } }, turnRand(before.seed, 0, 0));
    expect(after.foeHp).toBe(expected.foeHp);
    expect(after.party[0].hp).toBe(expected.party[0].hp);
    expect(after.log.map((l) => l.line)).toEqual(expected.log.map((l) => l.split(fighter.id).join("Ana")));
    expect(after.turn).toBe(expected.done ? 0 : 1);
  });

  test("a cleared run pays coins as an expedition event with no XP, and the run ends", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms.every((r) => r.kind === "foe"));
    const ana = await ready({ seed });
    await ana.mutation(api.rpg.start, { ruinId });
    const before = await player(team.ana);
    const r = await playOut(ana);
    expect(r.state).toBe("cleared");
    const after = await player(team.ana);
    expect(after!.xp).toBe(before!.xp);
    const events = await t.run((ctx) => ctx.db.query("gameEvents").withIndex("by_member_kind", (q) => q.eq("memberId", team.ana).eq("kind", "expedition")).collect());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ xp: 0, batchId: `expedition:${r._id}` });
    expect(events[0].coins).toBeGreaterThanOrEqual(5);
    expect(events[0].coins).toBeLessThanOrEqual(15);
    expect(after).toMatchObject({ coins: events[0].coins, expeditionCoins: events[0].coins, ruinsCleared: [ruinId] });
    expect(after!.expedition).toBeUndefined();
    const wallet = (await ana.query(api.game.mine, {})).wallet!;
    expect(wallet.fromRuins).toBe(events[0].coins);
    expect(await ana.query(api.rpg.current, {})).toMatchObject({ run: { open: false, state: "cleared" } });
  });

  test("a fallen hero returns to camp with no coins and loses nothing", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms[0].kind === "foe");
    const ana = await ready({ seed, level: 6 });
    await ana.mutation(api.rpg.start, { ruinId });
    await t.run(async (ctx) => {
      const r = (await ctx.db.query("expeditions").first())!;
      await ctx.db.patch(r._id, { party: [{ ...r.party[0], hp: 1 }] });
    });
    // Calm is heart, and Ana has grown no plants: it deals nothing, and the foe's hit takes her last point.
    await ana.mutation(api.rpg.act, { choice: { kind: "calm" } });
    const r = await run();
    expect(r.state).toBe("fallen");
    expect(r.log.at(-1)!.line).toMatch(/Ana falls and returns to camp/);
    const after = await player(team.ana);
    expect(after).toMatchObject({ stamina: 2, coins: 0 });
    expect(after!.expedition).toBeUndefined();
  });
});

describe("returning to camp", () => {
  test("abandon ends the run as a retreat, keeps nothing from the room, and gives no stamina back", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms[0].kind === "foe");
    const ana = await ready({ seed, level: 6 });
    await ana.mutation(api.rpg.start, { ruinId });
    await ana.mutation(api.rpg.abandon, {});
    const r = await run();
    expect(r.state).toBe("retreated");
    expect(r.loot.every((l) => l.gear.length === 0 && l.fruits.length === 0 && l.coins === 0)).toBe(true);
    expect(await player(team.ana)).toMatchObject({ stamina: 2 });
    expect((await player(team.ana))!.expedition).toBeUndefined();
    await expect(ana.mutation(api.rpg.act, { choice: { kind: "strike" } })).rejects.toThrow(/not on an expedition/);
  });
});

describe("puzzles", () => {
  test("ask about the team's public kudos, send options but never the answer, and are checked on the server", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms[0].kind === "puzzle");
    const ana = await ready({ seed });
    await t.run(async (ctx) => {
      for (const [slack, name] of [["UDAN", "Dan"], ["UEVE", "Eve"], ["UFIN", "Finn"], ["UGUS", "Gus"]]) {
        await ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId: slack, name, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 });
      }
    });
    await message("UBEN", "<@UCLEO> :taco: thanks for the lovely design work");
    await ana.mutation(api.rpg.start, { ruinId });
    const current = (await ana.query(api.rpg.current, {}))!;
    const puzzle = current.run!.puzzle!;
    expect(puzzle.options).toHaveLength(5);
    expect(JSON.stringify(current)).not.toMatch(/"answer"/);
    const stored = (await run()).puzzle!;
    expect(stored.question).toBeTruthy();
    const wrong = (stored.answer + 1) % 5;
    await ana.mutation(api.rpg.act, { choice: { kind: "answer", option: wrong } });
    expect(await run()).toMatchObject({ room: 0, wrong: 1 });
    // The wrong answer is crossed out for the party.
    expect((await ana.query(api.rpg.current, {}))!.run!.puzzle!.options[wrong]).toMatchObject({ tried: true });
    await ana.mutation(api.rpg.act, { choice: { kind: "answer", option: stored.answer } });
    expect((await run()).room === 1 || (await run()).state !== "open").toBe(true);
  });

  test("three wrong answers turn the party back", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms[0].kind === "puzzle");
    const ana = await ready({ seed });
    await ana.mutation(api.rpg.start, { ruinId });
    const r = await playOut(ana, { wrongAnswers: true });
    expect(r.state).toBe("retreated");
  });
});

describe("secrets and loot", () => {
  test("a secret room's item and lore card are found once per member, with a DM", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms.some((r) => r.kind === "secret") && rooms.every((r) => r.kind !== "puzzle"));
    const ana = await ready({ seed, stamina: 5 });
    await ana.mutation(api.rpg.start, { ruinId });
    const first = await playOut(ana);
    const found = first.loot.find((l) => l.memberId === team.ana)!;
    const secret = first.rooms.find((r) => r.kind === "secret") as Extract<Room, { kind: "secret" }>;
    expect(found.lore).toContain(secret.lore);
    expect(found.gear.length).toBeGreaterThanOrEqual(1);
    expect((await player(team.ana))!.lore!.map((l) => l.lore)).toContain(secret.lore);
    const dm = await t.run((ctx) => ctx.db.query("notifications").withIndex("by_member", (q) => q.eq("memberId", team.ana)).collect());
    expect(dm.some((n) => n.gains?.some((g) => g.kind === "ruin_finds"))).toBe(true);

    await ana.mutation(api.rpg.start, { ruinId });
    const again = await playOut(ana);
    const secretIndex = again.rooms.findIndex((r) => r.kind === "secret");
    const room = again.log.filter((l) => l.room === secretIndex);
    expect(room.length).toBeGreaterThan(0);
    const second = again.loot.find((l) => l.memberId === team.ana)!;
    expect(second.lore).not.toContain(secret.lore);
    expect((await player(team.ana))!.lore!.filter((l) => l.lore === secret.lore)).toHaveLength(1);
  });

  test("gear found goes into the inventory; lore cards hang in the gallery", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms.some((r) => r.kind === "secret") && rooms.every((r) => r.kind !== "puzzle"));
    const ana = await ready({ seed });
    await ana.mutation(api.rpg.start, { ruinId });
    const r = await playOut(ana);
    const gear = r.loot[0].gear;
    const camp = await ana.query(api.rpg.camp, {});
    for (const id of gear) expect(camp!.gear.some((g) => g.id === id)).toBe(true);
    const lore = await ana.query(api.discoveries.lore, {});
    expect(lore.cards).toHaveLength(12);
    expect(lore.found).toBeGreaterThanOrEqual(1);
    expect(lore.cards.filter((c) => c.text !== null)).toHaveLength(lore.found);
  });
});

describe("gear", () => {
  const hold = (gear: string) =>
    t.run((ctx) => ctx.db.insert("inventory", { workspaceId: team.workspaceId, memberId: team.ana, gear, count: 1 }));

  test("is worn one piece a slot, only what you hold and only in its own slot", async () => {
    const ana = await ready();
    await expect(ana.mutation(api.rpg.equip, { slot: "hat", gearId: "dune_hat" })).rejects.toThrow(/don't have/);
    await hold("dune_hat");
    await hold("brass_trowel");
    await expect(ana.mutation(api.rpg.equip, { slot: "tool", gearId: "dune_hat" })).rejects.toThrow(/hat/);
    await ana.mutation(api.rpg.equip, { slot: "hat", gearId: "dune_hat" });
    await ana.mutation(api.rpg.equip, { slot: "tool", gearId: "brass_trowel" });
    expect((await player(team.ana))!.equipped).toEqual({ hat: "dune_hat", tool: "brass_trowel" });
    await ana.mutation(api.rpg.equip, { slot: "hat", gearId: null });
    expect((await player(team.ana))!.equipped).toEqual({ tool: "brass_trowel" });
    const camp = await ana.query(api.rpg.camp, {});
    expect(camp).toMatchObject({ stamina: 3, equipped: { tool: "brass_trowel" } });
    expect(camp!.stats.might).toBe(21);
  });

  test("the party takes its stats as it enters: gear worn counts for the run", async () => {
    const ana = await ready();
    await hold("brass_trowel");
    await ana.mutation(api.rpg.equip, { slot: "tool", gearId: "brass_trowel" });
    await ana.mutation(api.rpg.start, { ruinId: "ruin:1:0" });
    expect((await run()).party[0].equipped).toEqual({ tool: "brass_trowel" });
  });

  test("the stall sells the three common pieces", async () => {
    const ana = await ready({ level: 9 });
    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { coins: 100 });
    });
    const shop = await ana.query(api.store.shop, { today: TODAY });
    const keys = shop.access === "open" ? shop.items.map((i) => i.key) : [];
    expect(keys).toEqual(expect.arrayContaining(["gear:dune_hat", "gear:brass_trowel", "gear:amber_charm"]));
    await ana.mutation(api.store.buyItem, { item: "gear:dune_hat", expectedPrice: 25 });
    const camp = await ana.query(api.rpg.camp, {});
    expect(camp!.gear).toEqual([expect.objectContaining({ id: "dune_hat", count: 1, slot: "hat" })]);
  });
});

describe("the bestiary", () => {
  test("lists every creature, revealing only the ones you've met", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms[0].kind === "foe");
    const ana = await ready({ seed });
    const before = await ana.query(api.rpg.bestiary, {});
    expect(before).toHaveLength(12);
    expect(before.filter((c) => c.met)).toHaveLength(0);
    await ana.mutation(api.rpg.start, { ruinId });
    const foe = ((await run()).rooms[0] as Extract<Room, { kind: "foe" }>).foe;
    const after = await ana.query(api.rpg.bestiary, {});
    expect(after.find((c) => c.id === foe)).toMatchObject({ met: true, name: expect.any(String) });
    expect(after.filter((c) => !c.met).every((c) => c.name === null)).toBe(true);
  });
});

describe("the ledger", () => {
  test("coins from the ruins survive a game rebuild, and the ledger still verifies", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms.every((r) => r.kind === "foe"));
    const ana = await ready({ seed });
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await ana.mutation(api.rpg.start, { ruinId });
    await playOut(ana);
    const found = (await player(team.ana))!.expeditionCoins!;
    expect(found).toBeGreaterThan(0);
    await t.mutation(internal.game.rebuildMember, { memberId: team.ana });
    const after = await player(team.ana);
    expect(after).toMatchObject({ expeditionCoins: found });
    expect(after!.coins).toBeGreaterThanOrEqual(found);
    const verified = await t.query(internal.game.verifyMember, { memberId: team.ana });
    expect(verified.coins).toBe(verified.eventCoins);
  });
});

describe("review (#162): puzzles stay honest", () => {
  test("enough wits strike out one wrong option, so guessing still can't clear a puzzle", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms[0].kind === "puzzle");
    const ana = await ready({ seed });
    await t.run(async (ctx) => {
      const p = await ctx.db.query("players").withIndex("by_member", (q) => q.eq("memberId", team.ana)).unique();
      await ctx.db.patch(p!._id, { equipped: { hat: "archivist_hood" }, skills: { emoji_variants: 2, pathfinder: 2 } });
    });
    await t.run((ctx) => ctx.db.insert("inventory", { workspaceId: team.workspaceId, memberId: team.ana, gear: "archivist_hood", count: 1 }));
    // Wits 7 (the hood and four Scout and Herald points) see through any near puzzle.
    await t.run(async (ctx) => {
      const r = await ctx.db.query("expeditions").first();
      if (r) await ctx.db.delete(r._id);
    });
    await ana.mutation(api.rpg.start, { ruinId });
    const stored = (await run()).puzzle!;
    const open = stored.options.length - stored.struck.length;
    expect(open).toBeGreaterThan(PUZZLE_TRIES);
    expect(stored.struck.length).toBeLessThanOrEqual(1);
  });

  test("a struck or already-tried option can't be answered", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms[0].kind === "puzzle");
    const ana = await ready({ seed });
    await ana.mutation(api.rpg.start, { ruinId });
    const stored = (await run()).puzzle!;
    const wrong = stored.options.map((_, i) => i).find((i) => i !== stored.answer && !stored.struck.includes(i))!;
    await ana.mutation(api.rpg.act, { choice: { kind: "answer", option: wrong } });
    await expect(ana.mutation(api.rpg.act, { choice: { kind: "answer", option: wrong } })).rejects.toThrow(/already/);
    await t.run(async (ctx) => {
      const r = (await ctx.db.query("expeditions").first())!;
      await ctx.db.patch(r._id, { puzzle: { ...r.puzzle!, struck: [(stored.answer + 1) % 5 === wrong ? (stored.answer + 2) % 5 : (stored.answer + 1) % 5] } });
    });
    const struck = (await run()).puzzle!.struck[0];
    await expect(ana.mutation(api.rpg.act, { choice: { kind: "answer", option: struck } })).rejects.toThrow(/ruled that one out/);
    expect(await run()).toMatchObject({ wrong: 1 });
  });

  test("kudos in private channels never appear in a puzzle", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms[0].kind === "puzzle");
    const ana = await ready({ seed });
    await t.run(async (ctx) => {
      const names = ["Dan", "Eve", "Finn", "Gus", "Hal", "Ivy"];
      const ids = [];
      for (const name of names) {
        ids.push(await ctx.db.insert("members", { workspaceId: team.workspaceId, slackUserId: `U${name.toUpperCase()}`, name, isAdmin: false, isBot: false, deactivated: false, totalGiven: 0, totalReceived: 0, totalMaxedDays: 0 }));
      }
      // Only private thanks, and one whose channel lookup failed (no name): nothing a puzzle may use.
      const at = Date.now() - 3600_000;
      const row = { workspaceId: team.workspaceId, amount: 1, dayKey: TODAY, source: "message" as const, text: "thanks for all of it", at, noteWords: 4 };
      await ctx.db.insert("kudos", { ...row, batchId: "p1", giverId: ids[0], receiverId: ids[1], channelId: "GSECRET", channelName: "secret-plans", channelPrivate: true });
      await ctx.db.insert("kudos", { ...row, batchId: "p2", giverId: ids[2], receiverId: ids[3], channelId: "CUNKNOWN" });
    });
    await ana.mutation(api.rpg.start, { ruinId });
    const stored = (await run()).puzzle!;
    expect(stored.question).toBe("The tree asks: what makes me grow?");
    expect(JSON.stringify(stored)).not.toMatch(/secret-plans|Dan|Eve|Finn|Gus/);
  });

  test("rooms not reached yet keep what they hold to themselves", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms[0].kind === "foe" && rooms.some((r) => r.kind === "secret"));
    const ana = await ready({ seed });
    await ana.mutation(api.rpg.start, { ruinId });
    const view = (await ana.query(api.rpg.current, {}))!.run!;
    expect(view.rooms[0].kind).toBe("foe");
    expect(view.rooms.slice(1).every((r) => r.kind === "unknown")).toBe(true);
  });
});

describe("review (#162): a run replays from its row", () => {
  test("every turn's choice is kept, and the rules replay the whole run to the same end", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms.some((r) => r.kind === "puzzle") && rooms.some((r) => r.kind === "rest"));
    const ana = await ready({ seed, level: 8 });
    await ana.mutation(api.rpg.start, { ruinId });
    const r = await playOut(ana);
    expect(r.choices.length).toBeGreaterThan(0);
    // Replay: the stored rooms, the party as it entered, the stored choices, turnRand per turn.
    let party = r.party.map((p) => ({ ...p, id: p.memberId as string, hp: startingHp(p.level), equipped: {} }));
    let done: string | null = null;
    for (let i = 0; i < r.rooms.length && done !== "fallen" && done !== "retreated"; i++) {
      let e = startEncounter(r.rooms[i] as Room, party);
      for (const c of r.choices.filter((c) => c.room === i)) {
        const choice = c.kind === "answer" ? { kind: "answer" as const, correct: !!c.correct } : c.kind === "onward" ? null : { kind: c.kind };
        e = resolveTurn(e, choice ? { [party[0].id]: choice as never } : {}, turnRand(r.seed, i, c.turn));
      }
      done = e.done;
      party = e.party;
    }
    expect(done).toBe(r.state);
    expect(party[0].hp).toBe(r.party[0].hp);
  });
});

describe("review (#162): the game hidden, stamina kept, one DM", () => {
  test("with the game hidden, nobody can start or act, and current is null", async () => {
    const ana = await ready();
    await t.run((ctx) => ctx.db.patch(team.ana, { gameHidden: true }));
    await expect(ana.mutation(api.rpg.start, { ruinId: "ruin:1:0" })).rejects.toThrow(/part of the game/);
    await expect(ana.mutation(api.rpg.act, { choice: { kind: "strike" } })).rejects.toThrow(/part of the game/);
    expect(await ana.query(api.rpg.current, {})).toBeNull();
  });

  test("stamina survives a game rebuild and a revoke", async () => {
    await message("UANA", "<@UBEN> :taco: thanks for the thorough review");
    await message("UANA", "<@UCLEO> :taco: thanks for the lovely design work");
    expect((await player(team.ana))!.stamina).toBe(2);
    await t.mutation(internal.game.rebuildMember, { memberId: team.ana });
    expect((await player(team.ana))!.stamina).toBe(2);
    const row = await t.run(async (ctx) => (await ctx.db.query("kudos").collect()).find((k) => k.giverId === team.ana)!);
    await t.run(async (ctx) => {
      const { revokeKudosRow } = await import("../convex/engine");
      await revokeKudosRow(ctx, (await ctx.db.get(team.workspaceId))!, row);
    });
    expect((await player(team.ana))!.stamina).toBe(2);
  });

  test("gear and a secret found in one run are told in exactly one DM", async () => {
    const { seed, ruinId } = nearRuin((rooms) => rooms.some((r) => r.kind === "secret") && rooms.every((r) => r.kind !== "puzzle"));
    const ana = await ready({ seed });
    await ana.mutation(api.rpg.start, { ruinId });
    await playOut(ana);
    const dms = await t.run((ctx) => ctx.db.query("notifications").withIndex("by_member", (q) => q.eq("memberId", team.ana)).collect());
    expect(dms.filter((n) => n.gains?.some((g) => g.kind === "ruin_finds"))).toHaveLength(1);
  });
});
