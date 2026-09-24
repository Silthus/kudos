import { ConvexError } from "convex/values";
import { TEAMMATE_UNAVAILABLE, type ComparePeriod } from "../../convex/lib/compare";
import type { Period } from "../../convex/lib/time";
import { nf } from "./format";

/** The period Compare opens with, and the one it uses when a link asks for "all time". */
export const DEFAULT_COMPARE_PERIOD: ComparePeriod = "month";

export type BenchmarkChoice = { kind: "past" } | { kind: "team" } | { kind: "teammate"; memberId: string };

/**
 * What `?vs=` asks for. `past`, a missing value and your own id (you can't be your own teammate) are
 * Past you, `team` is the Team benchmark, and any other value is a teammate id, which the server
 * validates.
 */
export function benchmarkFromParam(vs: string | null, viewerId: string): BenchmarkChoice {
  if (!vs || vs === "past" || vs === viewerId) return { kind: "past" };
  if (vs === "team") return { kind: "team" };
  return { kind: "teammate", memberId: vs };
}

/** A Compare deep link, keeping the caller's period where Compare has it. */
function compareHref(vs: string, period: Period) {
  const p = period === "all" ? DEFAULT_COMPARE_PERIOD : period;
  return `/compare?${new URLSearchParams({ vs, period: p })}`;
}

/** Deep link to a head-to-head with `memberId` (the Leaderboard's row action). */
export const compareWithHref = (memberId: string, period: Period) => compareHref(memberId, period);

/** Deep link to the Team benchmark (the Me page's "Compare in detail"). */
export const compareTeamHref = (period: Period) => compareHref("team", period);

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Picker search: every word of `query` must appear in the name, real name or title (case- and accent-blind). */
export function matchCandidates<T extends { name: string; realName?: string; title?: string }>(query: string, candidates: T[]): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return candidates;
  return candidates.filter((c) => {
    const haystack = fold([c.name, c.realName, c.title].filter(Boolean).join(" "));
    return words.every((w) => haystack.includes(w));
  });
}

/** How a teammate is named in labels and headers: the first word of their Slack display name. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** A Teammate difference as plain text: no colour, no arrow, nobody "wins". */
export function neutralDelta(delta: number) {
  if (delta === 0) return "same";
  return delta > 0 ? `+${nf.format(delta)}` : `−${nf.format(-delta)}`;
}

/** Where the team sits on one metric (see `teamStanding` in `convex/lib/compare.ts`). */
export type TeamDistribution = { n: number; median: number; p25: number | null; p75: number | null; max: number | null };

const statFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** A team statistic: medians and quartiles fall between whole kudos, so they keep one decimal at most. */
export const teamStat = (n: number) => statFormat.format(n);

/** What a range strip shows, in words: its tooltip and its accessible label. */
export function teamSummary(you: number, team: TeamDistribution) {
  return [
    `You ${nf.format(you)}`,
    `Team median ${teamStat(team.median)}`,
    ...(team.p25 !== null && team.p75 !== null ? [`Middle half ${teamStat(team.p25)}–${teamStat(team.p75)}`] : []),
    ...(team.max !== null ? [`Most ${nf.format(team.max)}`] : []),
    `${nf.format(team.n)} teammates`,
  ];
}

/** A share of the team (0–1) as a whole percent, rounded down so "more than N%" is always true. */
export const sharePercent = (share: number) => `${Math.floor(share * 100 + 1e-9)}%`;

/** Whether `error` is the server saying a `?vs=` id isn't a teammate you can compare with (a stale or foreign link). */
export function isTeammateUnavailable(error: unknown) {
  return error instanceof ConvexError && error.data === TEAMMATE_UNAVAILABLE;
}
