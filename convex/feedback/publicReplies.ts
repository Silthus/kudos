import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { levelReachedEventValidator, type LevelReachedEvent } from "../bus/events";
import { achievementsApplyIn } from "../achievements/flag";
import { messageRefValidator, type MessageRef } from "../engine/messageEvent";
import { wantsMessage } from "../messageSettings/messageSettings";
import { questsApplyIn } from "../quests/flag";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { publicCelebrationsOn } from "../workspace/celebrationsSwitch";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { segmentValidator, type Line } from "./segments";

export const publicSectionValidator = v.object({ key: v.string(), member: v.id("members"), about: v.union(v.literal("level"), v.literal("achievement")), line: v.array(segmentValidator) });

export const shownValidator = v.union(
  v.object({ state: v.literal("unposted") }),
  v.object({ state: v.literal("posting") }),
  v.object({ state: v.literal("sending") }),
  v.object({ state: v.literal("posted"), ts: v.string() }),
);

const replyFields = { workspace: v.string(), channel: v.string(), sections: v.array(publicSectionValidator), version: v.number(), shown: shownValidator };

export const publicReplyValidator = v.union(
  v.object({ ...replyFields, conversation: v.string(), message: v.string(), threadTs: v.optional(v.string()) }),
  v.object({ ...replyFields, reached: v.object({ member: v.id("members"), level: v.number() }) }),
  v.object({ ...replyFields, summary: v.id("tierSummaries") }),
);

export const celebratedLevelValidator = v.object({ ...messageRefValidator.fields, member: v.id("members"), level: v.number() });

export type PublicSection = Infer<typeof publicSectionValidator>;

type Announced = { reached: { member: MemberId; level: number } } | { summary: Id<"tierSummaries"> };

export const celebrateLevel = internalMutation({
  args: { event: levelReachedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    if (!(await xpLevelsShownIn(ctx, event.workspace))) return;
    const { user } = await chatUserOf(ctx, event.member);
    const section = levelSection(event.member, user, event.level);
    if (event.message === undefined) await announceRewardedLevel(ctx, event, section);
    else await celebrateLevelBeside(ctx, event.message, event, section);
  },
});

async function celebrateLevelBeside(ctx: MutationCtx, ref: MessageRef, { member, level }: LevelReachedEvent, section: PublicSection) {
  const celebrated = await celebratedLevelRow(ctx, ref, member);
  if (celebrated !== null && celebrated.level >= level) return;
  if (celebrated === null) await ctx.db.insert("celebratedLevels", { ...ref, member, level });
  else await ctx.db.patch(celebrated._id, { level });
  await setPublicSection(ctx, ref, section);
}

export async function setPublicSection(ctx: MutationCtx, ref: MessageRef, section: PublicSection) {
  const { announcementChannel: channel } = await settingsOf(ctx, ref.workspace);
  if (channel === null || !(await publicCelebrationsOn(ctx, ref.workspace))) return;
  const existing = await publicReplyRow(ctx, ref, channel);
  if (existing === null) {
    const reply = await ctx.db.insert("publicReplies", { ...ref, channel, sections: [section], version: 1, shown: { state: "posting" } });
    await deliver(ctx, reply);
    return;
  }
  await ctx.db.patch(existing._id, { sections: withSection(existing.sections, section), version: existing.version + 1 });
  if (existing.shown.state === "posted") await deliver(ctx, existing._id);
  if (existing.shown.state === "unposted") {
    await ctx.db.patch(existing._id, { shown: { state: "posting" } });
    await deliver(ctx, existing._id);
  }
}

async function announceRewardedLevel(ctx: MutationCtx, { workspace, member, level }: LevelReachedEvent, section: PublicSection) {
  if (!(await questsApplyIn(ctx, workspace)) || (await levelNoticeRow(ctx, member, level)) !== null) return;
  await announce(ctx, workspace, { reached: { member, level } }, section);
}

export async function announce(ctx: MutationCtx, workspace: string, announced: Announced, section: PublicSection) {
  const { announcementChannel } = await settingsOf(ctx, workspace);
  if (announcementChannel === null || !(await publicCelebrationsOn(ctx, workspace))) return;
  const notice = { workspace, ...announced, channel: announcementChannel, sections: [section], version: 1, shown: { state: "posting" as const } };
  await deliver(ctx, await ctx.db.insert("publicReplies", notice));
}

export const desired = internalQuery({
  args: { reply: v.id("publicReplies") },
  handler: async (ctx, { reply }) => {
    const row = await ctx.db.get(reply);
    if (row === null) return null;
    if (!(await isShownAtAll(ctx, row))) return { ...row, sections: [] };
    const bookApplies = await achievementsApplyIn(ctx, row.workspace);
    const shown = await Promise.all(row.sections.map((section) => (section.about !== "achievement" || bookApplies) && isShownPublicly(ctx, section)));
    return { ...row, sections: row.sections.filter((_, index) => shown[index]) };
  },
});

export const recordPosted = internalMutation({
  args: { reply: v.id("publicReplies"), ts: v.string() },
  handler: async (ctx, { reply, ts }): Promise<number> => {
    const row = await ctx.db.get(reply);
    if (row === null) return 0;
    await ctx.db.patch(reply, { shown: { state: "posted", ts } });
    return row.version;
  },
});

export const startSending = internalMutation({
  args: { reply: v.id("publicReplies") },
  handler: async (ctx, { reply }): Promise<boolean> => {
    const row = await ctx.db.get(reply);
    if (row?.shown.state !== "posting") return false;
    await ctx.db.patch(reply, { shown: { state: "sending" } });
    return true;
  },
});

export const sendingFailed = internalMutation({
  args: { reply: v.id("publicReplies") },
  handler: async (ctx, { reply }) => {
    const row = await ctx.db.get(reply);
    if (row?.shown.state === "sending") await ctx.db.patch(reply, { shown: { state: "posting" } });
  },
});

export const stopPosting = internalMutation({
  args: { reply: v.id("publicReplies") },
  handler: async (ctx, { reply }) => {
    const row = await ctx.db.get(reply);
    if (row?.shown.state === "posting") await ctx.db.patch(reply, { shown: { state: "unposted" } });
  },
});

export const stopSending = internalMutation({
  args: { reply: v.id("publicReplies") },
  handler: async (ctx, { reply }) => {
    const row = await ctx.db.get(reply);
    if (row?.shown.state === "sending") await ctx.db.patch(reply, { shown: { state: "unposted" } });
  },
});

export function linesOf(reply: Pick<Doc<"publicReplies">, "sections">): Line[] {
  return reply.sections.map(({ line }) => line);
}

async function isShownAtAll(ctx: QueryCtx, row: Doc<"publicReplies">) {
  return (await xpLevelsShownIn(ctx, row.workspace)) && (await publicCelebrationsOn(ctx, row.workspace)) && (await isRewardShownIn(ctx, row)) && (await isCelebratedWhereItIs(ctx, row));
}

async function isRewardShownIn(ctx: QueryCtx, row: Doc<"publicReplies">) {
  return !("reached" in row) || (await questsApplyIn(ctx, row.workspace));
}

async function isCelebratedWhereItIs(ctx: QueryCtx, row: Doc<"publicReplies">) {
  const { announcementChannel } = await settingsOf(ctx, row.workspace);
  if (announcementChannel === null) return false;
  if (!("conversation" in row)) return true;
  if (row.threadTs !== undefined) return false;
  return row.channel !== row.conversation || row.conversation === announcementChannel;
}

function isShownPublicly(ctx: QueryCtx, { member }: PublicSection) {
  return wantsMessage(ctx, member, "celebrations");
}

function levelSection(member: MemberId, user: string, level: number): PublicSection {
  return { key: `level:${user}`, member, about: "level", line: [{ text: "🎉 " }, { mention: { kind: "person", user } }, { text: ` reached level ${level}.` }] };
}

function withSection(sections: PublicSection[], section: PublicSection) {
  const replaced = sections.map((existing) => (existing.key === section.key ? section : existing));
  return sections.some(({ key }) => key === section.key) ? replaced : [...sections, section];
}

async function deliver(ctx: MutationCtx, reply: Id<"publicReplies">) {
  await ctx.scheduler.runAfter(0, internal.slack.publicReplies.deliverPublicReply, { reply });
}

function publicReplyRow(ctx: QueryCtx, ref: MessageRef, channel: string) {
  return ctx.db
    .query("publicReplies")
    .withIndex("by_destination", (q) =>
      q.eq("workspace", ref.workspace).eq("conversation", ref.conversation).eq("message", ref.message).eq("channel", channel).eq("threadTs", undefined),
    )
    .unique();
}

function celebratedLevelRow(ctx: QueryCtx, { workspace, conversation, message }: MessageRef, member: MemberId) {
  return ctx.db
    .query("celebratedLevels")
    .withIndex("by_member_message", (q) => q.eq("member", member).eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .unique();
}

function levelNoticeRow(ctx: QueryCtx, member: MemberId, level: number) {
  return ctx.db
    .query("publicReplies")
    .withIndex("by_level_reached", (q) => q.eq("reached.member", member).eq("reached.level", level))
    .unique();
}
