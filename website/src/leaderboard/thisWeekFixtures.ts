import type { Id } from "../../../convex/_generated/dataModel";
import type { HugBoardsRead, HugBoardsShown } from "../album/answer";
import type { HugBoards, HugMeasure, JoiningTeam, PersonRow } from "../../../convex/website/leaderboard";

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

type Joining = [name: string, crest: string | null, joined: number, of: number, standing: [rank: number, gain: number] | null];

function joiningTeamOf([name, crest, joined, of, standing]: Joining): JoiningTeam {
  const team = crest === null ? null : name.toLowerCase().replaceAll(" ", "-");
  return {
    group: `group-${name.toLowerCase().replaceAll(" ", "-")}` as Id<"userGroups">,
    name,
    team,
    art: crest === null ? null : { kind: "crest", slug: crest },
    joined,
    of,
    standing: standing && { rank: standing[0], gain: standing[1] },
    mine: name === "Lanterns",
  };
}

function joiningIn(...teams: Joining[]) {
  return { teams: teams.map(joiningTeamOf) };
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
  joiningIn: joiningIn(["Lanterns", "workflows", 3, 5, [1, 40]], ["Kettle Works", "experiments", 3, 3, [2, 33]], ["Paper Moons", "growth", 1, 4, [3, 25]], ["Tin Orchard", "replay", 2, 3, null], ["Night Shift", null, 0, 4, null]),
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
  joiningIn: joiningIn(["Lanterns", "workflows", 1, 5, null], ["Kettle Works", "experiments", 1, 3, null]),
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
  joiningIn: joiningIn(["Lanterns", "workflows", 0, 5, null], ["Kettle Works", "experiments", 0, 3, null]),
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

export function byHoggies(boards: HugBoards): HugBoards {
  return {
    ...boards,
    measure: "hoggies",
    team: boards.team && { ...boards.team, rows: rowsOf(["ines-okafor", "Ines Okafor", 3, 1], [you, "Sam Example", 0, null], ["oona-vasquez", "Oona Vasquez", 0, null]), yetToJoin: 0 },
  };
}

export function offTheBoards(boards: HugBoards): HugBoards {
  return { ...boards, team: boards.team && { ...boards.team, rows: boards.team.rows.filter((row) => !row.you), joinedIn: false } };
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
