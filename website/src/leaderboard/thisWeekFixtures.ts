import type { Id } from "../../../convex/_generated/dataModel";
import type { HugBoardsRead, HugBoardsShown } from "../album/answer";
import type { HugBoards, HugMeasure, PersonRow } from "../../../convex/website/leaderboard";

type Ranked = [person: string, name: string, figure: number, rank: number | null];

const you = "sam-example";

function rowOf([person, name, figure, rank]: Ranked): PersonRow {
  const initials = name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("");
  return { person: person as Id<"members">, rank, name, face: { kind: "initials", initials }, figure, you: person === you };
}

function rowsOf(...ranked: Ranked[]): PersonRow[] {
  return ranked.map(rowOf);
}

const kudosEmoji = { kudosEmoji: "taco", kudosEmojiImage: null };

const lively: HugBoards = {
  kind: "boards",
  you: {
    tallies: { hugsGiven: 4, hugsReceived: 2, kudosReceived: 1, hoggiesFound: 2 },
    lastWeek: { hugsGiven: 2, hugsReceived: 3, kudosReceived: 1, hoggiesFound: 0 },
    highlight: { kind: "best-week", hugsGiven: 4, more: 2, hoggiesFound: 2 },
  },
  kudosEmoji,
  measure: "hugsGiven",
  people: {
    rows: rowsOf(["wren-alder", "Wren Alder", 6, 1], ["ines-okafor", "Ines Okafor", 4, 2], [you, "Sam Example", 4, 2], ["fen-marlowe", "Fen Marlowe", 1, 4]),
    lastWeek: null,
  },
  team: { name: "Lanterns", rows: rowsOf(["ines-okafor", "Ines Okafor", 4, 1], [you, "Sam Example", 4, 1], ["oona-vasquez", "Oona Vasquez", 0, null]), joinedIn: true, yetToJoin: 2 },
};

const quiet: HugBoards = {
  kind: "boards",
  you: {
    tallies: { hugsGiven: 0, hugsReceived: 1, kudosReceived: 0, hoggiesFound: 0 },
    lastWeek: { hugsGiven: 2, hugsReceived: 1, kudosReceived: 0, hoggiesFound: 0 },
    highlight: { kind: "thanked", teammates: 1, reach: 14 },
  },
  kudosEmoji,
  measure: "hugsGiven",
  people: { rows: rowsOf(["wren-alder", "Wren Alder", 2, 1], [you, "Sam Example", 0, null]), lastWeek: null },
  team: { name: "Lanterns", rows: rowsOf(["ines-okafor", "Ines Okafor", 1, 1], [you, "Sam Example", 0, null]), joinedIn: false, yetToJoin: 3 },
};

const empty: HugBoards = {
  kind: "boards",
  you: {
    tallies: { hugsGiven: 0, hugsReceived: 0, kudosReceived: 0, hoggiesFound: 0 },
    lastWeek: { hugsGiven: 6, hugsReceived: 3, kudosReceived: 1, hoggiesFound: 1 },
    highlight: { kind: "last-week", hugs: 6, best: true, reach: 14 },
  },
  kudosEmoji,
  measure: "hugsGiven",
  people: { rows: rowsOf([you, "Sam Example", 0, null]), lastWeek: rowsOf(["wren-alder", "Wren Alder", 9, 1], ["ines-okafor", "Ines Okafor", 6, 2], [you, "Sam Example", 6, 2]) },
  team: { name: "Lanterns", rows: rowsOf([you, "Sam Example", 0, null]), joinedIn: false, yetToJoin: 4 },
};

export const hugBoardsFixtures = { lively, quiet, empty } satisfies Record<string, HugBoards>;

export function byLevel(boards: HugBoards): HugBoards {
  return {
    ...boards,
    measure: "level",
    people: { rows: rowsOf(["wren-alder", "Wren Alder", 9, 1], ["ines-okafor", "Ines Okafor", 7, 2], [you, "Sam Example", 6, 3]), lastWeek: null },
    team: boards.team && { ...boards.team, rows: rowsOf(["ines-okafor", "Ines Okafor", 7, 1], [you, "Sam Example", 6, 2], ["oona-vasquez", "Oona Vasquez", 5, 3]), yetToJoin: 0 },
  };
}

export function byKudosReceived(boards: HugBoards): HugBoards {
  return {
    ...boards,
    measure: "kudosReceived",
    team: boards.team && { ...boards.team, rows: rowsOf(["ines-okafor", "Ines Okafor", 1, 1], [you, "Sam Example", 0, null], ["oona-vasquez", "Oona Vasquez", 0, null]) },
  };
}

export function measuredBy(boards: HugBoards): (measure: HugMeasure) => HugBoards {
  return (measure) => (measure === "level" ? byLevel(boards) : { ...boards, measure });
}

export function fixedHugBoards(answer: HugBoardsShown | ((measure: HugMeasure) => HugBoardsShown | undefined)): HugBoardsRead {
  return (asking, measure) => {
    if (!asking) return undefined;
    return typeof answer === "function" ? answer(measure) : answer;
  };
}
