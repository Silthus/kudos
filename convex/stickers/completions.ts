import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { countAlbumsCompleted } from "../achievements/achievements";
import { publish } from "../bus/publish";
import { awardIdValidator, type AwardId } from "../engine/awards";
import { messageRefValidator } from "../engine/messageEvent";
import type { KudosGivenEvent } from "../bus/events";
import type { GroupId } from "../groups/groups";
import { peopleIn, type MemberId } from "../workspace/directory";
import { albumsOf, isFilled, type Album } from "./albums";
import { teamSpiritAppliesTo } from "./flag";
import { stickersNewestFirst } from "./records";

export const completionsPerMutation = 25;

export const albumCompletionValidator = v.object({
  member: v.id("members"),
  group: v.id("userGroups"),
  award: awardIdValidator,
  at: v.number(),
  people: v.number(),
  told: v.boolean(),
});

export const albumCheckValidator = v.object({ member: v.id("members"), at: v.number(), finished: v.boolean() });

const checkValidator = v.object({ workspace: v.string(), member: v.id("members"), message: messageRefValidator, award: awardIdValidator, at: v.number() });

type Check = Infer<typeof checkValidator>;

export type NewSticker = { member: MemberId; award: AwardId };

export type RecordedCompletion = { completedAt: number };

export async function checkAlbumsAfter(ctx: MutationCtx, { workspace, message, at }: KudosGivenEvent, newStickers: NewSticker[]) {
  const awardOf = new Map<MemberId, AwardId>();
  for (const { member, award } of newStickers) if (!awardOf.has(member)) awardOf.set(member, award);
  for (const [member, award] of awardOf) await ctx.scheduler.runAfter(0, internal.stickers.completions.checkAlbums, { check: { workspace, member, message, award, at } });
}

export const checkAlbums = internalMutation({
  args: { check: checkValidator },
  handler: async (ctx, { check }) => {
    if (!(await teamSpiritAppliesTo(ctx, check.member))) return;
    const due = await filledUnrecordedAlbums(ctx, check);
    const recorded = due.slice(0, completionsPerMutation);
    const finished = recorded.length === due.length;
    const told = await toldAfterTheFirstCheck(ctx, check, finished);
    if (recorded.length > 0) await recordCompletions(ctx, check, recorded, told);
    await countAlbumsCompleted(ctx, check, await completionRecordsInOrder(ctx, check.member));
    if (!finished) await ctx.scheduler.runAfter(0, internal.stickers.completions.checkAlbums, { check });
  },
});

export async function completionsOf(ctx: QueryCtx, member: MemberId): Promise<Map<GroupId, RecordedCompletion>> {
  const completions = await ctx.db
    .query("albumCompletions")
    .withIndex("by_member_group", (q) => q.eq("member", member))
    .collect();
  return new Map(completions.map(({ group, at }) => [group, { completedAt: at }]));
}

async function toldAfterTheFirstCheck(ctx: MutationCtx, { member, at }: Check, finished: boolean): Promise<boolean> {
  const first = await ctx.db
    .query("albumChecks")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  if (first === null) await ctx.db.insert("albumChecks", { member, at, finished });
  else if (!first.finished && finished) await ctx.db.patch(first._id, { finished });
  return first?.finished === true;
}

async function filledUnrecordedAlbums(ctx: QueryCtx, { workspace, member }: Check): Promise<Album[]> {
  const albums = await albumsOf(ctx, { member, workspace }, await peopleIn(ctx, workspace), await stickersNewestFirst(ctx, member));
  const recorded = await completionsOf(ctx, member);
  return albums.filter((album) => isFilled(album) && !recorded.has(album.group)).toSorted(byNameThenGroup);
}

function byNameThenGroup(first: Album, second: Album) {
  return first.name.localeCompare(second.name) || first.group.localeCompare(second.group);
}

async function recordCompletions(ctx: MutationCtx, { workspace, member, message, award, at }: Check, albums: Album[], told: boolean) {
  for (const { group, total } of albums) await ctx.db.insert("albumCompletions", { member, group, award, at, people: total, told });
  const groups = albums.map(({ group, total }) => ({ group, people: total }));
  await publish(ctx, { type: "albumsCompleted", workspace, member, message, award, groups, at, told });
}

async function completionRecordsInOrder(ctx: QueryCtx, member: MemberId) {
  const completions = await ctx.db
    .query("albumCompletions")
    .withIndex("by_member_group", (q) => q.eq("member", member))
    .collect();
  return completions.toSorted((first, second) => first._creationTime - second._creationTime).map(({ award, at, told }) => ({ award, at, told }));
}
