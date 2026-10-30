import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { albumShownTo } from "../album/flag";
import { loopLessonIn, type LoopLesson } from "../album/items/welcome";
import { hoggiesFoundIn, teammatesThankedBy } from "../album/weekThanks";
import { allowanceDay, weekOf, type DayKey } from "../engine/allowance";
import { weekCountsThrough, type RecognitionCounts } from "../leaderboard/counts";
import { leaderboardHugsShownTo } from "../leaderboard/flag";
import type { Improvement } from "../leaderboard/improvement";
import type { Peer } from "../leaderboard/peer";
import { lastPeriodUpToTheSameDay, periodValidator, type Period } from "../leaderboard/periods";
import { rankedBoardOf, type RankedRow, type Standing } from "../leaderboard/totals";
import { teammatesWhoThanked } from "../leaderboard/thankers";
import { isOnTheBoards } from "../leaderboard/visibility";
import { workspaceLink } from "../slack/workspaceLink";
import { timeZoneOf, type MemberId } from "../workspace/directory";
import { followTheClock } from "./clock";
import { signInFaceOf, teammateOf, type Face } from "./faces";
import { memberQuery, type Denial } from "./memberQuery";
import { hugMeasureValidator, peopleBoardsOf, type PeopleBoards } from "./peopleBoards";
import { leaderboardStateOf, unlockPathOf, type PageWaits } from "./unlockPath";

export type LeaderboardRow = { position: number; rank: number; tied: boolean; name: string; face: Face; kudos: number; you: boolean; climbed: number | null };

export type Leaderboard = {
  kind: "board";
  period: Period;
  chatUrl: string;
  rows: LeaderboardRow[];
  window: number[];
  standing: Standing;
  improvement: Improvement | null;
  peer: Peer | null;
  onTheBoards: boolean;
};

export type LeaderboardAnswer = { kind: "not-found" } | PageWaits | Leaderboard;

export type MyLeaderboard = Denial | LeaderboardAnswer;

export const getLeaderboard = memberQuery({
  args: { period: periodValidator },
  handler: async (ctx, me, { period }): Promise<LeaderboardAnswer> => {
    const state = await leaderboardStateOf(ctx, me, await unlockPathOf(ctx, me));
    if (state.kind === "off") return { kind: "not-found" };
    if (state.kind !== "open") return state;
    await followTheClock(ctx);
    const { rows, window, standing, improvement, peer } = await rankedBoardOf(ctx, me.workspace, me.user, period);
    const myFace = signInFaceOf(me);
    return {
      kind: "board",
      period,
      chatUrl: workspaceLink(me.workspace),
      rows: rows.map((row) => leaderboardRowOf(row, myFace)),
      window,
      standing,
      improvement,
      peer,
      onTheBoards: await isOnTheBoards(ctx, me.member),
    };
  },
});

export type Tallies = { hugsGiven: number; hugsReceived: number; kudosReceived: number; hoggiesFound: number };

export type Highlight =
  | { kind: "best-week"; hugsGiven: number; more: number; hoggiesFound: number }
  | { kind: "more-hugs"; hugsGiven: number; more: number }
  | { kind: "thanked"; teammates: number; reach: number }
  | { kind: "last-week"; hugs: number; best: boolean; reach: number }
  | { kind: "reach"; teammates: number };

export type YouThisWeek = { tallies: Tallies; lastWeek: Tallies; highlight: Highlight };

export type { HugMeasure, PersonRow } from "./peopleBoards";

export type HugBoards = { kind: "boards"; you: YouThisWeek; kudosEmoji: LoopLesson } & PeopleBoards;

export type HugBoardsAnswer = { kind: "off" } | HugBoards;

export type HugBoardsRead = Denial | HugBoardsAnswer;

type Weeks = { thisWeek: DayKey; lastWeek: DayKey };

type HugWeeks = Map<DayKey, RecognitionCounts>;

export const getBoards = memberQuery({
  args: { measure: v.optional(hugMeasureValidator) },
  handler: async (ctx, me, { measure = "hugsGiven" }): Promise<HugBoardsAnswer> => {
    if (!(await albumShownTo(ctx, me.member)) || !(await leaderboardHugsShownTo(ctx, me.member))) return { kind: "off" };
    await followTheClock(ctx);
    const weeks = await weeksOf(ctx, me.member);
    return { kind: "boards", you: await youThisWeekOf(ctx, me.member, weeks), kudosEmoji: await loopLessonIn(ctx, me.workspace), ...(await peopleBoardsOf(ctx, { workspace: me.workspace, member: me.member }, measure, weeks)) };
  },
});

async function weeksOf(ctx: QueryCtx, member: MemberId): Promise<Weeks> {
  const today = allowanceDay(Date.now(), (await timeZoneOf(ctx, member)) ?? undefined);
  return { thisWeek: weekOf(today).monday, lastWeek: lastPeriodUpToTheSameDay("week", today).first };
}

async function youThisWeekOf(ctx: QueryCtx, member: MemberId, weeks: Weeks): Promise<YouThisWeek> {
  const counted = await weekCountsThrough(ctx, member, weeks.thisWeek);
  const tallies = await talliesOf(ctx, member, weeks.thisWeek, counted);
  const lastWeek = await talliesOf(ctx, member, weeks.lastWeek, counted);
  const reach = await teammatesThankedBy(ctx, member);
  const thanked = await teammatesWhoThanked(ctx, member, weeks.thisWeek);
  return { tallies, lastWeek, highlight: highlightOf({ tallies, lastWeek, counted, weeks, thanked, reach }) };
}

async function talliesOf(ctx: QueryCtx, member: MemberId, week: DayKey, counted: HugWeeks): Promise<Tallies> {
  const { hugsGiven = 0, hugsReceived = 0, kudosReceived = 0 } = counted.get(week) ?? {};
  return { hugsGiven, hugsReceived, kudosReceived, hoggiesFound: await hoggiesFoundIn(ctx, member, week) };
}

type HighlightFacts = { tallies: Tallies; lastWeek: Tallies; counted: HugWeeks; weeks: Weeks; thanked: number; reach: number };

function highlightOf({ tallies, lastWeek, counted, weeks, thanked, reach }: HighlightFacts): Highlight {
  const more = tallies.hugsGiven - lastWeek.hugsGiven;
  if (more > 0 && tallies.hugsGiven > mostHugsGivenBefore(counted, weeks.thisWeek)) return { kind: "best-week", hugsGiven: tallies.hugsGiven, more, hoggiesFound: tallies.hoggiesFound };
  if (more > 0) return { kind: "more-hugs", hugsGiven: tallies.hugsGiven, more };
  if (thanked > 0) return { kind: "thanked", teammates: thanked, reach };
  if (lastWeek.hugsGiven > 0) return { kind: "last-week", hugs: lastWeek.hugsGiven, best: lastWeek.hugsGiven > mostHugsGivenBefore(counted, weeks.lastWeek), reach };
  return { kind: "reach", teammates: reach };
}

function mostHugsGivenBefore(counted: HugWeeks, week: DayKey): number {
  return Math.max(0, ...[...counted].filter(([each]) => each < week).map(([, { hugsGiven }]) => hugsGiven));
}

export function leaderboardRowOf({ position, rank, tied, name, picture, kudos, viewer, climbed }: RankedRow, myFace: Face): LeaderboardRow {
  const teammate = teammateOf(name, picture);
  return { position, rank, tied, name: teammate.name, face: viewer ? myFace : teammate.face, kudos, you: viewer, climbed };
}
