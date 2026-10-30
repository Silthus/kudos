import type { Id } from "../../_generated/dataModel";
import { internalMutation, type QueryCtx } from "../../_generated/server";
import { memberGreetedEventValidator } from "../../bus/events";
import type { CrateKey } from "../hoggies/crateKey";
import { customEmojiImageOf } from "../../workspace/customEmoji";
import type { MemberId } from "../../workspace/directory";
import { settingsOf } from "../../workspace/settings";
import type { DmLinks } from "../../feedback/dmLinks";
import { earnHoggieItem, welcomeRarities } from "../hoggies/rarityCaps";
import { earnedItemOf, shownWaitingHoggiesOf, type WaitingCount } from "./ledger";
import type { Turned } from "./turn";
import { welcomeItemShownTo } from "./welcomeFlag";

export type LoopLesson = { kudosEmoji: string; kudosEmojiImage: string | null };

export type Taught = { teaches?: LoopLesson };

export const welcomeCrateKey: CrateKey = "welcome:first";

export const earnWelcomeItemOnGreeting = internalMutation({
  args: { event: memberGreetedEventValidator },
  handler: async (ctx, { event: { workspace, member, owesTheWelcomeItem, at } }): Promise<void> => {
    if (owesTheWelcomeItem) await earnHoggieItem(ctx, { workspace, member, key: welcomeCrateKey, reason: { kind: "welcome" }, earnedAt: at }, welcomeRarities);
  },
});

export async function welcomeItemOwedTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await welcomeItemShownTo(ctx, member)) && !(await holdsTheWelcomeItem(ctx, member));
}

export async function shownWaitingHoggiesAtTheWelcomeOf(ctx: QueryCtx, member: MemberId, links: DmLinks | null, owedAtTheWelcome: boolean): Promise<WaitingCount> {
  const notYetEarned = owedAtTheWelcome && !(await holdsTheWelcomeItem(ctx, member)) ? 1 : 0;
  return shownWaitingHoggiesOf(ctx, member, links, { notYetEarned });
}

async function holdsTheWelcomeItem(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await earnedItemOf(ctx, member, "hoggie", welcomeCrateKey)) !== null;
}

export async function lessonAfter(ctx: QueryCtx, owner: { workspace: string; member: MemberId }, item: Id<"items">, { again }: Turned): Promise<Taught> {
  if (again || !(await isTheWelcomeItem(ctx, item)) || !(await welcomeItemShownTo(ctx, owner.member))) return {};
  return { teaches: await loopLessonIn(ctx, owner.workspace) };
}

async function isTheWelcomeItem(ctx: QueryCtx, item: Id<"items">): Promise<boolean> {
  return (await ctx.db.get(item))?.reason.kind === "welcome";
}

export async function loopLessonIn(ctx: QueryCtx, workspace: string): Promise<LoopLesson> {
  const { kudosEmoji } = await settingsOf(ctx, workspace);
  return { kudosEmoji, kudosEmojiImage: (await customEmojiImageOf(ctx, workspace, kudosEmoji)) ?? null };
}
