import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalQuery, type MutationCtx } from "../_generated/server";
import { mentionValidator, type ChatUserId, type Mention, type MessageRef } from "../engine/messageEvent";

export const segmentValidator = v.union(v.object({ text: v.string() }), v.object({ mention: mentionValidator }));

export type Segment = Infer<typeof segmentValidator>;
export type Line = Segment[];

export type SkipReason = "self" | "bot" | "not-a-member" | "group-or-broadcast";
export type SkippedMention = { mention: Mention; reason: SkipReason };

export type Given = { recipients: ChatUserId[]; perRecipient: number; left: number; skipped: SkippedMention[] };
export type OverAllowance = { cost: number; recipients: number; perRecipient: number; left: number };
export type Invalid = { skipped: SkippedMention[] };

export type Reply =
  | { kind: "given"; outcome: Given; base: number; extras?: Line }
  | { kind: "over-allowance"; outcome: OverAllowance; base: number }
  | { kind: "invalid"; outcome: Invalid }
  | { kind: "accepted-message-edited" };

export async function replyPrivately(ctx: MutationCtx, ref: MessageRef, threadRoot: string | undefined, to: ChatUserId, reply: Reply) {
  const id = await ctx.db.insert("privateReplies", { ...ref, ...(threadRoot && { threadRoot }), to, lines: renderReply(reply) });
  await ctx.scheduler.runAfter(0, internal.slack.delivery.deliverPrivateReply, { reply: id });
}

export const privateReply = internalQuery({
  args: { reply: v.id("privateReplies") },
  handler: async (ctx, { reply }) => ctx.db.get(reply),
});

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
