import type { MutationCtx, QueryCtx } from "../_generated/server";
import { workspaceDecisionWithoutWriting, type Flag } from "../analytics/flags";
import type { DayKey } from "../engine/allowance";
import { nameless } from "../website/faces";
import { currentNameAndPictureOf, type MemberId } from "../workspace/directory";
import { wholeWeekBefore } from "./periods";
import { isOnTheBoards } from "./visibility";

export const weeklyHighlightsFlag = { key: "weekly-highlights", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export const newGiversListed = 3;
export const mostGiversRanked = 5_000;
export const mostGiversChecked = 200;

export type NewGiver = { member: MemberId; name: string; thoughtful: number };

export function weeklyHighlightsApplyTo(ctx: QueryCtx, workspace: string): Promise<boolean> {
  return workspaceDecisionWithoutWriting(ctx, weeklyHighlightsFlag, workspace);
}

export async function newGiversOf(ctx: QueryCtx, workspace: string, postWeek: DayKey): Promise<NewGiver[]> {
  const listed: NewGiver[] = [];
  for (const { giver, awards } of (await giversRankedIn(ctx, workspace, postWeek)).slice(0, mostGiversChecked)) {
    const named = (await isNewIn(ctx, giver, postWeek)) && (await isOnTheBoards(ctx, giver)) ? await currentNameAndPictureOf(ctx, giver) : null;
    if (named !== null) listed.push({ member: giver, name: named.name ?? nameless, thoughtful: awards });
    if (listed.length === newGiversListed) break;
  }
  return listed;
}

export async function featureNewGivers(ctx: MutationCtx, workspace: string, postWeek: DayKey, givers: NewGiver[]) {
  for (const { member } of givers) if ((await featuredOf(ctx, member)) === null) await ctx.db.insert("featuredNewGivers", { workspace, member, week: postWeek });
}

async function giversRankedIn(ctx: QueryCtx, workspace: string, postWeek: DayKey) {
  const tallies = await ctx.db
    .query("thoughtfulBoardTallies")
    .withIndex("by_workspace_period_giver", (q) => q.eq("workspace", workspace).eq("period", wholeWeekBefore(postWeek).now))
    .take(mostGiversRanked);
  return tallies.sort((one, other) => other.awards - one.awards || one._creationTime - other._creationTime);
}

async function isNewIn(ctx: QueryCtx, giver: MemberId, postWeek: DayKey) {
  const featured = await featuredOf(ctx, giver);
  return featured === null || featured.week === postWeek;
}

function featuredOf(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("featuredNewGivers")
    .withIndex("by_member", (q) => q.eq("member", member))
    .first();
}
