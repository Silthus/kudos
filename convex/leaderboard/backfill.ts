import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../_generated/server";
import { givenMessagesInAwardOrder } from "../engine/awards";
import { countGiven } from "./totals";

type Progress = { pages: number; messages: number };

type Page = { cursor: string; isDone: boolean; messages: number };

const defaultPageSize = 100;

export const countEarlierKudos = internalAction({
  args: { pageSize: v.optional(v.number()) },
  handler: async (ctx, { pageSize = defaultPageSize }): Promise<Progress> => {
    const progress = { pages: 0, messages: 0 };
    let cursor: string | null = null;
    for (;;) {
      const page: Page = await ctx.runMutation(internal.leaderboard.backfill.countEarlierKudosPage, { cursor, pageSize });
      progress.pages += 1;
      progress.messages += page.messages;
      if (page.isDone) return progress;
      cursor = page.cursor;
    }
  },
});

export const countEarlierKudosPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), pageSize: v.number() },
  handler: async (ctx, { cursor, pageSize }): Promise<Page> => {
    const page = await givenMessagesInAwardOrder(ctx, cursor, pageSize);
    let counted = 0;
    for (const given of page.messages) if (await countGiven(ctx, given)) counted += 1;
    return { cursor: page.cursor, isDone: page.isDone, messages: counted };
  },
});
