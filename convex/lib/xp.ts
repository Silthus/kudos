/**
 * XP and levels: the pure rules of the game spec (#55 §G3). Only Qualifying kudos earn the full
 * amounts (`hasNote` + not a thank-back, the Quests' rule, see lib/quests.ts); XP never turns into
 * kudos or allowance. The engine gathers the facts (convex/game.ts) and stores what these return
 * as per-batch `gameEvents`, so a revoke takes back exactly what its kudos earned.
 */
import { hasNote, REKINDLE_GAP_MS, STORY_NOTE_WORDS, UNSUNG_QUIET_MS } from "./quests";

export const XP = {
  /** A qualifying kudos, per recipient per message. */
  base: 10,
  /** The second qualifying kudos to the same person on the same day; the third and later earn 0. */
  sameDaySecond: 2,
  /** Each earlier day this week with a qualifying kudos to the same person takes this much off… */
  weekStep: 2,
  /** …but never below this. */
  weekFloor: 2,
  newConnection: 10,
  story: 5,
  rekindle: 5,
  unsung: 5,
  /** A kudos without a reason (Note under 3 words) or a thank-back within 72 h. */
  thin: 2,
  dailyGiveCap: 50,
  receivePerGiver: 5,
  dailyReceiveCap: 15,
} as const;

export const MAX_LEVEL = 25;

/** Total XP needed to reach `level`: 30, 75, 175, 350, then 50 × (L − 1) more per level. */
export function xpForLevel(level: number): number {
  const early = [0, 0, 30, 75, 175, 350];
  if (level <= 5) return early[Math.max(1, level)];
  let total = early[5];
  for (let l = 6; l <= Math.min(level, MAX_LEVEL); l++) total += 50 * (l - 1);
  return total;
}

/** The level `xp` reaches (1 to 25). */
export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

const TITLES: { from: number; title: string }[] = [
  { from: 20, title: "Elder hog" },
  { from: 10, title: "Grove keeper" },
  { from: 5, title: "Gardener" },
  { from: 3, title: "Sprout" },
  { from: 1, title: "Seedling" },
];

export function titleForLevel(level: number): string {
  return TITLES.find((t) => level >= t.from)!.title;
}

export type LevelProgress = {
  level: number;
  title: string;
  xp: number;
  /** XP at which the shown level starts. */
  floor: number;
  /** XP the next level needs; null at the cap. */
  next: number | null;
  toNext: number | null;
  /** 0–1 through the shown level, for the next-level bar. */
  fraction: number;
};

/**
 * Where `xp` stands. `reached` is the highest level already reached: levels stay when a revoke
 * takes XP back, so the bar then waits at 0 until the XP catches up.
 */
export function levelProgress(xp: number, reached = 1): LevelProgress {
  const level = Math.max(levelForXp(xp), Math.min(reached, MAX_LEVEL));
  const floor = xpForLevel(level);
  const next = level < MAX_LEVEL ? xpForLevel(level + 1) : null;
  return {
    level,
    title: titleForLevel(level),
    xp,
    floor,
    next,
    toNext: next === null ? null : next - xp,
    fraction: next === null ? 1 : Math.min(1, Math.max(0, (xp - floor) / (next - floor))),
  };
}

/**
 * Game areas that open with a level (§G1 progressive disclosure). Until then they are shown
 * visible but locked, with a one-line "how to get there"; each game ticket makes its own real.
 */
export type GameArea = { key: "wallet" | "garden" | "store" | "quests"; title: string; level: number; how: string };

export const GAME_AREAS: GameArea[] = [
  { key: "wallet", title: "Hog coins", level: 3, how: "Thoughtful kudos collect Hog coins; your wallet opens at level 3 with everything collected so far." },
  { key: "garden", title: "Your garden", level: 3, how: "At level 3 you can grow a plant for a teammate you recognise." },
  { key: "store", title: "Store", level: 5, how: "At level 5 you can spend Hog coins on game items." },
  { key: "quests", title: "Quests", level: 5, how: "At level 5 the weekly board and a daily quest pay XP and coins." },
];

/** The areas that open at the next level ahead: a newcomer sees only what's coming next. */
export function nextLockedAreas(level: number): GameArea[] {
  const next = Math.min(...GAME_AREAS.filter((a) => a.level > level).map((a) => a.level));
  return GAME_AREAS.filter((a) => a.level === next);
}

export type XpItemKind = "base" | "new_connection" | "story" | "rekindle" | "unsung" | "thin";
export type XpItem = { kind: XpItemKind; xp: number };

/** One recipient of a batch, as the giver's history stood right before it. */
export type GiveRecipient = {
  kudosId: string;
  receiverId: string;
  /** The recipient gave the giver kudos in the 72 h before: a thank-back. */
  reciprocal: boolean;
  /** When the giver last gave this recipient kudos (any kind), if ever. */
  lastGivenAt: number | null;
  /** Earlier qualifying kudos from the giver to this recipient today. */
  earlierToday: number;
  /** Earlier days this quest week (not today) with a qualifying kudos from the giver to them. */
  earlierDaysThisWeek: number;
  /** When the recipient last received kudos from anybody (null: never); only read for Unsung. */
  receiverLastReceivedAt?: number | null;
};

export type GiveLine = {
  kudosId: string;
  receiverId: string;
  qualifying: boolean;
  /** What this kudos row earned the giver, after the daily cap. */
  xp: number;
  /** What it would earn before the cap, itemised for the earnings reply. */
  items: XpItem[];
};

/**
 * The giver's XP for one message (batch), one line per recipient. `earnedToday` is what giving
 * already earned them today, so the lines are cut in order once the daily cap is reached.
 */
export function scoreGive(input: {
  at: number;
  noteWords: number | undefined;
  /** Unsung bonus is on: received counts are visible to everyone. */
  unsungOn: boolean;
  earnedToday: number;
  recipients: GiveRecipient[];
}): GiveLine[] {
  let room = Math.max(0, XP.dailyGiveCap - input.earnedToday);
  let storyPaid = input.noteWords === undefined || input.noteWords < STORY_NOTE_WORDS;
  return input.recipients.map((r) => {
    const qualifying = hasNote(input.noteWords) && !r.reciprocal;
    const items: XpItem[] = [];
    if (!qualifying) items.push({ kind: "thin", xp: XP.thin });
    else {
      const base =
        r.earlierToday === 0
          ? Math.max(XP.weekFloor, XP.base - XP.weekStep * r.earlierDaysThisWeek)
          : r.earlierToday === 1
            ? XP.sameDaySecond
            : 0;
      items.push({ kind: "base", xp: base });
      if (base > 0) {
        if (r.lastGivenAt === null) items.push({ kind: "new_connection", xp: XP.newConnection });
        else if (input.at - r.lastGivenAt >= REKINDLE_GAP_MS) items.push({ kind: "rekindle", xp: XP.rekindle });
        if (input.unsungOn && r.receiverLastReceivedAt !== undefined && (r.receiverLastReceivedAt === null || input.at - r.receiverLastReceivedAt >= UNSUNG_QUIET_MS)) {
          items.push({ kind: "unsung", xp: XP.unsung });
        }
        if (!storyPaid) {
          items.push({ kind: "story", xp: XP.story });
          storyPaid = true;
        }
      }
    }
    const raw = items.reduce((sum, i) => sum + i.xp, 0);
    const xp = Math.min(raw, room);
    room -= xp;
    return { kudosId: r.kudosId, receiverId: r.receiverId, qualifying, xp, items };
  });
}

const BONUS_LABEL: Partial<Record<XpItemKind, string>> = {
  new_connection: "new connection",
  story: "a real why",
  rekindle: "rekindled",
  unsung: "unsung hero",
};

/**
 * The giver's earnings line for the reply where they gave (Slack ephemeral, playground):
 * "+25 XP · new connection +10 · a real why +5", plus how a thin kudos could earn more.
 */
export function earningsText(e: {
  xp: number;
  bonuses: { kind: XpItemKind; xp: number }[];
  capped: boolean;
  noReason: boolean;
  thankBack: boolean;
}): string {
  return [
    `+${e.xp} XP`,
    ...e.bonuses.filter((b) => BONUS_LABEL[b.kind]).map((b) => `${BONUS_LABEL[b.kind]} +${b.xp}`),
    e.capped ? "daily XP cap reached" : null,
    e.noReason ? "add a reason (3+ words) to earn more" : e.thankBack ? "thanking back within 72 h earns less" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The receiver's XP for one kudos row: 5 per distinct qualifying giver a day, at most 15 a day. */
export function scoreReceive(input: {
  qualifying: boolean;
  /** Only players accrue anything. */
  isPlayer: boolean;
  /** This giver already earned the receiver XP today. */
  giverCountedToday: boolean;
  /** What receiving already earned them today. */
  earnedToday: number;
}): number {
  if (!input.qualifying || !input.isPlayer || input.giverCountedToday) return 0;
  return Math.max(0, Math.min(XP.receivePerGiver, XP.dailyReceiveCap - input.earnedToday));
}
