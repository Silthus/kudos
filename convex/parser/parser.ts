import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { thoughtfulKudos } from "../progression/gate";
import type { Annotations, CountableContent, Mention, MessageContent } from "../engine/messageEvent";

export type ParseContext = { workspace: string; giver: MemberId | undefined };

export type ParseHook = {
  name: string;
  kudosEmoji?(ctx: QueryCtx, context: ParseContext): Promise<string[]>;
  annotate?(content: MessageContent, context: ParseContext): Annotations;
};

export type KudosMessage = { mentions: Mention[]; kudosEmoji: string[]; perRecipient: number };

const workspaceEmoji: ParseHook = {
  name: "workspace emoji",
  kudosEmoji: async (ctx, { workspace }) => [(await settingsOf(ctx, workspace)).kudosEmoji],
};

export const parseHooks: ParseHook[] = [workspaceEmoji, thoughtfulKudos];

export async function kudosMessageOf(ctx: QueryCtx, content: CountableContent, context: ParseContext): Promise<KudosMessage | null> {
  const kudosEmoji = await kudosEmojiIn(ctx, content, context);
  if (content.mentions.length === 0 || kudosEmoji.length === 0) return null;
  return { mentions: content.mentions, kudosEmoji, perRecipient: kudosEmoji.length };
}

export function annotationsOf(content: MessageContent, context: ParseContext): Annotations {
  return Object.assign({}, ...parseHooks.map((hook) => hook.annotate?.(content, context) ?? {}));
}

export async function fingerprintOf(ctx: QueryCtx, content: CountableContent, context: ParseContext): Promise<string> {
  const mentions = [...new Set(content.mentions.map((mention) => JSON.stringify(mention)))].sort();
  const kudosEmoji = (await kudosEmojiIn(ctx, content, context)).sort();
  return JSON.stringify({ mentions, kudosEmoji });
}

async function kudosEmojiIn(ctx: QueryCtx, content: CountableContent, context: ParseContext) {
  const giversEmoji = new Set(await kudosEmojiOf(ctx, context));
  return content.emoji.filter((name) => giversEmoji.has(name));
}

async function kudosEmojiOf(ctx: QueryCtx, context: ParseContext) {
  const claims = await Promise.all(parseHooks.map((hook) => hook.kudosEmoji?.(ctx, context) ?? []));
  return claims.flat();
}
