import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { mentionsOfOnePage, permalinkOfMessage, readableSegmentsOf } from "../activity/kudos";
import { hugGivenEventValidator, kudosGivenEventValidator, type KudosGivenEvent } from "../bus/events";
import { wordsOf } from "../engine/kudosText";
import { messageRefValidator, type ChatUserId, type MessageRef, type WordSegment } from "../engine/messageEvent";
import { hugOf, hugPeoplePageOf } from "../hugs/records";
import { earnWelcomeItem } from "../album/items/welcome";
import { welcomeItemShownTo } from "../album/items/welcomeFlag";
import { websiteOriginFor } from "../website/link";
import { signInEntry } from "../website/routes";
import { linkFrom } from "../website/visitSource";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { saveWelcomeNudge, settingsOf, welcomeNudgeOn } from "../workspace/settings";
import { isTheMaintainer } from "../workspace/workspaceSettings";
import { isWelcomed } from "../welcome/welcome";
import { onTheMondayPath } from "../quests/flag";
import { quoteOf } from "./mondayPost";

const recipientsNudgedPerMutation = 50;

export const welcomeNudgeCauseValidator = v.object({ kind: v.union(v.literal("thanks"), v.literal("hug"), v.literal("kudosHug")), giver: v.id("members"), message: messageRefValidator });

export type WelcomeNudgeCause = Infer<typeof welcomeNudgeCauseValidator>;

export type WelcomeNudgeMessage = { giver: ChatUserId; kudosEmoji: string; cause: { kind: "thanks"; quote: string | null } | { kind: "hug"; onKudos: boolean; permalink: string | null }; album: string };

export const nudgeTheThanked = internalMutation({
  args: { event: kudosGivenEventValidator, from: v.optional(v.number()) },
  handler: async (ctx, { event, from = 0 }): Promise<void> => {
    const recipients = recipientsOf(event);
    const next = from + recipientsNudgedPerMutation;
    for (const recipient of recipients.slice(from, next)) await nudge(ctx, recipient, { kind: "thanks", giver: event.giver, message: event.message }, event.at, true);
    if (next < recipients.length) await ctx.scheduler.runAfter(0, internal.feedback.welcomeNudge.nudgeTheThanked, { event, from: next });
  },
});

export const nudgeTheHugged = internalMutation({
  args: { event: hugGivenEventValidator, cursor: v.optional(v.string()) },
  handler: async (ctx, { event, cursor }): Promise<void> => {
    const hug = await hugOf(ctx, event.message, event.giver);
    if (hug === null) return;
    const cause: WelcomeNudgeCause = { kind: hug.author === undefined ? "kudosHug" : "hug", giver: event.giver, message: event.message };
    const { people, next } = await hugPeoplePageOf(ctx, hug, cursor ?? null, recipientsNudgedPerMutation);
    for (const person of people) if (person !== event.giver) await nudge(ctx, person, cause, event.at, false);
    if (next !== null) await ctx.scheduler.runAfter(0, internal.feedback.welcomeNudge.nudgeTheHugged, { event, cursor: next });
  },
});

export const welcomeNudgeMessage = internalQuery({
  args: { workspace: v.string(), member: v.id("members"), cause: welcomeNudgeCauseValidator },
  handler: async (ctx, { workspace, member, cause }): Promise<WelcomeNudgeMessage | null> => {
    if (!(await welcomeItemShownTo(ctx, member)) || !(await welcomeNudgeOn(ctx, workspace)) || (await isWelcomedOnTheMondayPath(ctx, member, false))) return null;
    const album = await albumLinkFor(ctx, workspace, member);
    if (album === null) return null;
    const { kudosEmoji } = await settingsOf(ctx, workspace);
    const giver = (await chatUserOf(ctx, cause.giver)).user;
    return { giver, kudosEmoji, cause: cause.kind === "thanks" ? { kind: "thanks", quote: await publicQuoteOf(ctx, cause.message) } : { kind: "hug", onKudos: cause.kind === "kudosHug", permalink: await permalinkOfMessage(ctx, cause.message) }, album };
  },
});

export async function welcomeNudgeSwitchOf(ctx: QueryCtx, viewer: { workspace: string; member: MemberId }): Promise<boolean | null> {
  if (!(await isTheMaintainer(ctx, viewer.member)) || !(await welcomeItemShownTo(ctx, viewer.member))) return null;
  return welcomeNudgeOn(ctx, viewer.workspace);
}

export async function setWelcomeNudge(ctx: MutationCtx, workspace: string, member: MemberId, on: boolean): Promise<boolean> {
  if (!(await isTheMaintainer(ctx, member))) return false;
  await saveWelcomeNudge(ctx, workspace, on);
  return true;
}

async function nudge(ctx: MutationCtx, member: MemberId, cause: WelcomeNudgeCause, at: number, causeWelcomes: boolean) {
  const { workspace, user } = await chatUserOf(ctx, member);
  if (!(await isNudgedWelcome(ctx, workspace, user, member)) || (await isWelcomedOnTheMondayPath(ctx, member, causeWelcomes))) return;
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

async function isWelcomedOnTheMondayPath(ctx: QueryCtx, member: MemberId, causeWelcomes: boolean) {
  return (await onTheMondayPath(ctx, member)) && (causeWelcomes || (await isWelcomed(ctx, member)));
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
  return linkFrom("welcome", origin.endsWith(signInEntry) ? origin : `${origin}/book`);
}

export async function publicQuoteOf(ctx: QueryCtx, message: MessageRef, quoted: (segments: WordSegment[]) => WordSegment[] = (segments) => segments): Promise<string | null> {
  const words = await wordsOf(ctx, message);
  if (words.kind !== "text" || words.visibility !== "public") return null;
  return quoteOf(await readableSegmentsOf(mentionsOfOnePage(ctx), message.workspace, quoted(words.segments)));
}

function recipientsOf(event: KudosGivenEvent): MemberId[] {
  return [...new Set(event.awards.map(({ recipient }) => recipient))].filter((recipient) => recipient !== event.giver);
}
