import type { Rarity } from "../../crates/drops";
import { categories, type CategoryId } from "../categories";

export type Spread = { kind: "cover" } | { kind: "hoggies"; rarity: Rarity } | { kind: "teams" } | { kind: "team"; team: string } | { kind: "achievements"; category: CategoryId | "all" };

export type SpreadTab = "cover" | "hoggies" | "teams" | "achievements";

export const rarestFirst: readonly Rarity[] = ["legendary", "epic", "rare", "uncommon", "common"];

const cover: Spread = { kind: "cover" };

export function spreadIn(hash: string): Spread | undefined {
  const [head, ...rest] = hash.replace(/^#/, "").split("/");
  const tail = rest.join("/");
  if (head === "cover") return cover;
  if (head === "hoggies") return { kind: "hoggies", rarity: rarestFirst.find((rarity) => rarity === tail) ?? "legendary" };
  if (head === "teams") return tail === "" ? { kind: "teams" } : { kind: "team", team: tail };
  if (head === "achievements") return { kind: "achievements", category: categories.find(({ id }) => id === tail)?.id ?? "all" };
  return undefined;
}

export function spreadAsked(spread: Spread | undefined, page: CategoryId | "overview" | "collection"): Spread {
  if (spread !== undefined) return spread;
  return page === "overview" || page === "collection" ? cover : { kind: "achievements", category: page };
}

export function spreadHrefOf(spread: Spread) {
  return `/book#${hashOf(spread)}`;
}

function hashOf(spread: Spread) {
  switch (spread.kind) {
    case "cover":
      return "cover";
    case "hoggies":
      return `hoggies/${spread.rarity}`;
    case "teams":
      return "teams";
    case "team":
      return `teams/${spread.team}`;
    case "achievements":
      return spread.category === "all" ? "achievements" : `achievements/${spread.category}`;
  }
}

export function spreadKeyOf(spread: Spread) {
  return hashOf(spread);
}

export function tabOf(spread: Spread): SpreadTab {
  return spread.kind === "team" ? "teams" : spread.kind;
}
