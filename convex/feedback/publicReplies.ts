import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { levelReachedEventValidator } from "../bus/events";
import { threadOf } from "../engine/engine";
import type { MessageRef } from "../engine/messageEvent";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { segmentValidator, type Line } from "./replies";

export const publicSectionValidator = v.object({ key: v.string(), line: v.array(segmentValidator) });

export type PublicSection = Infer<typeof publicSectionValidator>;

type Destination = { channel: string; threadTs?: string };

export const celebrateLevel = internalMutation({
  args: { event: levelReachedEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    if (!(await showsLevelPublicly(ctx, event.member))) return;
    const { user } = await chatUserOf(ctx, event.member);
    await setPublicSection(ctx, event.message, levelSection(user, event.level));
  },
});

export async function setPublicSection(ctx: MutationCtx, ref: MessageRef, section: PublicSection) {
  const destination = await destinationOf(ctx, ref);
  const existing = await publicReplyRow(ctx, ref, destination);
  if (existing === null) {
    const reply = await ctx.db.insert("publicReplies", { ...ref, ...destination, sections: [section], version: 1, posting: true });
    await deliver(ctx, reply);
    return;
  }
  const isPosted = existing.postedTs !== undefined;
  await ctx.db.patch(existing._id, { sections: withSection(existing.sections, section), version: existing.version + 1, posting: true });
  if (isPosted || !existing.posting) await deliver(ctx, existing._id);
}

export const desired = internalQuery({
  args: { reply: v.id("publicReplies") },
  handler: async (ctx, { reply }) => ctx.db.get(reply),
});

export const recordPosted = internalMutation({
  args: { reply: v.id("publicReplies"), ts: v.string() },
  handler: async (ctx, { reply, ts }): Promise<number> => {
    const row = await ctx.db.get(reply);
    if (row === null) return 0;
    await ctx.db.patch(reply, { postedTs: ts });
    return row.version;
  },
});

export const stopPosting = internalMutation({
  args: { reply: v.id("publicReplies") },
  handler: async (ctx, { reply }) => {
    const row = await ctx.db.get(reply);
    if (row !== null && row.postedTs === undefined) await ctx.db.patch(reply, { posting: false });
  },
});

export function linesOf(reply: Doc<"publicReplies">): Line[] {
  return reply.sections.map(({ line }) => line);
}

async function showsLevelPublicly(ctx: QueryCtx, member: MemberId) {
  const settings = await ctx.db
    .query("progressSettings")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  return !(settings?.hideLevel ?? false) && !(settings?.muteNotices ?? false);
}

function levelSection(user: string, level: number): PublicSection {
  return { key: `level:${user}`, line: [{ text: "🎉 " }, { mention: { kind: "person", user } }, { text: ` reached level ${level}.` }] };
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

function publicReplyRow(ctx: QueryCtx, ref: MessageRef, { channel }: Destination) {
  return ctx.db
    .query("publicReplies")
    .withIndex("by_destination", (q) => q.eq("workspace", ref.workspace).eq("conversation", ref.conversation).eq("message", ref.message).eq("channel", channel))
    .unique();
}
