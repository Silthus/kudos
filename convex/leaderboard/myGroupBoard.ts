import { v } from "convex/values";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { allowanceDay } from "../engine/allowance";
import { countingPrimaryGroupOf, groupsShownTo, primaryMembersOf, type GroupRef } from "../groups/groups";
import { lookup, type MemberId } from "../workspace/directory";
import type { BoardView } from "./board";
import { groupMemberTotalsOf, type MemberTotals } from "./groupTotals";
import { comparedOn, periodValidator, type Compared } from "./periods";
import { boardMembers, boardViewOf, giversAmong, rankedOf, withoutViewer, type IndividualBoardFacts, type KudosByMember, type Ranked } from "./rankedBoard";
import { totalUpTo } from "./runningTotal";
import { isOnTheBoards } from "./visibility";

export type MyGroupBoard = Ranked & { group: GroupRef };

export type MyGroupBoardView = { group: GroupRef; board: BoardView };

export type Viewer = { user: string; member: MemberId };

export type GroupKudos = { group: GroupRef; members: MemberTotals[] };

export const myGroupBoardViewOf = internalQuery({
  args: { workspace: v.string(), viewer: v.string(), period: periodValidator },
  handler: async (ctx, { workspace, viewer, period }): Promise<MyGroupBoardView | null> => {
    const person = await lookup(ctx, workspace, viewer);
    if (person?.kind !== "member" || !(await groupsShownTo(ctx, person.member))) return null;
    const group = await countingPrimaryGroupOf(ctx, person.member);
    if (group === null) return null;
    const compared = comparedOn(period, allowanceDay(Date.now(), person.timeZone));
    const members = await groupMemberTotalsOf(ctx, group.group, await primaryMembersOf(ctx, group.group), compared);
    return { group, board: boardViewOf(await myGroupFactsOf(ctx, { user: viewer, member: person.member }, { group, members }, compared)) };
  },
});

export async function myGroupBoardOf(ctx: QueryCtx, viewer: Viewer, kudos: GroupKudos, compared: Compared): Promise<MyGroupBoard> {
  return { group: kudos.group, ...rankedOf(await myGroupFactsOf(ctx, viewer, kudos, compared)) };
}

export async function myGroupBoardShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await groupsShownTo(ctx, member)) && (await countingPrimaryGroupOf(ctx, member)) !== null;
}

async function myGroupFactsOf(ctx: QueryCtx, viewer: Viewer, { members }: GroupKudos, compared: Compared): Promise<IndividualBoardFacts> {
  const boardMemberOf = boardMembers(ctx, viewer.member);
  const givers = await giversAmong(kudosNow(members, compared), boardMemberOf);
  const before = await giversAmong(kudosBefore(members, compared), boardMemberOf);
  if (await isOnTheBoards(ctx, viewer.member)) return { givers, before, viewer: viewer.user, viewerLeft: false };
  return { givers: withoutViewer(givers, viewer.user), before: withoutViewer(before, viewer.user), viewer: viewer.user, viewerLeft: true };
}

function kudosNow(members: MemberTotals[], { now }: Compared): KudosByMember {
  return new Map(members.map(({ member, totals }) => [member, totals.find(({ period }) => period === now)?.kudos ?? 0]));
}

function kudosBefore(members: MemberTotals[], { before }: Compared): KudosByMember {
  if (before === null) return new Map();
  return new Map(members.map(({ member, totals }) => [member, totalUpTo(totals.find(({ period }) => period === before.key)?.runningTotal ?? [], before.day)]));
}
