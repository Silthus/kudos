import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { awardsGivenBefore } from "../engine/awards";
import { catalogue } from "./catalogue";
import { replay } from "./progress";
import { progressOf, record, unrecordedAwardsOf } from "./progression";

const awardsPerBatch = 100;

export type Backfilled = { awards: number; recorded: number };

type ReplayedBatch = Backfilled & { isDone: boolean };

export const backfillEffects = observedAction({
  args: {},
  handler: async (ctx): Promise<Backfilled> => {
    const totals: Backfilled = { awards: 0, recorded: 0 };
    while (true) {
      const batch: ReplayedBatch = await ctx.runMutation(internal.progression.backfill.replayAwards, {});
      totals.awards += batch.awards;
      totals.recorded += batch.recorded;
      if (batch.isDone) return totals;
    }
  },
});

export const replayAwards = internalMutation({
  args: {},
  handler: async (ctx): Promise<ReplayedBatch> => {
    const run = await currentRun(ctx);
    if (run.isDone) return { awards: 0, recorded: 0, isDone: true };
    const { page, isDone, continueCursor } = await awardsGivenBefore(ctx, run.before, { cursor: run.cursor, numItems: awardsPerBatch });
    let recorded = 0;
    for (const award of page) {
      for (const member of [award.giver, award.recipient]) {
        if ((await unrecordedAwardsOf(ctx, member, [award])).length === 0) continue;
        const { state, effects } = replay(await progressOf(ctx, member), award, catalogue);
        await record(ctx, { state, effects });
        recorded += effects.length;
      }
    }
    await ctx.db.patch(run._id, { cursor: continueCursor, isDone });
    return { awards: page.length, recorded, isDone };
  },
});

async function currentRun(ctx: MutationCtx): Promise<Doc<"effectsBackfill">> {
  const run = await ctx.db.query("effectsBackfill").first();
  if (run !== null) return run;
  const started = await ctx.db.insert("effectsBackfill", { before: Date.now(), cursor: null, isDone: false });
  return (await ctx.db.get(started))!;
}
