import { v } from "convex/values";
import { newestDecidedSince } from "../activity/activity";
import { albumShownTo } from "../album/flag";
import { albumStickersOf } from "../album/stickers";
import { teamStickersOf } from "../album/teamPages";
import { newestDecidedReceivedBy } from "../engine/awards";
import { talliesOf } from "../album/hoggies/collection";
import { hiddenItemsShownTo } from "../album/items/flag";
import { newestTurnOf } from "../album/items/ledger";
import { firstThanksAwaitsItsMoment } from "../progression/firstThanks";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { memberMutation } from "./memberMutation";
import { xpMomentsShownTo } from "./xpMomentsFlag";

export type ArrivalAnswer = { kind: "arrived"; lastVisit: number | null } | { kind: "refused" };

const mostStickersRead = 500;

export async function lastVisitOf(ctx: QueryCtx, member: MemberId): Promise<number | null> {
  return (await storedLastVisitOf(ctx, member))?.at ?? null;
}

export async function moveLastVisitTo(ctx: MutationCtx, member: MemberId, at: number): Promise<void> {
  const stored = await storedLastVisitOf(ctx, member);
  if (stored === null) await ctx.db.insert("lastVisits", { member, at });
  else if (at > stored.at) await ctx.db.patch(stored._id, { at });
}

export async function lastVisitKeptFor(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await albumShownTo(ctx, member)) && ((await hiddenItemsShownTo(ctx, member)) || (await xpMomentsShownTo(ctx, member)));
}

export const arrive = memberMutation({
  args: { from: v.union(v.number(), v.null()) },
  handler: async (ctx, me, _person, { from }): Promise<ArrivalAnswer> => {
    if (!(await lastVisitKeptFor(ctx, me.member))) return { kind: "refused" };
    if ((await lastVisitOf(ctx, me.member)) !== from) return arrivedAt(await lastVisitOf(ctx, me.member));
    if (!(await activityAwaitsTheMoment(ctx, me.member, from))) await moveToTheNewestOf(ctx, me.member);
    return arrivedPastWhatWasPutIn(ctx, me.member);
  },
});

export function arrivedAt(lastVisit: number | null): ArrivalAnswer {
  return { kind: "arrived", lastVisit };
}

export async function arrivedPastWhatWasPutIn(ctx: QueryCtx, member: MemberId): Promise<ArrivalAnswer> {
  return arrivedAt(newestOf([await lastVisitOf(ctx, member), await newestPutInBy(ctx, member)]));
}

async function activityAwaitsTheMoment(ctx: QueryCtx, member: MemberId, lastVisit: number | null): Promise<boolean> {
  if (!(await xpMomentsShownTo(ctx, member))) return false;
  if (lastVisit === null) return firstThanksAwaitsItsMoment(ctx, member, Date.now());
  return (await newestDecidedSince(ctx, member, { above: lastVisit })) !== null;
}

async function moveToTheNewestOf(ctx: MutationCtx, member: MemberId) {
  const newest = await newestPutInOrReceivedBy(ctx, member);
  if (newest !== null) await moveLastVisitTo(ctx, member, newest);
}

async function newestPutInOrReceivedBy(ctx: QueryCtx, member: MemberId): Promise<number | null> {
  return newestOf([await newestPutInBy(ctx, member), await newestDecidedReceivedBy(ctx, member), await newestDecidedForTheMoment(ctx, member)]);
}

async function newestPutInBy(ctx: QueryCtx, member: MemberId): Promise<number | null> {
  return newestOf([
    await newestTurnOf(ctx, member),
    ...(await albumStickersOf(ctx, member, mostStickersRead)).stickers.map(({ at }) => at),
    ...[...(await teamStickersOf(ctx, member)).values()].map(({ at }) => at),
    ...[...(await talliesOf(ctx, member)).values()].map(({ firstAt }) => firstAt),
  ]);
}

function newestOf(instants: (number | null)[]): number | null {
  const known = instants.filter((at) => at !== null);
  return known.length === 0 ? null : Math.max(...known);
}

async function newestDecidedForTheMoment(ctx: QueryCtx, member: MemberId): Promise<number | null> {
  return (await xpMomentsShownTo(ctx, member)) ? newestDecidedSince(ctx, member, {}) : null;
}

function storedLastVisitOf(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("lastVisits")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
}
