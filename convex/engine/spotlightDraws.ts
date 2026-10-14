import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MessageRef } from "./messageEvent";

export type DrawPoint = { position: number; created: number };

export type Drawn = DrawPoint & { ref: MessageRef };

export type DrawStart = { kind: "at"; position: number } | { kind: "after"; point: DrawPoint };

type PositionRange =
  | { kind: "above"; from: number; inclusive: boolean; below?: number }
  | { kind: "tied"; position: number; created: { above: number } | { atMost: number } };

const lowestPosition = 0;

export async function placeInSpotlight(ctx: MutationCtx, ref: MessageRef, drawable: boolean) {
  const draw = await drawOf(ctx, ref);
  if (drawable && draw === null) await ctx.db.insert("spotlightDraws", { ...ref, position: Math.random() });
  if (!drawable && draw !== null) await ctx.db.delete(draw._id);
}

export async function dropFromSpotlight(ctx: MutationCtx, ref: MessageRef) {
  await placeInSpotlight(ctx, ref, false);
}

export async function* drawnOnceAround(ctx: QueryCtx, workspace: string, start: DrawStart): AsyncGenerator<Drawn> {
  for (const range of onceAroundFrom(start)) {
    const rows = ctx.db.query("spotlightDraws").withIndex("by_position", (q) => {
      const inWorkspace = q.eq("workspace", workspace);
      if (range.kind === "tied") {
        const tied = inWorkspace.eq("position", range.position);
        return "above" in range.created ? tied.gt("_creationTime", range.created.above) : tied.lte("_creationTime", range.created.atMost);
      }
      const from = range.inclusive ? inWorkspace.gte("position", range.from) : inWorkspace.gt("position", range.from);
      return range.below === undefined ? from : from.lt("position", range.below);
    });
    for await (const { workspace, conversation, message, position, _creationTime } of rows) yield { ref: { workspace, conversation, message }, position, created: _creationTime };
  }
}

function onceAroundFrom(start: DrawStart): PositionRange[] {
  if (start.kind === "at") {
    return [
      { kind: "above", from: start.position, inclusive: true },
      { kind: "above", from: lowestPosition, inclusive: true, below: start.position },
    ];
  }
  const { position, created } = start.point;
  return [
    { kind: "tied", position, created: { above: created } },
    { kind: "above", from: position, inclusive: false },
    { kind: "above", from: lowestPosition, inclusive: true, below: position },
    { kind: "tied", position, created: { atMost: created } },
  ];
}

async function drawOf(ctx: QueryCtx, ref: MessageRef) {
  return ctx.db
    .query("spotlightDraws")
    .withIndex("by_message", (q) => q.eq("workspace", ref.workspace).eq("conversation", ref.conversation).eq("message", ref.message))
    .unique();
}
