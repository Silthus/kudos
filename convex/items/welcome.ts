import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { CrateKey } from "../hoggies/crateKey";
import { customEmojiImageOf } from "../workspace/customEmoji";
import type { MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { earnItem } from "./ledger";
import type { Turned } from "./turn";
import { welcomeItemShownTo } from "./welcomeFlag";

export type LoopLesson = { kudosEmoji: string; kudosEmojiImage: string | null };

export type Taught = { teaches?: LoopLesson };

export const welcomeCrateKey: CrateKey = "welcome:first";

export async function earnWelcomeItem(ctx: MutationCtx, workspace: string, member: MemberId, at: number): Promise<void> {
  if (!(await welcomeItemShownTo(ctx, member))) return;
  await earnItem(ctx, { workspace, member, source: "hoggie", key: welcomeCrateKey, floor: "rare", reason: { kind: "welcome" }, earnedAt: at });
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
