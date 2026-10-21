import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { mentionsOfOnePage, permalinkOfMessage, readableSegmentsOf } from "../activity/kudos";
import { hugGivenEventValidator, kudosGivenEventValidator, type KudosGivenEvent } from "../bus/events";
import { wordsOf } from "../engine/kudosText";
import { messageRefValidator, type ChatUserId, type MessageRef } from "../engine/messageEvent";
import { hugOf } from "../hugs/records";
import { earnWelcomeItem } from "../items/welcome";
import { welcomeItemShownTo } from "../items/welcomeFlag";
import { websiteOriginFor } from "../website/link";
import { signInEntry } from "../website/routes";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { saveWorkspaceSettings, settingsOf, welcomeNudgeOn } from "../workspace/settings";
import { isTheMaintainer } from "../workspace/workspaceSettings";
import { quoteOf } from "./mondayPost";

const recipientsNudgedPerMutation = 50;

export const welcomeNudgeCauseValidator = v.object({ kind: v.union(v.literal("thanks"), v.literal("hug")), giver: v.id("members"), message: messageRefValidator });

export type WelcomeNudgeCause = Infer<typeof welcomeNudgeCauseValidator>;

export type WelcomeNudgeMessage = { giver: ChatUserId; kudosEmoji: string; cause: { kind: "thanks"; quote: string | null } | { kind: "hug"; permalink: string | null }; album: string };

export const nudgeTheThanked = internalMutation({
  args: { event: kudosGivenEventValidator, from: v.optional(v.number()) },
  handler: async (ctx, { event, from = 0 }): Promise<void> => {
    const recipients = recipientsOf(event);
    const next = from + recipientsNudgedPerMutation;
    for (const recipient of recipients.slice(from, next)) await nudge(ctx, recipient, { kind: "thanks", giver: event.giver, message: event.message }, event.at);
    if (next < recipients.length) await ctx.scheduler.runAfter(0, internal.feedback.welcomeNudge.nudgeTheThanked, { event, from: next });
  },
});

export const nudgeTheHugged = internalMutation({
  args: { event: hugGivenEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    const author = (await hugOf(ctx, event.message, event.giver))?.author;
    if (author !== undefined) await nudge(ctx, author, { kind: "hug", giver: event.giver, message: event.message }, event.at);
  },
});

export const welcomeNudgeMessage = internalQuery({
  args: { workspace: v.string(), member: v.id("members"), cause: welcomeNudgeCauseValidator },
  handler: async (ctx, { workspace, member, cause }): Promise<WelcomeNudgeMessage | null> => {
    const album = await albumLinkFor(ctx, workspace, member);
    if (album === null) return null;
    const { kudosEmoji } = await settingsOf(ctx, workspace);
    const giver = (await chatUserOf(ctx, cause.giver)).user;
    return { giver, kudosEmoji, cause: cause.kind === "thanks" ? { kind: "thanks", quote: await publicQuoteOf(ctx, cause.message) } : { kind: "hug", permalink: await permalinkOfMessage(ctx, cause.message) }, album };
  },
});

export async function welcomeNudgeSwitchOf(ctx: QueryCtx, viewer: { workspace: string; member: MemberId }): Promise<boolean | null> {
  if (!(await isTheMaintainer(ctx, viewer.member)) || !(await welcomeItemShownTo(ctx, viewer.member))) return null;
  return welcomeNudgeOn(ctx, viewer.workspace);
}

export async function setWelcomeNudge(ctx: MutationCtx, workspace: string, member: MemberId, on: boolean): Promise<boolean> {
  if (!(await isTheMaintainer(ctx, member))) return false;
  await saveWorkspaceSettings(ctx, workspace, { welcomeNudge: on });
  return true;
}

async function nudge(ctx: MutationCtx, member: MemberId, cause: WelcomeNudgeCause, at: number) {
  const { workspace, user } = await chatUserOf(ctx, member);
  if (!(await isNudgedWelcome(ctx, workspace, user, member))) return;
  await ctx.db.insert("welcomeNudges", { member, at });
  await earnWelcomeItem(ctx, workspace, member, at);
  await ctx.scheduler.runAfter(0, internal.slack.welcomeNudge.deliverWelcomeNudge, { workspace, user, member, cause });
}

async function isNudgedWelcome(ctx: QueryCtx, workspace: string, user: ChatUserId, member: MemberId) {
  return (
    (await welcomeItemShownTo(ctx, member)) &&
    !(await wasNudged(ctx, member)) &&
    !(await hasSignedIn(ctx, workspace, user)) &&
    (await welcomeNudgeOn(ctx, workspace)) &&
    (await albumLinkFor(ctx, workspace, member)) !== null
  );
}

async function wasNudged(ctx: QueryCtx, member: MemberId) {
  return (
    (await ctx.db
      .query("welcomeNudges")
      .withIndex("by_member", (q) => q.eq("member", member))
      .first()) !== null
  );
}

async function hasSignedIn(ctx: QueryCtx, workspace: string, user: ChatUserId) {
  return (
    (await ctx.db
      .query("users")
      .withIndex("by_chat_identity", (q) => q.eq("chatIdentity.workspace", workspace).eq("chatIdentity.user", user))
      .first()) !== null
  );
}

async function albumLinkFor(ctx: QueryCtx, workspace: string, member: MemberId): Promise<string | null> {
  const origin = await websiteOriginFor(ctx, workspace, member);
  if (origin === null) return null;
  return origin.endsWith(signInEntry) ? origin : `${origin}/book`;
}

async function publicQuoteOf(ctx: QueryCtx, message: MessageRef): Promise<string | null> {
  const words = await wordsOf(ctx, message);
  if (words.kind !== "text" || words.visibility !== "public") return null;
  return quoteOf(await readableSegmentsOf(mentionsOfOnePage(ctx), message.workspace, words.segments));
}

function recipientsOf(event: KudosGivenEvent): MemberId[] {
  return [...new Set(event.awards.map(({ recipient }) => recipient))].filter((recipient) => recipient !== event.giver);
}
