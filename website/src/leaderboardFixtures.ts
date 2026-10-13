import type { Leaderboard, LeaderboardRow, MyLeaderboard } from "../../convex/website/leaderboard";
import type { Period } from "./shell";

export type { Leaderboard, LeaderboardRow, MyLeaderboard } from "../../convex/website/leaderboard";

export type LeaderboardRead = (period: Period | undefined) => MyLeaderboard | undefined;

const you = { kind: "initials", initials: "SE" } as const;

function row(position: number, rank: number, name: string, kudos: number, { tied = false, me = false } = {}): LeaderboardRow {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("");
  return { position, rank, tied, name, face: me ? you : { kind: "initials", initials }, kudos, you: me };
}

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
  window: [1, 2, 3, 4],
  standing: { kind: "left" },
  improvement: { gain: 2 },
  onTheBoards: false,
};

const empty: Leaderboard = { ...board, period: "all", rows: [], window: [], standing: { kind: "not-ranked" }, improvement: null };

export const leaderboardFixtures = { midBoard, viewerLeads, sharedLead, tiedBelowTheLead, notRanked, left, empty } as const satisfies Record<string, Leaderboard>;

export function fixedLeaderboard(answer: Leaderboard): LeaderboardRead {
  return (period) => (period === undefined ? undefined : { ...answer, period });
}
