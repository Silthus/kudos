import type { Doc } from "../_generated/dataModel";
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
export const mostGiversFeatured = 5_000;

export type NewGiver = { member: MemberId; name: string; thoughtful: number };

type Tally = Doc<"thoughtfulBoardTallies">;

export function weeklyHighlightsApplyTo(ctx: QueryCtx, workspace: string): Promise<boolean> {
  return workspaceDecisionWithoutWriting(ctx, weeklyHighlightsFlag, workspace);
}

export async function newGiversOf(ctx: QueryCtx, workspace: string, postWeek: DayKey): Promise<NewGiver[]> {
  const ranked = await giversRankedIn(ctx, workspace, postWeek);
  const featured = await featuredIn(ctx, workspace);
  const featuredThisWeek = featured.filter(({ week }) => week === postWeek).sort((one, other) => one.place - other.place);
  if (featuredThisWeek.length > 0) return namedOnTheBoards(ctx, featuredThisWeek.map(({ member }) => ({ giver: member, awards: ranked.find(({ giver }) => giver === member)?.awards ?? 0 })));
  const featuredBefore = new Set(featured.map(({ member }) => member));
  return namedOnTheBoards(ctx, ranked.filter(({ giver }) => !featuredBefore.has(giver)).slice(0, mostGiversChecked));
}

export async function featureNewGivers(ctx: MutationCtx, workspace: string, postWeek: DayKey, givers: NewGiver[]) {
  if ((await featuredIn(ctx, workspace, postWeek)).length > 0) return;
  for (const [index, { member }] of givers.entries()) await ctx.db.insert("featuredNewGivers", { workspace, member, week: postWeek, place: index + 1 });
}

export async function unfeatureNewGivers(ctx: MutationCtx, workspace: string, postWeek: DayKey) {
  for (const { _id } of await featuredIn(ctx, workspace, postWeek)) await ctx.db.delete(_id);
}

async function namedOnTheBoards(ctx: QueryCtx, candidates: Pick<Tally, "giver" | "awards">[]) {
  const listed: NewGiver[] = [];
  for (const { giver, awards } of candidates) {
    const named = (await isOnTheBoards(ctx, giver)) ? await currentNameAndPictureOf(ctx, giver) : null;
    if (named !== null) listed.push({ member: giver, name: named.name ?? nameless, thoughtful: awards });
    if (listed.length === newGiversListed) break;
  }
  return listed;
}

async function giversRankedIn(ctx: QueryCtx, workspace: string, postWeek: DayKey) {
  const tallies = await ctx.db
    .query("thoughtfulBoardTallies")
    .withIndex("by_workspace_period_giver", (q) => q.eq("workspace", workspace).eq("period", wholeWeekBefore(postWeek).now))
    .take(mostGiversRanked);
  return tallies.sort((one, other) => other.awards - one.awards || one._creationTime - other._creationTime);
}

function featuredIn(ctx: QueryCtx, workspace: string, week?: DayKey) {
  return ctx.db
    .query("featuredNewGivers")
    .withIndex("by_workspace_week", (q) => (week === undefined ? q.eq("workspace", workspace) : q.eq("workspace", workspace).eq("week", week)))
    .take(mostGiversFeatured);
}
