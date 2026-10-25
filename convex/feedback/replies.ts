import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Award } from "../engine/awards";
import { type Annotations, type ChatUserId, type Mention, type MessageRef } from "../engine/messageEvent";
import { couldEarnMoreBySayingWhy, sayingWhyEarnsMore } from "../progression/perks";
import { perkOf } from "../progression/tree";
import { bonusLineValidator, type BonusLine } from "../progression/progress";
import { giverLinesOf, giverXpOf } from "../progression/progression";
import { skillTreeAppliesIn } from "../progression/skillTree";
import { bonusGainsShownTo, questGainsShownTo, xpGainsShownTo } from "../progression/gainsView";
import { xpLevelsShownTo } from "../progression/xpLevels";
import { journeyStepNamedTo, questsHoldTheReplyOf } from "../quests/flag";
import { isOnboardingStep, onboardingGoalOf } from "../quests/onboarding";
import { rewardWaits } from "../quests/crates";
import { journeyGoalOf } from "../quests/journeyCopy";
import { withoutFullStop } from "../quests/pool";
import { journeyStepValidator } from "../quests/step";
import { placeOf, wantsMessage } from "../messageSettings/messageSettings";
import { coinsShownTo, coinsVisibleTo } from "../wallet/visibility";
import { lookup, type MemberId } from "../workspace/directory";
import { coinsPartOf } from "./coins";
import { deepLinkOf, deepLinks, type DeepLink } from "./deepLinks";
import type { Line, Segment } from "./segments";
import { settingsFooterFor } from "./settingsFooter";
import { hoggieRewardOf } from "./waitingHoggies";

export const questDoneValidator = v.union(
  v.object({ kind: v.literal("journey"), step: journeyStepValidator, xp: v.number(), coins: v.optional(v.number()), heldRewardKey: v.optional(v.string()), hoggie: v.optional(v.literal(true)) }),
  v.object({ kind: v.literal("weekly"), goal: v.string(), xp: v.number(), coins: v.optional(v.number()), heldRewardKey: v.optional(v.string()), hoggie: v.optional(v.literal(true)) }),
);

export type QuestDone = Infer<typeof questDoneValidator>;

type Shown<Done> = Done extends unknown ? Omit<Done, "heldRewardKey"> & { waiting: boolean } : never;

type QuestDoneShown = Shown<QuestDone>;

export const gainsValidator = v.object({
  xp: v.number(),
  coins: v.optional(v.number()),
  questsDone: v.optional(v.array(questDoneValidator)),
  bonus: v.optional(v.array(bonusLineValidator)),
});

type Gains = Infer<typeof gainsValidator>;

type GainsShown = Omit<Required<Gains>, "questsDone"> & { questsDone: QuestDoneShown[] };

export type SkipReason = "self" | "bot" | "not-a-member" | "group-or-broadcast";
export type SkippedMention = { mention: Mention; reason: SkipReason };

export type Given = { recipients: ChatUserId[]; perRecipient: number; left: number; skipped: SkippedMention[]; awards: Pick<Award, "kudos">[] };
export type OverAllowance = { cost: number; recipients: number; perRecipient: number; left: number };
export type Invalid = { skipped: SkippedMention[] };

export type Reply =
  | { kind: "given"; outcome: Given; base: number; annotations: Annotations }
  | { kind: "over-allowance"; outcome: OverAllowance; base: number }
  | { kind: "invalid"; outcome: Invalid }
  | { kind: "accepted-message-edited" };

export const questsWaitMs = 10_000;

const hintLine: Line = [{ text: "Add why they earned it to earn more." }];

type WrittenReply = Pick<Doc<"privateReplies">, "given" | "lines" | "gains" | "hint" | "held">;

export async function replyPrivately(ctx: MutationCtx, ref: MessageRef, threadRoot: string | undefined, to: ChatUserId, reply: Reply) {
  const giver = await lookup(ctx, ref.workspace, to);
  const member = giver?.kind === "member" ? giver.member : undefined;
  const written = reply.kind === "given" ? await successReplyWritten(ctx, member, ref, reply) : { lines: renderReply(reply) };
  if (saysNothing(written)) return;
  const id = await ctx.db.insert("privateReplies", { ...ref, ...(threadRoot && { threadRoot }), to, ...written });
  if (written.held) await ctx.scheduler.runAfter(questsWaitMs, internal.feedback.replies.releaseUnreleased, { reply: id });
  else await deliver(ctx, id);
}

async function successReplyWritten(ctx: MutationCtx, member: MemberId | undefined, ref: MessageRef, reply: Extract<Reply, { kind: "given" }>): Promise<WrittenReply> {
  const lines = skippedLines(reply.outcome.skipped);
  if (member !== undefined && !(await wantsMessage(ctx, member, "kudos-reply"))) return { lines };
  const gains = await gainsWritten(ctx, member, ref, reply);
  const waitsForQuests = member !== undefined && (await questsHoldTheReplyOf(ctx, member));
  const asksWhy = member !== undefined && (await couldEarnMoreBySayingWhy(ctx, member, reply.annotations)) && (await wantsMessage(ctx, member, "tips"));
  return { given: givenLine(reply.outcome, reply.base), lines, gains, ...(asksWhy && { hint: hintLine }), ...(waitsForQuests && { held: true as const }) };
}

function saysNothing({ given, lines }: WrittenReply) {
  return given === undefined && lines.length === 0;
}

async function gainsWritten(ctx: MutationCtx, member: MemberId | undefined, ref: MessageRef, { outcome, annotations }: Extract<Reply, { kind: "given" }>): Promise<Gains> {
  const xp = giverXpOf(outcome.awards);
  if (member === undefined) return { xp };
  await xpLevelsShownTo(ctx, member);
  await coinsShownTo(ctx, member);
  const { bonus, coins } = await giverLinesOf(ctx, member, ref, annotations);
  return { xp, ...(coins > 0 && { coins }), ...(bonus.length > 0 && { bonus }) };
}

export async function releaseSuccessReply(ctx: MutationCtx, message: MessageRef, questsDone: QuestDone[]) {
  const held = await heldReplyOf(ctx, message);
  if (held !== null) await release(ctx, held, questsDone);
}

export const releaseUnreleased = internalMutation({
  args: { reply: v.id("privateReplies") },
  handler: async (ctx, { reply }) => {
    const row = await ctx.db.get(reply);
    if (row?.held === true) await release(ctx, row, []);
  },
});

export const privateReply = internalQuery({
  args: { reply: v.id("privateReplies") },
  handler: async (ctx, { reply }) => {
    const row = await ctx.db.get(reply);
    if (row === null) return null;
    const { given, gains, hint, questsDone: _, ...stored } = row;
    if (gains === undefined) return { ...stored, footer: null, asDirectMessage: false };
    const member = await memberOf(ctx, row.workspace, row.to);
    const place = member === null ? "channel" : await placeOf(ctx, member, "kudos-reply");
    if (place === "none") return row.lines.length === 0 ? null : { ...stored, footer: null, asDirectMessage: false };
    const shown = await gainsShownTo(ctx, row.workspace, member, gains);
    const extrasLine = extrasLineOf(shown, await hintShownTo(ctx, row.workspace, member, hint), await deepLinkOf(ctx, row.workspace, deepLinks.successReply));
    const lines = [...(given === undefined ? [] : [given]), ...row.lines, ...(extrasLine === null ? [] : [extrasLine]), ...hoggieQuestLinesOf(shown.questsDone)];
    return { ...stored, lines, footer: await settingsFooterFor(ctx, member), asDirectMessage: place === "dm" };
  },
});

async function memberOf(ctx: QueryCtx, workspace: string, to: ChatUserId): Promise<MemberId | null> {
  const person = await lookup(ctx, workspace, to);
  return person?.kind === "member" ? person.member : null;
}

async function hintShownTo(ctx: QueryCtx, workspace: string, member: MemberId | null, hint: Line | undefined): Promise<Line | null> {
  if (hint === undefined) return null;
  if (member === null) return (await skillTreeAppliesIn(ctx, workspace)) ? hint : null;
  return (await sayingWhyEarnsMore(ctx, member)) && (await wantsMessage(ctx, member, "tips")) ? hint : null;
}

export async function givenReplyOf(ctx: QueryCtx, { workspace, conversation, message }: MessageRef): Promise<Doc<"privateReplies"> | null> {
  const replies = ctx.db.query("privateReplies").withIndex("by_held_message", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message));
  for await (const reply of replies) if (reply.gains !== undefined) return reply;
  return null;
}

export async function gainsLineWithoutQuestsOf(ctx: QueryCtx, workspace: string, member: MemberId, { questsDone: _, ...gains }: Gains): Promise<Line | null> {
  return extrasLineOf(await gainsShownTo(ctx, workspace, member, gains), null, null);
}

function heldReplyOf(ctx: QueryCtx, { workspace, conversation, message }: MessageRef) {
  return ctx.db
    .query("privateReplies")
    .withIndex("by_held_message", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message).eq("held", true))
    .first();
}

async function release(ctx: MutationCtx, { _id, gains }: Doc<"privateReplies">, questsDone: QuestDone[]) {
  await ctx.db.patch(_id, { held: undefined, ...(questsDone.length > 0 && { gains: { ...gains, xp: gains?.xp ?? 0, questsDone } }) });
  await deliver(ctx, _id);
}

async function deliver(ctx: MutationCtx, reply: Id<"privateReplies">) {
  await ctx.scheduler.runAfter(0, internal.slack.delivery.deliverPrivateReply, { reply });
}

async function gainsShownTo(ctx: QueryCtx, workspace: string, member: MemberId | null, { xp, coins = 0, questsDone = [], bonus = [] }: Gains): Promise<GainsShown> {
  const coinsEarned = coins > 0 || questsDone.some((done) => (done.coins ?? 0) > 0);
  const coinsVisible = coinsEarned && (await areCoinsVisibleTo(ctx, member));
  return {
    xp: (await xpGainsShownTo(ctx, workspace, member)) ? xp : 0,
    coins: coinsVisible ? coins : 0,
    questsDone: questsDone.length > 0 && (await questGainsShownTo(ctx, workspace, member)) ? (await questsStillShown(ctx, workspace, member, questsDone)).map((done) => (coinsVisible ? done : withoutCoins(done))) : [],
    bonus: bonus.length > 0 && (await bonusGainsShownTo(ctx, workspace, member)) ? bonus : [],
  };
}

async function questsStillShown(ctx: QueryCtx, workspace: string, member: MemberId | null, questsDone: QuestDone[]): Promise<QuestDoneShown[]> {
  const shown: QuestDoneShown[] = [];
  for (const done of questsDone) if (done.kind !== "journey" || member === null || (await journeyStepNamedTo(ctx, workspace, member, done.step))) shown.push(await withWaitingOf(ctx, member, done));
  return shown;
}

async function withWaitingOf(ctx: QueryCtx, member: MemberId | null, { heldRewardKey, ...done }: QuestDone): Promise<QuestDoneShown> {
  return { ...done, waiting: heldRewardKey !== undefined && member !== null && (await rewardWaits(ctx, member, heldRewardKey)) };
}

async function areCoinsVisibleTo(ctx: QueryCtx, member: MemberId | null) {
  return member !== null && (await coinsVisibleTo(ctx, member));
}

function extrasLineOf({ xp, coins, questsDone, bonus }: GainsShown, hint: Line | null, link: DeepLink | null): Line | null {
  const parts: Line[] = [
    ...(xp > 0 ? [[{ text: `+${xp} XP` }]] : []),
    ...(coins > 0 ? [[{ text: coinsPartOf(coins) }]] : []),
    ...questsDoneParts(questsDone),
    ...bonusParts(bonus),
    ...(hint === null ? [] : [hint]),
    ...(link === null ? [] : [[{ link }]]),
  ];
  return parts.length === 0 ? null : parts.flatMap((part, index) => (index === 0 ? part : [{ text: " · " }, ...part]));
}

function bonusParts(bonus: BonusLine[]): Line[] {
  return bonus.map(({ source, xp }) => [{ text: `${perkOf(source).name} bonus (+${xp} XP)` }]);
}

function withoutCoins({ coins: _, ...done }: QuestDoneShown): QuestDoneShown {
  return done;
}

function questsDoneParts(questsDone: QuestDoneShown[]): Line[] {
  return questsDone.filter(({ hoggie }) => hoggie !== true).map((done) => [{ text: `Quest done: ${withoutFullStop(goalOf(done))} (${questRewardOf(done)})` }]);
}

function hoggieQuestLinesOf(questsDone: QuestDoneShown[]): Line[] {
  return questsDone.filter(({ hoggie }) => hoggie === true).map((done) => [{ text: `Quest done: ${withoutFullStop(goalOf(done))} · ${hoggieRewardOf(done.xp)}` }]);
}

function questRewardOf({ xp, coins = 0, waiting }: QuestDoneShown) {
  const gains = coins > 0 ? `+${xp} XP, ${coinsPartOf(coins)}` : `+${xp} XP`;
  return waiting ? `${gains} waiting in your crate` : gains;
}

function goalOf(done: QuestDoneShown) {
  if (done.kind === "weekly") return done.goal;
  return done.hoggie === true && isOnboardingStep(done.step) ? onboardingGoalOf(done.step) : journeyGoalOf(done.step);
}

export function renderReply(reply: Exclude<Reply, { kind: "given" }>): Line[] {
  switch (reply.kind) {
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
