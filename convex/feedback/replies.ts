import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { type Annotations, type ChatUserId, type Mention, type MessageRef } from "../engine/messageEvent";
import { couldEarnMoreBySayingWhy } from "../progression/perks";
import { skillTreeAppliesIn } from "../progression/skillTree";
import { questsApplyIn, questsExposedTo } from "../quests/flag";
import type { JourneyStep } from "../quests/step";
import { lookup } from "../workspace/directory";
import { journeyGoalOf } from "./home";

import type { Line, Segment } from "./segments";

export type SkipReason = "self" | "bot" | "not-a-member" | "group-or-broadcast";
export type SkippedMention = { mention: Mention; reason: SkipReason };

export type Given = { recipients: ChatUserId[]; perRecipient: number; left: number; skipped: SkippedMention[] };
export type OverAllowance = { cost: number; recipients: number; perRecipient: number; left: number };
export type Invalid = { skipped: SkippedMention[] };

export type Reply =
  | { kind: "given"; outcome: Given; base: number; annotations: Annotations; extras?: Line }
  | { kind: "over-allowance"; outcome: OverAllowance; base: number }
  | { kind: "invalid"; outcome: Invalid }
  | { kind: "accepted-message-edited" };

export type QuestDone = { kind: "journey"; step: JourneyStep } | { kind: "weekly"; goal: string };

export const questsWaitMs = 10_000;

const hintLine: Line = [{ text: "Add why they earned it to earn more." }];

export async function replyPrivately(ctx: MutationCtx, ref: MessageRef, threadRoot: string | undefined, to: ChatUserId, reply: Reply) {
  const { waitsForQuests, asksWhy } = reply.kind === "given" ? await successReplyFor(ctx, ref.workspace, to, reply.annotations) : notASuccessReply;
  const id = await ctx.db.insert("privateReplies", {
    ...ref,
    ...(threadRoot && { threadRoot }),
    to,
    lines: renderReply(reply),
    ...(asksWhy && { hint: hintLine }),
    ...(waitsForQuests && { held: true as const }),
  });
  if (waitsForQuests) await ctx.scheduler.runAfter(questsWaitMs, internal.feedback.replies.releaseUnreleased, { reply: id });
  else await deliver(ctx, id);
}

const notASuccessReply = { waitsForQuests: false, asksWhy: false };

async function successReplyFor(ctx: MutationCtx, workspace: string, giver: ChatUserId, annotations: Annotations) {
  const person = await lookup(ctx, workspace, giver);
  if (person?.kind !== "member") return notASuccessReply;
  return { waitsForQuests: await questsExposedTo(ctx, person.member), asksWhy: await couldEarnMoreBySayingWhy(ctx, person.member, annotations) };
}

export async function releaseSuccessReply(ctx: MutationCtx, message: MessageRef, questsDone: QuestDone[]) {
  const held = await heldReplyOf(ctx, message);
  if (held !== null) await release(ctx, held, questsDone.length === 0 ? undefined : questsDoneLine(questsDone));
}

export const releaseUnreleased = internalMutation({
  args: { reply: v.id("privateReplies") },
  handler: async (ctx, { reply }) => {
    const row = await ctx.db.get(reply);
    if (row?.held === true) await release(ctx, row, undefined);
  },
});

export const privateReply = internalQuery({
  args: { reply: v.id("privateReplies") },
  handler: async (ctx, { reply }) => {
    const row = await ctx.db.get(reply);
    if (row === null) return null;
    const { questsDone, hint, ...stored } = row;
    const questsStillApply = questsDone !== undefined && (await questsApplyIn(ctx, row.workspace));
    const skillTreeStillApplies = hint !== undefined && (await skillTreeAppliesIn(ctx, row.workspace));
    const extras = extrasLineOf([...(questsStillApply ? [questsDone] : []), ...(skillTreeStillApplies ? [hint] : [])]);
    return { ...stored, lines: extras ? [...row.lines, extras] : row.lines };
  },
});

function heldReplyOf(ctx: QueryCtx, { workspace, conversation, message }: MessageRef) {
  return ctx.db
    .query("privateReplies")
    .withIndex("by_held_message", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message).eq("held", true))
    .first();
}

async function release(ctx: MutationCtx, { _id }: Doc<"privateReplies">, questsDone: Line | undefined) {
  await ctx.db.patch(_id, { held: undefined, questsDone });
  await deliver(ctx, _id);
}

async function deliver(ctx: MutationCtx, reply: Id<"privateReplies">) {
  await ctx.scheduler.runAfter(0, internal.slack.delivery.deliverPrivateReply, { reply });
}

function questsDoneLine(questsDone: QuestDone[]): Line {
  const goals = new Set(questsDone.map((done) => withoutFullStop(done.kind === "journey" ? journeyGoalOf(done.step) : done.goal)));
  return [{ text: [...goals].map((goal) => `Quest done: ${goal}`).join(" · ") }];
}

function extrasLineOf(parts: Line[]): Line | undefined {
  if (parts.length === 0) return undefined;
  return parts.flatMap((part, index) => (index === 0 ? part : [{ text: " · " }, ...part]));
}

function withoutFullStop(goal: string) {
  return goal.endsWith(".") ? goal.slice(0, -1) : goal;
}

export function renderReply(reply: Reply): Line[] {
  switch (reply.kind) {
    case "given":
      return [givenLine(reply.outcome, reply.base), ...skippedLines(reply.outcome.skipped), ...(reply.extras ? [reply.extras] : [])];
    case "over-allowance":
      return [overAllowanceLine(reply.outcome, reply.base)];
    case "invalid":
      return [invalidLine(reply.outcome)];
    case "accepted-message-edited":
      return [[{ text: "This message already gave kudos, so your edit doesn't change them. To give more, send a new message." }]];
  }
}

function givenLine({ recipients, perRecipient, left }: Given, base: number): Line {
  const whatIsLeft = left > 0 ? `You have ${left} kudos left today.` : `That was your last kudos for today, and you'll have ${base} more at midnight.`;
  return [...listOf(recipients.map((user) => [person(user)])), { text: ` got ${perRecipient} kudos from you. ${whatIsLeft}` }];
}

function overAllowanceLine({ cost, recipients, perRecipient, left }: OverAllowance, base: number): Line {
  return [
    {
      text: `This needs ${cost} kudos (${people(recipients)} × ${perRecipient} kudos emoji), but you have ${left} left today. Edit the message to give fewer and I'll try again, or edit it after midnight when you have ${base} again.`,
    },
  ];
}

function invalidLine({ skipped }: Invalid): Line {
  const reasons = skippedByReason(skipped).map(({ reason }) => reason);
  return [{ text: "Nobody in this message can receive kudos: " }, ...listOf(reasons), { text: ". Tag a teammate and edit the message to try again." }];
}

function skippedLines(skipped: SkippedMention[]): Line[] {
  return skippedByReason(skipped).map(({ mentions, reason }) => [{ text: "I skipped " }, ...listOf(mentions.map((mention) => [{ mention }])), { text: ": " }, ...reason, { text: "." }]);
}

function skippedByReason(skipped: SkippedMention[]) {
  const byReason = new Map<string, { mentions: Mention[]; reason: Line }>();
  for (const { mention, reason } of skipped) {
    const line = reasonLine(reason, mention);
    const key = JSON.stringify(line);
    const group = byReason.get(key) ?? { mentions: [], reason: line };
    group.mentions.push(mention);
    byReason.set(key, group);
  }
  return [...byReason.values()];
}

function reasonLine(reason: SkipReason, mention: Mention): Line {
  switch (reason) {
    case "self":
      return [{ text: "you can't give kudos to yourself" }];
    case "bot":
      return [{ text: "bots don't receive kudos" }];
    case "not-a-member":
      return [{ mention }, { text: " isn't an active member of this workspace" }];
    case "group-or-broadcast":
      return [{ text: "`@here`, `@channel` and user groups don't receive kudos, so tag people individually" }];
  }
}

function listOf(items: Line[]): Line {
  return items.flatMap((item, index) => {
    if (index === 0) return item;
    return [{ text: index === items.length - 1 ? " and " : ", " }, ...item];
  });
}

function person(user: ChatUserId): Segment {
  return { mention: { kind: "person", user } };
}

function people(count: number) {
  return count === 1 ? "1 person" : `${count} people`;
}
