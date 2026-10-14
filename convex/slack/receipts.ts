import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { commandValidator, runCommand } from "../commands/commands";
import { welcomePickOf } from "../feedback/welcome";
import { messageEventValidator } from "../engine/messageEvent";
import { republish } from "../feedback/homes";
import { xpLevelsOnFor, xpLevelsShownIn } from "../progression/xpLevels";
import { directoryEntryValidator, lookup } from "../workspace/directory";
import { recordPerson } from "./directory";
import { reportHomeOpened } from "./appHome";
import { processEvent } from "./processEvent";

type Receipt = { workspace: string; eventId: string };

const keptForMs = 7 * 24 * 60 * 60 * 1000;
const deletionBatchSize = 500;

export const receive = internalMutation({
  args: { workspace: v.string(), eventId: v.string(), event: v.union(messageEventValidator, v.null()) },
  handler: async (ctx, { event, ...receipt }) => {
    if (await isRedelivered(ctx, receipt)) return;
    const observation = await processEvent(ctx, event);
    if (observation?.kind !== "ignored") await ctx.db.insert("slackReceipts", receipt);
  },
});

export const receiveHomeOpened = internalMutation({
  args: { workspace: v.string(), eventId: v.string(), user: v.string(), at: v.number() },
  handler: async (ctx, { user, at, ...receipt }) => {
    if (await isRedelivered(ctx, receipt)) return;
    await ctx.db.insert("slackReceipts", receipt);
    const opening = { workspace: receipt.workspace, user, at };
    const reported = await reportHomeOpened(ctx, opening);
    await ctx.scheduler.runAfter(0, internal.slack.appHome.publishHome, {
      workspace: receipt.workspace,
      user,
      opened: await isLevelShownToOpener(ctx, opening),
      ...(reported === "unknown-person" && { unreportedOpeningAt: at }),
    });
  },
});

export const receiveHomeClick = internalMutation({
  args: { workspace: v.string(), eventId: v.string(), user: v.string(), commands: v.array(commandValidator), conversation: v.optional(v.string()), message: v.optional(v.string()) },
  handler: async (ctx, { user, commands, conversation, message, ...receipt }) => {
    if (await isRedelivered(ctx, receipt)) return;
    await ctx.db.insert("slackReceipts", receipt);
    const person = await lookup(ctx, receipt.workspace, user);
    if (person?.kind !== "member") return;
    for (const command of commands) {
      const outcome = await runCommand(ctx, receipt.workspace, person, command, `slack:${receipt.eventId}`);
      if (outcome !== null && conversation !== undefined) await ctx.scheduler.runAfter(0, internal.slack.directMessages.deliverPurchaseReply, { member: person.member, workspace: receipt.workspace, conversation, outcome });
      if (command.type === "pickPrimaryGroup" && command.surface === "welcome" && conversation !== undefined && message !== undefined) {
        const pick = await welcomePickOf(ctx, person.member, command.group);
        if (pick !== null) await ctx.scheduler.runAfter(0, internal.slack.welcome.updateWelcome, { workspace: receipt.workspace, user, conversation, message, pick });
      }
    }
    await republish(ctx, person.member);
  },
});

export const receiveMemberChanged = internalMutation({
  args: { workspace: v.string(), eventId: v.string(), user: v.string(), entry: directoryEntryValidator, asOf: v.number() },
  handler: async (ctx, { eventId, ...directoryRecord }) => {
    const receipt = { workspace: directoryRecord.workspace, eventId };
    if (await isRedelivered(ctx, receipt)) return;
    await ctx.db.insert("slackReceipts", receipt);
    await recordPerson(ctx, directoryRecord);
  },
});

export const receiveUserGroupChanged = internalMutation({
  args: { workspace: v.string(), eventId: v.string(), group: v.string() },
  handler: async (ctx, { group, ...receipt }) => {
    if (await isRedelivered(ctx, receipt)) return;
    await ctx.db.insert("slackReceipts", receipt);
    await ctx.scheduler.runAfter(0, internal.slack.userGroups.refreshUserGroup, { workspace: receipt.workspace, group });
  },
});

export const deleteExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("slackReceipts")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", Date.now() - keptForMs))
      .take(deletionBatchSize);
    await Promise.all(expired.map((receipt) => ctx.db.delete(receipt._id)));
    if (expired.length === deletionBatchSize) await ctx.scheduler.runAfter(0, internal.slack.receipts.deleteExpired, {});
  },
});

async function isRedelivered(ctx: QueryCtx, receipt: Receipt) {
  const existing = await ctx.db
    .query("slackReceipts")
    .withIndex("by_event", (q) => q.eq("workspace", receipt.workspace).eq("eventId", receipt.eventId))
    .unique();
  return existing !== null;
}

async function isLevelShownToOpener(ctx: MutationCtx, { workspace, user }: { workspace: string; user: string }) {
  const person = await lookup(ctx, workspace, user);
  return person?.kind === "member" ? xpLevelsOnFor(ctx, person.member) : xpLevelsShownIn(ctx, workspace);
}
