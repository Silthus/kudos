import { milestoneCatalogue } from "./milestoneCatalogue";

export const emojiLevels = [5, 10, 15, 20, 25] as const;

export const milestoneGoldNames = milestoneCatalogue.milestones.map(({ id, steps: [, , gold] }) => ({ milestone: id, gold: gold.name }));

const longestSlug = 80;

export function slugOf(source: string): string {
  return source
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, longestSlug)
    .replace(/-+$/, "");
}
