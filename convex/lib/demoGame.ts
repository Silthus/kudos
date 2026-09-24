/**
 * The demo's game timeline (#100, spec #55 §G16): the demo team switched the game on at a simulated
 * *launch*, 18 weeks before the current week, and the demo year is played through the rules from
 * there. The kudos before it were given with the game off (a pause), so they earn nothing, and the
 * success metrics' baseline is the three whole months before the launch month, as switching the game
 * on would pin it (#102). Anchored to today, so the demo user lands at the same level on any day of
 * the year. Pure and clock-free: the same day always gives the same timeline.
 */
import { weekKeyOfDay } from "./quests";
import { addDays } from "./time";

/** How long the demo has played the game: about 18 weeks bring a steady giver to level 9 (§G3, §G16). */
export const LAUNCH_WEEKS = 18;
/** Whole months before the launch month the success metrics compare with (#102). */
export const BASELINE_MONTHS = 3;

/** The Monday the demo switched the game on. */
export function demoLaunchDay(today: string): string {
  return addDays(weekKeyOfDay(today), -7 * LAUNCH_WEEKS);
}

/** `month` ("YYYY-MM") moved by `n` months. */
export function shiftMonth(month: string, n: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/**
 * The first day the demo seeds: 1 January of this year (#49), or earlier when the launch and the
 * baseline months before it need more history.
 */
export function demoSeedStart(today: string): string {
  const newYear = `${today.slice(0, 4)}-01-01`;
  const baseline = `${shiftMonth(demoLaunchDay(today).slice(0, 7), -BASELINE_MONTHS)}-01`;
  return baseline < newYear ? baseline : newYear;
}

/**
 * The bonus days an admin scheduled (§G9): one to celebrate the launch (its Friday), one a month
 * ago, and the next one, announced ahead: the first Friday after today.
 */
export function demoBonusDays(today: string): { past: string[]; upcoming: string } {
  const friday = (monday: string) => addDays(monday, 4);
  const week = weekKeyOfDay(today);
  const upcoming = friday(week) > today ? friday(week) : friday(addDays(week, 7));
  return { past: [friday(demoLaunchDay(today)), friday(addDays(week, -28))], upcoming };
}
