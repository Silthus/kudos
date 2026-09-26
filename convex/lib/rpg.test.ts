import { describe, expect, test } from "vitest";
import { mulberry32 } from "./random";
import {
  BESTIARY,
  BLIGHT,
  blightHp,
  blightDamage,
  canJoinParty,
  characterStats,
  GEAR,
  generateRuin,
  lootFor,
  PARTY,
  resolveTurn,
  STAMINA,
  staminaAfterKudos,
  tierForLevel,
  type Choice,
  type Encounter,
  type PartyMember,
  type Room,
} from "./rpg";

/** The desert RPG's pure rules (#152 S7, S8): stamina, gear, ruins, turns, loot, parties, blights. */

const hero = (over: Partial<PartyMember> = {}): PartyMember => ({
  id: "ana",
  level: 8,
  scoutHeraldPoints: 2,
  plantsGrown: 1,
  gear: [],
  hp: 10,
  ...over,
});

describe("stamina", () => {
  test("comes only from thoughtful kudos and moon fruit, capped at 5, and never from time", () => {
    expect(STAMINA.max).toBe(5);
    expect(STAMINA.cost).toBe(1);
    expect(staminaAfterKudos(0, { qualifying: true })).toBe(1);
    expect(staminaAfterKudos(5, { qualifying: true })).toBe(5);
    expect(staminaAfterKudos(2, { qualifying: false })).toBe(2);
  });
});

describe("character stats", () => {
  test("derive from level, breadth skills, plants grown and gear, and are never stored", () => {
    expect(characterStats(hero())).toEqual({ might: 8, wits: 2, heart: 1, hp: 10 });
    const geared = hero({ gear: ["dune_hat", "brass_trowel", "amber_charm"] });
    const s = characterStats(geared);
    expect(s.might).toBe(8 + GEAR.brass_trowel.bonus);
    expect(s.wits).toBe(2 + GEAR.dune_hat.bonus);
    expect(s.heart).toBe(1 + GEAR.amber_charm.bonus);
  });

  test("gear has three slots, a rarity and a bonus of 1 to 3", () => {
    const slots = new Set(Object.values(GEAR).map((g) => g.slot));
    expect([...slots].sort()).toEqual(["charm", "hat", "tool"]);
    for (const g of Object.values(GEAR)) {
      expect(g.bonus).toBeGreaterThanOrEqual(1);
      expect(g.bonus).toBeLessThanOrEqual(3);
      expect(["common", "uncommon", "rare", "epic", "legendary"]).toContain(g.rarity);
    }
    expect(Object.keys(GEAR).length).toBeGreaterThanOrEqual(9);
  });
});

describe("the bestiary and ruins", () => {
  test("has twelve desert creatures across three tiers, each with a weakness", () => {
    expect(BESTIARY).toHaveLength(12);
    expect(new Set(BESTIARY.map((b) => b.tier))).toEqual(new Set([1, 2, 3]));
    for (const b of BESTIARY) expect(["might", "wits", "heart"]).toContain(b.weakness);
  });

  test("tiers open by level 6, 10 and 15", () => {
    expect(tierForLevel(5)).toBe(0);
    expect(tierForLevel(6)).toBe(1);
    expect(tierForLevel(10)).toBe(2);
    expect(tierForLevel(15)).toBe(3);
    expect(tierForLevel(25)).toBe(3);
  });

  test("a ruin is 3 to 6 rooms, deterministic from its seed, ending with a foe and holding at most one secret", () => {
    for (let i = 0; i < 200; i++) {
      const ruin = generateRuin(i, "ruin:1:2", 1);
      expect(ruin).toEqual(generateRuin(i, "ruin:1:2", 1));
      expect(ruin.rooms.length).toBeGreaterThanOrEqual(3);
      expect(ruin.rooms.length).toBeLessThanOrEqual(6);
      expect(ruin.rooms[ruin.rooms.length - 1].kind).toBe("foe");
      expect(ruin.rooms.filter((r) => r.kind === "secret").length).toBeLessThanOrEqual(1);
      for (const r of ruin.rooms) {
        if (r.kind === "foe") expect(BESTIARY.find((b) => b.id === r.foe)?.tier).toBe(1);
        if (r.kind === "puzzle") expect(["who_thanked", "most_thanked_by", "last_channel"]).toContain(r.puzzle);
      }
    }
  });

  test("higher tiers draw from their own creatures and are longer on average", () => {
    const avg = (tier: 1 | 2 | 3) => {
      let n = 0;
      for (let i = 0; i < 300; i++) n += generateRuin(i, `ruin:${tier}:0`, tier).rooms.length;
      return n / 300;
    };
    expect(avg(3)).toBeGreaterThan(avg(1));
    const deep = generateRuin(3, "ruin:3:1", 3);
    for (const r of deep.rooms) if (r.kind === "foe") expect(BESTIARY.find((b) => b.id === r.foe)?.tier).toBe(3);
  });
});

describe("turns", () => {
  const foeRoom = (id = "sand_scarab"): Extract<Room, { kind: "foe" }> => ({ kind: "foe", foe: id });
  const start = (members: PartyMember[], room = foeRoom()): Encounter => {
    const foe = BESTIARY.find((b) => b.id === room.foe)!;
    return { room, foeHp: foe.hp, party: members, turn: 0, log: [], done: null };
  };

  test("a strike hits with might, a weakness doubles it, and the foe strikes back at one member", () => {
    const e = start([hero()]);
    const next = resolveTurn(e, { ana: { kind: "strike" } }, mulberry32(1));
    const foe = BESTIARY.find((b) => b.id === "sand_scarab")!;
    const expected = foe.weakness === "might" ? 8 * 2 : 8;
    expect(next.foeHp).toBe(Math.max(0, foe.hp - expected));
    expect(next.turn).toBe(1);
    expect(next.log.length).toBeGreaterThanOrEqual(1);
    if (next.foeHp > 0) expect(next.party[0].hp).toBeLessThan(10);
  });

  test("rally heals the party and never damages the foe; use item spends it", () => {
    const e = start([hero({ hp: 4 }), hero({ id: "ben", hp: 6 })], foeRoom("dune_wisp"));
    const next = resolveTurn(e, { ana: { kind: "rally" }, ben: { kind: "strike" } }, mulberry32(2));
    const ana = next.party.find((m) => m.id === "ana")!;
    expect(ana.hp).toBeGreaterThanOrEqual(4);
    expect(next.log.some((l) => /rall/i.test(l))).toBe(true);
    const withItem = resolveTurn(start([hero({ items: ["moon"] })]), { ana: { kind: "item", item: "moon" } }, mulberry32(3));
    expect(withItem.party[0].items).toEqual([]);
  });

  test("the encounter ends when the foe falls or every member has fallen; a fallen member returns to camp, losing nothing", () => {
    let e = start([hero({ level: 1, hp: 3 })], foeRoom("sand_scarab"));
    const rand = mulberry32(4);
    for (let i = 0; i < 20 && !e.done; i++) e = resolveTurn(e, { ana: { kind: "strike" } }, rand);
    expect(e.done).not.toBeNull();
    if (e.done === "fallen") expect(e.party[0].hp).toBe(0);
    let strong = start([hero({ level: 25 })]);
    for (let i = 0; i < 20 && !strong.done; i++) strong = resolveTurn(strong, { ana: { kind: "strike" } }, rand);
    expect(strong.done).toBe("cleared");
  });

  test("a member with no choice yet waits; the foe still acts, so nobody stalls the party", () => {
    const e = start([hero(), hero({ id: "ben" })]);
    const next = resolveTurn(e, { ana: { kind: "strike" } }, mulberry32(5));
    expect(next.turn).toBe(1);
  });

  test("puzzle rooms are solved by wits against a threshold and rest rooms heal", () => {
    const puzzle: Room = { kind: "puzzle", puzzle: "who_thanked", difficulty: 4 };
    const e: Encounter = { room: puzzle, foeHp: 0, party: [hero({ scoutHeraldPoints: 5 })], turn: 0, log: [], done: null };
    expect(resolveTurn(e, { ana: { kind: "outwit" } }, mulberry32(6)).done).toBe("cleared");
    const rest: Room = { kind: "rest" };
    const r = resolveTurn({ ...e, room: rest, party: [hero({ hp: 2 })] }, { ana: { kind: "rally" } }, mulberry32(7));
    expect(r.done).toBe("cleared");
    expect(r.party[0].hp).toBeGreaterThan(2);
  });

  test("a solo level-appropriate hero clears most near ruins, and is not guaranteed to", () => {
    let cleared = 0;
    const runs = 200;
    for (let s = 0; s < runs; s++) {
      const ruin = generateRuin(s, "ruin:1:0", 1);
      const rand = mulberry32(1000 + s);
      let member = hero({ level: 7, hp: 12 });
      let ok = true;
      for (const room of ruin.rooms) {
        let e: Encounter = { room, foeHp: room.kind === "foe" ? BESTIARY.find((b) => b.id === room.foe)!.hp : 0, party: [member], turn: 0, log: [], done: null };
        const choice: Choice = room.kind === "puzzle" ? { kind: "outwit" } : room.kind === "rest" ? { kind: "rally" } : { kind: "strike" };
        for (let i = 0; i < 30 && !e.done; i++) e = resolveTurn(e, { ana: choice }, rand);
        if (e.done !== "cleared") {
          ok = false;
          break;
        }
        member = e.party[0];
      }
      if (ok) cleared++;
    }
    expect(cleared / runs).toBeGreaterThan(0.55);
    expect(cleared / runs).toBeLessThan(0.98);
  });
});

describe("balance", () => {
  const run = (members: PartyMember[], tier: 1 | 2 | 3, seed: number) => {
    const ruin = generateRuin(seed, `ruin:${tier}:0`, tier);
    const rand = mulberry32(9000 + seed);
    let party = members;
    for (const room of ruin.rooms) {
      let e: Encounter = { room, foeHp: room.kind === "foe" ? BESTIARY.find((b) => b.id === room.foe)!.hp : 0, party, turn: 0, log: [], done: null };
      for (let i = 0; i < 40 && !e.done; i++) {
        const choices: Record<string, Choice> = {};
        for (const m of e.party) {
          if (m.hp <= 0) continue;
          // The weakest standing member rallies when anyone is low; the rest strike or outwit.
          const low = e.party.some((p) => p.hp > 0 && p.hp <= 4);
          choices[m.id] = room.kind === "puzzle" ? { kind: "outwit" } : room.kind === "rest" ? { kind: "rally" } : low && m === e.party.find((p) => p.hp > 0) ? { kind: "rally" } : { kind: "strike" };
        }
        e = resolveTurn(e, choices, rand);
      }
      if (e.done !== "cleared") return false;
      party = e.party;
    }
    return true;
  };
  const rate = (members: () => PartyMember[], tier: 1 | 2 | 3, runs = 150) => {
    let ok = 0;
    for (let s = 0; s < runs; s++) if (run(members(), tier, s)) ok++;
    return ok / runs;
  };

  test("the deep ruins want a party: a solo level-15 hero mostly falls, three of them mostly clear", () => {
    const solo = rate(() => [hero({ id: "a", level: 15, hp: 15 })], 3);
    const party = rate(() => ["a", "b", "c"].map((id) => hero({ id, level: 15, hp: 15 })), 3);
    expect(solo).toBeLessThan(0.5);
    expect(party).toBeGreaterThan(0.6);
    expect(party).toBeGreaterThan(solo);
  });

  test("the far ruins suit a level-12 hero alone", () => {
    expect(rate(() => [hero({ id: "a", level: 12, hp: 14 })], 2)).toBeGreaterThan(0.6);
  });
});

describe("loot", () => {
  test("stays within bounds and drops a secret about one time in twenty", () => {
    let coinsMin = Infinity;
    let coinsMax = 0;
    let secrets = 0;
    const rand = mulberry32(11);
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const loot = lootFor({ kind: "foe", foe: "sand_scarab" }, 1, rand);
      coinsMin = Math.min(coinsMin, loot.coins);
      coinsMax = Math.max(coinsMax, loot.coins);
      if (loot.secret) secrets++;
      for (const g of loot.gear) expect(GEAR[g]).toBeDefined();
    }
    expect(coinsMin).toBeGreaterThanOrEqual(5);
    expect(coinsMax).toBeLessThanOrEqual(40);
    expect(secrets / n).toBeGreaterThan(0.03);
    expect(secrets / n).toBeLessThan(0.08);
  });

  test("secret rooms always hold a secret and a rare-or-better item; rest rooms hold nothing", () => {
    const rand = mulberry32(12);
    const s = lootFor({ kind: "secret", lore: 3 }, 2, rand);
    expect(s.secret).toBe(true);
    expect(s.gear.length).toBe(1);
    expect(["rare", "epic", "legendary"]).toContain(GEAR[s.gear[0]].rarity);
    expect(lootFor({ kind: "rest" }, 1, rand)).toEqual({ coins: 0, fruits: [], gear: [], secret: false });
  });
});

describe("parties and blights", () => {
  test("a party is 2 to 4, invited within 8 tiles, and needs the tier's level", () => {
    expect(PARTY.max).toBe(4);
    expect(PARTY.inviteRadius).toBe(8);
    expect(canJoinParty({ level: 6, distance: 3, size: 1 }, 1)).toEqual({ ok: true });
    expect(canJoinParty({ level: 6, distance: 9, size: 1 }, 1)).toEqual({ ok: false, reason: "too_far" });
    expect(canJoinParty({ level: 6, distance: 3, size: 4 }, 1)).toEqual({ ok: false, reason: "full" });
    expect(canJoinParty({ level: 9, distance: 3, size: 1 }, 2)).toEqual({ ok: false, reason: "level" });
  });

  test("a blight's hp scales with the active company and damage comes from kudos, rooms and raids", () => {
    expect(blightHp(10)).toBe(400);
    expect(blightHp(0)).toBe(BLIGHT.minHp);
    expect(blightDamage("kudos")).toBe(1);
    expect(blightDamage("room")).toBe(2);
    expect(blightDamage("raid_room")).toBe(10);
    expect(BLIGHT.windowDays).toBe(5);
    expect(BLIGHT.everyDays).toEqual([14, 28]);
    expect(BLIGHT.rewardCoins).toBe(20);
  });
});
