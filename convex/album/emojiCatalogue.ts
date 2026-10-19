import { milestoneCatalogue } from "./milestoneCatalogue";

export const emojiLevels = [5, 10, 15, 20, 25] as const;

export const milestoneGoldNames = milestoneCatalogue.milestones.map(({ id, steps: [, , gold] }) => ({ milestone: id, gold: gold.name }));
