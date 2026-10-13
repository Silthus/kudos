// PROTOTYPE mock time-series for the Dashboard variant: fictional, deterministic, display-only.
import { me } from "../../data/mock";

const today = new Date(2026, 9, 13);
const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayBefore = (daysAgo: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
const isWorkday = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;
export const shortDate = (d: Date) => `${monthShort[d.getMonth()]} ${d.getDate()}`;

const xpGains = [22, 0, 0, 31, 18, 44, 9, 27, 0, 0, 35, 19, 23, 41, 12, 0, 0, 38, 14, 46, 25, 17, 0, 0, 33, 39, 21, 28, 47, 61];

export type SeriesPoint = { date: Date; label: string; value: number };

export const xpLast30: SeriesPoint[] = (() => {
  const total = xpGains.reduce((a, b) => a + b, 0);
  let running = me.xp - total;
  return xpGains.map((gain, i) => {
    running += gain;
    const date = dayBefore(29 - i);
    return { date, label: shortDate(date), value: running };
  });
})();

export const levelReachedIndex = xpLast30.findIndex((p) => p.value >= me.xpThisLevelStart);

export const weeklyKudos = [
  { week: "W34", given: 11, received: 8 },
  { week: "W35", given: 14, received: 10 },
  { week: "W36", given: 9, received: 7 },
  { week: "W37", given: 16, received: 12 },
  { week: "W38", given: 13, received: 9 },
  { week: "W39", given: 17, received: 11 },
  { week: "W40", given: 12, received: 10 },
  { week: "W41", given: 6, received: 4 },
];

export type WorkdayCell = { date: Date; label: string; kudos: number; state: "gave" | "missed" | "freeze" | "future" };

const workdayPattern: Array<[number, WorkdayCell["state"]]> = [
  [2, "gave"],
  [3, "gave"],
  [0, "missed"],
  [1, "gave"],
  [4, "gave"],
  [0, "freeze"],
  [2, "gave"],
  [3, "gave"],
  [0, "missed"],
  [1, "gave"],
  [5, "gave"],
  [2, "gave"],
  [4, "gave"],
  [1, "gave"],
  [3, "gave"],
  [2, "gave"],
  [3, "gave"],
];

export const workdayHeatmap: WorkdayCell[][] = (() => {
  const daysSinceMonday = (today.getDay() + 6) % 7;
  const firstMonday = dayBefore(daysSinceMonday + 21);
  const cells: WorkdayCell[] = [];
  for (let offset = 0; cells.length < 20; offset++) {
    const date = new Date(firstMonday.getFullYear(), firstMonday.getMonth(), firstMonday.getDate() + offset);
    if (!isWorkday(date)) continue;
    const past = workdayPattern[cells.length];
    const [kudos, state] = date > today || !past ? [0, "future" as const] : past;
    cells.push({ date, label: shortDate(date), kudos, state });
  }
  return [0, 1, 2, 3].map((week) => cells.slice(week * 5, week * 5 + 5));
})();

export const maxInsights = {
  profile: "330 XP to level 9. Your last 7 workdays averaged 41 XP a day, so at this pace level 9 lands next Thursday. Rhythm is ready to roll out and would make full weeks count for more.",
  skills: "2 skill points cover Rhythm, or Flame plus 150 coins. Rhythm pays off on every full week; Flame only on first thank-yous. Nothing here can be undone.",
};

export type ActivityEvent = { event: string; detail: string; delta: string; when: string; private?: boolean };

export const recentActivity: ActivityEvent[] = [
  { event: "kudos.given", detail: "to Ada Lindqvist, first of the day", delta: "+9 XP · Spark", when: "2 h ago" },
  { event: "kudos.received", detail: "from Bo Okafor, thoughtful", delta: "+2 coins", when: "5 h ago", private: true },
  { event: "kudos.given", detail: "to Cleo Marchetti", delta: "+4 XP", when: "Yesterday" },
  { event: "chime_in", detail: "on Dev Raman's kudos to Edda Brandt", delta: "+1 XP", when: "Yesterday" },
  { event: "streak.extended", detail: "8 workdays, a personal best", delta: "Momentum 8 of 10", when: "Yesterday", private: true },
  { event: "drop", detail: "Paper High-Five card", delta: "Uncommon", when: "9 d ago" },
  { event: "level.reached", detail: `Level ${me.level}`, delta: "+2 skill points", when: `${29 - levelReachedIndex} d ago` },
];
