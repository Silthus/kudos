/**
 * The desert RPG (#152 §S7, §S8): the pure rules behind expeditions into the ruins around the
 * Ancient Tree. Everything here is deterministic from a seed and small integers, so a run stored
 * as (seed, choices) replays exactly, tests can prove the odds, and no rule pays anything that
 * didn't start as a kudos: stamina comes from thoughtful giving, gear from ruins or fruit, and a
 * fallen player simply returns to camp. Character stats are derived, never stored.
 */
import type { Rarity } from "./messages";
import { fnv1a, mulberry32 } from "./random";
import type { FruitId } from "./fruits";

export type Stat = "might" | "wits" | "heart";
export type Tier = 1 | 2 | 3;

/** Stamina: the only cost of an expedition, restored only by qualifying kudos and moon fruit. */
export const STAMINA = { max: 5, cost: 1, perKudos: 1 } as const;

export function staminaAfterKudos(stamina: number, k: { qualifying: boolean }): number {
  return k.qualifying ? Math.min(STAMINA.max, stamina + STAMINA.perKudos) : stamina;
}

/** Ruin tiers open by level: near 6, far 10, deep 15 (0 = none yet). */
export function tierForLevel(level: number): 0 | Tier {
  return level >= 15 ? 3 : level >= 10 ? 2 : level >= 6 ? 1 : 0;
}

export type GearSlot = "hat" | "tool" | "charm";
export type Gear = { name: string; slot: GearSlot; stat: Stat; bonus: 1 | 2 | 3; rarity: Rarity; about: string };

/** Equipment: one item per slot, each adding to one stat. Basic pieces are sold at the stall. */
export const GEAR = {
  dune_hat: { name: "Dune hat", slot: "hat", stat: "wits", bonus: 1, rarity: "common", about: "Keeps the sun out of your thinking." },
  brass_trowel: { name: "Brass trowel", slot: "tool", stat: "might", bonus: 1, rarity: "common", about: "A gardener's first tool." },
  amber_charm: { name: "Amber charm", slot: "charm", stat: "heart", bonus: 1, rarity: "common", about: "Warm to the touch." },
  scout_cap: { name: "Scout's cap", slot: "hat", stat: "wits", bonus: 2, rarity: "uncommon", about: "Worn by those who look further." },
  iron_spade: { name: "Iron spade", slot: "tool", stat: "might", bonus: 2, rarity: "uncommon", about: "Digs through anything but rock." },
  moon_pendant: { name: "Moon pendant", slot: "charm", stat: "heart", bonus: 2, rarity: "uncommon", about: "Glows faintly at night." },
  archivist_hood: { name: "Archivist's hood", slot: "hat", stat: "wits", bonus: 3, rarity: "rare", about: "From the Sunken Archive." },
  sap_blade: { name: "Sap blade", slot: "tool", stat: "might", bonus: 3, rarity: "rare", about: "Cut from a fallen branch of the tree." },
  heart_stone: { name: "Heart stone", slot: "charm", stat: "heart", bonus: 3, rarity: "rare", about: "It remembers every thank-you." },
  crown_of_leaves: { name: "Crown of leaves", slot: "hat", stat: "heart", bonus: 3, rarity: "epic", about: "Grown, not made." },
  lantern_staff: { name: "Lantern staff", slot: "tool", stat: "wits", bonus: 3, rarity: "epic", about: "Lights the deepest room." },
  first_seed: { name: "The first seed", slot: "charm", stat: "might", bonus: 3, rarity: "legendary", about: "A seed like the one that started it all." },
} as const satisfies Record<string, Gear>;

export type GearId = keyof typeof GEAR;

export function isGearId(id: string): id is GearId {
  return Object.hasOwn(GEAR, id);
}

export type PartyMember = {
  id: string;
  level: number;
  /** Skill points spent in the Scout and Herald branches (breadth and voice: wits). */
  scoutHeraldPoints: number;
  plantsGrown: number;
  gear: GearId[];
  hp: number;
  /** Fruit carried into the ruin (moon fruit heals in the field). */
  items?: FruitId[];
};

export type Stats = { might: number; wits: number; heart: number; hp: number };

/** Derived on the spot: level is might, breadth is wits, care is heart; gear adds to one stat each. */
export function characterStats(m: PartyMember): Stats {
  const stats: Stats = { might: m.level, wits: m.scoutHeraldPoints, heart: m.plantsGrown, hp: m.hp };
  for (const id of m.gear) stats[GEAR[id].stat] += GEAR[id].bonus;
  return stats;
}

/** Hit points a member starts a ruin with: enough to survive a few bad rolls at their tier. */
export function startingHp(level: number): number {
  return 8 + Math.floor(level / 2);
}

export type Creature = { id: string; name: string; tier: Tier; hp: number; hit: number; weakness: Stat; about: string };

/** Twelve desert creatures, four per tier; a foe's weakness doubles that stat against it. */
export const BESTIARY: Creature[] = [
  { id: "sand_scarab", name: "Sand scarab", tier: 1, hp: 16, hit: 2, weakness: "might", about: "Armoured, slow, and everywhere." },
  { id: "dune_wisp", name: "Dune wisp", tier: 1, hp: 12, hit: 3, weakness: "wits", about: "A trick of the heat with teeth." },
  { id: "blight_sprout", name: "Blight sprout", tier: 1, hp: 13, hit: 3, weakness: "heart", about: "Something that grew where nobody said thanks." },
  { id: "salt_hare", name: "Salt hare", tier: 1, hp: 11, hit: 3, weakness: "wits", about: "Faster than it looks." },
  { id: "glass_scorpion", name: "Glass scorpion", tier: 2, hp: 20, hit: 4, weakness: "might", about: "You see through it too late." },
  { id: "hollow_sentinel", name: "Hollow sentinel", tier: 2, hp: 24, hit: 3, weakness: "wits", about: "Still guarding a door that fell long ago." },
  { id: "thirst_shade", name: "Thirst shade", tier: 2, hp: 18, hit: 5, weakness: "heart", about: "It wants what you carry." },
  { id: "kiln_beetle", name: "Kiln beetle", tier: 2, hp: 22, hit: 4, weakness: "might", about: "Hot enough to bake bread on." },
  { id: "storm_djinn", name: "Storm djinn", tier: 3, hp: 34, hit: 5, weakness: "wits", about: "A whole sandstorm with a grudge." },
  { id: "root_wyrm", name: "Root wyrm", tier: 3, hp: 40, hit: 5, weakness: "might", about: "It chews on the roots of the world." },
  { id: "silent_choir", name: "Silent choir", tier: 3, hp: 30, hit: 6, weakness: "heart", about: "Everyone who was never thanked, singing." },
  { id: "blight_heart", name: "Blight heart", tier: 3, hp: 45, hit: 6, weakness: "heart", about: "The blight itself, cornered." },
];

export const CREATURE = Object.fromEntries(BESTIARY.map((c) => [c.id, c])) as Record<string, Creature>;

/** A puzzle asks something about the team's own, public kudos history. */
export type PuzzleKind = "who_thanked" | "most_thanked_by" | "last_channel";

export type Room =
  | { kind: "foe"; foe: string }
  | { kind: "puzzle"; puzzle: PuzzleKind; difficulty: number }
  | { kind: "secret"; lore: number }
  | { kind: "rest" };

export type Ruin = { id: string; tier: Tier; rooms: Room[] };

const PUZZLES: PuzzleKind[] = ["who_thanked", "most_thanked_by", "last_channel"];

/**
 * A ruin's rooms from (seed, ruin id, tier): 3–6 rooms (deeper tiers run longer), at most one
 * secret, always a foe at the end. The same ruin reads the same for every party that enters it
 * on the same seed, so a workspace's ruins are landmarks, not lotteries.
 */
export function generateRuin(seed: number, ruinId: string, tier: Tier): Ruin {
  const rand = mulberry32(fnv1a(`${seed >>> 0}:${ruinId}`));
  const foes = BESTIARY.filter((c) => c.tier === tier);
  const count = 3 + Math.floor(rand() * (2 + tier));
  const rooms: Room[] = [];
  let secret = false;
  for (let i = 0; i < count - 1; i++) {
    const roll = rand();
    if (!secret && roll < 0.12) {
      secret = true;
      rooms.push({ kind: "secret", lore: Math.floor(rand() * 12) });
    } else if (roll < 0.32) rooms.push({ kind: "puzzle", puzzle: PUZZLES[Math.floor(rand() * PUZZLES.length)], difficulty: 2 + tier * 2 + Math.floor(rand() * 2) });
    else if (roll < 0.45) rooms.push({ kind: "rest" });
    else rooms.push({ kind: "foe", foe: foes[Math.floor(rand() * foes.length)].id });
  }
  rooms.push({ kind: "foe", foe: foes[Math.floor(rand() * foes.length)].id });
  return { id: ruinId, tier, rooms: rooms.slice(0, Math.min(6, count)) };
}

export type Choice = { kind: "strike" } | { kind: "outwit" } | { kind: "rally" } | { kind: "item"; item: FruitId };

export type Encounter = {
  room: Room;
  foeHp: number;
  party: PartyMember[];
  turn: number;
  log: string[];
  done: null | "cleared" | "fallen";
};

const REST_HEAL = 4;
/** The chance a guess at a puzzle lands, before wits makes it certain. */
export function puzzleOdds(wits: number): number {
  return Math.min(0.95, 0.4 + 0.1 * wits);
}
const RALLY_HEAL = 2;

/**
 * One turn: every member who chose acts (a member without a choice waits, so nobody stalls the
 * party), then the foe hits one standing member. Small integers; a weakness doubles the stat
 * used against it. The encounter ends when the foe falls or every member has.
 */
export function resolveTurn(e: Encounter, choices: Record<string, Choice>, rand: () => number): Encounter {
  if (e.done) return e;
  const party = e.party.map((m) => ({ ...m, items: [...(m.items ?? [])] }));
  const log: string[] = [];
  let foeHp = e.foeHp;
  const foe = e.room.kind === "foe" ? CREATURE[e.room.foe] : null;
  const name = (m: PartyMember) => m.id;

  for (const m of party) {
    const choice = choices[m.id];
    if (!choice || m.hp <= 0) continue;
    const s = characterStats(m);
    switch (choice.kind) {
      case "strike":
      case "outwit": {
        const stat: Stat = choice.kind === "strike" ? "might" : "wits";
        if (e.room.kind === "puzzle") {
          // Anyone can answer a question about their own team; wits makes it more likely, and
          // enough wits makes it certain.
          if (choice.kind === "outwit" && (s.wits >= e.room.difficulty || rand() < puzzleOdds(s.wits))) {
            log.push(`${name(m)} works out the ${e.room.puzzle.replace(/_/g, " ")} puzzle.`);
            return { ...e, party, log: [...e.log, ...log], turn: e.turn + 1, done: "cleared" };
          }
          log.push(`${name(m)} puzzles over it and gets nowhere.`);
          break;
        }
        if (!foe) break;
        const dealt = s[stat] * (foe.weakness === stat ? 2 : 1);
        foeHp = Math.max(0, foeHp - dealt);
        log.push(`${name(m)} ${choice.kind === "strike" ? "strikes" : "outwits"} the ${foe.name} for ${dealt}.`);
        break;
      }
      case "rally": {
        const heal = e.room.kind === "rest" ? REST_HEAL : RALLY_HEAL + Math.floor(s.heart / 4);
        for (const p of party) if (p.hp > 0) p.hp = Math.min(startingHp(p.level) + 4, p.hp + heal);
        log.push(`${name(m)} rallies the party: everyone heals ${heal}.`);
        break;
      }
      case "item": {
        const i = m.items.indexOf(choice.item);
        if (i < 0) break;
        m.items.splice(i, 1);
        if (choice.item === "moon") {
          m.hp += 5;
          log.push(`${name(m)} eats a moon fruit and heals 5.`);
        } else log.push(`${name(m)} holds up a ${choice.item} fruit. Nothing happens here.`);
        break;
      }
    }
  }

  if (e.room.kind === "rest" || e.room.kind === "secret") {
    return { ...e, party, foeHp, log: [...e.log, ...log, e.room.kind === "rest" ? "The party rests." : "A hidden room. Something glints."], turn: e.turn + 1, done: "cleared" };
  }
  if (e.room.kind === "puzzle") {
    // An unsolved puzzle costs the party a little time and hp, and stays open.
    const target = party.filter((p) => p.hp > 0)[Math.floor(rand() * party.filter((p) => p.hp > 0).length)];
    if (target) target.hp = Math.max(0, target.hp - 1);
    const done = party.every((p) => p.hp <= 0) ? "fallen" : null;
    return { ...e, party, foeHp, log: [...e.log, ...log], turn: e.turn + 1, done };
  }
  if (foe && foeHp <= 0) {
    return { ...e, party, foeHp: 0, log: [...e.log, ...log, `The ${foe.name} falls.`], turn: e.turn + 1, done: "cleared" };
  }
  if (foe) {
    const standing = party.filter((p) => p.hp > 0);
    const target = standing[Math.floor(rand() * standing.length)];
    if (target) {
      const hit = foe.hit + (rand() < 0.25 ? 1 : 0);
      target.hp = Math.max(0, target.hp - hit);
      log.push(`The ${foe.name} hits ${name(target)} for ${hit}.${target.hp <= 0 ? ` ${name(target)} falls and returns to camp.` : ""}`);
    }
  }
  const done = party.every((p) => p.hp <= 0) ? "fallen" : null;
  return { ...e, party, foeHp, log: [...e.log, ...log], turn: e.turn + 1, done };
}

export type Loot = { coins: number; fruits: FruitId[]; gear: GearId[]; secret: boolean };

const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const gearOfRarity = (min: Rarity, max: Rarity) =>
  (Object.keys(GEAR) as GearId[]).filter((id) => RARITY_ORDER.indexOf(GEAR[id].rarity) >= RARITY_ORDER.indexOf(min) && RARITY_ORDER.indexOf(GEAR[id].rarity) <= RARITY_ORDER.indexOf(max));

/** Coins 5–40 (more at deeper tiers), sometimes a fruit or gear, and one time in twenty a secret. */
export function lootFor(room: Room, tier: Tier, rand: () => number): Loot {
  if (room.kind === "rest") return { coins: 0, fruits: [], gear: [], secret: false };
  if (room.kind === "secret") {
    const pool = gearOfRarity("rare", "legendary");
    return { coins: 10 + Math.floor(rand() * 11) * tier, fruits: [], gear: [pool[Math.floor(rand() * pool.length)]], secret: true };
  }
  const coins = Math.min(40, 5 + Math.floor(rand() * 11) + (tier - 1) * 8 + (room.kind === "foe" ? Math.floor(rand() * 6) : 0));
  const fruits: FruitId[] = rand() < 0.2 ? [rand() < 0.7 ? "sun" : "moon"] : [];
  const gear: GearId[] = [];
  if (rand() < 0.08 + tier * 0.03) {
    const pool = gearOfRarity("common", tier === 3 ? "epic" : tier === 2 ? "rare" : "uncommon");
    gear.push(pool[Math.floor(rand() * pool.length)]);
  }
  return { coins, fruits, gear, secret: rand() < 0.05 };
}

export const PARTY = { min: 2, max: 4, inviteRadius: 8, decideSeconds: 60 } as const;

export type JoinBlock = "too_far" | "full" | "level";

export function canJoinParty(who: { level: number; distance: number; size: number }, tier: Tier): { ok: true } | { ok: false; reason: JoinBlock } {
  if (who.size >= PARTY.max) return { ok: false, reason: "full" };
  if (who.distance > PARTY.inviteRadius) return { ok: false, reason: "too_far" };
  if (tierForLevel(who.level) < tier) return { ok: false, reason: "level" };
  return { ok: true };
}

/** Blights (§S8): a shared foe the whole company wears down for five days. */
export const BLIGHT = {
  hpPerActiveMember: 40,
  minHp: 80,
  windowDays: 5,
  /** Scheduled at random between these, in days, after the last one (or the ancient stage). */
  everyDays: [14, 28] as const,
  announceAheadDays: 2,
  rewardCoins: 20,
  damage: { kudos: 1, room: 2, raid_room: 10 } as const,
} as const;

export type BlightSource = keyof typeof BLIGHT.damage;

export function blightHp(activeMembers: number): number {
  return Math.max(BLIGHT.minHp, BLIGHT.hpPerActiveMember * activeMembers);
}

export function blightDamage(source: BlightSource): number {
  return BLIGHT.damage[source];
}
