import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { awardsInCreationOrder, givenMessagesInAwardOrder } from "../engine/awards";
import { hugsInCreationOrder, paidHugsInCreationOrder } from "../hugs/records";
import { noteGivingDay } from "./counts";
import { countGivenHug, countReceivedHug } from "./hugs";
import { countGiven, countReceived, fillRunningTotal } from "./totals";

type Progress = { pages: number; messages: number };

type Page = { cursor: string; isDone: boolean; messages: number };

type Filled = { pages: number; filled: number };

type FilledPage = { cursor: string; isDone: boolean; filled: number };

type Recognitions = { kudosReceived: number; hugsGiven: number; hugsReceived: number };

type CountedPage = { cursor: string; isDone: boolean; counted: number };

type PageArgs = { cursor: string | null; pageSize: number };

const pageArgs = { cursor: v.union(v.string(), v.null()), pageSize: v.number() };

const defaultPageSize = 100;

export const countEarlierKudos = observedAction({
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

export const fillRunningTotals = observedAction({
  args: { pageSize: v.optional(v.number()) },
  handler: async (ctx, { pageSize = defaultPageSize }): Promise<Filled> => {
    const progress = { pages: 0, filled: 0 };
    let cursor: string | null = null;
    for (;;) {
      const page: FilledPage = await ctx.runMutation(internal.leaderboard.backfill.fillRunningTotalsPage, { cursor, pageSize });
      progress.pages += 1;
      progress.filled += page.filled;
      if (page.isDone) return progress;
      cursor = page.cursor;
    }
  },
});

export const fillRunningTotalsPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), pageSize: v.number() },
  handler: async (ctx, { cursor, pageSize }): Promise<FilledPage> => {
    const page = await ctx.db.query("givenTotals").paginate({ cursor, numItems: pageSize });
    let filled = 0;
    for (const total of page.page) if (await fillRunningTotal(ctx, total)) filled += 1;
    return { cursor: page.continueCursor, isDone: page.isDone, filled };
  },
});

export const countEarlierRecognitions = observedAction({
  args: { pageSize: v.optional(v.number()) },
  handler: async (ctx, { pageSize = defaultPageSize }): Promise<Recognitions> => ({
    kudosReceived: await countedInPages((cursor) => ctx.runMutation(internal.leaderboard.backfill.countEarlierKudosReceivedPage, { cursor, pageSize })),
    hugsGiven: await countedInPages((cursor) => ctx.runMutation(internal.leaderboard.backfill.countEarlierHugsGivenPage, { cursor, pageSize })),
    hugsReceived: await countedInPages((cursor) => ctx.runMutation(internal.leaderboard.backfill.countEarlierHugsReceivedPage, { cursor, pageSize })),
  }),
});

export const countEarlierKudosReceivedPage = internalMutation({
  args: pageArgs,
  handler: async (ctx, { cursor, pageSize }: PageArgs): Promise<CountedPage> => {
    const page = await awardsInCreationOrder(ctx, { cursor, numItems: pageSize });
    let counted = 0;
    for (const award of page.page) {
      await noteGivingDay(ctx, { workspace: award.workspace, member: award.giver, day: award.day });
      if (await countReceived(ctx, award, award)) counted += 1;
    }
    return { cursor: page.continueCursor, isDone: page.isDone, counted };
  },
});

export const countEarlierHugsGivenPage = internalMutation({
  args: pageArgs,
  handler: async (ctx, { cursor, pageSize }: PageArgs): Promise<CountedPage> => {
    const page = await hugsInCreationOrder(ctx, { cursor, numItems: pageSize });
    let counted = 0;
    for (const { workspace, conversation, message, giver, day } of page.page) if (await countGivenHug(ctx, { workspace, giver, message: { workspace, conversation, message }, day })) counted += 1;
    return { cursor: page.continueCursor, isDone: page.isDone, counted };
  },
});

export const countEarlierHugsReceivedPage = internalMutation({
  args: pageArgs,
  handler: async (ctx, { cursor, pageSize }: PageArgs): Promise<CountedPage> => {
    const page = await paidHugsInCreationOrder(ctx, { cursor, numItems: pageSize });
    let counted = 0;
    for (const { hug: { workspace, conversation, message, giver, at }, person } of page.page) if (await countReceivedHug(ctx, { workspace, giver, person, message: { workspace, conversation, message }, at })) counted += 1;
    return { cursor: page.continueCursor, isDone: page.isDone, counted };
  },
});

async function countedInPages(countPage: (cursor: string | null) => Promise<CountedPage>) {
  let counted = 0;
  let cursor: string | null = null;
  for (;;) {
    const page: CountedPage = await countPage(cursor);
    counted += page.counted;
    if (page.isDone) return counted;
    cursor = page.cursor;
  }
}
