import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { giveKudos, type GiveResult } from "./engine";
import { attemptKudos, findAttempt } from "./attempts";
import { guidance } from "./lib/guidance";
import { countEmoji, countNoteWords, mentionedUsers, previewText } from "./lib/parse";

const ingestResult = v.object({
  status: v.string(),
  notificationIds: v.array(v.id("notifications")),
  /** How to fix a failed attempt, shown only to the giver (Slack mrkdwn). */
  guidance: v.optional(v.string()),
  /** The reaction the bot puts on the message; absent for reaction-based giving. */
  attempt: v.optional(v.object({ id: v.id("kudosAttempts"), reaction: v.string() })),
});

/** Readable preview of a Slack message, with every mention resolved to a name. */
async function readablePreview(
  ctx: Parameters<typeof giveKudos>[0],
  workspaceId: Id<"workspaces">,
  text: string,
  max?: number,
) {
  const names = new Map<string, string>();
  for (const id of mentionedUsers(text)) {
    const m = await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspaceId).eq("slackUserId", id))
      .unique();
    if (m) names.set(id, m.name);
  }
  return previewText(text, (id) => names.get(id), max);
}

function summarize(result: GiveResult) {
  return { status: result.status, notificationIds: result.notificationIds };
}

/**
 * A Slack message that may contain kudos (`@ana :taco: :taco:`). Every message carrying the kudos
 * emoji is an attempt: it's recorded once, with the reaction the bot puts on it and, if it
 * failed, how to fix it.
 */
export const ingestMessage = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    botUserId: v.string(),
    giverSlackId: v.string(),
    text: v.string(),
    channelId: v.string(),
    channelName: v.optional(v.string()),
    channelPrivate: v.optional(v.boolean()),
    messageTs: v.string(),
  },
  returns: v.union(v.null(), ingestResult),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.status !== "active") return null;
    const amountEach = countEmoji(args.text, workspace.emojiName);
    if (amountEach === 0) return null;
    // Re-delivered messages must not give, react or explain twice.
    if (await findAttempt(ctx, workspace._id, args.channelId, args.messageTs)) return null;
    // Messages given before attempts were recorded: look for the giver's own message row (a Slack
    // message has one author), since the message's first row may be a teammate's reaction to it.
    const giver = await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspace._id).eq("slackUserId", args.giverSlackId))
      .unique();
    if (giver) {
      const alreadyGiven = await ctx.db
        .query("kudos")
        .withIndex("by_message_giver_source", (q) =>
          q
            .eq("workspaceId", workspace._id)
            .eq("channelId", args.channelId)
            .eq("messageTs", args.messageTs)
            .eq("giverId", giver._id)
            .eq("source", "message"),
        )
        .first();
      if (alreadyGiven) return null;
    }

    const { result, attempt } = await attemptKudos(ctx, {
      workspace,
      giverSlackId: args.giverSlackId,
      recipientSlackIds: mentionedUsers(args.text),
      amountEach,
      channelId: args.channelId,
      channelName: args.channelName,
      channelPrivate: args.channelPrivate,
      messageTs: args.messageTs,
      text: await readablePreview(ctx, workspace._id, args.text),
      noteWords: countNoteWords(args.text, workspace.emojiName, workspace.emojiGlyph),
      source: "message",
      excludeSlackIds: [args.botUserId],
      now: Date.now(),
    });
    if (result.status === "given") {
      await ctx.scheduler.runAfter(0, internal.slack.refreshHome, {
        workspaceId: workspace._id,
        slackUserId: args.giverSlackId,
      });
    }
    return {
      ...summarize(result),
      ...(attempt?.guidance ? { guidance: attempt.guidance.slack } : {}),
      ...(attempt ? { attempt: { id: attempt.id, reaction: attempt.reaction } } : {}),
    };
  },
});

/** Reacting with the kudos emoji gives the message author one kudos. */
export const ingestReaction = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    botUserId: v.string(),
    reactorSlackId: v.string(),
    authorSlackId: v.string(),
    channelId: v.string(),
    channelName: v.optional(v.string()),
    channelPrivate: v.optional(v.boolean()),
    messageTs: v.string(),
    messageText: v.optional(v.string()),
  },
  returns: v.union(v.null(), ingestResult),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.status !== "active" || !workspace.reactionsEnabled) return null;
    const giver = await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) =>
        q.eq("workspaceId", workspace._id).eq("slackUserId", args.reactorSlackId),
      )
      .unique();
    if (giver) {
      const alreadyReacted = await ctx.db
        .query("kudos")
        .withIndex("by_message_giver_source", (q) =>
          q
            .eq("workspaceId", workspace._id)
            .eq("channelId", args.channelId)
            .eq("messageTs", args.messageTs)
            .eq("giverId", giver._id)
            .eq("source", "reaction"),
        )
        .first();
      if (alreadyReacted) return null;
    }
    const snippet = args.messageText ? await readablePreview(ctx, workspace._id, args.messageText, 200) : "";
    const result = await giveKudos(ctx, {
      workspace,
      giverSlackId: args.reactorSlackId,
      recipientSlackIds: [args.authorSlackId],
      amountEach: 1,
      channelId: args.channelId,
      channelName: args.channelName,
      channelPrivate: args.channelPrivate,
      messageTs: args.messageTs,
      text: snippet ? `Reacted with :${workspace.emojiName}: to “${snippet}”` : `Reacted with :${workspace.emojiName}:`,
      source: "reaction",
      excludeSlackIds: [args.botUserId],
      now: Date.now(),
    });
    // There's no message of the giver's own to react to: the explanation goes with the reply.
    const help =
      result.status === "limit"
        ? guidance({ kind: "limit", people: 1, amountEach: 1, remaining: result.remaining, limit: workspace.dailyLimit }, `:${workspace.emojiName}:`)
        : undefined;
    return { ...summarize(result), guidance: help };
  },
});
