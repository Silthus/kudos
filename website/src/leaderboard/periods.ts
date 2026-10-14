import type { Period } from "../shell";

export const periods: { period: Period; label: string; phrase: string }[] = [
  { period: "week", label: "This week", phrase: "the week" },
  { period: "month", label: "This month", phrase: "the month" },
  { period: "all", label: "All time", phrase: "all time" },
];

export function periodNamed(period: Period) {
  return periods.find((each) => each.period === period)!;
}
