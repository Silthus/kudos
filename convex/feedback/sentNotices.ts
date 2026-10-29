import { v, type Infer } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const sentNoticeValidator = v.object({ member: v.id("members"), notice: v.union(v.literal("first-hug-reply"), v.literal("coins-opened")) });

type Notice = Infer<typeof sentNoticeValidator>["notice"];

export async function sendsOnce(ctx: MutationCtx, member: MemberId, notice: Notice): Promise<boolean> {
  if (await wasSent(ctx, member, notice)) return false;
  await ctx.db.insert("sentNotices", { member, notice });
  return true;
}

async function wasSent(ctx: MutationCtx, member: MemberId, notice: Notice) {
  const sent = await ctx.db
    .query("sentNotices")
    .withIndex("by_member_notice", (q) => q.eq("member", member).eq("notice", notice))
    .unique();
  return sent !== null;
}
