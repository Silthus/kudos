import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { giveKudos, type GiveResult } from "./engine";
import { mentionedUsers, parseKudosMessage, previewText } from "./lib/parse";

const ingestResult = v.object({
  status: v.string(),
  notificationIds: v.array(v.id("notifications")),
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

/** A Slack message that may contain kudos (`@ana :taco: :taco:`). */
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
    const parsed = parseKudosMessage(args.text, workspace.emojiName);
    if (!parsed) return null;
    // Edited or re-delivered messages must not give twice.
    const already = await ctx.db
      .query("kudos")
      .withIndex("by_message", (q) =>
        q.eq("workspaceId", workspace._id).eq("channelId", args.channelId).eq("messageTs", args.messageTs),
      )
      .first();
    if (already && already.source === "message") return null;

    const result = await giveKudos(ctx, {
      workspace,
      giverSlackId: args.giverSlackId,
      recipientSlackIds: parsed.recipients,
      amountEach: parsed.amountEach,
      channelId: args.channelId,
      channelName: args.channelName,
      channelPrivate: args.channelPrivate,
      messageTs: args.messageTs,
      text: await readablePreview(ctx, workspace._id, args.text),
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
    return summarize(result);
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
    return summarize(result);
  },
});
