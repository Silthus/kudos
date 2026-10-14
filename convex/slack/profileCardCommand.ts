import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type ActionCtx, type MutationCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { recordUsage, recordUsageWithoutBlocking } from "../analytics/usage";
import { renderLookUpFailed, renderNotAMember, renderProfileCard, renderProfileCardUsage } from "../feedback/profileCard";
import type { Line } from "../feedback/segments";
import { isProfileCardShownTo } from "../profileCard/flag";
import { profileCardOf } from "../profileCard/profileCard";
import { lookup, type MemberFacts } from "../workspace/directory";
import { answerCommand, knownOrLookedUp, onceKnown, type Viewer } from "./commandReplies";
import { attemptArgs, failedAttempt, slackTextOf, tryAtMostThreeTimes } from "./delivery";

export type CardRequest = { kind: "card"; target: string } | { kind: "usage" };

export type CardReply = { shown: false } | { shown: true; lines: Line[] | null };

type Viewing = Viewer & { arrivedAt: number };

type Viewed = Viewing & { own: boolean };

type Answer = { lines: Line[]; own: boolean | null };

const personMention = /^<@([^|>\s]+)(?:\|[^>]*)?>$/;
const anyMention = /^<[@!#]/;
const replyWindowMs = 25 * 60_000;

const cardRequestValidator = v.union(v.object({ kind: v.literal("card"), target: v.string() }), v.object({ kind: v.literal("usage") }));

const viewingArgs = { workspace: v.string(), user: v.string(), arrivedAt: v.number() };

const cardViewedArgs = { ...viewingArgs, own: v.boolean() };

export const cardViewedValidator = v.object({ own: v.boolean(), arrivedAt: v.number() });

export function cardRequestOf(text: string): CardRequest | null {
  const trimmed = text.trim();
  const person = personMention.exec(trimmed);
  if (person !== null) return { kind: "card", target: person[1]! };
  return anyMention.test(trimmed) ? { kind: "usage" } : null;
}

export const profileCardReply = internalMutation({
  args: { ...viewingArgs, request: cardRequestValidator, responseUrl: v.string() },
  handler: async (ctx, { request, responseUrl, ...viewing }): Promise<CardReply> => {
    const viewer = await lookup(ctx, viewing.workspace, viewing.user);
    const shown = await isProfileCardShownTo(ctx, viewing.workspace, viewer?.kind === "member" ? viewer.member : undefined);
    const answer = shown ? await answerTo(ctx, viewing, request, responseUrl) : null;
    const own = answer?.own ?? null;
    if (viewer === undefined) await exposeOnceKnown(ctx, viewing, shown, own);
    else if (own !== null) await reportViewed(ctx, { ...viewing, own });
    return shown ? { shown, lines: answer?.lines ?? null } : { shown };
  },
});

async function answerTo(ctx: MutationCtx, viewing: Viewing, request: CardRequest, responseUrl: string): Promise<Answer | null> {
  if (request.kind === "usage") return { lines: renderProfileCardUsage(), own: null };
  const target = await lookup(ctx, viewing.workspace, request.target);
  if (target !== undefined) return cardAnswerOf(ctx, viewing, request.target, target);
  await ctx.scheduler.runAfter(0, internal.slack.profileCardCommand.answerUnknownTarget, { ...viewing, target: request.target, responseUrl });
  return null;
}

async function cardAnswerOf(ctx: MutationCtx, viewing: Viewer, user: string, target: MemberFacts): Promise<Answer> {
  if (target.kind !== "member") return { lines: renderNotAMember(user), own: null };
  const own = viewing.user === user;
  return { lines: renderProfileCard(user, await profileCardOf(ctx, target.member, { own })), own };
}

function exposeOnceKnown(ctx: MutationCtx, viewing: Viewing, shown: boolean, own: boolean | null) {
  const cardViewed = own === null ? {} : { cardViewed: { own, arrivedAt: viewing.arrivedAt } };
  return ctx.scheduler.runAfter(0, internal.slack.commands.exposeOnceKnown, { workspace: viewing.workspace, user: viewing.user, flag: "profile-card", shown, ...cardViewed });
}

function reportViewed(ctx: MutationCtx, viewed: Viewed) {
  return ctx.scheduler.runAfter(0, internal.slack.profileCardCommand.reportProfileCardViewed, viewed);
}

export const answerUnknownTarget = observedAction({
  args: { ...viewingArgs, target: v.string(), responseUrl: v.string(), ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...asked }) => {
    const { target, responseUrl, arrivedAt, ...viewing } = asked;
    const lookUpFailed = () => answerCommand(responseUrl, slackTextOf(renderLookUpFailed(target)));
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const person = await knownOrLookedUp(ctx, { workspace: viewing.workspace, user: target });
        if (person.kind === "failed") return failedAttempt(attempt, person.retryAfterMs);
        const { lines, own } = await ctx.runMutation(internal.slack.profileCardCommand.cardOfKnownTarget, { ...viewing, target });
        await answerCommand(responseUrl, slackTextOf(lines));
        if (own !== null) await ctx.scheduler.runAfter(0, internal.slack.profileCardCommand.reportProfileCardViewed, { ...viewing, arrivedAt, own });
        return null;
      },
      async (retry) => {
        if (retry.at > arrivedAt + replyWindowMs) await lookUpFailed();
        else await ctx.scheduler.runAt(retry.at, internal.slack.profileCardCommand.answerUnknownTarget, { ...asked, attempt: retry.attempt });
      },
      lookUpFailed,
    );
  },
});

export const cardOfKnownTarget = internalMutation({
  args: { workspace: v.string(), user: v.string(), target: v.string() },
  handler: async (ctx, { target, ...viewing }): Promise<Answer> => {
    const person = await lookup(ctx, viewing.workspace, target);
    return person === undefined ? { lines: renderLookUpFailed(target), own: null } : await cardAnswerOf(ctx, viewing, target, person);
  },
});

export const reportProfileCardViewed = observedAction({
  args: { ...cardViewedArgs, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...viewed }) => {
    await onceKnown(
      ctx,
      attempt,
      viewed,
      () => recordProfileCardViewedWithoutBlocking(ctx, viewed),
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.profileCardCommand.reportProfileCardViewed, { ...viewed, attempt: retry.attempt }),
    );
  },
});

export function recordProfileCardViewedWithoutBlocking(ctx: ActionCtx, viewed: Viewed) {
  return recordUsageWithoutBlocking(() => ctx.runMutation(internal.slack.profileCardCommand.recordProfileCardViewed, viewed));
}

export const recordProfileCardViewed = internalMutation({
  args: cardViewedArgs,
  handler: async (ctx, { workspace, user, arrivedAt, own }) => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind === "member") await recordUsage(ctx, { kind: "profileCardViewed", workspace, member: person.member, own, surface: "command", at: arrivedAt });
  },
});
