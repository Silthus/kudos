import { v } from "convex/values";
import { activitySince, newestDecidedSince, positionsSince, type EntrySince, type ReadSince } from "../activity/activity";
import { ranks, type Position } from "../activity/position";
import { thoughtfulGiversShownTo } from "../album/thoughtfulGivers";
import { reportXpMomentEnded } from "../analytics/isolatedUsage";
import { hiddenItemsShownTo } from "../items/flag";
import { waitingCountOf, type WaitingCount } from "../items/ledger";
import { levelOf, xpToReach } from "../progression/levels";
import { progressionHomeOf } from "../progression/progression";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { timeZoneOf, type MemberId } from "../workspace/directory";
import { lastVisitOf, moveLastVisitTo, type ArrivalAnswer } from "./lastVisit";
import { memberMutation } from "./memberMutation";
import { memberQuery, type Denial, type VerifiedMember } from "./memberQuery";
import { xpMomentsShownTo } from "./xpMomentsFlag";

export type { EntrySince } from "../activity/activity";

export type Excerpt = { entry: EntrySince; xp: number };

export type Fold = { count: number; xp: number };

export type Standing = { level: number; xp: number; startsAt: number; nextAt: number };

export type Climb = { from: Standing; to: Standing };

export type XpMoment = {
  kind: "moment";
  since: number;
  until: number;
  excerpts: Excerpt[];
  fold: Fold | null;
  moments: number;
  xp: number;
  climb: Climb;
  waiting: WaitingCount;
  thoughtfulGivers: number | null;
  timeZone: string | null;
};

export type XpMomentAnswer = { kind: "off" } | { kind: "none"; lastVisit: number | null } | XpMoment;

export type XpMomentEndReply = ArrivalAnswer;

const mostExcerpts = 5;

const progressionWaitedFor = 10 * 60_000;

const off = { kind: "off" } as const;

export const getXpMoment = memberQuery(async (ctx, me): Promise<XpMomentAnswer> => {
  if (!(await xpMomentsShownTo(ctx, me.member))) return off;
  const since = await lastVisitOf(ctx, me.member);
  if (since === null) return { kind: "none", lastVisit: null };
  const read = playableOf(await activitySince(ctx, me.member, { above: since }), Date.now());
  if (read.length === 0) return { kind: "none", lastVisit: since };
  return momentOf(ctx, me, since, read);
});

export const endXpMoment = memberMutation({
  args: { from: v.number(), until: v.number(), skipped: v.boolean() },
  handler: async (ctx, me, _person, { from, until, skipped }): Promise<XpMomentEndReply> => {
    if (!(await xpMomentsShownTo(ctx, me.member))) return { kind: "refused" };
    if ((await lastVisitOf(ctx, me.member)) === from && (await wasRead(ctx, me.member, from, until))) await end(ctx, me, { from, until, skipped });
    return { kind: "arrived", lastVisit: await lastVisitOf(ctx, me.member) };
  },
});

async function end(ctx: MutationCtx, me: VerifiedMember, { from, until, skipped }: { from: number; until: number; skipped: boolean }) {
  const { shown, folded } = chosenOf(await positionsSince(ctx, me.member, { above: from, upTo: until }), isLevelUpAt);
  await moveLastVisitTo(ctx, me.member, until);
  await reportXpMomentEnded(ctx, { workspace: me.workspace, member: me.member, skipped, excerptsShown: shown.length, folded: folded.length, at: Date.now() });
}

async function wasRead(ctx: QueryCtx, member: MemberId, from: number, until: number): Promise<boolean> {
  const newest = await newestDecidedSince(ctx, member, { above: from });
  return until > from && newest !== null && until <= newest;
}

function playableOf(newestFirst: ReadSince[], now: number): ReadSince[] {
  const oldestWaiting = newestFirst.findLastIndex(({ decided, recorded }) => !recorded && decided > now - progressionWaitedFor);
  return newestFirst.slice(oldestWaiting + 1);
}

async function momentOf(ctx: QueryCtx, me: VerifiedMember, since: number, read: ReadSince[]): Promise<XpMoment> {
  const { shown, folded } = chosenOf(read, ({ entry }) => entry.kind === "levelUp");
  const xp = xpOf(read);
  const timeZone = await timeZoneOf(ctx, me.member);
  return {
    kind: "moment",
    since,
    until: read[0]!.decided,
    excerpts: shown.map(({ entry, xp }) => ({ entry, xp })),
    fold: folded.length === 0 ? null : { count: folded.length, xp: xpOf(folded) },
    moments: read.filter(({ entry }) => entry.kind !== "levelUp").length,
    xp,
    climb: await climbOf(ctx, me.member, xp),
    waiting: (await hiddenItemsShownTo(ctx, me.member)) ? await waitingCountOf(ctx, me.member) : 0,
    thoughtfulGivers: await thoughtfulGiversShownTo(ctx, { workspace: me.workspace, member: me.member, timeZone: timeZone ?? undefined }),
    timeZone,
  };
}

function chosenOf<T>(newestFirst: T[], isLevelUp: (read: T) => boolean): { shown: T[]; folded: T[] } {
  const levelUps = newestFirst.filter(isLevelUp);
  const rest = newestFirst.filter((read) => !isLevelUp(read));
  const room = Math.max(0, mostExcerpts - levelUps.length);
  const kept = new Set([...levelUps, ...rest.slice(0, room)]);
  return { shown: newestFirst.filter((read) => kept.has(read)).reverse(), folded: rest.slice(room) };
}

function isLevelUpAt({ rank }: Position) {
  return rank === ranks.levelUp;
}

function xpOf(read: Pick<ReadSince, "xp">[]) {
  return read.reduce((sum, { xp }) => sum + xp, 0);
}

async function climbOf(ctx: QueryCtx, member: MemberId, gained: number): Promise<Climb> {
  const { xp } = await progressionHomeOf(ctx, member);
  return { from: standingAt(Math.max(0, xp - gained)), to: standingAt(xp) };
}

function standingAt(xp: number): Standing {
  const level = levelOf(xp);
  return { level, xp, startsAt: xpToReach(level), nextAt: xpToReach(level + 1) };
}
