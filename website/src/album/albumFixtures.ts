import type { Album, AlbumEmoji, AlbumMilestone, AlbumPerson, AlbumRead, AlbumTeam, GettingStarted, MyAlbum, PackOpenAnswer, PutAllInAnswer, PutInAnswer, TrayItem } from "./answer";

const day = 86_400_000;

const now = Date.parse("2026-10-18T10:00:00Z");

type CastTeam = { team: string; name: string; crest: string; people: string[]; held: number; state?: AlbumTeam["state"] };

const castTeams: CastTeam[] = [
  { team: "lanterns", name: "Lanterns", crest: "workflows", people: ["ines-okafor", "bram-teller", "oona-vasquez", "tomas-reyne", "juno-park"], held: 4 },
  { team: "kettle-works", name: "Kettle Works", crest: "experiments", people: ["wren-alder", "ines-okafor", "milo-strand"], held: 3, state: "ready" },
  { team: "quiet-harbour", name: "Quiet Harbour", crest: "support", people: ["perrin-holt", "ada-quill"], held: 2, state: "unlocked" },
  { team: "paper-moons", name: "Paper Moons", crest: "growth", people: ["fen-marlowe", "kit-sorrel", "lys-amber", "rook-dale"], held: 3 },
  { team: "tin-orchard", name: "Tin Orchard", crest: "replay", people: ["sable-ford", "nell-brook", "cass-vey"], held: 2 },
  { team: "salt-and-sparrow", name: "Salt and Sparrow", crest: "security", people: ["oren-pike", "hale-wren", "ivo-lark", "mara-fenn", "teo-ash"], held: 2 },
  { team: "brass-tidings", name: "Brass Tidings", crest: "onboarding", people: ["della-crane", "rafe-moss"], held: 1 },
  { team: "glass-meadow", name: "Glass Meadow", crest: "talent", people: ["una-reed", "pim-hollis", "zed-carrow"], held: 1 },
  { team: "willow-desk", name: "Willow Desk", crest: "graphics", people: ["bea-thorne", "cyl-amory"], held: 1 },
  { team: "copper-kite", name: "Copper Kite", crest: "apm", people: ["dov-esker", "ria-hallow", "sol-vane"], held: 0 },
  { team: "amber-ledger", name: "Amber Ledger", crest: "clickhouse", people: ["gus-marrow", "vi-ostrand"], held: 0 },
  { team: "nimble-lantern", name: "Nimble Lantern", crest: "youtube", people: ["eli-brask", "nora-quist"], held: 0 },
  { team: "velvet-signal", name: "Velvet Signal", crest: "data-tools", people: ["ott-reyes", "liv-carden", "ash-morrow"], held: 0 },
];

function nameOf(person: string) {
  return person
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function initialsOf(person: string) {
  return person
    .split("-")
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function teamsOf(cast: CastTeam[], mine: string | null): AlbumTeam[] {
  return cast.map(({ team, name, crest, people, held, state }) => ({
    team,
    name,
    art: { kind: "crest", slug: crest },
    mine: team === mine,
    people,
    held,
    total: people.length,
    state: state ?? "progress",
    unlockedAt: state === "unlocked" ? now - 3 * day : null,
  }));
}

function peopleOf(teams: AlbumTeam[]): AlbumPerson[] {
  const byPerson = new Map<string, AlbumPerson>();
  for (const { team, people, held } of teams) {
    people.forEach((person, index) => {
      const known = byPerson.get(person);
      if (known !== undefined) {
        known.teams.push(team);
        known.held ||= index < held;
        return;
      }
      byPerson.set(person, { person, name: nameOf(person), face: { kind: "initials", initials: initialsOf(person) }, teams: [team], held: index < held, packedThisWeek: false });
    });
  }
  return [...byPerson.values()];
}

const milestoneTiers = (names: [string, string, string, string], steps: [number, number, number, number], earned: number[]): AlbumMilestone["tiers"] =>
  (["bronze", "silver", "gold", "diamond"] as const).map((tier, index) => ({ tier, at: steps[index]!, name: names[index]!, earnedAt: earned[index] ?? null }));

const milestones: AlbumMilestone[] = [
  { id: "people", count: 12, tiers: milestoneTiers(["First face", "Familiar faces", "Full of friends", "Everyone's album"], [1, 10, 25, 50], [now - 20 * day, now - 2 * day]) },
  { id: "teams", count: 1, tiers: milestoneTiers(["First full page", "Five teams strong", "Most of the company", "Every page"], [1, 5, 15, 50], [now - 3 * day]) },
  { id: "reach", count: 6, tiers: milestoneTiers(["Next door", "Bridge builder", "Well travelled", "All hands"], [3, 10, 25, 50], [now - 9 * day]) },
  { id: "hoggies", count: 18, tiers: milestoneTiers(["Curious", "Collector", "Hoarder", "Completionist"], [10, 40, 100, 151], [now - 5 * day]) },
  { id: "thoughtful", count: 9, tiers: milestoneTiers(["First thank-you", "Generous soul", "Heart of the team", "Patron of praise"], [1, 25, 100, 500], [now - 30 * day]) },
];

const emojis: AlbumEmoji[] = [
  { id: "team:quiet-harbour", kind: "team", name: "quiet-harbour", picture: "/emoji/team-quiet-harbour.png", earned: true, seen: true, inSlack: true, progress: null },
  { id: "hype:ines-okafor", kind: "hype", name: "ines-okafor-hype", picture: "/emoji/hype-ines-okafor.png", earned: true, seen: true, inSlack: false, progress: null },
  { id: "level:5", kind: "level", name: "level-5", picture: "/emoji/level-5.png", earned: true, seen: false, inSlack: false, progress: null },
  { id: "team:lanterns", kind: "team", name: "lanterns", picture: "/emoji/team-lanterns.png", earned: false, seen: false, inSlack: false, progress: { have: 4, need: 5 } },
  { id: "level:10", kind: "level", name: "level-10", picture: "/emoji/level-10.png", earned: false, seen: false, inSlack: false, progress: { have: 1210, need: 4500 } },
];

const me = { name: "Sam Example", face: { kind: "initials", initials: "SE" }, person: "sam-example" } as const;

function albumOf({ mine = "lanterns", cast = castTeams, gettingStarted = { hugged: true, thoughtful: true, opened: false, completed: false }, packs = 2 }: { mine?: string | null; cast?: CastTeam[]; gettingStarted?: GettingStarted; packs?: number } = {}): Album {
  const teams = teamsOf(cast, mine);
  const people = peopleOf(teams);
  return {
    kind: "album",
    me: { ...me, team: mine },
    level: { level: 6, xp: 1210, startsAt: 1000, nextAt: 1500 },
    teams,
    people,
    packs: people
      .filter(({ held }) => !held)
      .slice(0, packs)
      .map(({ person }, index, waiting) => ({ pack: `pack-${index + 1}`, person, earnedAt: now - (waiting.length - index) * day })),
    morePacks: false,
    tray: [],
    emojis,
    milestones,
    gettingStarted,
  };
}

const midwayTray: TrayItem[] = [
  { item: "tray-cass-vey", kind: "sticker", person: "cass-vey" },
  { item: "tray-burning-money", kind: "hoggie", hoggie: "burning-money", rarity: "uncommon", isNew: true },
  { item: "tray-dov-esker", kind: "sticker", person: "dov-esker" },
  { item: "tray-banana", kind: "hoggie", hoggie: "banana", rarity: "common", isNew: false },
];

const newcomerCast = castTeams.slice(0, 4).map((team) => ({ ...team, held: 0, state: undefined }));

export const albumFixtures = {
  midway: albumOf(),
  newcomer: { ...albumOf({ mine: null, cast: newcomerCast, gettingStarted: { hugged: false, thoughtful: false, opened: false, completed: false }, packs: 0 }), emojis: emojis.map((emoji) => ({ ...emoji, earned: false, seen: false })), milestones: milestones.map((milestone) => ({ ...milestone, count: 0, tiers: milestone.tiers.map((tier) => ({ ...tier, earnedAt: null })) })) },
  started: albumOf({ gettingStarted: { hugged: true, thoughtful: true, opened: true, completed: true } }),
  onePack: albumOf({ packs: 1 }),
  fewTeams: albumOf({ cast: castTeams.slice(0, 3) }),
  trayed: { ...albumOf(), tray: midwayTray },
} satisfies Record<string, Album>;

export function fixedAlbum(answer: MyAlbum): AlbumRead {
  return (asking) => (asking ? answer : undefined);
}

const fixtureHoggies = [
  { hoggie: "coffee-run", rarity: "rare", isNew: true },
  { hoggie: "banana", rarity: "common", isNew: false },
] as const;

export function fixturePackOpeningOf(pack: string): PackOpenAnswer {
  const index = albumFixtures.midway.packs.findIndex((waiting) => waiting.pack === pack);
  const waiting = albumFixtures.midway.packs[index];
  if (waiting === undefined) return { kind: "refused" };
  const { xp, level } = albumFixtures.midway.level;
  return {
    kind: "opened",
    items: [
      { item: `${pack}:sticker`, kind: "sticker", person: waiting.person },
      { item: `${pack}:hoggie`, kind: "hoggie", ...fixtureHoggies[index % fixtureHoggies.length]! },
    ],
    applied: { xp: 15, coins: 0, from: { xp, level, coins: 0, skillPoints: 0 }, to: { xp: xp + 15, level, coins: 0, skillPoints: 0 } },
  };
}

export function fixturePutInOf(item: string): PutInAnswer {
  const placed = albumFixtures.trayed.tray.find((waiting) => waiting.item === item);
  return placed === undefined ? { kind: "refused" } : { kind: "placed", item: placed };
}

export function fixturePutAllIn(): PutAllInAnswer {
  const { tray } = albumFixtures.trayed;
  return { kind: "placed", items: [...tray.filter(({ kind }) => kind === "hoggie"), ...tray.filter(({ kind }) => kind === "sticker")], more: false };
}
