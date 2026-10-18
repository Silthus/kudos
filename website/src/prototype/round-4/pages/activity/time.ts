// PROTOTYPE (#625, round 4): days and weeks of the activity page, told in words. Never merge to main.
const day = 86_400_000;

export const fixtureNow = Date.parse("2026-10-18T10:00:00Z");

export function today() {
  return Math.max(Date.now(), fixtureNow);
}

export function startOfDay(at: number) {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function startOfWeek(at: number) {
  const date = new Date(startOfDay(at));
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.getTime();
}

export function weeksBefore(weekStart: number, weeks: number) {
  const date = new Date(weekStart);
  date.setDate(date.getDate() - 7 * weeks);
  return date.getTime();
}

export function daysOfWeek(weekStart: number) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date.getTime();
  });
}

const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" });

const shortWeekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

const dayAndMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

const month = new Intl.DateTimeFormat("en-GB", { month: "short" });

export function clockOf(at: number) {
  return clock.format(at);
}

export function weekdayOf(at: number) {
  return weekday.format(at);
}

export function shortWeekdayOf(at: number) {
  return shortWeekday.format(at);
}

export function dayAndMonthOf(at: number) {
  return dayAndMonth.format(at);
}

export function monthOf(at: number) {
  return month.format(at);
}

export function dayLabelOf(at: number) {
  const daysAgo = Math.round((startOfDay(today()) - startOfDay(at)) / day);
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return weekdayOf(at);
  return `${shortWeekdayOf(at)} ${dayAndMonthOf(at)}`;
}

export function dayWordOf(at: number) {
  const label = dayLabelOf(at);
  return label === "Today" || label === "Yesterday" ? label : shortWeekdayOf(at);
}

export function weekLabelOf(weekStart: number) {
  const weeksAgo = Math.round((startOfWeek(today()) - weekStart) / (7 * day));
  if (weeksAgo <= 0) return "This week";
  if (weeksAgo === 1) return "Last week";
  return `Week of ${dayAndMonthOf(weekStart)}`;
}

export function weekPhraseOf(weekStart: number) {
  const label = weekLabelOf(weekStart);
  return label.startsWith("Week of") ? `the w${label.slice(1)}` : label.toLowerCase();
}

export function lastDays(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(startOfDay(today()));
    date.setDate(date.getDate() - (count - 1 - index));
    return date.getTime();
  });
}

export function weekSpanOf(weekStart: number) {
  const days = daysOfWeek(weekStart);
  const first = days[0]!;
  const last = days[6]!;
  if (monthOf(first) === monthOf(last)) return `${new Date(first).getDate()}–${dayAndMonthOf(last)}`;
  return `${dayAndMonthOf(first)} – ${dayAndMonthOf(last)}`;
}

export function groupBy<Item>(items: Item[], keyOf: (item: Item) => number) {
  const groups = new Map<number, Item[]>();
  for (const item of items) groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  return [...groups.entries()].map(([key, members]) => ({ key, members }));
}
