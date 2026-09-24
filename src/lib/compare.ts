import type { ComparePeriod } from "../../convex/lib/compare";
import type { Period } from "../../convex/lib/time";
import { nf } from "./format";

/** The period Compare opens with, and the one it uses when a link asks for "all time". */
export const DEFAULT_COMPARE_PERIOD: ComparePeriod = "month";

export type BenchmarkChoice = { kind: "past" } | { kind: "teammate"; memberId: string };

/**
 * What `?vs=` asks for. `past` and anything the page doesn't offer yet (`team`) are Past you, and so
 * is your own id, since you can't be your own teammate. Any other value is a teammate id, which the
 * server validates.
 */
export function benchmarkFromParam(vs: string | null, viewerId: string): BenchmarkChoice {
  if (!vs || vs === "past" || vs === "team" || vs === viewerId) return { kind: "past" };
  return { kind: "teammate", memberId: vs };
}

/** Deep link to a head-to-head with `memberId`, keeping the caller's period where Compare has it. */
export function compareWithHref(memberId: string, period: Period) {
  const p = period === "all" ? DEFAULT_COMPARE_PERIOD : period;
  return `/compare?${new URLSearchParams({ vs: memberId, period: p })}`;
}

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
