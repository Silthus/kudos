import { v, type Infer } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { isEveryoneBoardShownTo } from "../leaderboard/flag";
import type { Period } from "../leaderboard/periods";
import { everyoneBoardOf, type EveryoneBoardView } from "../leaderboard/totals";
import { isOnTheBoards } from "../leaderboard/visibility";
import { lookup, type MemberId } from "../workspace/directory";

export const homeTabValidator = v.union(v.literal("profile"), v.literal("leaderboard"), v.literal("settings"));

export type HomeTab = Infer<typeof homeTabValidator>;

export type ShownTab =
  | { tab: "profile" }
  | { tab: "leaderboard"; period: Period; board: EveryoneBoardView }
  | { tab: "settings"; onTheBoards: boolean };

type HomeSelection = { tab: HomeTab; period: Period };

const opensOn: HomeSelection = { tab: "profile", period: "week" };

export const shownTabOf = internalMutation({
  args: { workspace: v.string(), user: v.string() },
  handler: async (ctx, { workspace, user }): Promise<ShownTab | null> => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind !== "member" || !(await isEveryoneBoardShownTo(ctx, workspace, person.member))) return null;
    const { tab, period } = await selectionOf(ctx, person.member);
    switch (tab) {
      case "profile":
        return { tab };
      case "leaderboard":
        return { tab, period, board: await everyoneBoardOf(ctx, workspace, user, period) };
      case "settings":
        return { tab, onTheBoards: await isOnTheBoards(ctx, person.member) };
    }
  },
});

export async function selectHomeTab(ctx: MutationCtx, member: MemberId, tab: HomeTab) {
  await select(ctx, member, { ...(await selectionOf(ctx, member)), tab });
}

export async function selectLeaderboardPeriod(ctx: MutationCtx, member: MemberId, period: Period) {
  await select(ctx, member, { tab: "leaderboard", period });
}

async function selectionOf(ctx: QueryCtx, member: MemberId): Promise<HomeSelection> {
  const row = await selectionRow(ctx, member);
  return row === null ? opensOn : { tab: row.tab, period: row.period };
}

async function select(ctx: MutationCtx, member: MemberId, selection: HomeSelection) {
  const row = await selectionRow(ctx, member);
  if (row === null) await ctx.db.insert("homeSelections", { member, ...selection });
  else if (row.tab !== selection.tab || row.period !== selection.period) await ctx.db.patch(row._id, selection);
}

function selectionRow(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("homeSelections")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
}
