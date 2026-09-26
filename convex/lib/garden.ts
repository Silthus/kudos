/**
 * Gardens: the pure rules of #55 §G8. A member's garden holds plants, each grown for one teammate.
 * A plant is *watered* by the first qualifying kudos (lib/quests.ts `hasNote` + no thank-back) from
 * its owner to its teammate in each quest week after the week it was planted, and grows through the
 * stages by waterings *and* a minimum age. Everything is computed lazily from day keys: no cron.
 *
 * Waterings are never stored. They follow from the surviving kudos rows (`wateringDays`), so a
 * revoke takes its watering back and a replay can't disagree with the live path. The age that
 * counts is the time the plant was awake: after 60 days without a watering it is *dormant*
 * (autumn-coloured, no fruit, no growth) until the next watering wakes it. Plants never die.
 *
 * Fruit: a Grown or older plant watered in the last 14 days grows one fruit a day, worth 1 or 2 Hog
 * coins (seeded by plant and day). It holds at most 3 (Good harvest: 4) and then stops growing more;
 * nothing rots. Picking pays at most 14 coins and 21 XP a quest week; fruit over the cap stays.
 */
import { fruitEffect } from "./fruits";
import { hasNote, RECIPROCAL_WINDOW_MS, weekKeyOfDay } from "./quests";
import { fnv1a } from "./random";
import { hasSkill, rankOf, type Allocation } from "./skills";
import { addDays, daysBetween } from "./time";

/** The garden opens at this level (the `garden` game area) with one plot. */
export const GARDEN_LEVEL = 3;
/** Hog coins a plant costs (plus a qualifying kudos to its teammate). */
export const PLANT_COST = 10;
/** A qualifying kudos to them in this many days lets you plant for them. */
export const PLANT_WINDOW_DAYS = 7;
export const MAX_PLOTS = 6;
/** Days without a watering until a plant is dormant; also the most one gap adds to its age. */
export const DORMANT_AFTER_DAYS = 60;

export const FRUIT = {
  /** A plant fruits while its last watering is at most this many days old (the day itself included). */
  wateredWithinDays: 14,
  /** Fruit a plant holds before it stops growing more (Good harvest: one more). */
  hold: 3,
  xpPerFruit: 3,
  weeklyCoins: 14,
  weeklyXp: 21,
} as const;

export type StageKey = "seed" | "sprout" | "sapling" | "young" | "grown" | "blossoming" | "ancient";
export type Stage = { key: StageKey; name: string; index: number; waterings: number; days: number };

const STAGE_LIST: Omit<Stage, "index">[] = [
  { key: "seed", name: "Seed", waterings: 0, days: 0 },
  { key: "sprout", name: "Sprout", waterings: 1, days: 3 },
  { key: "sapling", name: "Sapling", waterings: 2, days: 7 },
  { key: "young", name: "Young", waterings: 4, days: 21 },
  { key: "grown", name: "Grown", waterings: 6, days: 45 },
  { key: "blossoming", name: "Blossoming", waterings: 10, days: 90 },
  { key: "ancient", name: "Ancient", waterings: 20, days: 365 },
];
export const STAGES: Stage[] = STAGE_LIST.map((s, index) => ({ ...s, index }));
export const GROWN = STAGES.findIndex((s) => s.key === "grown");

/** Early bloom (Gardener): a seed sprouts without a watering, and the first watering makes a Sapling. */
function stagesFor(earlyBloom: boolean): Stage[] {
  if (!earlyBloom) return STAGES;
  return STAGES.map((s) => (s.key === "sprout" ? { ...s, waterings: 0 } : s.key === "sapling" ? { ...s, waterings: 1 } : s));
}

export type SpeciesId =
  | "helpful_oak"
  | "patient_pine"
  | "kind_maple"
  | "steady_birch"
  | "bright_sunflower"
  | "curious_fern"
  | "generous_cherry"
  | "wise_ginkgo"
  | "brave_cedar"
  | "golden_willow";

export const SPECIES: Record<SpeciesId, { name: string; rare: boolean }> = {
  helpful_oak: { name: "Helpful oak", rare: false },
  patient_pine: { name: "Patient pine", rare: false },
  kind_maple: { name: "Kind maple", rare: false },
  steady_birch: { name: "Steady birch", rare: false },
  bright_sunflower: { name: "Bright sunflower", rare: false },
  curious_fern: { name: "Curious fern", rare: false },
  generous_cherry: { name: "Generous cherry", rare: true },
  wise_ginkgo: { name: "Wise ginkgo", rare: true },
  brave_cedar: { name: "Brave cedar", rare: true },
  golden_willow: { name: "Golden willow", rare: true },
};

const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[];
const COMMON = SPECIES_IDS.filter((s) => !SPECIES[s].rare);

export function isSpeciesId(id: string): id is SpeciesId {
  return Object.hasOwn(SPECIES, id);
}

/** The species a member may choose (Plant picker; Rare species adds the rare ones). None: it's picked for them. */
export function speciesChoices(skills: Allocation): SpeciesId[] {
  if (!hasSkill(skills, "plant_picker")) return [];
  return hasSkill(skills, "rare_species") ? SPECIES_IDS : COMMON;
}

/** Without the plant picker, a common species seeded by the plant's owner, teammate and day. */
export function defaultSpecies(seed: string): SpeciesId {
  return COMMON[fnv1a(seed) % COMMON.length];
}

/** Plots: one, More plots (2nd, 3rd), Wide beds (4th, 5th) and Orchard (6th). */
export function plotsFor(skills: Allocation): number {
  return Math.min(MAX_PLOTS, 1 + rankOf(skills, "more_plots") + rankOf(skills, "wide_beds") + rankOf(skills, "orchard"));
}

/**
 * Which plot (key bed on the map, #129) each growing plant stands in, in the plants' order: its own
 * `plot` while that's free, else the lowest free one (plants from before plots were kept, or a clash).
 */
export function assignPlots(plants: { plot?: number }[]): number[] {
  const taken = new Set<number>();
  const kept = plants.map((p) => (p.plot !== undefined && !taken.has(p.plot) ? (taken.add(p.plot), p.plot) : null));
  let next = 0;
  return kept.map((plot) => {
    if (plot !== null) return plot;
    while (taken.has(next)) next++;
    taken.add(next);
    return next;
  });
}

/** The plot a new plant goes in: the lowest one no growing plant stands in. */
export function freePlot(plants: { plot?: number }[]): number {
  const taken = new Set(assignPlots(plants));
  let plot = 0;
  while (taken.has(plot)) plot++;
  return plot;
}

/** Fruit one plant holds (Good harvest: one more). */
export function holdFor(skills: Allocation): number {
  return FRUIT.hold + (hasSkill(skills, "good_harvest") ? 1 : 0);
}

type Pause = { from: number; until?: number };

/**
 * The days a plant was watered: of the owner's kudos to its teammate (`given`, any order), the first
 * qualifying one in each quest week after the planting week, given after planting and not while the
 * game was paused. `receivedAt`: the teammate's kudos to the owner, for the thank-back rule.
 */
export function wateringDays(input: {
  plantedAt: number;
  plantedDay: string;
  given: { at: number; dayKey: string; noteWords?: number }[];
  receivedAt: number[];
  pauses?: Pause[];
}): string[] {
  const plantedWeek = weekKeyOfDay(input.plantedDay);
  const paused = (at: number) => (input.pauses ?? []).some((p) => p.from <= at && (p.until === undefined || at < p.until));
  const back = [...input.receivedAt].sort((a, b) => a - b);
  // Their latest kudos before `at` (binary search): a thank-back if it's within 72 h.
  const thankBack = (at: number) => {
    let lo = 0;
    let hi = back.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (back[mid] < at) lo = mid + 1;
      else hi = mid;
    }
    return lo > 0 && back[lo - 1] > at - RECIPROCAL_WINDOW_MS;
  };
  const byWeek = new Map<string, string>();
  for (const k of [...input.given].sort((a, b) => a.at - b.at)) {
    const week = weekKeyOfDay(k.dayKey);
    if (k.at <= input.plantedAt || week <= plantedWeek || byWeek.has(week)) continue;
    if (!hasNote(k.noteWords) || thankBack(k.at) || paused(k.at)) continue;
    byWeek.set(week, k.dayKey);
  }
  return [...byWeek.values()].sort();
}

/** Days the plant was awake by `day`: each gap between waterings adds at most 60 (a dormant spell doesn't count). */
function awakeDays(plantedDay: string, waterings: string[], day: string): number {
  let age = 0;
  let prev = plantedDay;
  for (const w of waterings) {
    if (w > day) break;
    age += Math.min(Math.max(0, daysBetween(prev, w)), DORMANT_AFTER_DAYS);
    prev = w;
  }
  return age + Math.min(Math.max(0, daysBetween(prev, day)), DORMANT_AFTER_DAYS);
}

/** A Sunlamp (#97, §G10) skips this many days of a plant's minimum-age wait; it never replaces a watering. */
export const SUNLAMP_DAYS = 5;

/**
 * `sunlamps`: the days Sunlamps were used on the plant; each counts from its day on. `superSeed`: it
 * grew from a heart fruit's Super seed (#157), so it is a Sapling from the day it was planted.
 */
type Growth = { plantedDay: string; waterings: string[]; earlyBloom?: boolean; sunlamps?: string[]; superSeed?: boolean };

/** Where a Super seed starts: the heart fruit's `plantStage` (lib/fruits.ts). */
const HEART = fruitEffect("heart");
const SUPER_SEED_STAGE = STAGES.find((s) => HEART.kind === "superSeed" && s.key === HEART.plantStage)!;

/** The age a plant's Sunlamps add by `day`. */
function lampDays(sunlamps: string[] | undefined, day: string): number {
  return SUNLAMP_DAYS * (sunlamps ?? []).filter((d) => d <= day).length;
}

/** The stage a plant is at on `day` (its waterings sorted ascending). */
export function stageOn(input: Growth & { day: string }): Stage {
  const watered = input.waterings.filter((w) => w <= input.day).length;
  const age = awakeDays(input.plantedDay, input.waterings, input.day) + lampDays(input.sunlamps, input.day);
  const stages = stagesFor(Boolean(input.earlyBloom));
  let reached = stages[0];
  for (const s of stages) if (watered >= s.waterings && age >= s.days) reached = s;
  return STAGES[Math.max(reached.index, input.superSeed ? SUPER_SEED_STAGE.index : 0)];
}

function lastWateringBy(waterings: string[], day: string): string | null {
  let last: string | null = null;
  for (const w of waterings) if (w <= day) last = w;
  return last;
}

export type PlantState = {
  stage: Stage;
  waterings: number;
  lastWatered: string | null;
  /** 60+ days since the last watering (or planting): autumn, no fruit, no growth. */
  dormant: boolean;
  /** Grown or older and watered in the last 14 days. */
  fruiting: boolean;
  awakeDays: number;
  /** What the next stage needs (for its early-bloom-adjusted numbers); null at Ancient. */
  next: { key: StageKey; name: string; waterings: number; days: number } | null;
  /** The day the next stage is reached without another watering; null if it needs one. */
  nextOn: string | null;
};

export function plantState(input: Growth & { today: string }): PlantState {
  const { plantedDay, waterings, today } = input;
  const stage = stageOn({ ...input, day: today });
  const lastWatered = lastWateringBy(waterings, today);
  const lastPoint = lastWatered ?? plantedDay;
  const watered = waterings.filter((w) => w <= today).length;
  const nextStage = stagesFor(Boolean(input.earlyBloom))[stage.index + 1] ?? null;
  let nextOn: string | null = null;
  if (nextStage && watered >= nextStage.waterings) {
    // Awake days count until 60 days after the last watering: reached then or never.
    const base = awakeDays(plantedDay, waterings, lastPoint) + lampDays(input.sunlamps, today);
    const need = nextStage.days - base;
    if (need <= DORMANT_AFTER_DAYS) nextOn = addDays(lastPoint, Math.max(need, daysBetween(lastPoint, today)));
  }
  return {
    stage,
    waterings: watered,
    lastWatered,
    dormant: daysBetween(lastPoint, today) >= DORMANT_AFTER_DAYS,
    fruiting: fruitsOn({ ...input, day: today }),
    awakeDays: awakeDays(plantedDay, waterings, today) + lampDays(input.sunlamps, today), // the age that counts, Sunlamps included
    next: nextStage && { key: nextStage.key, name: nextStage.name, waterings: nextStage.waterings, days: nextStage.days },
    nextOn,
  };
}

/** A Lantern (#97, §G10): a one-line note on a teammate's plant that glows this many days. */
export const LANTERN = { days: 7, maxChars: 80 } as const;

/** Whether a lantern hung on `dayKey` still glows on `today`. */
export function lanternLit(lantern: { dayKey: string } | undefined, today: string): boolean {
  return lantern !== undefined && daysBetween(lantern.dayKey, today) < LANTERN.days;
}

/**
 * A lantern's note as it hangs: one line, spaces collapsed, control and format characters (zero
 * width, direction overrides) dropped; null when nothing visible is left or it's too long.
 */
export function lanternNote(note: string): string | null {
  const line = note
    .replace(/\s+/g, " ")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/ {2,}/g, " ")
    .trim();
  return line.length === 0 || line.length > LANTERN.maxChars ? null : line;
}

/**
 * Whether a Sunlamp helps a plant today: it has every watering its next stage needs and waits on
 * age alone. A plant waiting for a watering (or dormant, or Ancient) needs a kudos, not light.
 */
export function sunlampHelps(input: Growth & { today: string }): boolean {
  const state = plantState(input);
  return state.next !== null && !state.dormant && state.waterings >= state.next.waterings;
}

function fruitsOn(input: Growth & { day: string }): boolean {
  const last = lastWateringBy(input.waterings, input.day);
  if (last === null || daysBetween(last, input.day) >= FRUIT.wateredWithinDays) return false;
  return stageOn(input).index >= GROWN;
}

/** A fruit's worth: 1 or 2 Hog coins, the same for the same plant and day. */
export function fruitValue(plantId: string, day: string): number {
  return 1 + (fnv1a(`fruit:${plantId}:${day}`) % 2);
}

export type Fruit = { day: string; coins: number };

/**
 * The fruit waiting on a plant: one per fruiting day after `pickedThrough` up to `today`, the first
 * `hold` of them (a full plant stops growing more).
 */
export function fruitWaiting(input: Growth & { plantId: string; pickedThrough: string; today: string; hold: number }): Fruit[] {
  const { waterings, today, hold } = input;
  const out: Fruit[] = [];
  let day = addDays(input.pickedThrough, 1);
  while (day <= today && out.length < hold) {
    const last = lastWateringBy(waterings, day);
    if (last === null || daysBetween(last, day) >= FRUIT.wateredWithinDays) {
      // Nothing fruits until the next watering.
      const next = waterings.find((w) => w > day);
      if (next === undefined) break;
      day = next;
      continue;
    }
    if (stageOn({ ...input, day }).index >= GROWN) out.push({ day, coins: fruitValue(input.plantId, day) });
    day = addDays(day, 1);
  }
  return out;
}

export type Picked = { plantId: string; picked: number; pickedThrough: string | null };

/**
 * Picks the fruit waiting in a garden, plant by plant, oldest fruit first, while the quest week's
 * caps allow: 14 Hog coins, and 3 XP a fruit up to 21. A plant picked clean starts over from today;
 * one cut short by the cap keeps the rest (`pickedThrough` = the last day picked; null = untouched).
 */
export function pickFruit(input: {
  plants: { plantId: string; fruit: Fruit[] }[];
  today: string;
  weekCoins: number;
  weekXp: number;
}): { coins: number; xp: number; fruit: number; plants: Picked[] } {
  let room = Math.max(0, FRUIT.weeklyCoins - input.weekCoins);
  let coins = 0;
  let fruit = 0;
  const plants = input.plants.map(({ plantId, fruit: waiting }) => {
    let picked = 0;
    while (picked < waiting.length && waiting[picked].coins <= room) {
      room -= waiting[picked].coins;
      coins += waiting[picked].coins;
      picked++;
    }
    fruit += picked;
    const pickedThrough = picked === 0 ? null : picked === waiting.length ? input.today : waiting[picked - 1].day;
    return { plantId, picked, pickedThrough };
  });
  const xp = Math.min(fruit * FRUIT.xpPerFruit, Math.max(0, FRUIT.weeklyXp - input.weekXp));
  return { coins, xp, fruit, plants };
}
