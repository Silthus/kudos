/**
 * The desert RPG (#152 §S7): the pure rules behind expeditions into the ruins around the Ancient
 * Tree. Everything is deterministic from a seed and small integers, so a run stored as (seed,
 * rooms, choices) replays exactly, tests can prove the odds, and no rule pays anything that didn't
 * start as a kudos: stamina comes only from thoughtful giving and moon fruit, gear only from ruins
 * and the stall, and a fallen player simply returns to camp. Stats are derived, never stored.
 * A revoke never takes stamina back (a kudos once given was still an act of thanks, and revokes are
 * an admin's tool, not a player's). The bestiary is append-only: a creature is never removed or
 * renamed, so a stored foe id always resolves and a run in progress never changes under a party.
 *
 * Decisions recorded on #153: the deep ruins are meant for parties (a solo hero at the tier's level
 * mostly falls, three of them mostly clear); a foe's hit points grow with the party and it hits two
 * thirds of the standing party, so a party is a choice, not a cheat; heart is capped by level so a
 * veteran gardener still wants company; fruit is never used inside a fight (moon fruit restores
 * stamina at camp); coins and the rare secret are rolled once per run, rooms add only sun fruit and
 * gear, and a secret room's gear is found once per member per ruin; a puzzle takes one answer per
 * party per turn and fails after three wrong ones; a room unsettled after 30 turns is a retreat.
 */
import type { Rarity } from "./messages";
import { clampInt, whole } from "./numbers";
import { fnv1a, mulberry32 } from "./random";
import type { FruitId } from "./fruits";
import { rankOf, SKILL_TREE, type Allocation } from "./skills";
import { isRaidId, ruinTier, type RuinTier } from "./tree";
export type { RuinTier };

export type Stat = "might" | "wits" | "heart";

/** Stamina: the only cost of an expedition, restored only by qualifying kudos and moon fruit. */
export const STAMINA = { max: 5, cost: 1, perKudos: 1, perMoonFruit: 1 } as const;

const clampStamina = (n: number) => clampInt(n, 0, STAMINA.max);

/** One qualifying *message* (an act of thanks, however many it names) restores one stamina. */
export function staminaAfterKudos(stamina: number, k: { qualifyingLines: number }): number {
  return clampStamina(clampStamina(stamina) + (k.qualifyingLines > 0 ? STAMINA.perKudos : 0));
}

export function staminaAfterMoonFruit(stamina: number): number {
  return clampStamina(clampStamina(stamina) + STAMINA.perMoonFruit);
}

/** Ruin tiers open by level: near 6, far 10, deep 15 (0 = none yet). */
export function tierForLevel(level: number): 0 | RuinTier {
  const l = whole(level);
  return l >= 15 ? 3 : l >= 10 ? 2 : l >= 6 ? 1 : 0;
}

export type StartBlock = "level" | "stamina";

/** Whether a member may start (or join) an expedition of `tier`: the tier's level and one stamina. */
export function canStartExpedition(who: { level: number; stamina: number }, tier: RuinTier): { ok: true } | { ok: false; reason: StartBlock } {
  if (tierForLevel(who.level) < tier) return { ok: false, reason: "level" };
  if (clampStamina(who.stamina) < STAMINA.cost) return { ok: false, reason: "stamina" };
  return { ok: true };
}

export type GearSlot = "hat" | "tool" | "charm";
export type GearDef = { name: string; slot: GearSlot; stat: Stat; bonus: 1 | 2 | 3; rarity: Rarity; about: string };

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
} as const satisfies Record<string, GearDef>;

export type GearId = keyof typeof GEAR;
export const GEAR_IDS = Object.keys(GEAR) as GearId[];
/** What the stall sells, in Hog coins: the common pieces only; everything better is found in the ruins. */
export const STALL_GEAR: { id: GearId; price: number }[] = [
  { id: "dune_hat", price: 25 },
  { id: "brass_trowel", price: 25 },
  { id: "amber_charm", price: 25 },
];
/** What a member wears: at most one item per slot. */
export type Equipped = Partial<Record<GearSlot, GearId>>;

export function isGearId(id: string): id is GearId {
  return Object.hasOwn(GEAR, id);
}

/** The gear ids actually wearable from stored data: unknown ids and wrong slots are dropped. */
export function wearable(equipped: Partial<Record<string, string>> | undefined): Equipped {
  const out: Equipped = {};
  for (const slot of ["hat", "tool", "charm"] as const) {
    const id = equipped?.[slot];
    if (id && isGearId(id) && GEAR[id].slot === slot) out[slot] = id;
  }
  return out;
}

/** Skill points spent in the Scout and Herald branches (breadth and voice): the source of wits. */
export function scoutHeraldPoints(allocation: Allocation | undefined): number {
  return SKILL_TREE.filter((s) => s.branch === "scout" || s.branch === "herald").reduce((n, s) => n + rankOf(allocation, s.id) * s.cost, 0);
}

/** What a member brings to a ruin: derived from their game state, never stored. */
export type Adventurer = {
  id: string;
  level: number;
  /** From `scoutHeraldPoints(player.skills)`. */
  scoutHeraldPoints: number;
  /** Plants the member has grown to Young or older (memories included); capped by level in the stats. */
  plantsGrown: number;
  equipped: Equipped;
};

export type Stats = { might: number; wits: number; heart: number };

/** Level is might, breadth is wits, care is heart (never above level); each worn item adds to one stat. */
export function characterStats(a: Adventurer): Stats {
  const level = clampInt(a.level, 1, 25);
  const stats: Stats = { might: level, wits: clampInt(a.scoutHeraldPoints, 0, 40), heart: Math.min(level, clampInt(a.plantsGrown, 0, 999)) };
  for (const id of Object.values(wearable(a.equipped))) stats[GEAR[id].stat] += GEAR[id].bonus;
  return stats;
}

/** Hit points a member starts a ruin with, and the most healing can bring them to. */
export function startingHp(level: number): number {
  return 10 + Math.floor(clampInt(level, 1, 25) / 2);
}
export function maxHp(level: number): number {
  return startingHp(level) + 4;
}

export type CreatureId =
  | "sand_scarab"
  | "dune_wisp"
  | "blight_sprout"
  | "salt_hare"
  | "glass_scorpion"
  | "hollow_sentinel"
  | "thirst_shade"
  | "kiln_beetle"
  | "storm_djinn"
  | "root_wyrm"
  | "silent_choir"
  | "blight_heart";

export type Creature = { id: CreatureId; name: string; tier: RuinTier; hp: number; hit: number; weakness: Stat; about: string };

/** Twelve desert creatures, four per tier; the action matching a foe's weakness deals double. */
export const BESTIARY: Creature[] = [
  { id: "sand_scarab", name: "Sand scarab", tier: 1, hp: 16, hit: 2, weakness: "might", about: "Armoured, slow, and everywhere." },
  { id: "dune_wisp", name: "Dune wisp", tier: 1, hp: 12, hit: 2, weakness: "wits", about: "A trick of the heat with teeth." },
  { id: "blight_sprout", name: "Blight sprout", tier: 1, hp: 13, hit: 3, weakness: "heart", about: "Something that grew where nobody said thanks." },
  { id: "salt_hare", name: "Salt hare", tier: 1, hp: 11, hit: 2, weakness: "wits", about: "Faster than it looks." },
  { id: "glass_scorpion", name: "Glass scorpion", tier: 2, hp: 20, hit: 4, weakness: "might", about: "You see through it too late." },
  { id: "hollow_sentinel", name: "Hollow sentinel", tier: 2, hp: 24, hit: 3, weakness: "wits", about: "Still guarding a door that fell long ago." },
  { id: "thirst_shade", name: "Thirst shade", tier: 2, hp: 18, hit: 5, weakness: "heart", about: "It wants what you carry." },
  { id: "kiln_beetle", name: "Kiln beetle", tier: 2, hp: 22, hit: 4, weakness: "might", about: "Hot enough to bake bread on." },
  { id: "storm_djinn", name: "Storm djinn", tier: 3, hp: 34, hit: 5, weakness: "wits", about: "A whole sandstorm with a grudge." },
  { id: "root_wyrm", name: "Root wyrm", tier: 3, hp: 40, hit: 5, weakness: "might", about: "It chews on the roots of the world." },
  { id: "silent_choir", name: "Silent choir", tier: 3, hp: 30, hit: 6, weakness: "heart", about: "Everyone who was never thanked, singing." },
  { id: "blight_heart", name: "Blight heart", tier: 3, hp: 45, hit: 6, weakness: "heart", about: "The blight itself, cornered." },
];

const CREATURES = new Map(BESTIARY.map((c) => [c.id, c]));
/** The blight itself only appears in the raid; the ordinary deep ruins draw from the other three. */
const RAID_ONLY: CreatureId[] = ["blight_heart"];
/** What waits at the end of each tier's blight raid. */
export const RAID_BOSS: Record<RuinTier, CreatureId> = { 1: "blight_sprout", 2: "thirst_shade", 3: "blight_heart" };

export function creature(id: CreatureId): Creature {
  const c = CREATURES.get(id);
  if (!c) throw new Error(`Unknown creature ${id}`);
  return c;
}

/** A foe's hit points against a party of `standing` members: bigger parties face bigger foes. */
export function foeHpFor(id: CreatureId, standing: number): number {
  return Math.round((creature(id).hp * (Math.max(1, whole(standing)) + 1)) / 2);
}

/** How many members a foe hits in a turn: two thirds of the standing party, at least one. */
export function foeTargets(standing: number): number {
  return Math.max(1, Math.ceil((2 * Math.max(1, whole(standing))) / 3));
}

/** A puzzle asks something about the team's own, public kudos history; the caller checks the answer. */
export type PuzzleKind = "who_thanked" | "most_thanked_by" | "last_channel";
export const PUZZLES: PuzzleKind[] = ["who_thanked", "most_thanked_by", "last_channel"];
/** Wrong answers a party may give before the ruin turns them back; a puzzle offers at least this many options, so guessing can't clear it. */
export const PUZZLE_TRIES = 3;
export const PUZZLE_OPTIONS = 5;

export type Room =
  | { kind: "foe"; foe: CreatureId }
  | { kind: "puzzle"; puzzle: PuzzleKind; difficulty: number }
  | { kind: "secret"; lore: number }
  | { kind: "rest" };

export type Ruin = { id: string; tier: RuinTier; rooms: Room[] };

export const RUIN = { minRooms: 3, maxRooms: 6, lores: 12 } as const;

/**
 * A ruin's rooms from (seed, ruin id): 3–6 rooms (deeper tiers run longer), at most one secret,
 * always a foe at the end; the blight raid (`raid:<tier>`) is the same shape and ends on its
 * tier's `RAID_BOSS`. The same ruin reads the same for every party that
 * enters it on the same seed, so a workspace's ruins are landmarks, not lotteries. Callers store
 * the rooms on the expedition, so a later bestiary change never alters a run in progress.
 */
export function generateRuin(seed: number, ruinId: string): Ruin {
  const tier = ruinTier(ruinId);
  if (!tier) throw new Error(`Not a ruin id: ${ruinId}`);
  const rand = mulberry32(fnv1a(`${seed >>> 0}:${ruinId}`));
  const foes = BESTIARY.filter((c) => c.tier === tier && !RAID_ONLY.includes(c.id));
  const pick = () => foes[Math.floor(rand() * foes.length)].id;
  const span = { 1: 3, 2: 4, 3: 3 }[tier];
  const count = Math.min(RUIN.maxRooms, (tier === 3 ? 4 : RUIN.minRooms) + Math.floor(rand() * span));
  const rooms: Room[] = [];
  let secret = false;
  while (rooms.length < count - 1) {
    const roll = rand();
    if (!secret && roll < 0.12) {
      secret = true;
      rooms.push({ kind: "secret", lore: Math.floor(rand() * RUIN.lores) });
    } else if (roll < 0.32) rooms.push({ kind: "puzzle", puzzle: PUZZLES[Math.floor(rand() * PUZZLES.length)], difficulty: 2 + tier * 2 + Math.floor(rand() * 2) });
    else if (roll < 0.45) rooms.push({ kind: "rest" });
    else rooms.push({ kind: "foe", foe: pick() });
  }
  rooms.push({ kind: "foe", foe: isRaidId(ruinId) ? RAID_BOSS[tier] : pick() });
  return { id: ruinId, tier, rooms };
}

/** Strike is might, outwit is wits, calm is heart; rally heals; answer settles a puzzle. */
export type Choice = { kind: "strike" } | { kind: "outwit" } | { kind: "calm" } | { kind: "rally" } | { kind: "answer"; correct: boolean };

export const ATTACKS: Record<"strike" | "outwit" | "calm", Stat> = { strike: "might", outwit: "wits", calm: "heart" };

/** One member's state inside a room. */
export type Fighter = Adventurer & { hp: number };

export type Encounter = {
  room: Room;
  foeHp: number;
  party: Fighter[];
  turn: number;
  /** Wrong puzzle answers so far. */
  wrong: number;
  log: string[];
  done: null | "cleared" | "fallen" | "retreated";
};

/** A room that isn't settled by then ends in a retreat to camp, so nothing can stall forever. */
export const MAX_TURNS = 30;
const REST_HEAL = 4;
const RALLY_HEAL = 2;

const standingOf = (party: Fighter[]) => party.filter((p) => p.hp > 0);

/** The random source for one turn of a run, so stateless mutations never repeat a draw. */
export function turnRand(runSeed: number, roomIndex: number, turn: number): () => number {
  return mulberry32(fnv1a(`turn:${runSeed >>> 0}:${roomIndex}:${turn}`));
}

/** The random source for one member's loot in one room (or the run, with room index −1). */
export function lootRand(runSeed: number, memberId: string, roomIndex: number): () => number {
  return mulberry32(fnv1a(`loot:${runSeed >>> 0}:${memberId}:${roomIndex}`));
}

/** A room begins: duplicate ids are dropped, a rest heals everyone on entry, the foe sizes up the standing party. */
export function startEncounter(room: Room, party: Fighter[]): Encounter {
  const seen = new Set<string>();
  const members = party
    .filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)))
    .map((f) => ({ ...f, hp: clampInt(f.hp, 0, maxHp(f.level)) }));
  const standing = standingOf(members).length;
  const log: string[] = [];
  if (room.kind === "rest") {
    for (const p of standingOf(members)) p.hp = Math.min(maxHp(p.level), p.hp + REST_HEAL);
    log.push("The party rests.");
  }
  return { room, foeHp: room.kind === "foe" ? foeHpFor(room.foe, standing) : 0, party: members, turn: 0, wrong: 0, log, done: null };
}

/** Whether `wits` is enough to see the puzzle's hint (the caller shows it); the answer is still the player's. */
export function puzzleHint(wits: number, difficulty: number): boolean {
  return wits >= difficulty;
}

/**
 * One turn: every member who chose acts (a member without a choice waits, so nobody stalls the
 * party), then the foe hits two thirds of the standing party. Small integers; the action matching
 * a foe's weakness deals double. A puzzle takes the first standing member's answer only. The room
 * ends when the foe falls, every member has fallen, a puzzle is answered (or failed three times),
 * or the turn cap is reached. Rest and secret rooms clear at once. Never mutates its input.
 */
export function resolveTurn(e: Encounter, choices: Record<string, Choice>, rand: () => number): Encounter {
  if (e.done) return e;
  const party = e.party.map((m) => ({ ...m, hp: clampInt(m.hp, 0, maxHp(m.level)) }));
  const log: string[] = [];
  let foeHp = e.foeHp;
  let wrong = e.wrong;
  const foe = e.room.kind === "foe" ? creature(e.room.foe) : null;
  const finish = (done: Encounter["done"], ...tail: string[]): Encounter => ({ ...e, party, foeHp, wrong, log: [...e.log, ...log, ...tail], turn: e.turn + 1, done });

  if (standingOf(party).length === 0) return finish("fallen");
  if (e.room.kind === "rest" || e.room.kind === "secret") return finish("cleared", e.room.kind === "rest" ? "Rested, the party moves on." : "A hidden room. Something glints.");

  if (e.room.kind === "puzzle") {
    const answerer = standingOf(party).find((m) => choices[m.id]?.kind === "answer");
    const answer = answerer ? (choices[answerer.id] as Extract<Choice, { kind: "answer" }>) : null;
    if (answerer && answer) {
      if (answer.correct) return finish("cleared", `${answerer.id} answers the ${e.room.puzzle.replace(/_/g, " ")} puzzle.`);
      wrong++;
      answerer.hp = Math.max(0, answerer.hp - 1);
      log.push(`${answerer.id} answers wrong and loses a little time.`);
      if (wrong >= PUZZLE_TRIES) return finish("retreated", "The ruin's riddle stays shut. The party turns back.");
    }
    if (standingOf(party).length === 0) return finish("fallen");
    if (e.turn + 1 >= MAX_TURNS) return finish("retreated", "The party retreats to camp.");
    return finish(null);
  }

  for (const m of party) {
    const choice = choices[m.id];
    if (!choice || m.hp <= 0 || choice.kind === "answer") continue;
    const s = characterStats(m);
    if (choice.kind === "rally") {
      const heal = RALLY_HEAL + Math.floor(s.heart / 4);
      for (const p of standingOf(party)) p.hp = Math.min(maxHp(p.level), p.hp + heal);
      log.push(`${m.id} rallies the party: everyone heals ${heal}.`);
      continue;
    }
    if (!foe || !(choice.kind in ATTACKS)) continue;
    const stat = ATTACKS[choice.kind];
    const dealt = s[stat] * (foe.weakness === stat ? 2 : 1);
    foeHp = Math.max(0, foeHp - dealt);
    log.push(`${m.id} ${choice.kind === "strike" ? "strikes" : choice.kind === "outwit" ? "outwits" : "calms"} the ${foe.name} for ${dealt}.`);
  }

  if (foe && foeHp <= 0) return finish("cleared", `The ${foe.name} falls.`);
  if (foe) {
    const targets = standingOf(party);
    const hits = foeTargets(targets.length);
    for (let n = 0; n < hits && targets.length > 0; n++) {
      const target = targets.splice(Math.floor(rand() * targets.length), 1)[0];
      const hit = foe.hit + (rand() < 0.25 ? 1 : 0);
      target.hp = Math.max(0, target.hp - hit);
      log.push(`The ${foe.name} hits ${target.id} for ${hit}.${target.hp <= 0 ? ` ${target.id} falls and returns to camp.` : ""}`);
    }
  }
  if (standingOf(party).length === 0) return finish("fallen");
  if (e.turn + 1 >= MAX_TURNS) return finish("retreated", "The party retreats to camp.");
  return finish(null);
}

/** Who is paid: a member standing when the room clears gets its room loot; a member standing at the end of the run gets run loot. */
export function paidFor(e: Encounter): Fighter[] {
  return e.done === "cleared" ? standingOf(e.party) : [];
}

export type RoomLoot = { fruits: FruitId[]; gear: GearId[]; lore: number | null };
export type RunLoot = { coins: number; secret: { lore: number } | null };

const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const gearBetween = (min: Rarity, max: Rarity): GearId[] =>
  GEAR_IDS.filter((id) => RARITY_ORDER.indexOf(GEAR[id].rarity) >= RARITY_ORDER.indexOf(min) && RARITY_ORDER.indexOf(GEAR[id].rarity) <= RARITY_ORDER.indexOf(max));
const TIER_TOP_RARITY: Record<RuinTier, Rarity> = { 1: "uncommon", 2: "rare", 3: "epic" };
const SECRET_TOP_RARITY: Record<RuinTier, Rarity> = { 1: "rare", 2: "epic", 3: "legendary" };

/**
 * What a cleared room adds for one member: sometimes a sun fruit, sometimes gear (rarer at deeper
 * tiers). A secret room gives its lore card and a rare-or-better item, but only the first time
 * this member finds it (`secretFound`), so a known ruin can't be farmed.
 */
export function roomLoot(room: Room, tier: RuinTier, rand: () => number, opts: { secretFound?: boolean } = {}): RoomLoot {
  if (room.kind === "rest") return { fruits: [], gear: [], lore: null };
  if (room.kind === "secret") {
    if (opts.secretFound) return { fruits: [], gear: [], lore: null };
    const pool = gearBetween("rare", SECRET_TOP_RARITY[tier]);
    return { fruits: [], gear: [pool[Math.floor(rand() * pool.length)]], lore: room.lore };
  }
  const fruits: FruitId[] = rand() < 0.2 ? ["sun"] : [];
  const gear: GearId[] = [];
  if (rand() < 0.06 + tier * 0.02) {
    const pool = gearBetween("common", TIER_TOP_RARITY[tier]);
    gear.push(pool[Math.floor(rand() * pool.length)]);
  }
  return { fruits, gear, lore: null };
}

const RUN_COINS: Record<RuinTier, [number, number]> = { 1: [5, 15], 2: [12, 28], 3: [20, 40] };
export const SECRET_CHANCE = 0.05;

/** Rolled once per cleared run, per member: coins by tier, and one time in twenty a secret lore card. */
export function runLoot(tier: RuinTier, rand: () => number): RunLoot {
  const [lo, hi] = RUN_COINS[tier];
  return { coins: lo + Math.floor(rand() * (hi - lo + 1)), secret: rand() < SECRET_CHANCE ? { lore: Math.floor(rand() * RUIN.lores) } : null };
}

export const PARTY = { max: 4, inviteRadius: 8, decideSeconds: 60 } as const;

export type JoinBlock = "too_far" | "full" | StartBlock;

/** Whether a member may join a forming party: within reach, room left, and able to start the tier. */
export function canJoinParty(who: { level: number; stamina: number; distance: number; size: number }, tier: RuinTier): { ok: true } | { ok: false; reason: JoinBlock } {
  if (who.size >= PARTY.max) return { ok: false, reason: "full" };
  if (who.distance > PARTY.inviteRadius) return { ok: false, reason: "too_far" };
  return canStartExpedition(who, tier);
}
