import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { earnTrayItem } from "../album/opening";
import { earnPackItemsOf } from "../album/packs";
import { dropLevelUpHoggies, type LevelUp } from "../unlocks/levelUpHoggies";
import type { MemberId } from "../workspace/directory";
import { waitingPageOf } from "./ledger";

export const mostFilledOfAKind = 100;

const fillStepValidator = v.object({ member: v.id("members"), kind: v.union(v.literal("packs"), v.literal("tray"), v.literal("levels")), cursor: v.optional(v.string()) });

type FillStep = Infer<typeof fillStepValidator>;

type Filled = { isDone: boolean; continueCursor: string };

export const fillItems = internalMutation({
  args: { step: v.optional(fillStepValidator) },
  returns: v.null(),
  handler: async (ctx, { step }) => {
    const filling = step ?? (await firstStepAfter(ctx, 0));
    const next = filling === null ? null : await fill(ctx, filling);
    if (next !== null) await ctx.scheduler.runAfter(0, internal.items.fill.fillItems, { step: next });
    return null;
  },
});

const fillers = { packs: fillPacks, tray: fillTray, levels: revealLevels } as const;

async function fill(ctx: MutationCtx, step: FillStep): Promise<FillStep | null> {
  const { isDone, continueCursor } = await fillers[step.kind](ctx, step);
  if (!isDone) return { ...step, cursor: continueCursor };
  if (step.kind === "packs") return { member: step.member, kind: "tray" };
  if (step.kind === "tray") return { member: step.member, kind: "levels" };
  return stepAfterTheMember(ctx, step.member);
}

async function stepAfterTheMember(ctx: QueryCtx, member: MemberId): Promise<FillStep | null> {
  const filled = await ctx.db.get(member);
  return filled === null ? null : firstStepAfter(ctx, filled._creationTime);
}

async function fillPacks(ctx: MutationCtx, { member, cursor }: FillStep): Promise<Filled> {
  const { page, isDone, continueCursor } = await ctx.db
    .query("thoughtfulPacks")
    .withIndex("by_giver_opened_at", (q) => q.eq("giver", member).eq("openedAt", undefined))
    .paginate({ cursor: cursor ?? null, numItems: mostFilledOfAKind });
  for (const pack of page) await earnPackItemsOf(ctx, pack);
  return { isDone, continueCursor };
}

async function fillTray(ctx: MutationCtx, { member, cursor }: FillStep): Promise<Filled> {
  const { page, isDone, continueCursor } = await ctx.db
    .query("trayItems")
    .withIndex("by_member_put_in", (q) => q.eq("member", member).eq("putInAt", undefined))
    .paginate({ cursor: cursor ?? null, numItems: mostFilledOfAKind });
  for (const item of page) await earnTrayItemOf(ctx, item);
  return { isDone, continueCursor };
}

async function revealLevels(ctx: MutationCtx, { member, cursor }: FillStep): Promise<Filled> {
  const { page, isDone, continueCursor } = await waitingPageOf(ctx, member, cursor ?? null, mostFilledOfAKind);
  for (const levelUp of levelUpsAmong(page)) await dropLevelUpHoggies(ctx, levelUp);
  return { isDone, continueCursor };
}

function levelUpsAmong(items: Doc<"items">[]): LevelUp[] {
  const reached = new Map<number, LevelUp>();
  for (const { workspace, member, reason, earnedAt } of items) if (reason.kind === "levelUp") reached.set(reason.level, { workspace, member, level: reason.level, at: earnedAt });
  return [...reached.values()];
}

async function earnTrayItemOf(ctx: MutationCtx, item: Doc<"trayItems">) {
  const pack = await ctx.db.get(item.pack);
  if (pack !== null) await earnTrayItem(ctx, item, pack);
}

async function firstStepAfter(ctx: QueryCtx, after: number): Promise<FillStep | null> {
  const next = await ctx.db
    .query("members")
    .withIndex("by_creation_time", (q) => q.gt("_creationTime", after))
    .first();
  return next === null ? null : { member: next._id, kind: "packs" };
}
