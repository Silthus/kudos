import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { levelReachedEventValidator, type LevelReachedEvent } from "../bus/events";
import { threadOf } from "../engine/engine";
import type { MessageRef } from "../engine/messageEvent";
import { progressSettingsOf } from "../progression/settings";
import { questsApplyIn } from "../quests/flag";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { segmentValidator, type Line } from "./replies";

export const publicSectionValidator = v.object({ key: v.string(), member: v.id("members"), about: v.literal("level"), line: v.array(segmentValidator) });

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
);

export type PublicSection = Infer<typeof publicSectionValidator>;

type Destination = { channel: string; threadTs?: string };

export const celebrateLevel = internalMutation({
  args: { event: levelReachedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    if (!(await xpLevelsShownIn(ctx, event.workspace))) return;
    const { user } = await chatUserOf(ctx, event.member);
    const section = levelSection(event.member, user, event.level);
    if (event.message === undefined) await announceRewardedLevel(ctx, event, section);
    else await setPublicSection(ctx, event.message, section);
  },
});

export async function setPublicSection(ctx: MutationCtx, ref: MessageRef, section: PublicSection) {
  const destination = await destinationOf(ctx, ref);
  const existing = await publicReplyRow(ctx, ref, destination);
  if (existing === null) {
    const reply = await ctx.db.insert("publicReplies", { ...ref, ...destination, sections: [section], version: 1, shown: { state: "posting" } });
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
  const { announcementChannel } = await settingsOf(ctx, workspace);
  if (announcementChannel === null || !(await questsApplyIn(ctx, workspace)) || (await levelNoticeRow(ctx, member, level)) !== null) return;
  const notice = { workspace, reached: { member, level }, channel: announcementChannel, sections: [section], version: 1, shown: { state: "posting" as const } };
  await deliver(ctx, await ctx.db.insert("publicReplies", notice));
}

export const desired = internalQuery({
  args: { reply: v.id("publicReplies") },
  handler: async (ctx, { reply }) => {
    const row = await ctx.db.get(reply);
    if (row === null) return null;
    if (!(await xpLevelsShownIn(ctx, row.workspace))) return { ...row, sections: [] };
    const shown = await Promise.all(row.sections.map((section) => isShownPublicly(ctx, section)));
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

export function threadTsOf(reply: Doc<"publicReplies">): string | undefined {
  return "threadTs" in reply ? reply.threadTs : undefined;
}

async function isShownPublicly(ctx: QueryCtx, { member }: PublicSection) {
  return !(await progressSettingsOf(ctx, member)).muteNotices;
}

function levelSection(member: MemberId, user: string, level: number): PublicSection {
  return { key: `level:${user}`, member, about: "level", line: [{ text: "🎉 " }, { mention: { kind: "person", user } }, { text: ` reached level ${level}.` }] };
}

function withSection(sections: PublicSection[], section: PublicSection) {
  const replaced = sections.map((existing) => (existing.key === section.key ? section : existing));
  return sections.some(({ key }) => key === section.key) ? replaced : [...sections, section];
}

async function destinationOf(ctx: QueryCtx, ref: MessageRef): Promise<Destination> {
  const { announcementChannel } = await settingsOf(ctx, ref.workspace);
  if (announcementChannel !== null) return { channel: announcementChannel };
  return { channel: ref.conversation, threadTs: await threadOf(ctx, ref) };
}

async function deliver(ctx: MutationCtx, reply: Id<"publicReplies">) {
  await ctx.scheduler.runAfter(0, internal.slack.publicReplies.deliverPublicReply, { reply });
}

function publicReplyRow(ctx: QueryCtx, ref: MessageRef, { channel, threadTs }: Destination) {
  return ctx.db
    .query("publicReplies")
    .withIndex("by_destination", (q) =>
      q.eq("workspace", ref.workspace).eq("conversation", ref.conversation).eq("message", ref.message).eq("channel", channel).eq("threadTs", threadTs),
    )
    .unique();
}

function levelNoticeRow(ctx: QueryCtx, member: MemberId, level: number) {
  return ctx.db
    .query("publicReplies")
    .withIndex("by_level_reached", (q) => q.eq("reached.member", member).eq("reached.level", level))
    .unique();
}
