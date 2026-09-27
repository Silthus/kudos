/**
 * The simulator's pure rules (#143, convex/simulator.ts): how its workspace clock moves from day to
 * day, and how the fast-forward bot plays a day.
 */
import { addDays, dayKeyFor, startOfDayUtc, zonedParts } from "./time";

/** Levels a visitor can join at and fast-forward to. */
export const SIMULATOR_LEVELS = { min: 1, max: 25 } as const;
/** How far one `advance` may move the clock. */
export const MAX_ADVANCE_DAYS = 30;
/** Simulated days start here: advancing lands on this local hour, so a day is never cut short. */
export const MORNING_HOUR = 9;
/** Teammates a simulator starts with (the shared demo's people, without their history). */
export const SIMULATOR_TEAMMATES = 12;
/** A fast-forward that hasn't reached its level after this many simulated days stops (a stuck bot never runs forever). */
export const MAX_RUN_DAYS = 500;
/** Simulators are wiped this long after they started (wall clock). */
export const SIMULATOR_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const HOUR_MS = 3_600_000;

/** `MORNING_HOUR` local on `dayKey`, found by local parts so DST days (23 h, 25 h) land right too. */
function morningOn(dayKey: string, timeZone: string): number {
  let ts = startOfDayUtc(dayKey, timeZone) + MORNING_HOUR * HOUR_MS;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(ts, timeZone);
    const off = (p.hour - MORNING_HOUR) * HOUR_MS + p.minute * 60_000;
    if (off === 0) break;
    ts -= off;
  }
  return ts;
}

/**
 * Where `advance({ days })` moves the clock: the morning of the local day `days` after the one
 * containing `now`. Calendar days, not 24 h steps: a DST switch never skips or repeats a day.
 */
export function morningOf(now: number, timeZone: string, days: number): number {
  return morningOn(addDays(dayKeyFor(now, timeZone), days), timeZone);
}

/**
 * A new simulator's first moment: the next morning at or after the wall clock (today's, if it's still
 * to come), so the first day is a whole day and the clock never runs behind the wall clock.
 */
export function simulatorStart(now: number, timeZone: string): number {
  const today = morningOf(now, timeZone, 0);
  return today >= now ? today : morningOf(now, timeZone, 1);
}

/** What the bot writes: thoughtful notes of 12+ words, so every kudos qualifies and tells a story. */
export const BOT_NOTES = [
  "thanks for untangling the deploy pipeline on friday, it saved my whole afternoon",
  "your write-up of the outage made a scary week feel calm and fixable for everyone",
  "you turned a vague customer complaint into three concrete fixes we shipped this sprint",
  "thank you for pairing with me on the flaky test until we finally found the race",
  "the onboarding doc you wrote made the new joiners productive on their very first day",
  "thanks for reviewing my proposal so carefully, the questions you asked made it much stronger",
  "you stayed calm while everything was on fire and walked the whole team through the fix",
];

/** Thoughtful kudos the simulator's teammates give among themselves each day a fast-forward plays (#165, plan #152 S10). */
export const TEAMMATE_KUDOS_PER_DAY = 3;

/**
 * The teammates' kudos on simulated day `day`: `count` of them, each from the next teammate in a
 * rotation to one a few places after them. Never a thank-back: a teammate only ever thanks the one to
 * five after them, so nobody thanks back anyone who thanked them (12 teammates). The visitor isn't
 * among them: the bot thanks everyone every few days, so a kudos to the visitor would be a thank-back.
 */
export function teammateKudos({ day, teammates, count = TEAMMATE_KUDOS_PER_DAY }: { day: number; teammates: string[]; count?: number }): { from: string; to: string }[] {
  const n = teammates.length;
  if (n < 3) return []; // two would only ever thank each other back
  return Array.from({ length: count }, (_, j) => {
    const giver = (day * count + j) % n;
    const ahead = 1 + ((day + j) % Math.min(5, Math.floor((n - 1) / 2) || 1));
    return { from: teammates[giver], to: teammates[(giver + ahead) % n] };
  });
}

/**
 * Who the bot thanks on simulated day `day`: the teammates it grows plants for first (their weekly
 * watering), then the next teammates in a rotation through everyone, `count` of them (the allowance
 * left), each once, so every kudos is one teammate in one message.
 */
export function botRecipients({ day, teammates, waterFirst, count }: { day: number; teammates: string[]; waterFirst: string[]; count: number }): string[] {
  const out: string[] = [];
  for (const id of waterFirst) if (out.length < count && !out.includes(id)) out.push(id);
  const start = (day * count) % Math.max(1, teammates.length);
  for (let i = 0; i < teammates.length && out.length < count; i++) {
    const id = teammates[(start + i) % teammates.length];
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
