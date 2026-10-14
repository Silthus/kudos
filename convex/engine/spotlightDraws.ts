import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MessageRef } from "./messageEvent";

export type DrawPoint = { position: number; created: number };

export type Drawn = DrawPoint & { ref: MessageRef };

export type DrawWalk = { after: DrawPoint; through: DrawPoint };

type PositionRange =
  | { kind: "between"; from: number; inclusive: boolean; below?: number }
  | { kind: "tied"; position: number; createdAbove?: number; createdAtMost?: number };

const lowestPosition = 0;

export async function placeInSpotlight(ctx: MutationCtx, ref: MessageRef, drawable: boolean) {
  const draw = await drawOf(ctx, ref);
  if (drawable && draw === null) await ctx.db.insert("spotlightDraws", { ...ref, position: Math.random() });
  if (!drawable && draw !== null) await ctx.db.delete(draw._id);
}

export async function dropFromSpotlight(ctx: MutationCtx, ref: MessageRef) {
  await placeInSpotlight(ctx, ref, false);
}

export function beforeEveryDrawAt(position: number): DrawPoint {
  return { position, created: 0 };
}

export async function* drawnAlong(ctx: QueryCtx, workspace: string, walk: DrawWalk): AsyncGenerator<Drawn> {
  for (const range of rangesAlong(walk)) {
    const rows = ctx.db.query("spotlightDraws").withIndex("by_position", (q) => {
      const inWorkspace = q.eq("workspace", workspace);
      if (range.kind === "tied") {
        const tied = inWorkspace.eq("position", range.position);
        const above = range.createdAbove === undefined ? tied : tied.gt("_creationTime", range.createdAbove);
        return range.createdAtMost === undefined ? above : above.lte("_creationTime", range.createdAtMost);
      }
      const from = range.inclusive ? inWorkspace.gte("position", range.from) : inWorkspace.gt("position", range.from);
      return range.below === undefined ? from : from.lt("position", range.below);
    });
    for await (const { workspace, conversation, message, position, _creationTime } of rows) yield { ref: { workspace, conversation, message }, position, created: _creationTime };
  }
}

function rangesAlong({ after, through }: DrawWalk): PositionRange[] {
  if (comesBefore(after, through)) {
    if (after.position === through.position) return [{ kind: "tied", position: after.position, createdAbove: after.created, createdAtMost: through.created }];
    return [
      { kind: "tied", position: after.position, createdAbove: after.created },
      { kind: "between", from: after.position, inclusive: false, below: through.position },
      { kind: "tied", position: through.position, createdAtMost: through.created },
    ];
  }
  return [
    { kind: "tied", position: after.position, createdAbove: after.created },
    { kind: "between", from: after.position, inclusive: false },
    { kind: "between", from: lowestPosition, inclusive: true, below: through.position },
    { kind: "tied", position: through.position, createdAtMost: through.created },
  ];
}

function comesBefore(one: DrawPoint, other: DrawPoint) {
  return one.position < other.position || (one.position === other.position && one.created < other.created);
}

async function drawOf(ctx: QueryCtx, ref: MessageRef) {
  return ctx.db
    .query("spotlightDraws")
    .withIndex("by_message", (q) => q.eq("workspace", ref.workspace).eq("conversation", ref.conversation).eq("message", ref.message))
    .unique();
}
