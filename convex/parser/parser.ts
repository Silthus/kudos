import type { MutationCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { thoughtfulKudos } from "../progression/gate";
import { ownedKudosEmojiHook } from "../store/inventory";
import type { Annotations, CountableContent, Mention, MessageContent } from "../engine/messageEvent";

export type ParseContext = { workspace: string; giver: MemberId | undefined };

export type ParseHook = {
  name: string;
  kudosEmoji?(ctx: MutationCtx, context: ParseContext): Promise<string[]>;
  annotate?(content: MessageContent, context: ParseContext): Annotations;
};

export type KudosMessage = { mentions: Mention[]; kudosEmoji: string[]; perRecipient: number; ownedEmoji: string[] };

const workspaceEmoji: ParseHook = {
  name: "workspace emoji",
  kudosEmoji: async (ctx, { workspace }) => [(await settingsOf(ctx, workspace)).kudosEmoji],
};

export const parseHooks: ParseHook[] = [workspaceEmoji, ownedKudosEmojiHook, thoughtfulKudos];

export async function kudosMessageOf(ctx: MutationCtx, content: CountableContent, context: ParseContext): Promise<KudosMessage | null> {
  if (content.mentions.length === 0) return null;
  const claims = await claimsOf(ctx, context);
  const kudosEmoji = claimedIn(content, claims);
  if (kudosEmoji.length === 0) return null;
  const ownedEmoji = [...new Set(claimedIn(content, claims.filter(({ hook }) => hook === ownedKudosEmojiHook)))];
  return { mentions: content.mentions, kudosEmoji, perRecipient: kudosEmoji.length, ownedEmoji };
}

export function annotationsOf(content: MessageContent, context: ParseContext): Annotations {
  return Object.assign({}, ...parseHooks.map((hook) => hook.annotate?.(content, context) ?? {}));
}

export async function fingerprintOf(ctx: MutationCtx, content: CountableContent, context: ParseContext): Promise<string> {
  const mentions = [...new Set(content.mentions.map((mention) => JSON.stringify(mention)))].sort();
  const kudosEmoji = (await kudosEmojiIn(ctx, content, context)).sort();
  return JSON.stringify({ mentions, kudosEmoji });
}

async function kudosEmojiIn(ctx: MutationCtx, content: CountableContent, context: ParseContext) {
  return claimedIn(content, await claimsOf(ctx, context));
}

type Claim = { hook: ParseHook; claimed: Set<string> };

function claimsOf(ctx: MutationCtx, context: ParseContext): Promise<Claim[]> {
  return Promise.all(parseHooks.map(async (hook) => ({ hook, claimed: new Set(await (hook.kudosEmoji?.(ctx, context) ?? [])) })));
}

function claimedIn({ emoji }: CountableContent, claims: Claim[]) {
  return emoji.filter((name) => claims.some(({ claimed }) => claimed.has(name)));
}
