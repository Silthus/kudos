import { number } from "./gameBlocks";
import { escapeMrkdwn } from "./slack";
import { DISTRICTS, RING_GROWTH, TREE_STAGE_BY_ID, TREE_STAGES, type TreeStageId } from "./tree";

/**
 * How the Ancient Tree reads in words (#154, design plan #152 S9): the stage-up post in the
 * announcement channel and the tree's section on App Home and in `/kudos tree`. Pure; the rules
 * themselves are `lib/tree.ts`.
 */

/** Seeds a count reads: a member with more sees "100+". */
export const SEEDS_COUNTED = 100;

const plural = (n: number, one: string, many: string) => `${number(n)} ${n === 1 ? one : many}`;
const seedCount = (n: number) => (n >= SEEDS_COUNTED ? `${number(SEEDS_COUNTED)}+` : number(n));
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const nextStage = (stage: TreeStageId) => TREE_STAGES[TREE_STAGE_BY_ID[stage].index + 1] ?? null;

/** "an ancient tree at 2,000 growth", or past the world tree, the next ring. */
export function nextStageText(stage: TreeStageId): string {
  const next = nextStage(stage);
  return next ? `${next.name} at ${number(next.growth)} growth` : `a new ring every ${number(RING_GROWTH)} growth`;
}

/** The receiver's kudos DM (#154): "2 seeds to plant at the tree"; without a number where received counts are hidden (null). */
export function seedsToPlantText(n: number | null): string {
  return n === null ? "Seeds to plant at the tree" : `${seedCount(n)} ${n === 1 ? "seed" : "seeds"} to plant at the tree`;
}

/** The one-line summary of `/kudos tree`. */
export function treeSummaryText(view: TreeView): string {
  if (!view.planted) return "The desert is waiting: the first seed planted at the tree plants the Ancient Seed.";
  return `The Ancient Tree is ${TREE_STAGE_BY_ID[view.stage].name}: ${number(view.toNext)} growth to ${nextName(view.next)}.`;
}

/** The announcement channel's post when the tree reaches a new stage (never for rings). */
export function stageUpText(stage: TreeStageId): string {
  return `The Ancient Tree is now ${TREE_STAGE_BY_ID[stage].name}. Next: ${nextStageText(stage)}.`;
}

/** The tree as App Home and `/kudos tree` show it to one member. */
export type TreeView = {
  /** False while the workspace is still a desert: no seed has been planted yet. */
  planted: boolean;
  /** The stage of the tree's peak growth. */
  stage: TreeStageId;
  growth: number;
  /** The stage after `stage` (past the world tree, its next ring), and the growth it still needs. */
  next: TreeStageId | "ring";
  toNext: number;
  rings: number;
  districtsOpen: number;
  /** Null where the workspace hides received counts even from the member. */
  seedsToPlant: number | null;
  hasSeedsToPlant: boolean;
};

const nextName = (next: TreeStageId | "ring") => (next === "ring" ? "its next ring" : TREE_STAGE_BY_ID[next].name);

/** The tree's section: its stage, the way to the next one, the districts open and the member's seeds. */
export function treeBlocks(view: TreeView, world: string | null): object[] {
  const stage = TREE_STAGE_BY_ID[view.stage];
  const seedsField = `*Seeds to plant*\n${view.seedsToPlant !== null ? seedCount(view.seedsToPlant) : view.hasSeedsToPlant ? "Waiting at the tree" : "None"}`;
  const fields = view.planted
    ? [
        `*${capitalise(stage.name)}*${view.rings > 0 ? ` · ${plural(view.rings, "ring", "rings")}` : ""}\n${number(view.growth)} growth`,
        `*Next*\n${number(view.toNext)} growth to ${nextName(view.next)}`,
        `*Districts open*\n${view.districtsOpen} of ${DISTRICTS.length}`,
        seedsField,
      ]
    : [`*A desert*\nThe first seed planted at the tree plants the Ancient Seed.`, seedsField];
  const yours = view.seedsToPlant === null ? "your seeds" : `your ${seedCount(view.seedsToPlant)} ${view.seedsToPlant === 1 ? "seed" : "seeds"}`;
  const hint = view.hasSeedsToPlant
    ? `Plant ${yours} at the tree: each one is sap. Seeds plant themselves after 30 days.`
    : "Every thoughtful kudos sows a seed for the person you thank.";
  return [
    { type: "header", text: { type: "plain_text", text: "The Ancient Tree" } },
    { type: "section", fields: fields.map((text) => ({ type: "mrkdwn", text })) },
    { type: "context", elements: [{ type: "mrkdwn", text: escapeMrkdwn(hint) }] },
    ...(world ? [{ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Visit the tree" }, url: world, action_id: "open_tree" }] }] : []),
  ];
}
