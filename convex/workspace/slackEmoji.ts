import type { QueryCtx } from "../_generated/server";
import { customEmojiImageOf, customEmojiListedIn, originalCustomEmojiOf, originalCustomEmojiStartingWith, type ListedEmoji } from "./customEmoji";

export type SlackEmoji = ListedEmoji;

export function slackEmojiImageOf(ctx: QueryCtx, workspace: string, name: string): Promise<string | undefined> {
  return customEmojiImageOf(ctx, workspace, name);
}

export function slackEmojiNamed(ctx: QueryCtx, workspace: string, name: string): Promise<SlackEmoji | null> {
  return originalCustomEmojiOf(ctx, workspace, name);
}

export function slackEmojiStartingWith(ctx: QueryCtx, workspace: string, typed: string, limit: number): Promise<SlackEmoji[]> {
  return originalCustomEmojiStartingWith(ctx, workspace, typed, limit);
}

export function slackEmojiListedIn(ctx: QueryCtx, workspace: string, most: number): Promise<SlackEmoji[]> {
  return customEmojiListedIn(ctx, workspace, most);
}
