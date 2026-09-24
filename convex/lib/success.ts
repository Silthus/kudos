/**
 * The game's success metrics (spec #55 G18), per workspace month: how far giving reaches
 * (distinct recipients per active giver), how often it says why (12+ word Notes) and how often it
 * is a thank-back (Reciprocal kudos, the Quests' 72 h rule), next to participation. Recorded
 * before the game launches, so there is a baseline to review it against.
 *
 * A kudos here is one kudos row, one person recognised in one message, whatever its amount: a
 * note or a thank-back is a property of recognising someone, and the emoji count shouldn't weigh it.
 */
import type { Doc } from "../_generated/dataModel";
import { STORY_NOTE_WORDS, thanksBack } from "./quests";

export const SUCCESS_COUNTERS = ["pairs", "storyRows", "reciprocalRows"] as const;
export type SuccessCounter = (typeof SUCCESS_COUNTERS)[number];
export type SuccessCounts = Record<SuccessCounter, number>;

export const zeroSuccess = (): SuccessCounts => ({ pairs: 0, storyRows: 0, reciprocalRows: 0 });

/** The Note says why: 12+ words, as the "Say why" quest and the game's XP bonus count it. */
export const isStory = (row: Pick<Doc<"kudos">, "noteWords">) => (row.noteWords ?? 0) >= STORY_NOTE_WORDS;

type Row = Pick<Doc<"kudos">, "giverId" | "receiverId" | "at" | "noteWords">;

/** What a month's metrics are computed from: its rollup counts and the team it is measured against. */
export type MonthFacts = SuccessCounts & { month: string; givers: number; kudos: number; teamSize: number };

const ratio = (n: number, d: number) => (d > 0 ? n / d : null);

/** The four metrics of a month, or of several months pooled (sums over sums); null without a denominator. */
export function metricsOf(months: readonly MonthFacts[]) {
  const sum = (pick: (m: MonthFacts) => number) => months.reduce((s, m) => s + pick(m), 0);
  const givers = sum((m) => m.givers);
  const kudos = sum((m) => m.kudos);
  return {
    participation: ratio(givers, sum((m) => m.teamSize)),
    recipientsPerGiver: ratio(sum((m) => m.pairs), givers),
    storyShare: ratio(sum((m) => m.storyRows), kudos),
    reciprocalShare: ratio(sum((m) => m.reciprocalRows), kudos),
  };
}

/**
 * A month's counters from its kudos rows (`month`) and every kudos row that could make one of them
 * Reciprocal (`context`: at least the month's rows and the 72 h before it).
 */
export function successCounts(month: readonly Row[], context: readonly Row[]): SuccessCounts {
  const given = new Map<string, number[]>();
  for (const k of context) {
    const key = `${k.giverId}>${k.receiverId}`;
    given.set(key, [...(given.get(key) ?? []), k.at]);
  }
  return {
    pairs: new Set(month.map((k) => `${k.giverId}>${k.receiverId}`)).size,
    storyRows: month.filter(isStory).length,
    reciprocalRows: month.filter((k) => (given.get(`${k.receiverId}>${k.giverId}`) ?? []).some((at) => thanksBack(k.at, at))).length,
  };
}
