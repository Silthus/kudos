import type { HomeStageId } from "./homes";

/**
 * The demo's homes on the tree (#160, design plan #152 S10): ten teammates' homes at varied stages
 * round Lumen Labs' elder tree, three of them building their next stage, and a few guestbooks with
 * lanterns from earlier weeks. Alex has no home, so a visitor can buy a plot and build.
 *
 * Plots are numbered as `lib/tree.ts layout().homes`. The world leaves a gap where a district stands
 * on a plot (`src/world/world.ts`); `src/world/homes.test.ts` checks every plot here stands clear in
 * the demo's world, so no seeded home goes undrawn.
 */
export type DemoHome = {
  who: string;
  plot: number;
  /** Its stage: finished, and past that the next one under way when `buildingFor` says so. */
  stage: HomeStageId;
  /** The next stage under way since this many days ago. */
  buildingFor?: number;
};

export const DEMO_HOMES: DemoHome[] = [
  { who: "UDEMOLENA", plot: 12, stage: "canopy_manor" },
  { who: "UDEMOPRIYA", plot: 4, stage: "lantern_lodge" },
  { who: "UDEMOFREYA", plot: 22, stage: "timber_house", buildingFor: 6 },
  { who: "UDEMOJONAS", plot: 9, stage: "timber_house" },
  { who: "UDEMONORA", plot: 20, stage: "leaf_hut" },
  { who: "UDEMOSOFIA", plot: 1, stage: "leaf_hut", buildingFor: 3 },
  { who: "UDEMOCHLOE", plot: 14, stage: "planks" },
  { who: "UDEMODIEGO", plot: 0, stage: "planks" },
  { who: "UDEMOAIKO", plot: 5, stage: "sky" },
  { who: "UDEMOMATEO", plot: 8, stage: "sky", buildingFor: 1 },
];

/** Lanterns left in guestbooks in weeks gone by: whose home, who left it, how many weeks ago. */
export const DEMO_LANTERNS: { home: string; by: string; weeksAgo: number; note: string }[] = [
  { home: "UDEMOLENA", by: "UDEMOPRIYA", weeksAgo: 1, note: "Thanks for the tea and the long talk on Friday." },
  { home: "UDEMOLENA", by: "UDEMOYOU", weeksAgo: 2, note: "Stopped by after the offsite. Thank you for hosting us all." },
  { home: "UDEMOLENA", by: "UDEMOEMIL", weeksAgo: 4, note: "The coziest canopy on the tree." },
  { home: "UDEMOPRIYA", by: "UDEMOJONAS", weeksAgo: 1, note: "Your lantern lodge glows all the way to the gallery." },
  { home: "UDEMOPRIYA", by: "UDEMOSAMIR", weeksAgo: 3, note: "Came by to say the incident write-up saved my week." },
  { home: "UDEMOSOFIA", by: "UDEMOFREYA", weeksAgo: 1, note: "The leaf hut suits you. Can't wait for the timber house!" },
  { home: "UDEMOSOFIA", by: "UDEMOYOU", weeksAgo: 5, note: "Love the scarves. Very you." },
  { home: "UDEMOCHLOE", by: "UDEMOKWAME", weeksAgo: 2, note: "Good planks. Thanks for the launch post." },
];
