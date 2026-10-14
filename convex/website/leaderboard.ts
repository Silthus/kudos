import type { Improvement } from "../leaderboard/improvement";
import { periodValidator, type Period } from "../leaderboard/periods";
import { rankedBoardOf, type RankedRow, type Standing } from "../leaderboard/totals";
import { isOnTheBoards } from "../leaderboard/visibility";
import { workspaceLink } from "../slack/workspaceLink";
import { followTheClock } from "./clock";
import { faceOf, teammateOf, type Face } from "./faces";
import { memberQuery, type Denial } from "./memberQuery";
import { leaderboardStateOf, unlockPathOf, type PageWaits } from "./unlockPath";

export type LeaderboardRow = { position: number; rank: number; tied: boolean; name: string; face: Face; kudos: number; you: boolean };

export type Leaderboard = {
  kind: "board";
  period: Period;
  chatUrl: string;
  rows: LeaderboardRow[];
  window: number[];
  standing: Standing;
  improvement: Improvement | null;
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
    const { rows, window, standing, improvement } = await rankedBoardOf(ctx, me.workspace, me.user, period);
    const myFace = await faceOf(ctx, me);
    return {
      kind: "board",
      period,
      chatUrl: workspaceLink(me.workspace),
      rows: rows.map((row) => leaderboardRowOf(row, myFace)),
      window,
      standing,
      improvement,
      onTheBoards: await isOnTheBoards(ctx, me.member),
    };
  },
});

function leaderboardRowOf({ position, rank, tied, name, picture, kudos, viewer }: RankedRow, myFace: Face): LeaderboardRow {
  const teammate = teammateOf(name, picture);
  return { position, rank, tied, name: teammate.name, face: viewer ? myFace : teammate.face, kudos, you: viewer };
}
