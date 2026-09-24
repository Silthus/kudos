import { type Infer, v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { ensureMember, findMember, giveKudos, type GiveResult } from "./engine";
import { joinSpree, offerSpree, withdrawSpreeJoin } from "./sprees";
import { baseEmojiName } from "./lib/parse";
import { attemptKudos, type AttemptInput, findAttempt, reattemptKudos } from "./attempts";
import { guidance } from "./lib/guidance";
import { countEmoji, countNoteWords, mentionedUsers, mentionsGroup, previewText } from "./lib/parse";

const spreeOfferValidator = v.object({
  kind: v.union(v.literal("prompt"), v.literal("note")),
  text: v.string(),
  /** prompt: the Join button's value. */
  attemptId: v.optional(v.id("kudosAttempts")),
  threadTs: v.optional(v.string()),
});

const ingestResult = v.object({
  status: v.string(),
  notificationIds: v.array(v.id("notifications")),
  /** How to fix a failed attempt, shown only to the giver (Slack mrkdwn). */
  guidance: v.optional(v.string()),
  /** The reaction the bot puts on the message; absent for reaction-based giving. */
  attempt: v.optional(
    v.object({
      id: v.id("kudosAttempts"),
      reaction: v.string(),
      /** After an edit: reactions the bot may still show from before, to take off first. */
      staleReactions: v.optional(v.array(v.string())),
    }),
  ),
  /** Clicking the bot's reaction on a kudos that can spree (#94): Join / Not now, or why not. */
  spree: v.optional(spreeOfferValidator),
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

/** Look-ups per message are capped; mentions beyond this are treated as teammates, as before. */
export const MAX_MENTION_LOOKUPS = 20;

/** Which of a message's mentions Kudos has no member row for (a new hire, or nobody at all). */
export const unknownMentions = internalQuery({
  args: { workspaceId: v.id("workspaces"), slackUserIds: v.array(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, { workspaceId, slackUserIds }) => {
    const unknown = [];
    for (const slackUserId of slackUserIds.slice(0, MAX_MENTION_LOOKUPS)) {
      const member = await ctx.db
        .query("members")
        .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspaceId).eq("slackUserId", slackUserId))
        .unique();
      if (!member) unknown.push(slackUserId);
    }
    return unknown;
  },
});

const messageArgs = {
  workspaceId: v.id("workspaces"),
  botUserId: v.string(),
  giverSlackId: v.string(),
  text: v.string(),
  channelId: v.string(),
  channelName: v.optional(v.string()),
  channelPrivate: v.optional(v.boolean()),
  messageTs: v.string(),
  /** Mentions Slack couldn't resolve to a teammate of this workspace (see `unknownMentions`). */
  unknownSlackIds: v.optional(v.array(v.string())),
  /** The thread the message is a reply in, if any. */
  threadTs: v.optional(v.string()),
};
const messageArgsValidator = v.object(messageArgs);

/**
 * A Slack message that may contain kudos (`@ana :taco: :taco:`). Every message carrying the kudos
 * emoji is an attempt: it's recorded once, with the reaction the bot puts on it and, if it
 * failed, how to fix it.
 */
export const ingestMessage = internalMutation({
  args: messageArgs,
  returns: v.union(v.null(), ingestResult),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.status !== "active") return null;
    const amountEach = countEmoji(args.text, workspace.emojiName);
    if (amountEach === 0) return null;
    // Re-delivered messages must not give, react or explain twice: `attemptKudos` finds the
    // message's attempt. Messages given before attempts were recorded: look for the giver's own
    // message row (a Slack message has one author), since the first may be a teammate's reaction.
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

    const attempted = await attemptKudos(ctx, await messageAttempt(ctx, workspace, args));
    if (!attempted) return null;
    const { result, attempt } = attempted;
    if (result.status === "given") await refreshGiverHome(ctx, workspace._id, args.giverSlackId);
    return {
      ...summarize(result),
      ...(attempt?.guidance ? { guidance: attempt.guidance.slack } : {}),
      ...(attempt ? { attempt: { id: attempt.id, reaction: attempt.reaction } } : {}),
    };
  },
});

/**
 * The author edited a message (`text` is the new text). Only a failed attempt (⏳ or ❌) is judged
 * again; kudos already sent never change, and the author is told so privately.
 */
export const ingestEdit = internalMutation({
  args: {
    ...messageArgs,
    /** Identifies this edit, so a redelivery of it is a no-op. */
    editTs: v.string(),
    /** The text before the edit, when Slack sends it. */
    previousText: v.optional(v.string()),
  },
  returns: v.union(v.null(), ingestResult),
  handler: async (ctx, { editTs, previousText, ...args }) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.status !== "active") return null;
    const edit = { ts: editTs, text: args.text, previousText };
    const reattempt = await reattemptKudos(ctx, await messageAttempt(ctx, workspace, args), edit);
    if (!reattempt) return null;
    if (reattempt.status === "already_given") return { status: reattempt.status, notificationIds: [], guidance: reattempt.note };
    const { result, attempt, staleReactions } = reattempt;
    if (result.status === "given") await refreshGiverHome(ctx, workspace._id, args.giverSlackId);
    return {
      ...summarize(result),
      ...(attempt.guidance ? { guidance: attempt.guidance.slack } : {}),
      attempt: { id: attempt.id, reaction: attempt.reaction, staleReactions },
    };
  },
});

/** A Slack message with the kudos emoji, as an attempt by its author. */
async function messageAttempt(ctx: MutationCtx, workspace: Doc<"workspaces">, args: Infer<typeof messageArgsValidator>): Promise<AttemptInput> {
  return {
    workspace,
    giverSlackId: args.giverSlackId,
    recipientSlackIds: mentionedUsers(args.text),
    unknownSlackIds: args.unknownSlackIds,
    groupMention: mentionsGroup(args.text),
    amountEach: countEmoji(args.text, workspace.emojiName),
    channelId: args.channelId,
    channelName: args.channelName,
    channelPrivate: args.channelPrivate,
    messageTs: args.messageTs,
    ...(args.threadTs ? { threadTs: args.threadTs } : {}),
    text: await readablePreview(ctx, workspace._id, args.text),
    noteWords: countNoteWords(args.text, workspace.emojiName, workspace.emojiGlyph),
    source: "message",
    excludeSlackIds: [args.botUserId],
    now: Date.now(),
  };
}

async function refreshGiverHome(ctx: MutationCtx, workspaceId: Id<"workspaces">, slackUserId: string) {
  await ctx.scheduler.runAfter(0, internal.slack.refreshHome, { workspaceId, slackUserId });
}

/**
 * A reaction added to a message. Clicking the bot's reaction on a kudos that can spree offers to
 * join it (#94); otherwise reacting with the kudos emoji gives the message author one kudos, if the
 * workspace allows reaction-giving.
 */
export const ingestReaction = internalMutation({
  args: {
    /** The reaction's name as Slack sends it (maybe with a skin tone); the kudos emoji if absent. */
    reaction: v.optional(v.string()),
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
  handler: async (ctx, args): Promise<Infer<typeof ingestResult> | null> => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.status !== "active") return null;
    const reaction = args.reaction ?? workspace.emojiName;
    const offer = await offerSpree(ctx, workspace, args.reactorSlackId, args.channelId, args.messageTs, reaction, Date.now());
    if (offer) return { status: "spree", notificationIds: [], ...(offer.kind === "silent" ? {} : { spree: offer }) };
    if (!workspace.reactionsEnabled || baseEmojiName(reaction) !== workspace.emojiName) return null;
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

/** A reaction taken off a message: the bot's reaction on a spree joined today withdraws the join (#94). */
export const ingestUnreaction = internalMutation({
  args: { workspaceId: v.id("workspaces"), reactorSlackId: v.string(), channelId: v.string(), messageTs: v.string(), reaction: v.string() },
  returns: v.union(v.null(), v.object({ text: v.string(), threadTs: v.optional(v.string()) })),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.status !== "active") return null;
    const member = await findMember(ctx, workspace, args.reactorSlackId);
    if (!member) return null;
    const text = await withdrawSpreeJoin(ctx, workspace, member, args.channelId, args.messageTs, args.reaction, Date.now());
    if (!text) return null;
    const attempt = await findAttempt(ctx, workspace._id, args.channelId, args.messageTs);
    return { text, ...(attempt?.threadTs ? { threadTs: attempt.threadTs } : {}) };
  },
});

/** Join on a spree prompt (a Slack button): what to tell the clicker. DMs of a tier it reached go out on their own. */
export const spreeInteraction = internalMutation({
  args: { teamId: v.string(), slackUserId: v.string(), userTeamId: v.optional(v.string()), attemptId: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_team", (q) => q.eq("slackTeamId", args.teamId))
      .unique();
    const attemptId = ctx.db.normalizeId("kudosAttempts", args.attemptId);
    if (!workspace || workspace.status !== "active" || !attemptId) return "This spree is over.";
    // People from other workspaces in a shared channel never take part.
    if (args.userTeamId && args.userTeamId !== args.teamId) return "Only teammates in this workspace can join its sprees.";
    const member = await ensureMember(ctx, workspace, args.slackUserId);
    return (await joinSpree(ctx, workspace, member, attemptId, Date.now())).text;
  },
});
