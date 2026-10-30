import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { hypeReactedEventValidator, type HypeReactedEvent } from "../bus/events";
import { isMember, type MemberId } from "../workspace/directory";
import { hypeEarnedBy } from "./earnedEmojis";
import { emojiNameOf } from "./emojiNames";

export type Nudge = { person: MemberId; emoji: string; reactions: number };

type HypeReaction = Doc<"hypeReactions">;

type ReactedOwner = { workspace: string; owner: MemberId; reactions: number };

export const mostHypeReactionsRead = 500;

export const keepHypeReaction = internalMutation({
  args: { event: hypeReactedEventValidator },
  handler: async (ctx, { event }) => {
    if (await isKept(ctx, event)) return;
    const { workspace, giver, owner, author, emoji, message, at } = event;
    await ctx.db.insert("hypeReactions", { workspace, giver, owner, author, emoji, conversation: message.conversation, message: message.message, at });
  },
});

export async function nudgesFor(ctx: QueryCtx, member: MemberId, most: number): Promise<Nudge[]> {
  const nudges: Nudge[] = [];
  for (const reacted of reactedOwnersOf(await newestHypeReactionsBy(ctx, member))) {
    if (nudges.length === most) break;
    const nudge = await nudgeOf(ctx, member, reacted);
    if (nudge !== null) nudges.push(nudge);
  }
  return nudges;
}

async function isKept(ctx: MutationCtx, { giver, owner, message }: HypeReactedEvent): Promise<boolean> {
  const kept = await ctx.db
    .query("hypeReactions")
    .withIndex("by_giver_owner_message", (q) => q.eq("giver", giver).eq("owner", owner).eq("conversation", message.conversation).eq("message", message.message))
    .first();
  return kept !== null;
}

function newestHypeReactionsBy(ctx: QueryCtx, giver: MemberId): Promise<HypeReaction[]> {
  return ctx.db
    .query("hypeReactions")
    .withIndex("by_giver_at", (q) => q.eq("giver", giver))
    .order("desc")
    .take(mostHypeReactionsRead);
}

function reactedOwnersOf(newestFirst: HypeReaction[]): ReactedOwner[] {
  const owners = new Map<MemberId, ReactedOwner>();
  for (const { workspace, owner, author } of newestFirst) {
    if (author !== owner) continue;
    const reacted = owners.get(owner) ?? { workspace, owner, reactions: 0 };
    owners.set(owner, { ...reacted, reactions: reacted.reactions + 1 });
  }
  return [...owners.values()].toSorted((a, b) => b.reactions - a.reactions);
}

async function nudgeOf(ctx: QueryCtx, member: MemberId, { workspace, owner, reactions }: ReactedOwner): Promise<Nudge | null> {
  if (!(await isMember(ctx, owner))) return null;
  const emoji = await emojiNameOf(ctx, workspace, `hype:${owner}`);
  if (emoji === null || (await hypeEarnedBy(ctx, member, owner))) return null;
  return { person: owner, emoji, reactions };
}
