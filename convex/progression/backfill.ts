import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../_generated/server";
import { awardsInAwardOrder } from "../engine/awards";
import { catalogue } from "./catalogue";
import { replay } from "./progress";
import { progressOf, recordOnce } from "./progression";

const awardsPerBatch = 100;

export type Backfilled = { awards: number; recorded: number };

type ReplayedBatch = Backfilled & { isDone: boolean; continueCursor: string };

export const backfillEffects = internalAction({
  args: {},
  handler: async (ctx): Promise<Backfilled> => {
    const totals: Backfilled = { awards: 0, recorded: 0 };
    let cursor: string | null = null;
    while (true) {
      const batch: ReplayedBatch = await ctx.runMutation(internal.progression.backfill.replayAwards, { cursor });
      totals.awards += batch.awards;
      totals.recorded += batch.recorded;
      if (batch.isDone) return totals;
      cursor = batch.continueCursor;
    }
  },
});

export const replayAwards = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }): Promise<ReplayedBatch> => {
    const { page, isDone, continueCursor } = await awardsInAwardOrder(ctx, { cursor, numItems: awardsPerBatch });
    let recorded = 0;
    for (const award of page) {
      for (const member of new Set([award.giver, award.recipient])) {
        if (await recordOnce(ctx, replay(await progressOf(ctx, member), award, catalogue))) recorded += 1;
      }
    }
    return { awards: page.length, recorded, isDone, continueCursor };
  },
});
