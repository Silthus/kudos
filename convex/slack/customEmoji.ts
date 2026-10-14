import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { ReportableError } from "../analytics/exceptions";
import { claimCustomEmojiRefresh, type CustomEmoji } from "../workspace/customEmoji";
import { textOf } from "./directory";
import { readSlack, slackErrorCodeOf, type SlackFailure } from "./webApi";

type EmojiChanged = { type: "emoji_changed" };

type Listing = { kind: "listed"; emoji: CustomEmoji[] } | { kind: "without-scope" } | { kind: "rate-limited"; retryAfterMs: number };

const aliasPrefix = "alias:";
const withoutScope = "missing_scope";
const refreshAfterMs = 30_000;
const keptPerWrite = 1_000;
const maxAttempts = 3;
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
  if (listed.kind === "without-scope") return;
  if (listed.kind === "rate-limited") {
    await ctx.scheduler.runAfter(listed.retryAfterMs, internal.slack.customEmoji.syncCustomEmoji, { attempt: nextAttempt(attempt) });
    return;
  }
  for (const emoji of writesOf(listed.emoji)) {
    if (!(await ctx.runMutation(internal.workspace.customEmoji.keepCustomEmoji, { workspace, emoji, listing }))) return;
  }
  await ctx.runMutation(internal.workspace.customEmoji.forgetUnlistedCustomEmoji, { workspace, listing });
}

async function customEmojiListed(): Promise<Listing> {
  const answer = await readSlack<{ emoji?: unknown }>("emoji.list", {});
  if (answer.ok) return { kind: "listed", emoji: customEmojiOf(answer.emoji) };
  if (answer.error === withoutScope) return { kind: "without-scope" };
  if (answer.error === "ratelimited") return { kind: "rate-limited", retryAfterMs: retryDelayOf(answer) };
  throw new ReportableError(`Slack emoji.list failed: ${slackErrorCodeOf(answer.error)}`);
}

async function workspaceOfToken() {
  const identity = await readSlack<{ team_id?: unknown }>("auth.test", {});
  if (!identity.ok) throw new ReportableError(`Slack auth.test failed: ${slackErrorCodeOf(identity.error)}`);
  const workspace = textOf(identity.team_id);
  if (workspace === undefined) throw new ReportableError("Slack auth.test answered without a team");
  return workspace;
}

function customEmojiOf(listed: unknown): CustomEmoji[] {
  if (typeof listed !== "object" || listed === null || Array.isArray(listed)) throw new ReportableError("Slack emoji.list answered without an emoji list");
  const values = new Map(Object.entries(listed));
  return [...values].flatMap(([name, value]) => {
    const image = imageOf(values, value, aliasHopsFollowed);
    return image === undefined ? [] : [{ name, image }];
  });
}

function imageOf(values: Map<string, unknown>, value: unknown, hopsLeft: number): string | undefined {
  const text = textOf(value);
  if (!text?.startsWith(aliasPrefix)) return httpsUrlOf(text);
  return hopsLeft === 0 ? undefined : imageOf(values, values.get(text.slice(aliasPrefix.length)), hopsLeft - 1);
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

function nextAttempt(attempt: number) {
  if (attempt >= maxAttempts) throw new ReportableError("Slack emoji.list stayed rate limited");
  return attempt + 1;
}

function retryDelayOf({ retryAfterMs }: SlackFailure) {
  return typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) ? retryAfterMs : 1_000;
}
