import { memberDecisionWithoutWriting, type Flag } from "../analytics/flags";
import type { QueryCtx } from "../_generated/server";
import { customEmojiImageOf, customEmojiListedIn, originalCustomEmojiOf, originalCustomEmojiStartingWith, type ListedEmoji } from "./customEmoji";
import type { MemberId } from "./directory";
import { standardEmojiListed, standardEmojiNamed, standardEmojiStartingWith } from "./standardEmoji";

export type SlackEmoji = ListedEmoji;

export type SlackEmojiReach = "custom" | "customAndStandard";

export const standardEmojiFlag = { key: "standard-emoji", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export async function slackEmojiReachOf(ctx: QueryCtx, member: MemberId): Promise<SlackEmojiReach> {
  return (await memberDecisionWithoutWriting(ctx, standardEmojiFlag, member)) ? "customAndStandard" : "custom";
}

export async function slackEmojiImageOf(ctx: QueryCtx, workspace: string, name: string): Promise<string | undefined> {
  return (await customEmojiImageOf(ctx, workspace, name)) ?? standardEmojiNamed(name)?.image;
}

export async function slackEmojiNamed(ctx: QueryCtx, workspace: string, name: string, reach: SlackEmojiReach): Promise<SlackEmoji | null> {
  return (await originalCustomEmojiOf(ctx, workspace, name)) ?? standardIn(reach, () => standardEmojiNamed(name)) ?? null;
}

export async function slackEmojiStartingWith(ctx: QueryCtx, workspace: string, typed: string, limit: number, reach: SlackEmojiReach): Promise<SlackEmoji[]> {
  const custom = await originalCustomEmojiStartingWith(ctx, workspace, typed, limit);
  return withStandardAfter(custom, standardIn(reach, () => standardEmojiStartingWith(typed, limit)) ?? []).slice(0, limit);
}

export async function slackEmojiListedIn(ctx: QueryCtx, workspace: string, most: number, reach: SlackEmojiReach): Promise<SlackEmoji[]> {
  const custom = await customEmojiListedIn(ctx, workspace, most);
  return withStandardAfter(custom, standardIn(reach, standardEmojiListed) ?? []).slice(0, most);
}

function withStandardAfter(custom: SlackEmoji[], standard: readonly SlackEmoji[]): SlackEmoji[] {
  const customNames = new Set(custom.map(({ name }) => name));
  return [...custom, ...standard.filter(({ name }) => !customNames.has(name))];
}

function standardIn<Found>(reach: SlackEmojiReach, find: () => Found): Found | undefined {
  return reach === "customAndStandard" ? find() : undefined;
}
