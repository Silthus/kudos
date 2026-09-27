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
import { DAY_MS } from "./time";

export const SUCCESS_COUNTERS = ["pairs", "storyRows", "reciprocalRows"] as const;
export type SuccessCounter = (typeof SUCCESS_COUNTERS)[number];
export type SuccessCounts = Record<SuccessCounter, number>;

export const zeroSuccess = (): SuccessCounts => ({ pairs: 0, storyRows: 0, reciprocalRows: 0 });

/**
 * The game's own counters of a month (#165, plan #152 S11), kept on the same rows:
 * - `claims`: offerings claimed at the stone by the player (not by time), in the month of the claim;
 * - `offeredCoins`: the Hog coins of the month's offerings, and `claimedSoonCoins` those of them their
 *   giver claimed within CLAIMED_SOON_MS (both in the month the offering was made);
 * - `expeditions`: members paid for a cleared run, in a ruin or the blight raid (their `expedition` events);
 * - `crewJoins`: members who first gave to a crew quest in the month (each counted once a month).
 */
export const GAME_COUNTERS = ["claims", "offeredCoins", "claimedSoonCoins", "expeditions", "crewJoins"] as const;
export type GameCounter = (typeof GAME_COUNTERS)[number];
export type GameCounts = Record<GameCounter, number>;

export const zeroGame = (): GameCounts => ({ claims: 0, offeredCoins: 0, claimedSoonCoins: 0, expeditions: 0, crewJoins: 0 });

/** The game's counters as a row stores them: a counter at zero is left unset, as on rows from before them. */
export function gameFields(counts: GameCounts): { [C in GameCounter]: number | undefined } {
  return { claims: counts.claims || undefined, offeredCoins: counts.offeredCoins || undefined, claimedSoonCoins: counts.claimedSoonCoins || undefined, expeditions: counts.expeditions || undefined, crewJoins: counts.crewJoins || undefined };
}

/** A claim within this long of the offering counts as "claimed soon". */
export const CLAIMED_SOON_MS = 7 * DAY_MS;

type OfferingFacts = Pick<Doc<"offerings">, "coins" | "createdAt" | "claimedAt">;

/**
 * What one offering adds to its month's counters. An offering claimed the moment it was made is a
 * batch from before offerings (its coins went straight into the wallet, offerings.ts replay) or a
 * story's fuel without coins: nobody offered it at the stone, so it counts for nothing.
 */
export function offeringTally(o: OfferingFacts | null): Pick<GameCounts, "offeredCoins" | "claimedSoonCoins"> {
  if (!o || o.claimedAt === o.createdAt) return { offeredCoins: 0, claimedSoonCoins: 0 };
  const soon = o.claimedAt !== undefined && o.claimedAt - o.createdAt <= CLAIMED_SOON_MS;
  return { offeredCoins: o.coins, claimedSoonCoins: soon ? o.coins : 0 };
}

/** The Note says why: 12+ words, as the "Say why" quest and the game's XP bonus count it. */
export const isStory = (row: Pick<Doc<"kudos">, "noteWords">) => (row.noteWords ?? 0) >= STORY_NOTE_WORDS;

type Row = Pick<Doc<"kudos">, "giverId" | "receiverId" | "at" | "noteWords">;

/**
 * What a month's metrics are computed from: its rollup counts, the team it is measured against, the
 * days it has had so far, and whether the game was on (from its launch month): before, the game's
 * metrics measure nothing.
 */
export type MonthFacts = SuccessCounts & GameCounts & { month: string; givers: number; kudos: number; teamSize: number; days: number; game: boolean };

const ratio = (n: number, d: number) => (d > 0 ? n / d : null);

/** The four metrics of a month, or of several months pooled (sums over sums); null without a denominator. */
export function metricsOf(months: readonly MonthFacts[]) {
  const sum = (pick: (m: MonthFacts) => number) => months.reduce((s, m) => s + pick(m), 0);
  const givers = sum((m) => m.givers);
  const kudos = sum((m) => m.kudos);
  const game = months.length > 0 && months.every((m) => m.game);
  const ifGame = (n: number | null) => (game ? n : null);
  return {
    participation: ratio(givers, sum((m) => m.teamSize)),
    recipientsPerGiver: ratio(sum((m) => m.pairs), givers),
    storyShare: ratio(sum((m) => m.storyRows), kudos),
    reciprocalShare: ratio(sum((m) => m.reciprocalRows), kudos),
    // The game's (#165): active players are the month's givers (every giver plays once the game is on).
    claimsPerPlayerWeek: ifGame(ratio(sum((m) => m.claims), sum((m) => (m.givers * m.days) / 7))),
    claimedSoonShare: ifGame(ratio(sum((m) => m.claimedSoonCoins), sum((m) => m.offeredCoins))),
    expeditionsPerPlayer: ifGame(ratio(sum((m) => m.expeditions), givers)),
    crewContributors: ifGame(sum((m) => m.crewJoins)),
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
