import { HedgehogCodingGroup, HedgehogKatyPerry, HedgehogMailbox, HedgehogParty } from "@posthog/brand/hoggies";
import type { Hoggie } from "../features";
import type { LadderCard } from "../shell";

export type CategoryId = "giving" | "thanked" | "connections" | "crowd";

export type Category = { id: CategoryId; name: string; blurb: string | null; Emblem: Hoggie };

export const categories: readonly Category[] = [
  { id: "giving", name: "Giving", blurb: "Thanks you hand out, day after day and month after month.", Emblem: HedgehogMailbox },
  { id: "thanked", name: "Being thanked", blurb: "Thanks that find their way back to you.", Emblem: HedgehogKatyPerry },
  { id: "connections", name: "Connections", blurb: "The people you thank and old friends.", Emblem: HedgehogCodingGroup },
  { id: "crowd", name: "Crowd", blurb: null, Emblem: HedgehogParty },
];

export const ladderCategories: Record<LadderCard["ladder"], CategoryId> = {
  generosity: "giving",
  dependability: "giving",
  seasons: "giving",
  recognition: "thanked",
  connections: "connections",
  "old-friends": "connections",
  applause: "crowd",
};

export type Chapter = { category: Category; ladders: LadderCard[] };

export function chaptersOf(ladders: readonly LadderCard[]): Chapter[] {
  const keyed = categories.map((category) => ({ category, ladders: ladders.filter(({ ladder }) => ladderCategories[ladder] === category.id) })).filter(holdsALadder);
  const unkeyed = ladders.filter(({ ladder }) => !Object.hasOwn(ladderCategories, ladder));
  const last = keyed.at(-1);
  if (last === undefined || unkeyed.length === 0) return keyed;
  return [...keyed.slice(0, -1), { ...last, ladders: [...last.ladders, ...unkeyed] }];
}

function holdsALadder({ ladders }: Chapter) {
  return ladders.length > 0;
}

export function categoryAsked(search: string): CategoryId | "overview" {
  const asked = new URLSearchParams(search).get("page");
  return categories.find(({ id }) => id === asked)?.id ?? "overview";
}

export function bookHref(page: CategoryId | "overview") {
  return page === "overview" ? "/book" : `/book?page=${page}`;
}
