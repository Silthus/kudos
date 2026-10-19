import type { BoardPerson, BoardsRead, BoardsShown, BoardTeam, ThoughtfulBoards } from "./answer";

type Placing = { rank: number; tied?: boolean } | { rank: null };

function giver(person: string, name: string, teams: string[], thoughtful: number, placing: Placing, you = false): BoardPerson {
  const initials = name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("");
  const face = person === "perrin-holt" ? { kind: "slack" as const, image: "https://avatars.slack-edge.com/2026-10-01/perrin_72.png", initials } : { kind: "initials" as const, initials };
  return { person, name, face, teams, thoughtful, you, ...standingOf(placing) };
}

function team(slug: string, name: string, crest: string, thoughtful: number, placing: Placing, mine = false): BoardTeam {
  return { team: slug, name, art: { kind: "crest", slug: crest }, thoughtful, mine, ...standingOf(placing) };
}

function standingOf(placing: Placing) {
  return placing.rank === null ? { rank: null, tied: false as const } : { rank: placing.rank, tied: placing.tied ?? false };
}

const others = {
  wren: giver("wren-alder", "Wren Alder", ["kettle-works"], 6, { rank: 1 }),
  ines: giver("ines-okafor", "Ines Okafor", ["lanterns", "kettle-works"], 5, { rank: 2 }),
  fen: giver("fen-marlowe", "Fen Marlowe", ["paper-moons"], 4, { rank: 3, tied: true }),
  perrin: giver("perrin-holt", "Perrin Holt", ["quiet-harbour"], 4, { rank: 3, tied: true }),
  oren: giver("oren-pike", "Oren Pike", ["salt-and-sparrow"], 2, { rank: 6 }),
  della: giver("della-crane", "Della Crane", ["brass-tidings"], 1, { rank: 7 }),
};

const sam = (teams: string[], thoughtful: number, placing: Placing) => giver("sam-example", "Sam Example", teams, thoughtful, placing, true);

const samRanked = sam(["lanterns"], 3, { rank: 5 });

function boardsOf(people: BoardPerson[], teams: BoardTeam[], me: BoardPerson | null, onTheBoards = true): ThoughtfulBoards {
  return { kind: "boards", people, teams, pinned: { me, teams: teams.filter(({ mine }) => mine) }, onTheBoards };
}

function withUnrankedTeams(boards: ThoughtfulBoards, unranked: BoardTeam[]): ThoughtfulBoards {
  return { ...boards, pinned: { ...boards.pinned, teams: [...boards.pinned.teams, ...unranked] } };
}

const week = boardsOf(
  [others.wren, others.ines, others.fen, others.perrin, samRanked, others.oren, others.della],
  [team("kettle-works", "Kettle Works", "experiments", 11, { rank: 1 }), team("lanterns", "Lanterns", "workflows", 8, { rank: 2 }, true), team("paper-moons", "Paper Moons", "growth", 4, { rank: 3, tied: true }), team("quiet-harbour", "Quiet Harbour", "support", 4, { rank: 3, tied: true }), team("salt-and-sparrow", "Salt and Sparrow", "security", 2, { rank: 5 }), team("brass-tidings", "Brass Tidings", "onboarding", 1, { rank: 6 })],
  samRanked,
);

const samOnTwoTeams = sam(["lanterns", "tin-orchard"], 3, { rank: 5 });

const twoTeams = boardsOf(
  [others.wren, others.ines, others.fen, others.perrin, samOnTwoTeams, others.oren, others.della],
  [team("kettle-works", "Kettle Works", "experiments", 11, { rank: 1 }), team("lanterns", "Lanterns", "workflows", 8, { rank: 2 }, true), team("paper-moons", "Paper Moons", "growth", 4, { rank: 3, tied: true }), team("quiet-harbour", "Quiet Harbour", "support", 4, { rank: 3, tied: true }), team("tin-orchard", "Tin Orchard", "replay", 3, { rank: 5 }, true), team("salt-and-sparrow", "Salt and Sparrow", "security", 2, { rank: 6 }), team("brass-tidings", "Brass Tidings", "onboarding", 1, { rank: 7 })],
  samOnTwoTeams,
);

const hidden = boardsOf(
  [others.wren, others.ines, others.fen, others.perrin, { ...others.oren, rank: 5 }, { ...others.della, rank: 6 }],
  [team("kettle-works", "Kettle Works", "experiments", 11, { rank: 1 }), team("lanterns", "Lanterns", "workflows", 5, { rank: 2 }, true), team("paper-moons", "Paper Moons", "growth", 4, { rank: 3, tied: true }), team("quiet-harbour", "Quiet Harbour", "support", 4, { rank: 3, tied: true }), team("salt-and-sparrow", "Salt and Sparrow", "security", 2, { rank: 5 }), team("brass-tidings", "Brass Tidings", "onboarding", 1, { rank: 6 })],
  null,
  false,
);

const quiet = withUnrankedTeams(boardsOf([], [], sam(["lanterns", "tin-orchard"], 0, { rank: null })), [team("lanterns", "Lanterns", "workflows", 0, { rank: null }, true), team("tin-orchard", "Tin Orchard", "replay", 0, { rank: null }, true)]);

const teamless = boardsOf([], [], sam([], 0, { rank: null }));

export const boardsFixtures = { week, twoTeams, hidden, quiet, teamless } satisfies Record<string, ThoughtfulBoards>;

export function fixedBoards(answer: BoardsShown): BoardsRead {
  return (asking) => (asking ? answer : undefined);
}
