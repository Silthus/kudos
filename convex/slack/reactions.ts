import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { HugReaction } from "../hugs/reaction";
import { mayGiveHugWith } from "../hugs/hugs";
import type { EventCallback } from "./normalize";
import { isText } from "./richText";
import { withoutSkinTone } from "../workspace/slackEmoji";

type ReactionAdded = {
  type: "reaction_added";
  user?: string;
  reaction?: string;
  item_user?: string;
  item?: { type?: string; channel?: string; ts?: string };
  event_ts?: string;
};

export type ReactionEnvelope = EventCallback & { event: ReactionAdded; authorizations?: Array<{ user_id?: string; is_bot?: boolean }> };

export function isReactionAdded(envelope: EventCallback): envelope is ReactionEnvelope {
  return envelope.event.type === "reaction_added";
}

export const mayHugWith = internalQuery({
  args: { workspace: v.string(), giver: v.string(), emoji: v.string() },
  handler: (ctx, { workspace, giver, emoji }) => mayGiveHugWith(ctx, workspace, giver, withoutSkinTone(emoji)),
});

export function hugReactionOf(envelope: ReactionEnvelope): HugReaction | null {
  const { user, reaction, item_user: author, item, event_ts: eventTs } = envelope.event;
  if (!isText(reaction)) return null;
  if (item?.type !== "message" || !isText(item.channel) || !isText(item.ts) || isDirectMessage(item.channel)) return null;
  if (!isText(user) || !isText(author) || !isText(eventTs) || author === user) return null;
  const appBotUser = appBotUserOf(envelope);
  if (user === appBotUser || author === appBotUser) return null;
  return { workspace: envelope.team_id, giver: user, author, conversation: item.channel, message: item.ts, emoji: reaction, at: Number(eventTs) * 1000 };
}

function isDirectMessage(conversation: string) {
  return conversation.startsWith("D");
}

function appBotUserOf({ authorizations }: ReactionEnvelope) {
  return authorizations?.find((authorization) => authorization.is_bot === true)?.user_id;
}
