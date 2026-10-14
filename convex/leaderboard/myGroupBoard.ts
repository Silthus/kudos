import { v } from "convex/values";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { allowanceDay } from "../engine/allowance";
import { countingPrimaryGroupOf, groupsShownTo, primaryMembersOf, type GroupId, type GroupRef } from "../groups/groups";
import { lookup, type MemberId } from "../workspace/directory";
import type { BoardView } from "./board";
import { keyOf, periodValidator, sameDayLastPeriod, type Period, type PeriodKey, type SameDay } from "./periods";
import { boardMembers, boardViewOf, giversAmong, rankedOf, withoutViewer, type IndividualBoardFacts, type KudosByMember, type Ranked } from "./rankedBoard";
import { totalUpTo } from "./runningTotal";
import { isOnTheBoards } from "./visibility";

export type MyGroupBoard = Ranked & { group: GroupRef };

export type MyGroupBoardView = { group: GroupRef; board: BoardView };

export type Viewer = { user: string; member: MemberId; timeZone: string | undefined };

type Compared = { now: PeriodKey; before: SameDay | null };

type MyGroupFacts = IndividualBoardFacts & { group: GroupRef };

export const myGroupBoardViewOf = internalQuery({
  args: { workspace: v.string(), viewer: v.string(), period: periodValidator },
  handler: async (ctx, { workspace, viewer, period }): Promise<MyGroupBoardView | null> => {
    const person = await lookup(ctx, workspace, viewer);
    if (person?.kind !== "member" || !(await groupsShownTo(ctx, person.member))) return null;
    const facts = await myGroupFactsOf(ctx, { ...person, user: viewer }, period);
    return facts === null ? null : { group: facts.group, board: boardViewOf(facts) };
  },
});

export async function myGroupBoardOf(ctx: QueryCtx, viewer: Viewer, period: Period): Promise<MyGroupBoard | null> {
  const facts = await myGroupFactsOf(ctx, viewer, period);
  return facts === null ? null : { group: facts.group, ...rankedOf(facts) };
}

export async function myGroupBoardShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await groupsShownTo(ctx, member)) && (await countingPrimaryGroupOf(ctx, member)) !== null;
}

async function myGroupFactsOf(ctx: QueryCtx, viewer: Viewer, period: Period): Promise<MyGroupFacts | null> {
  const group = await countingPrimaryGroupOf(ctx, viewer.member);
  if (group === null) return null;
  const today = allowanceDay(Date.now(), viewer.timeZone);
  const compared = { now: keyOf(period, today), before: period === "all" ? null : sameDayLastPeriod(period, today) };
  const { now, before } = await kudosForTheGroup(ctx, group.group, compared);
  const boardMemberOf = boardMembers(ctx, viewer.member);
  const givers = await giversAmong(now, boardMemberOf);
  const giversBefore = await giversAmong(before, boardMemberOf);
  if (await isOnTheBoards(ctx, viewer.member)) return { group, givers, before: giversBefore, viewer: viewer.user, viewerLeft: false };
  return { group, givers: withoutViewer(givers, viewer.user), before: withoutViewer(giversBefore, viewer.user), viewer: viewer.user, viewerLeft: true };
}

async function kudosForTheGroup(ctx: QueryCtx, group: GroupId, { now, before }: Compared) {
  const kudos = { now: new Map() as KudosByMember, before: new Map() as KudosByMember };
  for (const member of await primaryMembersOf(ctx, group)) {
    const totals = await ctx.db
      .query("attributedTotals")
      .withIndex("by_member_group_period", (q) => q.eq("member", member).eq("group", group).gte("period", before?.key ?? now).lte("period", now))
      .collect();
    kudos.now.set(member, totals.find(({ period }) => period === now)?.kudos ?? 0);
    if (before !== null) kudos.before.set(member, totalUpTo(totals.find(({ period }) => period === before.key)?.runningTotal ?? [], before.day));
  }
  return kudos;
}
