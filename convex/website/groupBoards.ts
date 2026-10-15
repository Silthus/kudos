import type { GroupId, GroupRef } from "../groups/groups";
import { groupBoardsOf } from "../leaderboard/groupBoards";
import type { GroupsBoard } from "../leaderboard/groupsBoard";
import { periodValidator } from "../leaderboard/periods";
import type { Standing } from "../leaderboard/totals";
import { followTheClock } from "./clock";
import { faceOf } from "./faces";
import { leaderboardRowOf, type LeaderboardRow } from "./leaderboard";
import { memberQuery, type Denial } from "./memberQuery";
import { leaderboardStateOf, unlockPathOf } from "./unlockPath";

export type GroupsBoardShown = GroupsBoard<GroupId>;

export type MyGroupBoardShown = { group: GroupRef; rows: LeaderboardRow[]; window: number[]; standing: Standing };

export type GroupBoards = { kind: "boards"; groups: GroupsBoardShown | null; myGroup: MyGroupBoardShown | null };

export type MyGroupBoards = Denial | GroupBoards;

const hidden: GroupBoards = { kind: "boards", groups: null, myGroup: null };

export const getGroupBoards = memberQuery({
  args: { period: periodValidator },
  handler: async (ctx, me, { period }): Promise<GroupBoards> => {
    if ((await leaderboardStateOf(ctx, me, await unlockPathOf(ctx, me))).kind !== "open") return hidden;
    await followTheClock(ctx);
    const { groups, myGroup } = await groupBoardsOf(ctx, me.workspace, me.user, period);
    const myFace = await faceOf(ctx, me);
    return {
      kind: "boards",
      groups: groups === null || groups.rows.length === 0 ? null : groups,
      myGroup: myGroup === null ? null : { group: myGroup.group, rows: myGroup.rows.map((row) => leaderboardRowOf(row, myFace)), window: myGroup.window, standing: myGroup.standing },
    };
  },
});
