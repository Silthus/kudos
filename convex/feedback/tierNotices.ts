import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { tierNameOf, tierRefValidator, type TierRef } from "../achievements/ladders";
import type { MessageRef } from "../engine/messageEvent";
import { openedAtOf } from "../unlocks/unlocks";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { notify } from "./notify";
import { setPublicSection, type PublicSection } from "./publicReplies";
import { isOpened } from "./unlockFilter";

export const tierNoticeValidator = v.object({
  member: v.id("members"),
  workspace: v.string(),
  conversation: v.string(),
  message: v.string(),
  tiers: v.array(tierRefValidator),
});

export type TiersEarned = { member: MemberId; message: MessageRef; at: number; earned: TierRef[] };

export async function tellTiersEarned(ctx: MutationCtx, { member, message, at, earned }: TiersEarned) {
  if (earned.length === 0 || !(await wasOpenedBy(ctx, member, at))) return;
  const notice = await tierNoticeRow(ctx, member, message);
  const told = notice?.tiers ?? [];
  const untold = earned.filter((tier) => !told.some((each) => isSameTier(each, tier)));
  if (untold.length === 0) return;
  const tiers = [...told, ...untold];
  if (notice === null) await ctx.db.insert("tierNotices", { member, ...message, tiers });
  else await ctx.db.patch(notice._id, { tiers });
  await notify(ctx, member, { kind: "tiers-earned", tiers: untold });
  const { user } = await chatUserOf(ctx, member);
  await setPublicSection(ctx, message, tierSection(member, user, tiers));
}

function tierSection(member: MemberId, user: string, tiers: TierRef[]): PublicSection {
  const names = listOf(tiers.map(tierNameOf));
  return { key: `achievement:${user}`, member, about: "achievement", line: [{ text: "🏅 " }, { mention: { kind: "person", user } }, { text: ` earned ${names}.` }] };
}

function listOf(names: string[]) {
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

async function wasOpenedBy(ctx: QueryCtx, member: MemberId, at: number) {
  const openedAt = await openedAtOf(ctx, member, "book");
  return openedAt !== null && openedAt <= at && (await isOpened(ctx, member, "book"));
}

function isSameTier(one: TierRef, other: TierRef) {
  return one.ladder === other.ladder && one.tier === other.tier;
}

function tierNoticeRow(ctx: QueryCtx, member: MemberId, { workspace, conversation, message }: MessageRef) {
  return ctx.db
    .query("tierNotices")
    .withIndex("by_member_message", (q) => q.eq("member", member).eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .unique();
}
