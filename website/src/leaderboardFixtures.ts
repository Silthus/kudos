import type { BoardRead } from "./boardRead";
import type { GroupId, GroupsBoardRow, GroupsBoardShown, Leaderboard, LeaderboardRow, MyGroupBoardShown } from "./shell";

const you = { kind: "initials", initials: "SE" } as const;

function row(position: number, rank: number, name: string, kudos: number, { tied = false, me = false } = {}): LeaderboardRow {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("");
  return { position, rank, tied, name, face: me ? you : { kind: "initials", initials }, kudos, you: me, climbed: null };
}

const teammatesPictures: Record<string, string> = {
  "Ada Lindqvist": "https://avatars.slack-edge.com/ada_192.png",
  "Ivy Quinn": "https://secure.gravatar.com/avatar/ivy.jpg?s=192",
};

const board = { kind: "board", period: "week", chatUrl: "https://app.slack.com/client/T1", onTheBoards: true, peer: null, groups: null, myGroup: null } as const;

const midBoard: Leaderboard = {
  ...board,
  rows: [
    row(1, 1, "Ada Lindqvist", 21),
    row(2, 2, "Bo Okafor", 19),
    row(3, 3, "Cleo Marchetti", 17, { tied: true }),
    row(4, 3, "Dev Rao", 17, { tied: true }),
    row(5, 5, "Eli Brandt", 15),
    row(6, 6, "Fay Mensah", 14),
    row(7, 7, "Gus Park", 13),
    row(8, 8, "Hal Sato", 12),
    row(9, 9, "Sam Example", 11, { me: true }),
    row(10, 10, "Ivy Quinn", 10),
    row(11, 11, "Jo Vogt", 9),
    row(12, 12, "Kai Hale", 8),
    row(13, 13, "Lu Chen", 7),
  ],
  window: [1, 2, 3, 6, 7, 8, 9, 10, 11, 12],
  standing: { kind: "ranked", position: 9, rank: 9 },
  improvement: { gain: 3, places: 2 },
};

const midBoardAfterAClimb: Leaderboard = {
  ...midBoard,
  rows: [...midBoard.rows.slice(0, 5), { ...midBoard.rows[8]!, position: 6, rank: 6, kudos: 16 }, ...midBoard.rows.slice(5, 8), ...midBoard.rows.slice(9)].map((row, i) => ({
    ...row,
    position: i + 1,
    rank: i < 5 ? row.rank : i + 1,
  })),
  window: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  standing: { kind: "ranked", position: 6, rank: 6 },
};

const viewerLeads: Leaderboard = {
  ...board,
  rows: [row(1, 1, "Sam Example", 12, { me: true }), row(2, 2, "Ada Lindqvist", 8), row(3, 3, "Bo Okafor", 5)],
  window: [1, 2, 3],
  standing: { kind: "ranked", position: 1, rank: 1 },
  improvement: { gain: 4 },
};

const sharedLead: Leaderboard = {
  ...board,
  rows: [row(1, 1, "Ada Lindqvist", 9, { tied: true }), row(2, 1, "Sam Example", 9, { tied: true, me: true }), row(3, 3, "Bo Okafor", 5)],
  window: [1, 2, 3],
  standing: { kind: "ranked", position: 2, rank: 1 },
  improvement: null,
};

const tiedBelowTheLead: Leaderboard = {
  ...board,
  rows: [row(1, 1, "Ada Lindqvist", 9), row(2, 2, "Bo Okafor", 4, { tied: true }), row(3, 2, "Sam Example", 4, { tied: true, me: true })],
  window: [1, 2, 3],
  standing: { kind: "ranked", position: 3, rank: 2 },
  improvement: null,
};

const notRanked: Leaderboard = {
  ...board,
  period: "month",
  rows: [row(1, 1, "Ada Lindqvist", 30), row(2, 2, "Bo Okafor", 22)],
  window: [1, 2],
  standing: { kind: "not-ranked" },
  improvement: { best: 19 },
};

const left: Leaderboard = {
  ...board,
  rows: [row(1, 1, "Ada Lindqvist", 21), row(2, 2, "Bo Okafor", 19), row(3, 3, "Cleo Marchetti", 17), row(4, 4, "Dev Rao", 12)],
  window: [1, 2, 3],
  standing: { kind: "left" },
  improvement: { gain: 2 },
  onTheBoards: false,
};

const leftALongBoard: Leaderboard = {
  ...left,
  rows: midBoard.rows.filter((row) => !row.you).map((row, i) => ({ ...row, position: i + 1, rank: row.rank > 9 ? row.rank - 1 : row.rank })),
};

const withTeammatesFaces: Leaderboard = {
  ...midBoard,
  rows: midBoard.rows.map((row) => {
    const picture = teammatesPictures[row.name];
    return picture === undefined ? row : { ...row, face: { kind: "slack", image: picture, initials: row.face.initials } };
  }),
};

const longBoardLength = 30;

function longBoardWith({ viewerAt }: { viewerAt: number }): Leaderboard {
  const rows = Array.from({ length: longBoardLength }, (_, i) => {
    const position = i + 1;
    return position === viewerAt ? row(position, position, "Sam Example", 100 - position, { me: true }) : row(position, position, `Teammate ${position}`, 100 - position);
  });
  return { ...board, rows, window: windowAround(viewerAt), standing: { kind: "ranked", position: viewerAt, rank: viewerAt }, improvement: null };
}

function windowAround(viewerAt: number) {
  const from = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, i) => first + i);
  if (viewerAt <= 7) return from(1, 10);
  return [1, 2, 3, ...from(viewerAt - 3, Math.min(viewerAt + 3, longBoardLength))];
}

const longBoardViewerInTheMiddle = longBoardWith({ viewerAt: 15 });
const longBoardViewerAtTheTop = longBoardWith({ viewerAt: 2 });
const longBoardViewerAtTheBottom = longBoardWith({ viewerAt: longBoardLength });

function groupRow(position: number, rank: number, name: string, perMember: number, participation: number, kudos: number, { tied = false, mine = false, climbed = null as number | null } = {}): GroupsBoardRow {
  return { position, rank, tied, group: groupIdOf(name), name, perMember, participation, kudos, members: Math.max(3, Math.round(kudos / Math.max(perMember, 0.1))), mine, climbed };
}

function groupIdOf(name: string) {
  return `group-${name.toLowerCase().replaceAll(" ", "-")}` as GroupId;
}

const groupsThisWeek: GroupsBoardShown = {
  rows: [
    groupRow(1, 1, "Thistle", 3.2, 100, 16),
    groupRow(2, 2, "Team Ants", 2, 66, 6, { mine: true, climbed: 1 }),
    groupRow(3, 3, "Bees", 0.8, 25, 3),
    groupRow(4, 4, "Moss", 0.5, 50, 3, { climbed: 1 }),
    groupRow(5, 5, "Acorn", 0.3, 33, 1),
  ],
  window: [1, 2, 3, 4, 5],
  standing: { kind: "ranked", position: 2, rank: 2 },
  improvement: { gain: 1.5, places: 1 },
  mostImproved: { group: groupIdOf("Moss"), name: "Moss", gain: 2.5 },
};

const teamAnts: MyGroupBoardShown = {
  group: { group: groupIdOf("Team Ants"), name: "Team Ants" },
  rows: [{ ...row(1, 1, "Sam Example", 4, { me: true }), climbed: 2 }, row(2, 2, "Ada Lindqvist", 2)],
  window: [1, 2],
  standing: { kind: "ranked", position: 1, rank: 1 },
};

const withGroupBoards: Leaderboard = {
  ...midBoard,
  rows: midBoard.rows.map((row) => (row.name === "Hal Sato" ? { ...row, climbed: 3 } : row)),
  groups: groupsThisWeek,
  myGroup: teamAnts,
};

const withGroupsAndNoGroupOfMine: Leaderboard = {
  ...midBoard,
  groups: { ...groupsThisWeek, rows: groupsThisWeek.rows.map((row) => ({ ...row, mine: false })), window: [1, 2, 3], standing: { kind: "no-group" }, improvement: null },
  myGroup: null,
};

const withMyGroupUnlisted: Leaderboard = {
  ...withGroupsAndNoGroupOfMine,
  groups: { ...withGroupsAndNoGroupOfMine.groups!, standing: { kind: "not-listed" } },
  myGroup: { ...teamAnts, rows: [], window: [], standing: { kind: "not-ranked" } },
};

const withMyGroupTiedOnGroups: Leaderboard = {
  ...withGroupBoards,
  groups: { ...groupsThisWeek, rows: groupsThisWeek.rows.map((row) => (row.position === 2 || row.position === 3 ? { ...row, rank: 2, tied: true, perMember: 2, participation: 66, kudos: 6 } : row)) },
};

const withGroupsGivingNothingYet: Leaderboard = {
  ...withGroupBoards,
  groups: { ...groupsThisWeek, rows: groupsThisWeek.rows.map((row) => ({ ...row, rank: 1, tied: true, perMember: 0, participation: 0, kudos: 0, climbed: null })), improvement: null, mostImproved: null },
};

const withGroupBoardsAllTime: Leaderboard = {
  ...withGroupBoards,
  period: "all",
  rows: midBoard.rows,
  improvement: null,
  groups: { ...groupsThisWeek, rows: groupsThisWeek.rows.map((row) => ({ ...row, climbed: null })), improvement: null, mostImproved: null },
  myGroup: { ...teamAnts, rows: teamAnts.rows.map((row) => ({ ...row, climbed: null })) },
};

const withAPeerLine: Leaderboard = { ...withGroupBoards, peer: { percent: 60, group: teamAnts.group } };

const aheadOfTheWholeGroup: Leaderboard = { ...withGroupBoards, peer: { percent: 100, group: teamAnts.group } };

const leftWhileMyGroupRanks: Leaderboard = {
  ...left,
  groups: groupsThisWeek,
  myGroup: { ...teamAnts, rows: [row(1, 1, "Ada Lindqvist", 2)], window: [1], standing: { kind: "left" } },
};

const leftWhileMyGroupIsUnlisted: Leaderboard = {
  ...left,
  groups: withMyGroupUnlisted.groups,
  myGroup: { ...teamAnts, rows: [], window: [], standing: { kind: "left" } },
};

const empty: Leaderboard = { ...board, period: "all", rows: [], window: [], standing: { kind: "not-ranked" }, improvement: null };

export const leaderboardFixtures = { midBoard, midBoardAfterAClimb, withTeammatesFaces, viewerLeads, sharedLead, tiedBelowTheLead, notRanked, left, leftALongBoard, longBoardViewerInTheMiddle, longBoardViewerAtTheTop, longBoardViewerAtTheBottom, empty, withGroupBoards, withGroupsAndNoGroupOfMine, withMyGroupUnlisted, withMyGroupTiedOnGroups, withGroupsGivingNothingYet, withGroupBoardsAllTime, withAPeerLine, aheadOfTheWholeGroup, leftWhileMyGroupRanks, leftWhileMyGroupIsUnlisted } as const satisfies Record<string, Leaderboard>;

export function fixedLeaderboard(answer: Leaderboard): BoardRead {
  return (period) => (period === undefined ? undefined : { ...answer, period });
}
