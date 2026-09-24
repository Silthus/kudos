import { addDays, daysBetween, weekdayOfKey } from "./time";

/** Monday … Sunday: Friday shout-outs, quiet weekends. */
const WEEKDAY_RHYTHM = [0.95, 1, 1.05, 1, 1.1, 0.14, 0.1];

/**
 * How busy the demo team is on a day, relative to an ordinary workday: the weekly rhythm, holidays,
 * launches and gentle growth over the year. Pure and clock-free, so a day always seeds the same history.
 */
export function demoActivity(dayKey: string): number {
  return WEEKDAY_RHYTHM[weekdayOfKey(dayKey)] * growth(dayKey) * season(dayKey);
}

/** Holidays and the team's big moments, as inclusive day ranges of `year`. */
function seasonOf(year: number) {
  const easter = easterSunday(year);
  const workweekOf = (dayKey: string) => {
    const monday = addDays(dayKey, -weekdayOfKey(dayKey));
    return { from: monday, to: addDays(monday, 4) };
  };
  return [
    { from: `${year}-01-01`, to: `${year}-01-06`, factor: 0.35 }, // New Year
    { ...workweekOf(`${year}-03-18`), factor: 1.8 }, // spring launch week
    { from: addDays(easter, -2), to: addDays(easter, 1), factor: 0.3 }, // Good Friday to Easter Monday
    { from: `${year}-06-25`, to: `${year}-06-25`, factor: 2.2 }, // team offsite
    { from: `${year}-08-03`, to: `${year}-08-21`, factor: 0.5 }, // summer holidays
    { ...workweekOf(`${year}-09-09`), factor: 1.6 }, // autumn release week
    { from: `${year}-12-21`, to: `${year}-12-31`, factor: 0.35 }, // winter holidays
  ];
}

function season(dayKey: string) {
  const moment = seasonOf(Number(dayKey.slice(0, 4))).find((s) => dayKey >= s.from && dayKey <= s.to);
  return moment?.factor ?? 1;
}

/** Western Easter Sunday of `year` as a day key (the anonymous Gregorian computus). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** About 0.8× in early January up to 1.2× by late December. */
function growth(dayKey: string) {
  return 0.8 + (0.4 * daysBetween(`${dayKey.slice(0, 4)}-01-01`, dayKey)) / 365;
}
