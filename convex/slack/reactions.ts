import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { HugReaction } from "../hugs/reaction";
import { settingsOf } from "../workspace/settings";
import type { EventCallback } from "./normalize";
import { isText } from "./richText";

type ReactionAdded = {
  type: "reaction_added";
  user?: string;
  reaction?: string;
  item_user?: string;
  item?: { type?: string; channel?: string; ts?: string };
  event_ts?: string;
};

export type ReactionEnvelope = EventCallback & { event: ReactionAdded; authorizations?: Array<{ user_id?: string; is_bot?: boolean }> };

const skinToneSuffix = /::skin-tone-[2-6]$/;

export function isReactionAdded(envelope: EventCallback): envelope is ReactionEnvelope {
  return envelope.event.type === "reaction_added";
}

export const kudosEmojiOf = internalQuery({
  args: { workspace: v.string() },
  handler: async (ctx, { workspace }) => (await settingsOf(ctx, workspace)).kudosEmoji,
});

export function hugReactionOf(envelope: ReactionEnvelope, kudosEmoji: string): HugReaction | null {
  const { user, reaction, item_user: author, item, event_ts: eventTs } = envelope.event;
  if (!isText(reaction) || withoutSkinTone(reaction) !== kudosEmoji) return null;
  if (item?.type !== "message" || !isText(item.channel) || !isText(item.ts) || isDirectMessage(item.channel)) return null;
  if (!isText(user) || !isText(author) || !isText(eventTs) || author === user) return null;
  const appBotUser = appBotUserOf(envelope);
  if (user === appBotUser || author === appBotUser) return null;
  return { workspace: envelope.team_id, giver: user, author, conversation: item.channel, message: item.ts, emoji: reaction, at: Number(eventTs) * 1000 };
}

export function withoutSkinTone(emoji: string): string {
  return emoji.replace(skinToneSuffix, "");
}

function isDirectMessage(conversation: string) {
  return conversation.startsWith("D");
}

function appBotUserOf({ authorizations }: ReactionEnvelope) {
  return authorizations?.find((authorization) => authorization.is_bot === true)?.user_id;
}
