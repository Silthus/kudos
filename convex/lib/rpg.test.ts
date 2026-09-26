import { describe, expect, test } from "vitest";
import { mulberry32 } from "./random";
import {
  BESTIARY,
  canJoinParty,
  canStartExpedition,
  characterStats,
  creature,
  foeHpFor,
  foeTargets,
  GEAR,
  generateRuin,
  lootRand,
  MAX_TURNS,
  maxHp,
  PARTY,
  puzzleHint,
  PUZZLE_TRIES,
  resolveTurn,
  roomLoot,
  runLoot,
  scoutHeraldPoints,
  STAMINA,
  staminaAfterKudos,
  staminaAfterMoonFruit,
  startEncounter,
  startingHp,
  tierForLevel,
  turnRand,
  wearable,
  type Choice,
  type CreatureId,
  type Fighter,
  type Room,
} from "./rpg";

/** The desert RPG's pure rules (#152 S7): stamina, gear, ruins, turns, loot, parties. */

const hero = (over: Partial<Fighter> = {}): Fighter => ({ id: "ana", level: 8, scoutHeraldPoints: 2, plantsGrown: 1, equipped: {}, hp: 10, ...over });
const foeRoom = (foe: CreatureId = "sand_scarab"): Room => ({ kind: "foe", foe });
const fresh = (id: string, level: number, over: Partial<Fighter> = {}): Fighter => hero({ id, level, hp: startingHp(level), ...over });

describe("stamina", () => {
  test("comes only from thoughtful kudos (one per act of thanks) and moon fruit, and is capped at 5", () => {
    expect(STAMINA).toEqual({ max: 5, cost: 1, perKudos: 1, perMoonFruit: 1 });
    expect(staminaAfterKudos(0, { qualifyingLines: 1 })).toBe(1);
    expect(staminaAfterKudos(0, { qualifyingLines: 3 })).toBe(1);
    expect(staminaAfterKudos(5, { qualifyingLines: 1 })).toBe(5);
    expect(staminaAfterKudos(2, { qualifyingLines: 0 })).toBe(2);
    expect(staminaAfterKudos(9, { qualifyingLines: 0 })).toBe(5);
    expect(staminaAfterKudos(NaN, { qualifyingLines: 1 })).toBe(1);
    expect(staminaAfterMoonFruit(4)).toBe(5);
    expect(staminaAfterMoonFruit(5)).toBe(5);
  });

  test("an expedition needs the tier's level and one stamina", () => {
    expect(canStartExpedition({ level: 6, stamina: 1 }, 1)).toEqual({ ok: true });
    expect(canStartExpedition({ level: 6, stamina: 0 }, 1)).toEqual({ ok: false, reason: "stamina" });
    expect(canStartExpedition({ level: 9, stamina: 3 }, 2)).toEqual({ ok: false, reason: "level" });
    expect([5, 6, 10, 15, 25].map(tierForLevel)).toEqual([0, 1, 2, 3, 3]);
  });
});

describe("character stats and gear", () => {
  test("derive from level, breadth skills, plants grown (never above level) and worn gear", () => {
    expect(characterStats(hero())).toEqual({ might: 8, wits: 2, heart: 1 });
    expect(characterStats(hero({ equipped: { hat: "dune_hat", tool: "brass_trowel", charm: "amber_charm" } }))).toEqual({ might: 9, wits: 3, heart: 2 });
    expect(characterStats(hero({ level: 0 })).might).toBe(1);
    expect(characterStats(hero({ level: 6, plantsGrown: 40 })).heart).toBe(6);
    expect(characterStats(hero({ level: NaN, scoutHeraldPoints: -3, plantsGrown: NaN }))).toEqual({ might: 1, wits: 0, heart: 0 });
  });

  test("wits come from the Scout and Herald branches of the skill tree", () => {
    expect(scoutHeraldPoints(undefined)).toBe(0);
    expect(scoutHeraldPoints({ more_plots: 2 })).toBe(0);
    expect(scoutHeraldPoints({ lookout: 1 })).toBeGreaterThanOrEqual(1);
  });

  test("one item per slot: a wrong slot or an unknown id is dropped instead of stacking or crashing", () => {
    expect(wearable({ hat: "sap_blade", tool: "sap_blade", charm: "nope" })).toEqual({ tool: "sap_blade" });
    expect(wearable(undefined)).toEqual({});
    expect(characterStats(hero({ equipped: { tool: "sap_blade", hat: "sap_blade" as never } })).might).toBe(11);
  });

  test("gear has three slots, a rarity and a bonus of 1 to 3", () => {
    expect([...new Set(Object.values(GEAR).map((g) => g.slot))].sort()).toEqual(["charm", "hat", "tool"]);
    for (const g of Object.values(GEAR)) {
      expect(g.bonus).toBeGreaterThanOrEqual(1);
      expect(g.bonus).toBeLessThanOrEqual(3);
      expect(["common", "uncommon", "rare", "epic", "legendary"]).toContain(g.rarity);
    }
    expect(Object.keys(GEAR).length).toBeGreaterThanOrEqual(9);
  });
});

describe("the bestiary and ruins", () => {
  test("has twelve desert creatures across three tiers, each with a weakness, and rejects unknown ids", () => {
    expect(BESTIARY).toHaveLength(12);
    expect(new Set(BESTIARY.map((b) => b.tier))).toEqual(new Set([1, 2, 3]));
    for (const b of BESTIARY) expect(["might", "wits", "heart"]).toContain(b.weakness);
    expect(() => creature("constructor" as never)).toThrow(/Unknown creature/);
  });

  test("a foe grows with the standing party and hits two thirds of it", () => {
    expect([1, 2, 4].map((n) => foeHpFor("sand_scarab", n))).toEqual([16, 24, 40]);
    expect([1, 2, 3, 4].map(foeTargets)).toEqual([1, 2, 2, 3]);
  });

  test("every ruin at every tier is 3 to 6 rooms, deterministic from its seed, ending with a foe of its tier, with at most one secret", () => {
    for (const tier of [1, 2, 3] as const) {
      const lengths = new Set<number>();
      for (let i = 0; i < 300; i++) {
        const id = `ruin:${tier}:${i % 6}`;
        const ruin = generateRuin(i, id);
        expect(ruin).toEqual(generateRuin(i, id));
        expect(ruin.tier).toBe(tier);
        lengths.add(ruin.rooms.length);
        expect(ruin.rooms.length).toBeGreaterThanOrEqual(3);
        expect(ruin.rooms.length).toBeLessThanOrEqual(6);
        expect(ruin.rooms[ruin.rooms.length - 1].kind).toBe("foe");
        expect(ruin.rooms.filter((r) => r.kind === "secret").length).toBeLessThanOrEqual(1);
        for (const r of ruin.rooms) if (r.kind === "foe") expect(creature(r.foe).tier).toBe(tier);
      }
      expect(lengths.size).toBeGreaterThan(1);
    }
    expect(() => generateRuin(1, "nope")).toThrow(/Not a ruin id/);
    expect(() => generateRuin(1, "ruin:1:9")).toThrow(/Not a ruin id/);
  });

  test("the blight raid is a ruin that ends on the blight heart at the top tier", () => {
    const raid = generateRuin(7, "raid:3");
    expect(raid.tier).toBe(3);
    expect(raid.rooms[raid.rooms.length - 1]).toEqual({ kind: "foe", foe: "blight_heart" });
    expect(generateRuin(7, "raid:1").rooms.at(-1)?.kind).toBe("foe");
  });

  test("deeper tiers run longer on average", () => {
    const avg = (tier: 1 | 2 | 3) => Array.from({ length: 300 }, (_, i) => generateRuin(i, `ruin:${tier}:0`).rooms.length).reduce((a, b) => a + b) / 300;
    expect(avg(3)).toBeGreaterThan(avg(1));
  });

  test("random sources for turns and loot are their own per turn, room and member", () => {
    expect(turnRand(1, 0, 0)()).toBe(turnRand(1, 0, 0)());
    expect(turnRand(1, 0, 0)()).not.toBe(turnRand(1, 0, 1)());
    expect(lootRand(1, "ana", 0)()).not.toBe(lootRand(1, "ben", 0)());
    expect(lootRand(1, "ana", -1)()).not.toBe(lootRand(1, "ana", 0)());
  });
});

describe("turns", () => {
  test("never mutate the encounter passed in, and drop a duplicated member", () => {
    const e = startEncounter(foeRoom(), [hero(), hero()]);
    expect(e.party).toHaveLength(1);
    const frozen = JSON.stringify(e);
    resolveTurn(e, { ana: { kind: "strike" } }, mulberry32(1));
    expect(JSON.stringify(e)).toBe(frozen);
  });

  test("an attack uses its stat, a matching weakness doubles it, and the foe hits back", () => {
    const e = startEncounter(foeRoom("dune_wisp"), [hero({ level: 4, scoutHeraldPoints: 3 })]); // wisp: 12 hp, weak to wits
    const struck = resolveTurn(e, { ana: { kind: "strike" } }, mulberry32(1));
    expect(struck.foeHp).toBe(12 - 4);
    expect(struck.party[0].hp).toBeLessThan(10);
    expect(struck.turn).toBe(1);
    expect(struck.done).toBeNull();
    expect(resolveTurn(e, { ana: { kind: "outwit" } }, mulberry32(1)).foeHp).toBe(12 - 6);
    expect(resolveTurn(startEncounter(foeRoom("blight_sprout"), [hero({ plantsGrown: 3 })]), { ana: { kind: "calm" } }, mulberry32(1)).foeHp).toBe(13 - 6);
  });

  test("rally heals the standing party up to the cap and never touches the foe", () => {
    const e = startEncounter(foeRoom("dune_wisp"), [hero({ hp: 4, plantsGrown: 8 }), hero({ id: "ben", hp: maxHp(8) }), hero({ id: "cy", hp: 0 })]);
    expect(e.foeHp).toBe(foeHpFor("dune_wisp", 2));
    const next = resolveTurn(e, { ana: { kind: "rally" } }, mulberry32(2));
    expect(next.foeHp).toBe(e.foeHp);
    const [ana, ben, cy] = next.party;
    // Heals 2 + 8/4 = 4; then the wisp hits both standing members for 2 or 3 each.
    expect(ana.hp + ben.hp).toBeGreaterThanOrEqual(8 + maxHp(8) - 6);
    expect(ana.hp + ben.hp).toBeLessThanOrEqual(8 + maxHp(8) - 4);
    expect(cy.hp).toBe(0);
    expect(next.log.some((l) => /rallies/.test(l))).toBe(true);
  });

  test("the room ends when the foe falls, when everyone has fallen (returning to camp, losing nothing), or at the turn cap", () => {
    let weak = startEncounter(foeRoom("sand_scarab"), [hero({ level: 1, hp: 3 })]);
    const rand = mulberry32(4);
    for (let i = 0; i < 40 && !weak.done; i++) weak = resolveTurn(weak, { ana: { kind: "strike" } }, rand);
    expect(weak.done).toBe("fallen");
    expect(weak.party[0].hp).toBe(0);

    const strong = resolveTurn(startEncounter(foeRoom("sand_scarab"), [hero({ level: 25 })]), { ana: { kind: "strike" } }, rand);
    expect(strong.done).toBe("cleared");
    expect(strong.foeHp).toBe(0);

    let stall = startEncounter(foeRoom("sand_scarab"), [hero({ level: 25, plantsGrown: 25, hp: maxHp(25) })]);
    for (let i = 0; i < 100 && !stall.done; i++) stall = resolveTurn(stall, { ana: { kind: "rally" } }, rand);
    expect(stall.done).toBe("retreated");
    expect(stall.turn).toBe(MAX_TURNS);
    expect(resolveTurn(stall, { ana: { kind: "strike" } }, rand)).toBe(stall);
  });

  test("a member with no choice yet waits; the foe still acts; a broken hp counts as fallen", () => {
    const next = resolveTurn(startEncounter(foeRoom(), [hero(), hero({ id: "ben" })]), { ana: { kind: "strike" } }, mulberry32(5));
    expect(next.turn).toBe(1);
    expect(next.party.reduce((n, p) => n + p.hp, 0)).toBeLessThan(20);
    expect(startEncounter(foeRoom(), [hero({ hp: NaN })]).party[0].hp).toBe(0);
    expect(resolveTurn(startEncounter(foeRoom(), [hero({ hp: NaN })]), {}, mulberry32(6)).done).toBe("fallen");
  });

  test("a puzzle takes one answer per turn about the team, costs a little when wrong, and shuts after three wrong ones", () => {
    const puzzle: Room = { kind: "puzzle", puzzle: "who_thanked", difficulty: 4 };
    const e = startEncounter(puzzle, [hero(), hero({ id: "ben" })]);
    expect(resolveTurn(e, { ana: { kind: "answer", correct: true } }, mulberry32(6)).done).toBe("cleared");
    const bothWrong = resolveTurn(e, { ana: { kind: "answer", correct: false }, ben: { kind: "answer", correct: false } }, mulberry32(6));
    expect(bothWrong.wrong).toBe(1);
    expect(bothWrong.party.map((p) => p.hp)).toEqual([9, 10]);
    expect(resolveTurn(e, { ana: { kind: "strike" }, ben: { kind: "rally" } }, mulberry32(6)).party.map((p) => p.hp)).toEqual([10, 10]);
    let shut = e;
    for (let i = 0; i < PUZZLE_TRIES; i++) shut = resolveTurn(shut, { ana: { kind: "answer", correct: false } }, mulberry32(6));
    expect(shut.done).toBe("retreated");
    expect(puzzleHint(4, 4)).toBe(true);
    expect(puzzleHint(3, 4)).toBe(false);
    expect(resolveTurn(startEncounter(foeRoom(), [hero()]), { ana: { kind: "answer", correct: true } }, mulberry32(6)).done).toBeNull();
  });

  test("rest rooms heal on entry and clear on the next turn whatever anyone does; secret rooms clear", () => {
    const rest = startEncounter({ kind: "rest" }, [hero({ hp: 2 })]);
    expect(rest.party[0].hp).toBe(6);
    expect(resolveTurn(rest, {}, mulberry32(7)).done).toBe("cleared");
    expect(resolveTurn(startEncounter({ kind: "secret", lore: 1 }, [hero()]), {}, mulberry32(7)).done).toBe("cleared");
  });
});

describe("balance", () => {
  /** A sensible policy: answer puzzles right three times in four, rally when someone is low, else use the foe's weakness. */
  const run = (members: Fighter[], tier: 1 | 2 | 3, seed: number) => {
    const ruin = generateRuin(seed, `ruin:${tier}:0`);
    const rand = mulberry32(9000 + seed);
    let party = members;
    for (const room of ruin.rooms) {
      let e = startEncounter(room, party);
      for (let i = 0; i < MAX_TURNS && !e.done; i++) {
        const choices: Record<string, Choice> = {};
        const low = e.party.some((p) => p.hp > 0 && p.hp <= 4);
        const healer = e.party.find((p) => p.hp > 0);
        for (const m of e.party) {
          if (m.hp <= 0) continue;
          if (room.kind === "puzzle") choices[m.id] = { kind: "answer", correct: rand() < 0.75 };
          else if (low && m === healer) choices[m.id] = { kind: "rally" };
          else {
            const s = characterStats(m);
            const weak = room.kind === "foe" ? creature(room.foe).weakness : "might";
            choices[m.id] = s[weak] * 2 > s.might ? ({ might: { kind: "strike" }, wits: { kind: "outwit" }, heart: { kind: "calm" } } as const)[weak] : { kind: "strike" };
          }
        }
        e = resolveTurn(e, choices, rand);
      }
      if (e.done !== "cleared") return false;
      party = e.party;
    }
    return true;
  };
  const rate = (members: () => Fighter[], tier: 1 | 2 | 3, runs = 200) => Array.from({ length: runs }, (_, s) => run(members(), tier, s)).filter(Boolean).length / runs;
  const deep = (id: string, over: Partial<Fighter> = {}) => fresh(id, 15, { scoutHeraldPoints: 5, plantsGrown: 4, ...over });

  test("a solo hero at each tier's gate clears the near and far ruins most of the time, and is never guaranteed to", () => {
    const near = rate(() => [fresh("a", 6)], 1);
    const far = rate(() => [fresh("a", 10, { scoutHeraldPoints: 4, equipped: { tool: "iron_spade" } })], 2);
    expect(near).toBeGreaterThan(0.55);
    expect(near).toBeLessThan(0.98);
    expect(far).toBeGreaterThan(0.55);
    expect(far).toBeLessThan(0.98);
  });

  test("the deep ruins want a party: a solo level-15 hero mostly falls, even a veteran gardener; three mostly clear; a full party can still fail", () => {
    expect(rate(() => [deep("a")], 3)).toBeLessThan(0.5);
    expect(rate(() => [deep("a", { plantsGrown: 30 })], 3)).toBeLessThan(0.5);
    expect(rate(() => ["a", "b", "c"].map((id) => deep(id)), 3)).toBeGreaterThan(0.6);
    expect(rate(() => ["a", "b", "c", "d"].map((id) => deep(id)), 3)).toBeLessThan(0.95);
  });
});

describe("loot", () => {
  test("coins and the rare secret come once per run, within the tier's bounds", () => {
    for (const tier of [1, 2, 3] as const) {
      const rand = mulberry32(11 + tier);
      let secrets = 0;
      const n = 4000;
      for (let i = 0; i < n; i++) {
        const l = runLoot(tier, rand);
        expect(l.coins).toBeGreaterThanOrEqual([5, 12, 20][tier - 1]);
        expect(l.coins).toBeLessThanOrEqual([15, 28, 40][tier - 1]);
        if (l.secret) {
          secrets++;
          expect(l.secret.lore).toBeGreaterThanOrEqual(0);
          expect(l.secret.lore).toBeLessThan(12);
        }
      }
      expect(secrets / n).toBeGreaterThan(0.035);
      expect(secrets / n).toBeLessThan(0.065);
    }
  });

  test("rooms add only sun fruit and gear, rarer at deeper tiers; rest rooms hold nothing", () => {
    const rand = mulberry32(12);
    const rarities = (tier: 1 | 2 | 3) => {
      const seen = new Set<string>();
      const fruitKinds = new Set<string>();
      for (let i = 0; i < 3000; i++) {
        const l = roomLoot({ kind: "foe", foe: "sand_scarab" }, tier, rand);
        for (const f of l.fruits) fruitKinds.add(f);
        for (const g of l.gear) seen.add(GEAR[g].rarity);
      }
      return { seen, fruitKinds };
    };
    expect([...rarities(1).fruitKinds]).toEqual(["sun"]);
    expect([...rarities(1).seen].sort()).toEqual(["common", "uncommon"]);
    expect(rarities(3).seen.has("epic")).toBe(true);
    expect(rarities(3).seen.has("legendary")).toBe(false);
    expect(roomLoot({ kind: "rest" }, 1, rand)).toEqual({ fruits: [], gear: [], lore: null });
  });

  test("a secret room gives its lore card and a rare-or-better item once per member, never again", () => {
    const rand = mulberry32(13);
    const first = roomLoot({ kind: "secret", lore: 3 }, 1, rand);
    expect(first.lore).toBe(3);
    expect(first.gear).toHaveLength(1);
    expect(GEAR[first.gear[0]].rarity).toBe("rare");
    expect(["rare", "epic", "legendary"]).toContain(GEAR[roomLoot({ kind: "secret", lore: 3 }, 3, rand).gear[0]].rarity);
    expect(roomLoot({ kind: "secret", lore: 3 }, 1, rand, { secretFound: true })).toEqual({ fruits: [], gear: [], lore: null });
  });
});

describe("parties", () => {
  test("a party is 1 to 4, invited within 8 tiles, and every member needs the tier's level and a stamina", () => {
    expect(PARTY).toEqual({ min: 1, max: 4, inviteRadius: 8, decideSeconds: 60 });
    expect(canJoinParty({ level: 6, stamina: 1, distance: 3, size: 1 }, 1)).toEqual({ ok: true });
    expect(canJoinParty({ level: 6, stamina: 1, distance: 9, size: 1 }, 1)).toEqual({ ok: false, reason: "too_far" });
    expect(canJoinParty({ level: 6, stamina: 1, distance: 3, size: 4 }, 1)).toEqual({ ok: false, reason: "full" });
    expect(canJoinParty({ level: 9, stamina: 1, distance: 3, size: 1 }, 2)).toEqual({ ok: false, reason: "level" });
    expect(canJoinParty({ level: 6, stamina: 0, distance: 3, size: 1 }, 1)).toEqual({ ok: false, reason: "stamina" });
  });
});
