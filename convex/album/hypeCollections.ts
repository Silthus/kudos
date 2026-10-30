import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { HypeReactedEvent } from "../bus/events";
import type { MemberId } from "../workspace/directory";
import { hypeByReactionsCollectFor } from "./flag";
import { recordReactionsSticker } from "./stickers";

export const reactionsToCollect = 10;

export type ReactionsToward = { have: number; need: number };

type HypeCollected = Doc<"hypesCollected">;

export async function collectByReactions(ctx: MutationCtx, { workspace, giver, owner, author, at }: HypeReactedEvent): Promise<void> {
  if (giver === owner || author !== owner) return;
  if ((await collectedBy(ctx, giver, owner)) !== null || !(await hypeByReactionsCollectFor(ctx, giver))) return;
  if ((await reactionsToward(ctx, giver, owner)).have < reactionsToCollect) return;
  await ctx.db.insert("hypesCollected", { workspace, member: giver, person: owner, at });
  await recordReactionsSticker(ctx, giver, owner, at);
}

export async function reactionsToward(ctx: QueryCtx, giver: MemberId, owner: MemberId): Promise<ReactionsToward> {
  const onOwnMessages = await ctx.db
    .query("hypeReactions")
    .withIndex("by_giver_owner_author", (q) => q.eq("giver", giver).eq("owner", owner).eq("author", owner))
    .take(reactionsToCollect);
  return { have: onOwnMessages.length, need: reactionsToCollect };
}

export function collectedBy(ctx: QueryCtx, member: MemberId, person: MemberId): Promise<HypeCollected | null> {
  return ctx.db
    .query("hypesCollected")
    .withIndex("by_member_person", (q) => q.eq("member", member).eq("person", person))
    .unique();
}

export function peopleCollectedBy(ctx: QueryCtx, member: MemberId, most: number): Promise<HypeCollected[]> {
  return ctx.db
    .query("hypesCollected")
    .withIndex("by_member_person", (q) => q.eq("member", member))
    .take(most);
}
