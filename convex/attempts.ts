import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { findMember, giveKudos, type GiveInput, type GiveResult } from "./engine";
import {
  alreadySent,
  type AttemptOutcome,
  guidance,
  INVALID_REACTION,
  type InvalidReason,
  LIMIT_REACTION,
  type Problem,
  reactionFor,
} from "./lib/guidance";
import { sameKudos } from "./lib/parse";

/** The attempt recorded for one Slack message, if it ever carried the kudos emoji. */
export async function findAttempt(ctx: QueryCtx, workspaceId: Id<"workspaces">, channelId: string, messageTs: string) {
  return await ctx.db
    .query("kudosAttempts")
    .withIndex("by_message", (q) => q.eq("workspaceId", workspaceId).eq("channelId", channelId).eq("messageTs", messageTs))
    .unique();
}

/** How an attempt ended and, if it failed, what went wrong. `null`: it wasn't an attempt. */
function judge(result: GiveResult, input: AttemptInput): { outcome: AttemptOutcome; reason?: InvalidReason; problem?: Problem } | null {
  switch (result.status) {
    case "given":
      return { outcome: "given" };
    case "limit":
      return {
        outcome: "limit",
        problem: {
          kind: "limit",
          people: result.people,
          amountEach: input.amountEach,
          remaining: result.remaining,
          limit: input.workspace.dailyLimit,
        },
      };
    case "self":
    case "invalid": {
      const named = result.status === "self" ? "self" : result.reason;
      const reason = named === "no_mention" && input.groupMention ? "group" : named;
      return { outcome: "invalid", reason, problem: { kind: reason } };
    }
    case "ignored":
      return null;
  }
}

export type AttemptInput = GiveInput & {
  messageTs: string;
  /** The message mentions @here, @channel or a user group (which never give kudos). */
  groupMention?: boolean;
  /** The thread the message is a reply in, if any. */
  threadTs?: string;
};

export type Attempt = {
  id: Id<"kudosAttempts">;
  outcome: AttemptOutcome;
  /** Slack reaction name to put on the message; recorded with `setReaction` once Slack shows it. */
  reaction: string;
  /** How to fix a failed attempt, for the giver only: Slack mrkdwn and web text. */
  guidance: { slack: string; web: string } | null;
};

/**
 * Gives kudos for a message that carries the kudos emoji and records how the attempt ended,
 * so the bot can react on the message and a redelivery or an edit can find it later.
 * `null`: the message already has its attempt (a redelivery), nothing happened.
 * Not an attempt at all (a deactivated giver) → `attempt: null`.
 */
export async function attemptKudos(
  ctx: MutationCtx,
  input: AttemptInput,
): Promise<{ result: GiveResult; attempt: Attempt | null } | null> {
  // One attempt per message: re-evaluating one (an edit) must update it, never add another.
  if (await findAttempt(ctx, input.workspace._id, input.channelId, input.messageTs)) return null;
  const result = await giveKudos(ctx, input);
  const verdict = judge(result, input);
  if (!verdict) return { result, attempt: null };
  const giver = (await findMember(ctx, input.workspace, input.giverSlackId))!; // giveKudos made sure it exists
  const id = await ctx.db.insert("kudosAttempts", {
    workspaceId: input.workspace._id,
    channelId: input.channelId,
    messageTs: input.messageTs,
    giverId: giver._id,
    ...(input.threadTs ? { threadTs: input.threadTs } : {}),
    ...outcomeFields(result, verdict, input.now),
  });
  return { result, attempt: describe(id, verdict, input) };
}

/** The author edited a message: its raw Slack text after the edit, and before it if Slack says. */
export type Edit = { ts: string; text: string; previousText?: string };

export type Reattempt =
  /** The attempt had failed and was judged again. */
  | { status: "reattempted"; result: GiveResult; attempt: Attempt; staleReactions: string[] }
  /** The kudos were already sent: nothing changes, the author only hears why. */
  | { status: "already_given"; note: string };

/**
 * An edited message is judged again only if its attempt failed (⏳ or ❌): the edited text is a
 * fresh attempt against today's allowance, and it updates the message's one attempt record.
 * A given attempt never changes; the author is told so if the edit touched the kudos.
 * `null`: nothing to do (no attempt on the message, someone else's, an edit that isn't newer than
 * the last one handled, an unchanged text or kudos, or no longer an attempt at all).
 */
export async function reattemptKudos(ctx: MutationCtx, input: AttemptInput, edit: Edit): Promise<Reattempt | null> {
  const { workspace } = input;
  if (edit.text === edit.previousText) return null;
  const existing = await findAttempt(ctx, workspace._id, input.channelId, input.messageTs);
  // Slack may deliver edits late or out of order: only ever move forward.
  if (!existing || (existing.editTs !== undefined && !isLater(edit.ts, existing.editTs))) return null;
  const giver = await findMember(ctx, workspace, input.giverSlackId);
  if (giver?._id !== existing.giverId) return null;

  if (existing.outcome === "given") {
    await ctx.db.patch(existing._id, { editTs: edit.ts });
    // Without the text before the edit, it may have been a typo fix: stay quiet.
    if (edit.previousText === undefined || sameKudos(edit.previousText, edit.text, workspace.emojiName)) return null;
    return { status: "already_given", note: alreadySent(workspace.unitPlural) };
  }

  const result = await giveKudos(ctx, input);
  const verdict = judge(result, input);
  if (!verdict) return null;
  // `reason: undefined` clears a stale reason once the edit gives or goes over the allowance.
  await ctx.db.patch(existing._id, { reason: undefined, ...outcomeFields(result, verdict, input.now), editTs: edit.ts });
  const attempt = describe(existing._id, verdict, input);
  // Every failure reaction but the new one comes off: the recorded reaction lags behind Slack
  // when two edits overlap or a swap only half worked.
  const staleReactions = [LIMIT_REACTION, INVALID_REACTION].filter((r) => r !== attempt.reaction);
  return { status: "reattempted", result, attempt, staleReactions };
}

/**
 * Slack timestamps (`1790000000.000100`) in time order, exactly (too many digits for a float).
 * The same ts again is not later; the playground's same-millisecond ts differ by a random suffix.
 */
function isLater(ts: string, than: string) {
  const micros = (s: string) => {
    const [, seconds = "0", fraction = ""] = /^(\d+)(?:\.(\d+))?/.exec(s) ?? [];
    return BigInt(seconds) * 1_000_000n + BigInt(fraction.padEnd(6, "0").slice(0, 6));
  };
  return micros(ts) > micros(than) || (micros(ts) === micros(than) && ts !== than);
}

type Verdict = NonNullable<ReturnType<typeof judge>>;

/** How the attempt ended, as recorded. */
function outcomeFields(result: GiveResult, verdict: Verdict, at: number) {
  return {
    outcome: verdict.outcome,
    ...(verdict.reason ? { reason: verdict.reason } : {}),
    ...(result.status === "given" ? { batchId: result.batchId } : {}),
    at,
  };
}

function describe(id: Id<"kudosAttempts">, verdict: Verdict, { workspace }: AttemptInput): Attempt {
  const problem = verdict.problem;
  return {
    id,
    outcome: verdict.outcome,
    reaction: reactionFor(verdict.outcome, workspace.emojiName),
    guidance: problem ? { slack: guidance(problem, `:${workspace.emojiName}:`), web: guidance(problem, workspace.emojiGlyph) } : null,
  };
}

/** Remembers the reaction now shown on the attempt's message (✅ after a fallback). */
export async function recordReaction(ctx: MutationCtx, id: Id<"kudosAttempts">, reaction: string) {
  if (await ctx.db.get(id)) await ctx.db.patch(id, { reaction });
}

/** Slack confirmed the bot's reaction on the message. */
export const setReaction = internalMutation({
  args: { id: v.id("kudosAttempts"), reaction: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, reaction }) => {
    await recordReaction(ctx, id, reaction);
    return null;
  },
});
