import { v, type ObjectType } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { withholdingWords } from "../analytics/exceptions";
import { commandsOfferedTo, commandValidator, runCommand } from "../commands/commands";
import { welcomePickOf } from "../feedback/welcome";
import { messageDeletedValidator, messageEventValidator } from "../engine/messageEvent";
import { republish } from "../feedback/homes";
import { xpLevelsOnFor, xpLevelsShownIn } from "../progression/xpLevels";
import type { HomeRefusal } from "../feedback/homeRefusal";
import { directoryEntryValidator, lookup } from "../workspace/directory";
import { recordPerson } from "./directory";
import { reportHomeOpened } from "./appHome";
import { refreshCustomEmojiLater } from "./customEmoji";
import { processEvent } from "./processEvent";
import { hugReactionValidator } from "../hugs/reaction";
import { giveHug } from "../hugs/hugs";

type Receipt = { workspace: string; eventId: string };

const keptForMs = 7 * 24 * 60 * 60 * 1000;
const deletionBatchSize = 500;

const receivedEventArgs = { workspace: v.string(), eventId: v.string(), event: v.union(messageEventValidator, messageDeletedValidator, v.null()) };

type ReceivedEvent = ObjectType<typeof receivedEventArgs>;

export const receive = internalMutation({
  args: receivedEventArgs,
  handler: withholdingWords(async (ctx: MutationCtx, { event, ...receipt }: ReceivedEvent) => {
    if (await isRedelivered(ctx, receipt)) return;
    const observation = await processEvent(ctx, event);
    if (observation?.kind !== "ignored") await ctx.db.insert("slackReceipts", receipt);
  }),
});

export const receiveReaction = internalMutation({
  args: { eventId: v.string(), reaction: hugReactionValidator },
  handler: async (ctx, { eventId, reaction }) => {
    const receipt = { workspace: reaction.workspace, eventId };
    if (await isRedelivered(ctx, receipt)) return;
    await ctx.db.insert("slackReceipts", receipt);
    const decision = await giveHug(ctx, reaction);
    if (decision.kind === "unknown-people") await ctx.scheduler.runAfter(0, internal.slack.hugLookups.lookUpHugPeople, { reaction, users: decision.users });
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
  args: {
    workspace: v.string(),
    eventId: v.string(),
    user: v.string(),
    commands: v.array(commandValidator),
    conversation: v.optional(v.string()),
    message: v.optional(v.string()),
    ephemeral: v.optional(v.object({ threadRoot: v.optional(v.string()) })),
  },
  handler: async (ctx, { user, commands, conversation, message, ephemeral, ...receipt }) => {
    const person = await lookup(ctx, receipt.workspace, user);
    const offered = person?.kind === "member" ? await commandsOfferedTo(ctx, person.member, commands) : commands;
    if (offered.length === 0) return;
    if (await isRedelivered(ctx, receipt)) return;
    await ctx.db.insert("slackReceipts", receipt);
    if (person?.kind !== "member") return;
    let refused: HomeRefusal | undefined;
    for (const command of offered) {
      const outcome = await runCommand(ctx, receipt.workspace, person, command, { surface: "slack", idempotencyKey: `slack:${receipt.eventId}` });
      if (outcome !== null && "perk" in outcome && conversation !== undefined) {
        const answeredIn = ephemeral === undefined ? { conversation } : { conversation: user, beside: { conversation, ...ephemeral } };
        await ctx.scheduler.runAfter(0, internal.slack.directMessages.deliverPurchaseReply, { member: person.member, workspace: receipt.workspace, ...answeredIn, outcome });
      }
      if (outcome !== null && ("item" in outcome || "crate" in outcome) && outcome.kind === "refused") refused = outcome;
      if (command.type === "pickPrimaryGroup" && command.surface === "welcome" && conversation !== undefined && message !== undefined) {
        const pick = await welcomePickOf(ctx, person.member, command.group);
        if (pick !== null) await ctx.scheduler.runAfter(0, internal.slack.welcome.updateWelcome, { workspace: receipt.workspace, user, conversation, message, pick });
      }
    }
    await republish(ctx, person.member, refused);
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

export const receiveEmojiChanged = internalMutation({
  args: { workspace: v.string(), eventId: v.string() },
  handler: async (ctx, receipt) => {
    if (await isRedelivered(ctx, receipt)) return;
    await ctx.db.insert("slackReceipts", receipt);
    await refreshCustomEmojiLater(ctx, receipt.workspace);
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
