import type { BoardRead } from "./boardRead";
import type { Leaderboard, LeaderboardRow } from "./shell";

const you = { kind: "initials", initials: "SE" } as const;

function row(position: number, rank: number, name: string, kudos: number, { tied = false, me = false } = {}): LeaderboardRow {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("");
  return { position, rank, tied, name, face: me ? you : { kind: "initials", initials }, kudos, you: me };
}

const teammatesPictures: Record<string, string> = {
  "Ada Lindqvist": "https://avatars.slack-edge.com/ada_192.png",
  "Ivy Quinn": "https://secure.gravatar.com/avatar/ivy.jpg?s=192",
};

const board = { kind: "board", period: "week", chatUrl: "https://app.slack.com/client/T1", onTheBoards: true } as const;

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

const empty: Leaderboard = { ...board, period: "all", rows: [], window: [], standing: { kind: "not-ranked" }, improvement: null };

export const leaderboardFixtures = { midBoard, midBoardAfterAClimb, withTeammatesFaces, viewerLeads, sharedLead, tiedBelowTheLead, notRanked, left, leftALongBoard, longBoardViewerInTheMiddle, longBoardViewerAtTheTop, longBoardViewerAtTheBottom, empty } as const satisfies Record<string, Leaderboard>;

export function fixedLeaderboard(answer: Leaderboard): BoardRead {
  return (period) => (period === undefined ? undefined : { ...answer, period });
}
