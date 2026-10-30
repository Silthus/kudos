import type { HugBoardsRead, HugBoardsShown } from "../album/answer";
import type { HugBoards } from "../../../convex/website/leaderboard";

const lively: HugBoards = {
  kind: "boards",
  you: {
    tallies: { hugsGiven: 4, hugsReceived: 2, kudosReceived: 1, hoggiesFound: 2 },
    lastWeek: { hugsGiven: 2, hugsReceived: 3, kudosReceived: 1, hoggiesFound: 0 },
    highlight: { kind: "best-week", hugsGiven: 4, more: 2, hoggiesFound: 2 },
  },
};

const quiet: HugBoards = {
  kind: "boards",
  you: {
    tallies: { hugsGiven: 0, hugsReceived: 1, kudosReceived: 0, hoggiesFound: 0 },
    lastWeek: { hugsGiven: 2, hugsReceived: 1, kudosReceived: 0, hoggiesFound: 0 },
    highlight: { kind: "thanked", teammates: 1, reach: 14 },
  },
};

const empty: HugBoards = {
  kind: "boards",
  you: {
    tallies: { hugsGiven: 0, hugsReceived: 0, kudosReceived: 0, hoggiesFound: 0 },
    lastWeek: { hugsGiven: 6, hugsReceived: 3, kudosReceived: 1, hoggiesFound: 1 },
    highlight: { kind: "last-week", hugs: 6, best: true, reach: 14 },
  },
};

export const hugBoardsFixtures = { lively, quiet, empty } satisfies Record<string, HugBoards>;

export function fixedHugBoards(answer: HugBoardsShown): HugBoardsRead {
  return (asking) => (asking ? answer : undefined);
}
