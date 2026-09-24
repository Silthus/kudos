/**
 * The skill tree: the pure rules of #55 §G7. A player earns one skill point per level-up (24 by
 * level 25) and spends them on a tree worth 38, so no tree is ever complete and each is a choice.
 * Tier 1 is open from the start; tier 2 opens at level 5, tier 3 at 10 and the capstones at 20.
 * A skill needs its parent. A reset returns every point and costs Hog coins, more each time.
 *
 * The rule for every skill: it's an ability or a nudge toward *breadth*, never a multiplier of XP
 * from volume. XP bonuses only ever grow a bonus that is itself about breadth (a new connection,
 * a rekindle), and the daily XP cap still applies.
 *
 * The tree is data (`SKILL_TREE`). A skill whose system hasn't shipped yet names the ticket it
 * arrives with (`arrives`) and can't be taken until that ticket removes the field and implements
 * the effect behind `rankOf`/`hasSkill` (or a lookup like `scoutEffects`).
 */
import { REKINDLE_GAP_MS } from "./quests";
import { XP, type ScoutEffects } from "./xp";

export type BranchId = "gardener" | "herald" | "scout" | "neighbour";
export type Tier = 1 | 2 | 3 | 4;

/** The level each tier opens at. Tier 4 holds the capstones. */
export const TIER_LEVEL: Record<Tier, number> = { 1: 1, 2: 5, 3: 10, 4: 20 };

export const BRANCHES: { id: BranchId; name: string; about: string }[] = [
  { id: "gardener", name: "Gardener", about: "Your garden: more plots, faster early growth, rarer plants." },
  { id: "herald", name: "Herald", about: "The kudos you send: Super kudos, emoji variants, a spotlight." },
  { id: "scout", name: "Scout", about: "Breadth: new connections, rekindled ones, and who you haven't thanked in a while." },
  { id: "neighbour", name: "Neighbour", about: "The team: the team garden, newcomers and bonus days." },
];

const DAY_MS = 24 * 3_600_000;

/** Pathfinder: more new-connection XP per rank. Rekindler: more rekindle XP per rank. */
export const SCOUT = {
  newConnectionPerRank: 5,
  rekindlePerRank: 5,
  /** Trailblazer: a rekindle after this long earns at least the new-connection bonus. */
  relinkAfterMs: 90 * DAY_MS,
  /** Lookout: a teammate you've thanked counts as "a while ago" after the rekindle gap. */
  quietAfterMs: REKINDLE_GAP_MS,
} as const;

type SkillSpec = {
  branch: BranchId;
  tier: Tier;
  name: string;
  /** What it does, one line; `perRank` says what each rank adds when there is more than one. */
  effect: string;
  perRank?: string;
  ranks: number;
  /** Points per rank. */
  cost: number;
  /** Another skill's id in the same branch (checked by the tests). */
  parent?: string;
  /** The ticket whose system makes this skill work; until then it's shown but can't be taken. */
  arrives?: { ticket: number; with: string };
};

const SPREES = { ticket: 94, with: "Kudos sprees" };
const SUPER = { ticket: 98, with: "Super kudos" };
const TEAM = { ticket: 96, with: "the team garden and bonus days" };

const TREE = {
  // Gardener: your garden (live, lib/garden.ts).
  more_plots: { branch: "gardener", tier: 1, name: "More plots", effect: "A second and third plot in your garden.", perRank: "One more plot.", ranks: 2, cost: 1 },
  early_bloom: { branch: "gardener", tier: 2, name: "Early bloom", effect: "Your seeds sprout without a watering, and the first watering makes a Sapling.", ranks: 1, cost: 1, parent: "more_plots" },
  plant_picker: { branch: "gardener", tier: 2, name: "Plant picker", effect: "Choose the species you plant, like a Helpful oak.", ranks: 1, cost: 1, parent: "more_plots" },
  wide_beds: { branch: "gardener", tier: 3, name: "Wide beds", effect: "A fourth and fifth plot.", perRank: "One more plot.", ranks: 2, cost: 1, parent: "more_plots" },
  rare_species: { branch: "gardener", tier: 3, name: "Rare species", effect: "Rare species join the plant picker.", ranks: 1, cost: 1, parent: "plant_picker" },
  good_harvest: { branch: "gardener", tier: 3, name: "Good harvest", effect: "Each plant holds four fruit instead of three.", ranks: 1, cost: 1, parent: "early_bloom" },
  orchard: { branch: "gardener", tier: 4, name: "Orchard", effect: "A sixth plot: the biggest garden there is.", ranks: 1, cost: 3, parent: "wide_beds" },

  // Herald: the kudos you send (#97, #98).
  emoji_variants: { branch: "herald", tier: 1, name: "Signature emoji", effect: "Extra kudos-emoji variants to give with.", perRank: "One more variant.", ranks: 2, cost: 1, arrives: SUPER },
  charm_discount: { branch: "herald", tier: 2, name: "Charm maker", effect: "Lucky charms cost 3 Hog coins less in the Store per rank: 12, then 9, then 6.", perRank: "3 Hog coins off a Lucky charm.", ranks: 2, cost: 1 },
  super_kudos: { branch: "herald", tier: 2, name: "Super kudos", effect: "One Super kudos a month: a unique celebration for them and a golden leaf on your plant for them.", ranks: 1, cost: 1, parent: "emoji_variants", arrives: SUPER },
  encore: { branch: "herald", tier: 3, name: "Encore", effect: "A second Super kudos each month.", ranks: 1, cost: 1, parent: "super_kudos", arrives: SUPER },
  spotlight: { branch: "herald", tier: 4, name: "Spotlight", effect: "Your Super kudos are featured in the announcement channel.", ranks: 1, cost: 3, parent: "encore", arrives: SUPER },

  // Scout: breadth (live).
  pathfinder: { branch: "scout", tier: 1, name: "Pathfinder", effect: "A bigger new-connection bonus: +5 XP per rank on top of the 10.", perRank: "+5 XP for a new connection.", ranks: 2, cost: 1 },
  lookout: { branch: "scout", tier: 1, name: "Lookout", effect: "A private list of teammates you haven't thanked in 30 days or more.", ranks: 1, cost: 1 },
  rekindler: { branch: "scout", tier: 2, name: "Rekindler", effect: "A bigger rekindle bonus: +5 XP per rank on top of the 5.", perRank: "+5 XP for a rekindle.", ranks: 2, cost: 1, parent: "lookout" },
  wanderer: { branch: "scout", tier: 2, name: "Wanderer", effect: "+2 spree joins a month.", ranks: 1, cost: 1, parent: "pathfinder", arrives: SPREES },
  wide_net: { branch: "scout", tier: 3, name: "Wide net", effect: "Lookout also suggests teammates you've never thanked.", ranks: 1, cost: 1, parent: "lookout" },
  trailblazer: { branch: "scout", tier: 4, name: "Trailblazer", effect: "Thanking a teammate after 90 days or more earns at least the new-connection bonus.", ranks: 1, cost: 3, parent: "rekindler" },

  // Neighbour: the team (#96).
  good_neighbour: { branch: "neighbour", tier: 1, name: "Good neighbour", effect: "A bigger share in the team garden.", perRank: "A bigger share.", ranks: 3, cost: 1, arrives: TEAM },
  mentor: { branch: "neighbour", tier: 2, name: "Mentor", effect: "See the newcomers who haven't been thanked yet, and welcome them.", ranks: 1, cost: 1, parent: "good_neighbour", arrives: TEAM },
  welcome_wagon: { branch: "neighbour", tier: 3, name: "Welcome wagon", effect: "Your first thoughtful kudos to a newcomer rolls their message at Uncommon or better.", ranks: 1, cost: 1, parent: "mentor", arrives: TEAM },
  block_party: { branch: "neighbour", tier: 4, name: "Block party", effect: "Call a workspace bonus day once a quarter.", ranks: 1, cost: 3, parent: "good_neighbour", arrives: TEAM },
} satisfies Record<string, SkillSpec>;

export type SkillId = keyof typeof TREE;
export type Skill = Omit<SkillSpec, "parent"> & { id: SkillId; parent?: SkillId };

/** The tree in display order: branch by branch, tier by tier. */
export const SKILL_TREE: Skill[] = Object.entries(TREE).map(([id, s]) => ({ ...(s as SkillSpec), id: id as SkillId, parent: (s as SkillSpec).parent as SkillId | undefined }));
export const SKILLS = Object.fromEntries(SKILL_TREE.map((s) => [s.id, s])) as Record<SkillId, Skill>;

export function isSkillId(id: string): id is SkillId {
  return Object.hasOwn(TREE, id);
}

/** A player's skills: the rank taken of each (absent = 0). Stored on `players.skills`. */
export type Allocation = Partial<Record<SkillId, number>>;

export function rankOf(allocation: Allocation | undefined, id: SkillId): number {
  return allocation?.[id] ?? 0;
}

export function hasSkill(allocation: Allocation | undefined, id: SkillId): boolean {
  return rankOf(allocation, id) > 0;
}

/** One point per level-up: level 25 has 24. */
export function pointsOf(allocation: Allocation | undefined, level: number, tree: Skill[] = SKILL_TREE) {
  const earned = Math.max(0, level - 1);
  const spent = tree.reduce((sum, s) => sum + rankOf(allocation, s.id) * s.cost, 0);
  return { earned, spent, available: earned - spent };
}

export type TakeBlock = "unknown" | "arrives" | "maxed" | "tier" | "parent" | "points";

/** Whether one more rank of `id` can be taken, and if not, the first reason why. */
export function canTake(allocation: Allocation, level: number, id: SkillId, tree: Skill[] = SKILL_TREE): { ok: true } | { ok: false; reason: TakeBlock } {
  const skill = tree.find((s) => s.id === id);
  if (!skill) return { ok: false, reason: "unknown" };
  if (skill.arrives) return { ok: false, reason: "arrives" };
  if (rankOf(allocation, id) >= skill.ranks) return { ok: false, reason: "maxed" };
  if (level < TIER_LEVEL[skill.tier]) return { ok: false, reason: "tier" };
  if (skill.parent && !hasSkill(allocation, skill.parent)) return { ok: false, reason: "parent" };
  if (pointsOf(allocation, level, tree).available < skill.cost) return { ok: false, reason: "points" };
  return { ok: true };
}

/** Why a skill can't be taken, in words (the same on the web and in errors). */
export function takeBlockText(skill: Skill, reason: TakeBlock, available: number): string {
  switch (reason) {
    case "unknown":
      return "There's no such skill.";
    case "arrives":
      return `${skill.name} arrives with ${skill.arrives?.with ?? "a later update"}.`;
    case "maxed":
      return `You have every rank of ${skill.name}.`;
    case "tier":
      return `${skill.name} opens at level ${TIER_LEVEL[skill.tier]}.`;
    case "parent":
      return `${skill.name} needs ${skill.parent ? SKILLS[skill.parent].name : "its parent"} first.`;
    case "points":
      return `${skill.name} needs ${skill.cost} skill ${skill.cost === 1 ? "point" : "points"}; you have ${available}.`;
  }
}

/** Every rank known and within its maximum, every tier reached, every parent taken, no overspend. */
export function validAllocation(allocation: Allocation, level: number, tree: Skill[] = SKILL_TREE): boolean {
  for (const [id, rank = 0] of Object.entries(allocation)) {
    const skill = tree.find((s) => s.id === id);
    if (!skill || !Number.isInteger(rank) || rank < 0 || rank > skill.ranks) return false;
    if (rank === 0) continue;
    if (skill.arrives) return false;
    if (level < TIER_LEVEL[skill.tier]) return false;
    if (skill.parent && !hasSkill(allocation, skill.parent)) return false;
  }
  return pointsOf(allocation, level, tree).available >= 0;
}

/** Hog coins for a reset after `resets` earlier ones: 50, 100, 200, 400, then 200 more each time. */
export function resetCost(resets: number): number {
  return resets < 4 ? 50 * 2 ** resets : 400 + 200 * (resets - 3);
}

/** The Scout branch's XP effects, as `scoreGive` takes them. */
export function scoutEffects(allocation: Allocation | undefined): ScoutEffects {
  return {
    newConnection: XP.newConnection + SCOUT.newConnectionPerRank * rankOf(allocation, "pathfinder"),
    rekindle: XP.rekindle + SCOUT.rekindlePerRank * rankOf(allocation, "rekindler"),
    relinkAfterMs: hasSkill(allocation, "trailblazer") ? SCOUT.relinkAfterMs : null,
  };
}
