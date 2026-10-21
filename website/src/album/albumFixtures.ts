import type { Id } from "../../../convex/_generated/dataModel";
import { milestoneTierArtOf, slugOf } from "../../../convex/album/emojiCatalogue";
import type { Drop } from "../../../convex/hoggies/drops";
import type { BoardItem, ItemBoard, TurnAnswer } from "../../../convex/website/album";
import type { Album, AlbumEmoji, AlbumMilestone, AlbumPerson, AlbumRead, AlbumTeam, GettingStarted, MyAlbum, PackOpenAnswer, PersonPage, PersonRead, PutAllInAnswer, PutInAnswer, SharedEmoji, TrayItem, UnlockAnswer } from "./answer";

const day = 86_400_000;

const now = Date.parse("2026-10-18T10:00:00Z");

type CastTeam = { team: string; name: string; crest: string; people: string[]; held: number; state?: AlbumTeam["state"]; unmatched?: string[] };

const castTeams: CastTeam[] = [
  { team: "lanterns", name: "Lanterns", crest: "workflows", people: ["ines-okafor", "bram-teller", "oona-vasquez", "tomas-reyne", "juno-park"], held: 4, unmatched: ["Hal Corwin"] },
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

export function stickerFor(item: string, person: string): TrayItem {
  return { item, kind: "sticker", person, thanked: { name: nameOf(person), face: { kind: "initials", initials: initialsOf(person) } } };
}

function teamsOf(cast: CastTeam[], mine: string | null): AlbumTeam[] {
  return cast.map(({ team, name, crest, people, held, state, unmatched = [] }) => ({
    team,
    name,
    art: { kind: "crest", slug: crest },
    mine: team === mine,
    people,
    unmatched,
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

const milestoneEmojisInSlack: ReadonlySet<string> = new Set(["milestone:people:bronze"]);

const milestoneEmojisOf = (listed: AlbumMilestone[]): AlbumEmoji[] =>
  listed.flatMap(({ id, count, tiers }) =>
    tiers.map(({ tier, at, name, earnedAt }) => {
      const emoji = `milestone:${id}:${tier}`;
      const earned = earnedAt !== null;
      return { id: emoji, kind: "milestone", name: slugOf(name), from: name, picture: `/emoji/milestone-${milestoneTierArtOf(id, tier)}.png`, earned, earnedAt, seen: earned, inSlack: milestoneEmojisInSlack.has(emoji), progress: earned ? null : { have: count, need: at } };
    }),
  );

const emojis: AlbumEmoji[] = [
  { id: "team:quiet-harbour", kind: "team", name: "team-quiet-harbour", from: "Quiet Harbour", picture: "/emoji/team-support.png", earned: true, earnedAt: now - 3 * day, seen: true, inSlack: true, progress: null },
  { id: "hype:ines-okafor", kind: "hype", name: "ines-okafor-hype", from: "Ines Okafor", picture: "/emoji/hype.png", earned: true, earnedAt: now - 9 * day, seen: true, inSlack: false, progress: null },
  { id: "level:5", kind: "level", name: "level-5", from: "Level 5", picture: "/emoji/level-5.png", earned: true, earnedAt: null, seen: true, inSlack: false, progress: null },
  { id: "team:lanterns", kind: "team", name: "team-lanterns", from: "Lanterns", picture: "/emoji/team-workflows.png", earned: false, earnedAt: null, seen: false, inSlack: false, progress: { have: 4, need: 5 } },
  { id: "team:kettle-works", kind: "team", name: "team-kettle-works", from: "Kettle Works", picture: "/emoji/team-experiments.png", earned: false, earnedAt: null, seen: false, inSlack: false, progress: { have: 3, need: 3 } },
  { id: "team:copper-kite", kind: "team", name: "team-copper-kite", from: "Copper Kite", picture: "/emoji/team-apm.png", earned: false, earnedAt: null, seen: false, inSlack: false, progress: { have: 0, need: 3 } },
  { id: "level:10", kind: "level", name: "level-10", from: "Level 10", picture: "/emoji/level-10.png", earned: false, earnedAt: null, seen: false, inSlack: false, progress: { have: 1210, need: 4500 } },
  ...milestoneEmojisOf(milestones),
];

const newEmojis: AlbumEmoji[] = [
  ...emojis.map((emoji) => (emoji.id === "team:quiet-harbour" || emoji.id === "level:5" ? { ...emoji, seen: false } : emoji)),
  { id: "hype:bram-teller", kind: "hype", name: "bram-teller-hype", from: "Bram Teller", picture: "/emoji/hype.png", earned: true, earnedAt: now - day, seen: false, inSlack: false, progress: null },
  { id: "hype:fen-marlowe", kind: "hype", name: "fen-marlowe-hype", from: "Fen Marlowe", picture: "/emoji/hype.png", earned: true, earnedAt: now - day, seen: false, inSlack: false, progress: null },
];

const sharedEmojis: SharedEmoji[] = emojis.filter(({ kind }) => kind !== "hype").map(({ id, kind, name, from, picture, inSlack }) => ({ id, kind, name, from, picture, inSlack }));

const emojiPage = "https://hedgehug.slack.com/customize/emoji";

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
      .map(({ person, name, face }, index, waiting) => ({ pack: `pack-${index + 1}`, person, earnedAt: now - (waiting.length - index) * day, thanked: { name, face } })),
    morePacks: false,
    tray: [],
    emojis,
    moreEmojis: false,
    sharedEmojis: null,
    emojiPage,
    emojiWizard: false,
    emojiInPlace: null,
    milestones,
    gettingStarted,
    board: null,
  };
}

const midwayTray: TrayItem[] = [
  stickerFor("tray-cass-vey", "cass-vey"),
  { item: "tray-burning-money", kind: "hoggie", hoggie: "burning-money", rarity: "uncommon", isNew: true },
  stickerFor("tray-dov-esker", "dov-esker"),
  { item: "tray-banana", kind: "hoggie", hoggie: "banana", rarity: "common", isNew: false },
];

function boardItemFor(index: number, person: string): BoardItem {
  return { item: `item-${index + 1}` as Id<"items">, earnedAt: now - (index + 1) * day, reason: { kind: "thanks", thanked: { name: nameOf(person), face: { kind: "initials", initials: initialsOf(person) } } } };
}

const waitingItems: ItemBoard = { items: ["cass-vey", "dov-esker", "rook-dale"].map((person, index) => boardItemFor(index, person)), more: false };

const newcomerCast = castTeams.slice(0, 4).map((team) => ({ ...team, held: 0, state: undefined }));

export const albumFixtures = {
  midway: albumOf(),
  teamless: albumOf({ mine: null }),
  newcomer: { ...albumOf({ mine: null, cast: newcomerCast, gettingStarted: { hugged: false, thoughtful: false, opened: false, completed: false }, packs: 0 }), emojis: emojis.map((emoji) => ({ ...emoji, earned: false, seen: false, progress: emoji.progress ?? { have: 0, need: 1 } })), milestones: milestones.map((milestone) => ({ ...milestone, count: 0, tiers: milestone.tiers.map((tier) => ({ ...tier, earnedAt: null })) })) },
  started: albumOf({ gettingStarted: { hugged: true, thoughtful: true, opened: true, completed: true } }),
  onePack: albumOf({ packs: 1 }),
  fewTeams: albumOf({ cast: castTeams.slice(0, 3) }),
  trayed: { ...albumOf(), tray: midwayTray },
  newEmojis: { ...albumOf(), emojis: newEmojis },
  admin: { ...albumOf(), sharedEmojis },
  withItems: { ...albumOf(), packs: [], board: waitingItems },
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
      { item: `${pack}:sticker`, kind: "sticker", person: waiting.person, thanked: waiting.thanked },
      { item: `${pack}:hoggie`, kind: "hoggie", ...fixtureHoggies[index % fixtureHoggies.length]! },
    ],
    applied: { xp: 15, coins: 0, from: { xp, level, coins: 0, skillPoints: 0 }, to: { xp: xp + 15, level, coins: 0, skillPoints: 0 } },
  };
}

const turnedDrops: Drop[] = [
  { hoggie: "70s-dance", name: "70's Dance", rarity: "rare", art: { kind: "hoggie", slug: "70s-dance" }, copy: 1, isNew: true },
  { hoggie: "banana", name: "Banana", rarity: "common", art: { kind: "hoggie", slug: "banana" }, copy: 2, isNew: false },
  { hoggie: "coffee-run", name: "Coffee Run", rarity: "rare", art: { kind: "hoggie", slug: "coffee-run" }, copy: 1, isNew: true },
];

export function fixtureTurnOf(item: string): TurnAnswer {
  const index = waitingItems.items.findIndex((waiting) => waiting.item === item);
  if (index === -1) return { kind: "refused" };
  const { xp, level } = albumFixtures.midway.level;
  return {
    kind: "turned",
    face: { kind: "hoggie", drop: turnedDrops[index % turnedDrops.length]! },
    applied: { xp: 15, coins: 0, from: { xp, level, coins: 0, skillPoints: 0 }, to: { xp: xp + 15, level, coins: 0, skillPoints: 0 } },
    page: { kind: "hoggies" },
    unlocked: { teamStickers: [], hype: null, milestones: [] },
    again: false,
  };
}

export function fixtureUnlockOf(album: Album, team: string): UnlockAnswer {
  const page = album.teams.find((listed) => listed.team === team);
  if (page?.state !== "ready") return { kind: "refused" };
  return { kind: "unlocked", sticker: { team, name: page.name, art: page.art, emoji: `team-${team}`, at: now } };
}

const bestWords = "Thanks for staying late to untangle the migration, the whole launch went out on time because of you.";

export function fixturePersonOf(album: Album, person: string): PersonPage | { kind: "no-person" } {
  const listed = album.people.find((someone) => someone.person === person);
  if (listed === undefined) return { kind: "no-person" };
  const index = album.people.indexOf(listed);
  const thanked = listed.held || index % 3 === 0;
  return {
    kind: "person",
    person,
    name: listed.name,
    face: listed.face,
    held: listed.held,
    firstThankedAt: thanked ? now - (40 + index) * day : null,
    kudosGiven: thanked ? 1 + (index % 4) : 0,
    kudosReceived: index % 3,
    hugsGiven: index % 5,
    hugsReceived: (index + 2) % 4,
    best: listed.held && index % 2 === 0 ? { message: { kind: "text", segments: [{ kind: "text", text: bestWords }], edited: false }, permalink: "https://example.slack.com/archives/C1/p1", at: now - 12 * day } : null,
    teams: album.teams
      .filter(({ team }) => listed.teams.includes(team))
      .map(({ team, name, art }) => ({ team, name, art }))
      .toSorted((one, other) => one.name.localeCompare(other.name)),
    hype: { earned: album.emojis.some(({ id, earned }) => earned && id === `hype:${person}`), name: `${person}-hype`, picture: "/emoji/hype.png", inSlack: album.emojis.find(({ id }) => id === `hype:${person}`)?.inSlack ?? false },
    slackProfile: `https://example.slack.com/team/U_${person.toUpperCase().replaceAll("-", "_")}`,
  };
}

export function fixedPeople(album: Album): PersonRead {
  return (asking, person) => (asking && person !== null ? fixturePersonOf(album, person) : undefined);
}

export function fixturePutInOf(item: string): PutInAnswer {
  const placed = albumFixtures.trayed.tray.find((waiting) => waiting.item === item);
  return placed === undefined ? { kind: "refused" } : { kind: "placed", item: placed };
}

export function fixturePutAllIn(): PutAllInAnswer {
  const { tray } = albumFixtures.trayed;
  return { kind: "placed", items: [...tray.filter(({ kind }) => kind === "hoggie"), ...tray.filter(({ kind }) => kind === "sticker")], more: false };
}
