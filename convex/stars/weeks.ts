import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { allowanceDay, weekOf, type DayKey } from "../engine/allowance";
import type { MessageRef } from "../engine/messageEvent";
import { timeZoneOf, type MemberId } from "../workspace/directory";
import type { Star } from "./records";
import { starXp } from "./xp";

export type StarWeek = Doc<"starWeeks">;

export type MostStarred = NonNullable<StarWeek["mostStarred"]>;

type CountedStar = MessageRef & { giver: MemberId; day: DayKey };

export async function countStarGiven(ctx: MutationCtx, star: CountedStar) {
  const week = await weekRowOf(ctx, star.workspace, star.giver, weekOf(star.day).monday);
  await ctx.db.patch(week._id, { given: week.given + 1, givenXp: week.givenXp + starXp });
  await countStarOnTheMessage(ctx, star);
}

export async function countStarReceived(ctx: MutationCtx, star: Star, person: MemberId) {
  const timeZone = (await timeZoneOf(ctx, person)) ?? undefined;
  const week = await weekRowOf(ctx, star.workspace, person, weekOf(allowanceDay(star.at, timeZone)).monday);
  const onTheMessage = await countStarOnTheMessageFor(ctx, person, week.week, star);
  await ctx.db.patch(week._id, { received: week.received + 1, receivedXp: week.receivedXp + starXp, mostStarred: mostStarredOf(week.mostStarred, onTheMessage) });
}

function mostStarredOf(current: MostStarred | undefined, candidate: MostStarred): MostStarred {
  if (current === undefined || candidate.stars > current.stars) return candidate;
  return candidate.stars === current.stars && candidate.lastAt >= current.lastAt ? candidate : current;
}

async function weekRowOf(ctx: MutationCtx, workspace: string, member: MemberId, week: DayKey): Promise<StarWeek> {
  const existing = await ctx.db
    .query("starWeeks")
    .withIndex("by_member_week", (q) => q.eq("member", member).eq("week", week))
    .unique();
  if (existing !== null) return existing;
  const id = await ctx.db.insert("starWeeks", { workspace, member, week, given: 0, givenXp: 0, received: 0, receivedXp: 0, recap: "waiting", tries: 0 });
  return (await ctx.db.get(id))!;
}

async function countStarOnTheMessageFor(ctx: MutationCtx, member: MemberId, week: DayKey, { conversation, message, at }: Star): Promise<MostStarred> {
  const row = await ctx.db
    .query("starWeekMessages")
    .withIndex("by_member_week_message", (q) => q.eq("member", member).eq("week", week).eq("conversation", conversation).eq("message", message))
    .unique();
  const counted = { stars: (row?.stars ?? 0) + 1, lastAt: Math.max(row?.lastAt ?? at, at) };
  if (row === null) await ctx.db.insert("starWeekMessages", { member, week, conversation, message, ...counted });
  else await ctx.db.patch(row._id, counted);
  return { conversation, message, ...counted };
}

async function countStarOnTheMessage(ctx: MutationCtx, { workspace, conversation, message }: MessageRef) {
  const row = await starCountRow(ctx, { workspace, conversation, message });
  if (row === null) await ctx.db.insert("starCounts", { workspace, conversation, message, stars: 1 });
  else await ctx.db.patch(row._id, { stars: row.stars + 1 });
}

function starCountRow(ctx: QueryCtx, { workspace, conversation, message }: MessageRef) {
  return ctx.db
    .query("starCounts")
    .withIndex("by_message", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message))
    .unique();
}
