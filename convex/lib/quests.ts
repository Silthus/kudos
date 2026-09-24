/**
 * Weekly quests: the built-in catalog, board selection and the pure evaluator.
 * Only Qualifying kudos move progress (see CONTEXT.md): a Note of 3+ words and not Reciprocal.
 * Progress is never stored; it is recomputed from kudos rows via `evaluateBoard`.
 */
import type { Infer } from "convex/values";
import type { receivedVisibilityValidator } from "../schema";
import { fnv1a, mulberry32 } from "./random";
import { addDays, dayKeyFor, weekdayOfKey } from "./time";

export type QuestKey = "spread" | "fresh" | "rekindle" | "unsung" | "steady" | "channels" | "story";
export type QuestGroup = "people" | "habit" | "craft";
export type WaivedReason = "no_candidates" | "privacy" | "too_new";
type ReceivedVisibility = Infer<typeof receivedVisibilityValidator>;

export type Quest = { key: QuestKey; title: string; description: string; group: QuestGroup; goal: number };

export const QUESTS: Quest[] = [
  { key: "spread", title: "Spread the love", description: "Recognize 3 different teammates, each in their own message", group: "people", goal: 3 },
  { key: "fresh", title: "New connection", description: "Recognize someone you've never recognized before", group: "people", goal: 1 },
  { key: "rekindle", title: "Old friends", description: "Recognize someone you last recognized more than 30 days ago", group: "people", goal: 1 },
  { key: "unsung", title: "Unsung hero", description: "Recognize a teammate who hasn't received kudos in the last 14 days", group: "people", goal: 1 },
  { key: "steady", title: "Steady hand", description: "Give thoughtful kudos on 3 different days", group: "habit", goal: 3 },
  { key: "channels", title: "Channel hopper", description: "Give thoughtful kudos in 2 different channels", group: "habit", goal: 2 },
  { key: "story", title: "Say why", description: "Write a detailed note (12+ words) in 2 kudos messages", group: "craft", goal: 2 },
];

export const QUEST_BY_KEY = Object.fromEntries(QUESTS.map((q) => [q.key, q])) as Record<QuestKey, Quest>;

export function isQuestKey(key: string): key is QuestKey {
  return key in QUEST_BY_KEY;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
export const BOARD_SIZE = 3;
export const MIN_NOTE_WORDS = 3;
export const STORY_NOTE_WORDS = 12;
export const RECIPROCAL_WINDOW_MS = 72 * HOUR_MS;
export const REKINDLE_GAP_MS = 30 * DAY_MS;
export const UNSUNG_QUIET_MS = 14 * DAY_MS;
/** Old friends is only drawn once the workspace has this much history before the week. */
export const REKINDLE_WORKSPACE_AGE_MS = 35 * DAY_MS;

/** The quest week containing a day key: its Monday's day key. */
export function weekKeyOfDay(dayKey: string): string {
  return addDays(dayKey, -weekdayOfKey(dayKey));
}

/** The quest week's key at `now`: its Monday's day key in the workspace timezone. */
export function weekKeyFor(now: number, timeZone: string): string {
  return weekKeyOfDay(dayKeyFor(now, timeZone));
}

export function boardSeed(workspaceId: string, weekKey: string): number {
  return fnv1a(`${workspaceId}:${weekKey}`);
}

/** Catalog keys that may be drawn for a week, given workspace-level conditions. */
export function eligibleQuestKeys(input: {
  receivedVisibility: ReceivedVisibility;
  workspaceFirstKudosAt: number | null;
  weekStart: number;
}): QuestKey[] {
  return QUESTS.filter((q) => {
    if (q.key === "unsung") return input.receivedVisibility === "everyone";
    if (q.key === "rekindle") {
      return input.workspaceFirstKudosAt !== null && input.workspaceFirstKudosAt <= input.weekStart - REKINDLE_WORKSPACE_AGE_MS;
    }
    return true;
  }).map((q) => q.key);
}

const isPeople = (key: QuestKey) => QUEST_BY_KEY[key].group === "people";
/** How many of last week's quests a new board may keep. */
export const MAX_CARRY_OVER = 1;

/** Every valid board from `keys`: 3 distinct quests with at least 1 people and 1 habit/craft quest. */
function boardsFrom(keys: readonly QuestKey[]): QuestKey[][] {
  const pool = QUESTS.map((q) => q.key).filter((k) => keys.includes(k));
  const boards: QuestKey[][] = [];
  for (let a = 0; a < pool.length; a++) {
    for (let b = a + 1; b < pool.length; b++) {
      for (let c = b + 1; c < pool.length; c++) {
        const board = [pool[a], pool[b], pool[c]];
        if (board.some(isPeople) && !board.every(isPeople)) boards.push(board);
      }
    }
  }
  return boards;
}

/**
 * Seeded draw of a week's board among every valid one (1+ people, 1+ habit/craft quest) that keeps
 * at most one of last week's quests (`previousKeys`) and, where it can, isn't the board from two
 * weeks before (`earlierKeys`), so boards keep changing instead of alternating between two sets.
 * Only if the catalog is too small for that, it may keep more, but never last week's exact board
 * when another exists. People quests come first.
 */
export function pickBoard(input: {
  seed: number;
  previousKeys: readonly string[];
  earlierKeys?: readonly string[];
  eligibleKeys: readonly QuestKey[];
}): QuestKey[] {
  const previous = new Set(input.previousKeys);
  const earlier = new Set(input.earlierKeys);
  const kept = (board: QuestKey[]) => board.filter((k) => previous.has(k)).length;
  const isEarlier = (board: QuestKey[]) => earlier.size === board.length && board.every((k) => earlier.has(k));
  const boards = boardsFrom(input.eligibleKeys);
  const preferences = [
    (b: QuestKey[]) => kept(b) <= MAX_CARRY_OVER && !isEarlier(b),
    (b: QuestKey[]) => kept(b) <= MAX_CARRY_OVER,
    (b: QuestKey[]) => kept(b) < BOARD_SIZE,
    () => true,
  ];
  const candidates =
    preferences.map((ok) => boards.filter(ok)).find((c) => c.length > 0) ??
    // No valid board at all (never with the built-in catalog): the drawable quests as they are.
    [input.eligibleKeys.slice(0, BOARD_SIZE)];
  const board = candidates[Math.floor(mulberry32(input.seed)() * candidates.length)];
  return [...board.filter(isPeople), ...board.filter((k) => !isPeople(k))];
}

/** Size of a maximum matching between messages and their recipients (augmenting paths). */
export function maxMatching(batches: readonly (readonly string[])[]): number {
  const owner = new Map<string, number>();
  const assign = (batch: number, seen: Set<string>): boolean => {
    for (const r of batches[batch]) {
      if (seen.has(r)) continue;
      seen.add(r);
      const current = owner.get(r);
      if (current === undefined || assign(current, seen)) {
        owner.set(r, batch);
        return true;
      }
    }
    return false;
  };
  let size = 0;
  for (let i = 0; i < batches.length; i++) if (assign(i, new Set())) size++;
  return size;
}

/** One kudos row the member gave during the quest week. */
export type GivenFact = {
  batchId: string;
  receiverId: string;
  dayKey: string;
  channelId: string;
  at: number;
  noteWords?: number;
  /** When the member last gave this recipient kudos before this row (any source), if ever. */
  lastBeforeAt: number | null;
  /**
   * When the recipient last received kudos before this row (null: never). Only looked up when
   * Unsung hero needs it; `undefined` means not looked up and never counts as quiet.
   */
  receiverLastReceivedAt?: number | null;
};

export type QuestFacts = {
  given: GivenFact[];
  /** Kudos the member received from [week start − 72 h, week end): for the reciprocity rule. */
  receivedFrom: { giverId: string; at: number }[];
  /** Active non-bot members besides the member (counted only as far as the waivers need). */
  activeTeammates: number;
  /** Some active teammate has never received kudos from the member. */
  hasUnrecognizedTeammate: boolean;
  firstGivenAt: number | null;
  weekStart: number;
  receivedVisibility: ReceivedVisibility;
};

export type QuestResult = { key: QuestKey; progress: number; goal: number; done: boolean; waived: WaivedReason | null };

function isReciprocal(row: GivenFact, receivedFrom: QuestFacts["receivedFrom"]) {
  return receivedFrom.some(
    (r) => r.giverId === row.receiverId && r.at < row.at && r.at > row.at - RECIPROCAL_WINDOW_MS,
  );
}

/** Qualifying kudos: a Note of at least 3 words, and not thanking someone back within 72 h. */
export function qualifyingKudos(facts: QuestFacts): GivenFact[] {
  return facts.given.filter((g) => (g.noteWords ?? 0) >= MIN_NOTE_WORDS && !isReciprocal(g, facts.receivedFrom));
}

function rawProgress(key: QuestKey, rows: GivenFact[]): number {
  const distinct = (pick: (g: GivenFact) => string, of = rows) => new Set(of.map(pick)).size;
  switch (key) {
    case "spread": {
      const byBatch = new Map<string, Set<string>>();
      for (const g of rows) byBatch.set(g.batchId, (byBatch.get(g.batchId) ?? new Set()).add(g.receiverId));
      return maxMatching([...byBatch.values()].map((s) => [...s]));
    }
    case "fresh":
      return rows.some((g) => g.lastBeforeAt === null) ? 1 : 0;
    case "rekindle":
      return rows.some((g) => g.lastBeforeAt !== null && g.at - g.lastBeforeAt >= REKINDLE_GAP_MS) ? 1 : 0;
    case "unsung":
      return rows.some(
        (g) => g.receiverLastReceivedAt === null || (g.receiverLastReceivedAt !== undefined && g.at - g.receiverLastReceivedAt >= UNSUNG_QUIET_MS),
      )
        ? 1
        : 0;
    case "steady":
      return distinct((g) => g.dayKey);
    case "channels":
      return distinct((g) => g.channelId);
    case "story":
      return distinct((g) => g.batchId, rows.filter((g) => (g.noteWords ?? 0) >= STORY_NOTE_WORDS));
  }
}

function waivedReason(key: QuestKey, facts: QuestFacts): WaivedReason | null {
  switch (key) {
    case "spread":
      return facts.activeTeammates < QUEST_BY_KEY.spread.goal ? "no_candidates" : null;
    case "fresh":
      return facts.hasUnrecognizedTeammate ? null : "no_candidates";
    case "rekindle":
      return facts.firstGivenAt === null || facts.firstGivenAt > facts.weekStart - REKINDLE_GAP_MS ? "too_new" : null;
    case "unsung":
      return facts.receivedVisibility === "everyone" ? null : "privacy";
    default:
      return null;
  }
}

/** Progress on each quest of a board. A done quest isn't waived, except for privacy. */
export function evaluateBoard(board: readonly QuestKey[], facts: QuestFacts): QuestResult[] {
  const rows = qualifyingKudos(facts);
  return board.map((key) => {
    const goal = QUEST_BY_KEY[key].goal;
    const waived = waivedReason(key, facts);
    if (waived === "privacy") return { key, progress: 0, goal, done: false, waived };
    const progress = Math.min(goal, rawProgress(key, rows));
    const done = progress >= goal;
    return { key, progress, goal, done, waived: done ? null : waived };
  });
}

/**
 * When each done quest was completed: the `at` of the kudos after which its goal was first met
 * (replaying the week's giving in order). For history recorded after the fact, like the demo's.
 */
export function completionTimes(board: readonly QuestKey[], facts: QuestFacts): Partial<Record<QuestKey, number>> {
  const given = [...facts.given].sort((a, b) => a.at - b.at);
  const times: Partial<Record<QuestKey, number>> = {};
  for (let i = 0; i < given.length; i++) {
    for (const r of evaluateBoard(board, { ...facts, given: given.slice(0, i + 1) })) {
      if (r.done && times[r.key] === undefined) times[r.key] = given[i].at;
    }
  }
  return times;
}

/** Every quest that isn't waived is done (and there is at least one). */
export function isCleanSweep(results: readonly { done: boolean; waived: WaivedReason | null }[]): boolean {
  const open = results.filter((r) => r.waived === null);
  return open.length > 0 && open.every((r) => r.done);
}
