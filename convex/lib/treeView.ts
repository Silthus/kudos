import { number } from "./gameBlocks";
import { escapeMrkdwn } from "./slack";
import { DISTRICTS, RING_GROWTH, TREE_STAGE_BY_ID, TREE_STAGES, type TreeStageId } from "./tree";

/**
 * How the Ancient Tree reads in words (#154, design plan #152 S9): the stage-up post in the
 * announcement channel and the tree's section on App Home and in `/kudos tree`. Pure; the rules
 * themselves are `lib/tree.ts`.
 */

const plural = (n: number, one: string, many: string) => `${number(n)} ${n === 1 ? one : many}`;
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const nextStage = (stage: TreeStageId) => TREE_STAGES[TREE_STAGE_BY_ID[stage].index + 1] ?? null;

/** "an ancient tree at 2,000 growth", or past the world tree, the next ring. */
export function nextStageText(stage: TreeStageId): string {
  const next = nextStage(stage);
  return next ? `${next.name} at ${number(next.growth)} growth` : `a new ring every ${number(RING_GROWTH)} growth`;
}

/** The receiver's kudos DM (#154): "2 seeds to plant at the tree". */
export function seedsToPlantText(n: number): string {
  return `${plural(n, "seed", "seeds")} to plant at the tree`;
}

/** The one-line summary of `/kudos tree`. */
export function treeSummaryText(view: TreeView): string {
  if (!view.planted) return "The desert is waiting: the first seed planted at the tree plants the Ancient Seed.";
  const next = nextStage(view.stage);
  return `The Ancient Tree is ${TREE_STAGE_BY_ID[view.stage].name}: ${number(view.toNext)} growth to ${next?.name ?? "its next ring"}.`;
}

/** The announcement channel's post when the tree reaches a new stage (never for rings). */
export function stageUpText(stage: TreeStageId): string {
  return `The Ancient Tree is now ${TREE_STAGE_BY_ID[stage].name}. Next: ${nextStageText(stage)}.`;
}

/** The tree as App Home and `/kudos tree` show it to one member. */
export type TreeView = {
  /** False while the workspace is still a desert: no seed has been planted yet. */
  planted: boolean;
  stage: TreeStageId;
  growth: number;
  /** Growth still needed for the next stage (or ring), from current growth. */
  toNext: number;
  rings: number;
  districtsOpen: number;
  seedsToPlant: number;
};

/** The tree's section: its stage, the way to the next one, the districts open and the member's seeds. */
export function treeBlocks(view: TreeView, world: string | null): object[] {
  const stage = TREE_STAGE_BY_ID[view.stage];
  const fields = view.planted
    ? [
        `*${capitalise(stage.name)}*${view.rings > 0 ? ` · ${plural(view.rings, "ring", "rings")}` : ""}\n${number(view.growth)} growth`,
        `*Next*\n${number(view.toNext)} growth to ${nextStage(view.stage)?.name ?? "the next ring"}`,
        `*Districts open*\n${view.districtsOpen} of ${DISTRICTS.length}`,
        `*Seeds to plant*\n${number(view.seedsToPlant)}`,
      ]
    : [`*A desert*\nThe first seed planted at the tree plants the Ancient Seed.`, `*Seeds to plant*\n${number(view.seedsToPlant)}`];
  const hint =
    view.seedsToPlant > 0
      ? `Plant your ${plural(view.seedsToPlant, "seed", "seeds")} at the tree: each one is sap. Seeds plant themselves after 30 days.`
      : "Every thoughtful kudos sows a seed for the person you thank.";
  return [
    { type: "header", text: { type: "plain_text", text: "The Ancient Tree" } },
    { type: "section", fields: fields.map((text) => ({ type: "mrkdwn", text })) },
    { type: "context", elements: [{ type: "mrkdwn", text: escapeMrkdwn(hint) }] },
    ...(world ? [{ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Visit the tree" }, url: world, action_id: "open_tree" }] }] : []),
  ];
}
