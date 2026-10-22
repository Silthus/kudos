import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { ReportableError } from "../analytics/exceptions";
import { claimCustomEmojiRefresh, type CustomEmoji } from "../workspace/customEmoji";
import { textOf, workspaceOfToken } from "./directory";
import { nextRateLimitedAttempt, readSlack, retryDelayOf, slackErrorCodeOf } from "./webApi";

type EmojiChanged = { type: "emoji_changed" };

type Listing = { kind: "listed"; emoji: CustomEmoji[]; scopeMissing?: true } | { kind: "rate-limited"; retryAfterMs: number };

const aliasPrefix = "alias:";
const withoutScope = "missing_scope";
const refreshAfterMs = 30_000;
const keptPerWrite = 1_000;
const aliasHopsFollowed = 5;

export function isEmojiChanged(event: { type: string }): event is EmojiChanged {
  return event.type === "emoji_changed";
}

export function emojiChangeOf(workspace: unknown, eventId: unknown) {
  const [team, receipt] = [textOf(workspace), textOf(eventId)];
  return team === undefined || receipt === undefined ? null : { workspace: team, eventId: receipt };
}

export async function refreshCustomEmojiLater(ctx: MutationCtx, workspace: string) {
  if (await claimCustomEmojiRefresh(ctx, workspace, refreshAfterMs)) await ctx.scheduler.runAfter(refreshAfterMs, internal.slack.customEmoji.syncCustomEmoji, {});
}

export const syncCustomEmoji = observedAction({
  args: { attempt: v.optional(v.number()) },
  handler: (ctx, { attempt = 1 }) => listCustomEmoji(ctx, attempt),
});

async function listCustomEmoji(ctx: ActionCtx, attempt: number) {
  const workspace = await workspaceOfToken();
  const listing = await ctx.runMutation(internal.workspace.customEmoji.beginCustomEmojiListing, { workspace });
  const listed = await customEmojiListed();
  if (listed.kind === "rate-limited") {
    await ctx.scheduler.runAfter(listed.retryAfterMs, internal.slack.customEmoji.syncCustomEmoji, { attempt: nextRateLimitedAttempt(attempt, "emoji.list") });
    return;
  }
  const { scopeMissing } = listed;
  for (const emoji of writesOf(listed.emoji)) {
    if (!(await ctx.runMutation(internal.workspace.customEmoji.keepCustomEmoji, { workspace, emoji, listing, ...(scopeMissing && { scopeMissing }) }))) return;
  }
  await ctx.runMutation(internal.workspace.customEmoji.forgetUnlistedCustomEmoji, { workspace, listing });
}

async function customEmojiListed(): Promise<Listing> {
  const answer = await readSlack<{ emoji?: unknown }>("emoji.list", {});
  if (answer.ok) return { kind: "listed", emoji: customEmojiOf(answer.emoji) };
  if (answer.error === withoutScope) return { kind: "listed", emoji: [], scopeMissing: true };
  if (answer.error === "ratelimited") return { kind: "rate-limited", retryAfterMs: retryDelayOf(answer) };
  throw new ReportableError(`Slack emoji.list failed: ${slackErrorCodeOf(answer.error)}`);
}

function customEmojiOf(listed: unknown): CustomEmoji[] {
  if (typeof listed !== "object" || listed === null || Array.isArray(listed)) throw new ReportableError("Slack emoji.list answered without an emoji list");
  const values = new Map(Object.entries(listed));
  return [...values].flatMap(([name, value]) => {
    const original = originalOf(values, name, value, aliasHopsFollowed);
    if (original === undefined) return [];
    return [{ name, image: original.image, ...(original.name !== name && { aliasOf: original.name }) }];
  });
}

function originalOf(values: Map<string, unknown>, name: string, value: unknown, hopsLeft: number): { name: string; image: string } | undefined {
  const text = textOf(value);
  if (!text?.startsWith(aliasPrefix)) {
    const image = httpsUrlOf(text);
    return image === undefined ? undefined : { name, image };
  }
  const aliased = text.slice(aliasPrefix.length);
  return hopsLeft === 0 ? undefined : originalOf(values, aliased, values.get(aliased), hopsLeft - 1);
}

function httpsUrlOf(value: unknown) {
  if (typeof value !== "string" || !URL.canParse(value)) return undefined;
  return new URL(value).protocol === "https:" ? value : undefined;
}

function writesOf(emoji: CustomEmoji[]) {
  const writes = [];
  for (let start = 0; start === 0 || start < emoji.length; start += keptPerWrite) writes.push(emoji.slice(start, start + keptPerWrite));
  return writes;
}
