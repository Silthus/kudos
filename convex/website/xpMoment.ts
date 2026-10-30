import { v } from "convex/values";
import { questXpOf, type QuestDone } from "../activity/entries";
import { activitySince, mostReadSince, newestDecidedTakenBackOrNotSince, positionsSince, type EntrySince, type ReadSince } from "../activity/activity";
import { ranks, type Position } from "../activity/position";
import { thoughtfulGiversThisWeek } from "../album/thoughtfulGivers";
import { reportXpMomentEnded } from "../analytics/isolatedUsage";
import { hiddenItemsShownTo } from "../album/items/flag";
import { waitingCountOf, type WaitingCount } from "../album/items/ledger";
import { firstThanksTopUpPaidTo, type FirstThanksTopUp } from "../progression/firstThanks";
import { progressionWaitedFor } from "../progression/effects";
import { levelOf, xpToReach } from "../progression/levels";
import { progressionHomeOf } from "../progression/progression";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { timeZoneOf, type MemberId } from "../workspace/directory";
import { progressBeatsShownTo } from "./progressBeatsFlag";
import { progressedSince, type Progressed } from "./progressed";
import { questBeatsShownTo } from "./questBeatsFlag";
import { arrivedAt, arrivedPastWhatWasPutIn, lastVisitOf, moveLastVisitTo, type ArrivalAnswer } from "./lastVisit";
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
  quests: QuestDone[];
  progressed: Progressed[];
  waiting: WaitingCount;
  thoughtfulGivers: number | null;
  timeZone: string | null;
};

export type XpMomentAnswer = { kind: "off" } | { kind: "none"; lastVisit: number | null } | XpMoment;

export type XpMomentEndReply = ArrivalAnswer;

const mostExcerpts = 5;

const off = { kind: "off" } as const;

export const getXpMoment = memberQuery(async (ctx, me): Promise<XpMomentAnswer> => {
  if (!(await xpMomentsShownTo(ctx, me.member))) return off;
  const { lastVisit, since, topUp } = await startOf(ctx, me.member);
  if (since === null) return { kind: "none", lastVisit };
  const now = Date.now();
  const questsShown = await questBeatsShownTo(ctx, me.member);
  const progressShown = await progressBeatsShownTo(ctx, me.member);
  const awaitedAbove = now - progressionWaitedFor;
  const read = await activitySince(ctx, me.member, { above: since, ...((questsShown || progressShown) && { questsAwaitedAbove: awaitedAbove }), ...(progressShown && { talliesAwaitedAbove: awaitedAbove }) });
  const { playable, heldBack } = playableOf(withTopUp(read, topUp), now);
  if (playable.length === 0) return { kind: "none", lastVisit };
  return momentOf(ctx, me, since, { read: playable, heldBack, questsShown, progressShown });
});

export const endXpMoment = memberMutation({
  args: { from: v.number(), until: v.number(), skipped: v.boolean(), played: v.optional(v.object({ shown: v.number(), folded: v.number() })) },
  handler: async (ctx, me, _person, { from, until, skipped, played }): Promise<XpMomentEndReply> => {
    if (!(await xpMomentsShownTo(ctx, me.member))) return { kind: "refused" };
    if ((await startOf(ctx, me.member)).since !== from || !(await wasRead(ctx, me.member, from, until))) return arrivedAt(await lastVisitOf(ctx, me.member));
    await end(ctx, me, { from, until, skipped, played });
    return arrivedPastWhatWasPutIn(ctx, me.member);
  },
});

type Played = { shown: number; folded: number };

async function end(ctx: MutationCtx, me: VerifiedMember, { from, until, skipped, played }: { from: number; until: number; skipped: boolean; played: Played | undefined }) {
  const { shown, folded } = played === undefined ? await playedOf(ctx, me.member, { from, until }) : boundedPlayed(played);
  await moveLastVisitTo(ctx, me.member, until);
  await reportXpMomentEnded(ctx, { workspace: me.workspace, member: me.member, skipped, excerptsShown: shown, folded, at: Date.now() });
}

async function playedOf(ctx: QueryCtx, member: MemberId, { from, until }: { from: number; until: number }): Promise<Played> {
  const { shown, folded } = chosenOf(await positionsSince(ctx, member, { above: from, upTo: until }), isLevelUpAt);
  return { shown: shown.length, folded: folded.length };
}

function boundedPlayed({ shown, folded }: Played): Played {
  return { shown: countWithin(shown, mostReadSince), folded: countWithin(folded, mostReadSince) };
}

function countWithin(count: number, most: number) {
  return Number.isFinite(count) ? Math.min(most, Math.max(0, Math.floor(count))) : 0;
}

type Start = { lastVisit: number | null; since: number | null; topUp: FirstThanksTopUp | null };

async function startOf(ctx: QueryCtx, member: MemberId): Promise<Start> {
  const [lastVisit, topUp] = await Promise.all([lastVisitOf(ctx, member), firstThanksTopUpPaidTo(ctx, member)]);
  return { lastVisit, topUp, since: lastVisit ?? (topUp === null ? null : instantBefore(topUp.decided)) };
}

function instantBefore(decided: number): number {
  const instant = new Float64Array([decided]);
  new BigInt64Array(instant.buffer)[0]! -= 1n;
  return instant[0]!;
}

function withTopUp(newestFirst: ReadSince[], topUp: FirstThanksTopUp | null): ReadSince[] {
  if (topUp === null) return newestFirst;
  return newestFirst.map((read) => (read.recorded && read.entry.kind === "kudosGiven" && read.decided === topUp.decided ? { ...read, xp: read.xp + topUp.xp } : read));
}

async function wasRead(ctx: QueryCtx, member: MemberId, from: number, until: number): Promise<boolean> {
  const newest = await newestDecidedTakenBackOrNotSince(ctx, member, { above: from });
  return until > from && newest !== null && until <= newest;
}

function playableOf(newestFirst: ReadSince[], now: number): { playable: ReadSince[]; heldBack: ReadSince[] } {
  const oldestWaiting = newestFirst.findLastIndex(({ decided, recorded, settled }) => !(recorded && settled) && decided > now - progressionWaitedFor);
  return { playable: newestFirst.slice(oldestWaiting + 1), heldBack: newestFirst.slice(0, oldestWaiting + 1) };
}

type Read = { read: ReadSince[]; heldBack: ReadSince[]; questsShown: boolean; progressShown: boolean };

async function momentOf(ctx: QueryCtx, me: VerifiedMember, since: number, { read, heldBack, questsShown, progressShown }: Read): Promise<XpMoment> {
  const { shown, folded } = chosenOf(read, ({ entry }) => entry.kind === "levelUp");
  const xp = xpOf(read);
  const quests = questsShown ? questsDoneIn(read) : [];
  const questsHeldBack = questsShown ? questsDoneIn(heldBack) : [];
  const timeZone = await timeZoneOf(ctx, me.member);
  return {
    kind: "moment",
    since,
    until: read[0]!.decided,
    excerpts: shown.map(({ entry, xp }) => ({ entry, xp })),
    fold: folded.length === 0 ? null : { count: folded.length, xp: xpOf(folded) },
    moments: read.filter(({ entry }) => entry.kind !== "levelUp").length,
    xp,
    climb: await climbOf(ctx, me.member, { gained: xp + questXpOf(quests), heldBack: xpOf(heldBack) + questXpOf(questsHeldBack) }),
    quests,
    progressed: progressShown ? await progressedSince(ctx, me.member, since, read[0]!.decided) : [],
    waiting: (await hiddenItemsShownTo(ctx, me.member)) ? await waitingCountOf(ctx, me.member) : 0,
    thoughtfulGivers: await thoughtfulGiversThisWeek(ctx, { workspace: me.workspace, timeZone: timeZone ?? undefined }),
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

function questsDoneIn(newestFirst: ReadSince[]): QuestDone[] {
  return newestFirst.toReversed().flatMap(({ entry }) => (entry.kind === "kudosGiven" ? (entry.earned?.questsDone ?? []) : [])).filter(({ hoggie }) => hoggie);
}

function isLevelUpAt({ rank }: Position) {
  return rank === ranks.levelUp;
}

function xpOf(read: Pick<ReadSince, "xp">[]) {
  return read.reduce((sum, { xp }) => sum + xp, 0);
}

async function climbOf(ctx: QueryCtx, member: MemberId, { gained, heldBack }: { gained: number; heldBack: number }): Promise<Climb> {
  const reached = Math.max(0, (await progressionHomeOf(ctx, member)).xp - heldBack);
  return { from: standingAt(Math.max(0, reached - gained)), to: standingAt(reached) };
}

function standingAt(xp: number): Standing {
  const level = levelOf(xp);
  return { level, xp, startsAt: xpToReach(level), nextAt: xpToReach(level + 1) };
}
