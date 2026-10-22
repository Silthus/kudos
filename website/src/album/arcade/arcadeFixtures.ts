// PROTOTYPE: the arcade fixture. A made-up cast (the launch video's) and one made-up team, Burrow Builders.
import type { Id } from "../../../../convex/_generated/dataModel";
import type { Drop } from "../../../../convex/hoggies/drops";
import type { BoardItem, TurnAnswer } from "../../../../convex/website/album";
import type { XpMoment } from "../../../../convex/website/xpMoment";
import type { AppReads } from "../../App";
import { hoggiePictureOf } from "../../crates/Hoggie";
import { fixtureActions, type ShellActions } from "../../shell";
import { albumFixtures, fixedAlbum } from "../albumFixtures";
import type { Album, AlbumEmoji, AlbumLevelUp, AlbumPerson, AlbumProfile, AlbumTeam, BoardPerson, BoardTeam, PersonPage, ThoughtfulBoards } from "../answer";
import { hoggiesFixtures } from "../hoggiesFixtures";
import { fixtureWeeks } from "../weekFixtures";

const day = 86_400_000;

const now = Date.parse("2026-10-22T10:00:00Z");

type CastMember = { person: string; name: string; hoggie: string; colour: string };

const cast = {
  robin: { person: "robin-ash", name: "Robin Ash", hoggie: "hipster", colour: "#ffd400" },
  juno: { person: "juno-vale", name: "Juno Vale", hoggie: "star", colour: "#ff5fa2" },
  milo: { person: "milo-brandt", name: "Milo Brandt", hoggie: "chef", colour: "#ff8a00" },
  sasha: { person: "sasha-lind", name: "Sasha Lind", hoggie: "scientist", colour: "#21c8f6" },
  niko: { person: "niko-pratt", name: "Niko Pratt", hoggie: "surfer", colour: "#2fd06b" },
  kit: { person: "kit-moreau", name: "Kit Moreau", hoggie: "explorer", colour: "#a78bfa" },
  lena: { person: "lena-ortiz", name: "Lena Ortiz", hoggie: "megaphone", colour: "#ff5a1f" },
} satisfies Record<string, CastMember>;

const teammates = [cast.juno, cast.milo, cast.sasha, cast.niko, cast.kit, cast.lena];

function faceOf({ name, hoggie, colour }: CastMember) {
  const initials = name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("");
  return { kind: "company-profile" as const, image: hoggiePictureOf({ kind: "hoggie", slug: hoggie }) ?? "", colour, initials };
}

const thankedOf = (member: CastMember) => ({ name: member.name, face: faceOf(member) });

const burrow = "burrow-builders";

const crest = { kind: "image" as const, url: "/prototype/burrow-builders-crest.svg" };

const team: AlbumTeam = { team: burrow, name: "Burrow Builders", art: crest, mine: true, people: teammates.map(({ person }) => person), unmatched: [], held: teammates.length, total: teammates.length, state: "ready", unlockedAt: null };

const people: AlbumPerson[] = teammates.map((member, index) => ({ person: member.person, name: member.name, face: faceOf(member), teams: [burrow], held: true, packedThisWeek: index < 2 }));

const milestoneEmojis = albumFixtures.midway.emojis.filter(({ kind }) => kind === "milestone");

const emojis: AlbumEmoji[] = [
  { id: `team:${burrow}`, kind: "team", name: "team-burrow-builders", from: "Burrow Builders", picture: crest.url, earned: false, earnedAt: null, seen: false, inSlack: false, progress: { have: 6, need: 6 } },
  { id: "hype:milo-brandt", kind: "hype", name: "milo-brandt-hype", from: "Milo Brandt", picture: hoggiePictureOf({ kind: "hoggie", slug: "chef" }) ?? "", earned: true, earnedAt: now - 2 * day, seen: true, inSlack: true, progress: null },
  { id: "level:4", kind: "level", name: "level-4", from: "Level 4", picture: "/emoji/level-5.png", earned: true, earnedAt: now - day, seen: true, inSlack: false, progress: null },
  ...milestoneEmojis,
];

const levelFour = { level: 4, xp: 640, startsAt: 600, nextAt: 1000 };

const boardItem = (index: number, member: CastMember): BoardItem => ({ item: `arcade-item-${index + 1}` as Id<"items">, earnedAt: now - (index + 1) * 3_600_000, reason: { kind: "thanks", thanked: thankedOf(member) } });

const thankedOnTheBoard = [cast.juno, cast.milo, cast.sasha, cast.niko, cast.juno];

const board = { items: thankedOnTheBoard.map((member, index) => boardItem(index, member)), more: false };

const album: Album = {
  ...albumFixtures.midway,
  me: { name: cast.robin.name, face: faceOf(cast.robin), person: cast.robin.person, team: burrow },
  level: levelFour,
  teams: [team],
  people,
  packs: [],
  tray: [],
  emojis,
  board,
  shares: board.items.slice(-2).map(({ item }) => item),
  shareableUrls: true,
};

const drop = (hoggie: string, name: string, rarity: Drop["rarity"]): Drop => ({ hoggie, name, rarity, art: { kind: "hoggie", slug: hoggie }, copy: 1, isNew: true });

const reveals: Drop[] = [drop("coffee-cup", "Coffee Cup", "common"), drop("dj", "Dj", "rare"), drop("level-up", "Level Up", "epic"), drop("wizard", "Wizard", "legendary")];

const xpOfRarity: Record<Drop["rarity"], number> = { common: 10, uncommon: 15, rare: 25, epic: 50, legendary: 200 };

const nothingUnlocked = { teamStickers: [], hype: null, milestones: [] };

function arcadeTurnOf(item: string): TurnAnswer {
  const index = board.items.findIndex((waiting) => waiting.item === item);
  if (index === -1) return { kind: "refused" };
  const reveal = reveals[index];
  const xp = reveal === undefined ? 15 : xpOfRarity[reveal.rarity];
  const applied = { xp, coins: 0, from: { ...levelFour, coins: 0, skillPoints: 0 }, to: { ...levelFour, xp: levelFour.xp + xp, coins: 0, skillPoints: 0 } };
  if (reveal !== undefined) return { kind: "turned", face: { kind: "hoggie", drop: reveal }, applied, page: { kind: "hoggies" }, unlocked: nothingUnlocked, again: false };
  return {
    kind: "turned",
    face: { kind: "sticker", person: cast.juno.person as Id<"members">, isNew: true, thanked: thankedOf(cast.juno) },
    applied,
    page: { kind: "team", team: burrow },
    unlocked: { ...nothingUnlocked, hype: { name: "juno-vale-hype", picture: hoggiePictureOf({ kind: "hoggie", slug: "star" }) ?? "", inSlack: false, from: cast.juno.name } },
    again: false,
  };
}

const giver = (member: CastMember, thoughtful: number, rank: number, you = false): BoardPerson => ({ person: member.person, name: member.name, face: faceOf(member), teams: [burrow], thoughtful, you, rank, tied: false });

const robinOnTop = giver(cast.robin, 9, 1, true);

const boardTeam: BoardTeam = { team: burrow, name: "Burrow Builders", art: crest, thoughtful: 31, mine: true, rank: 1, tied: false };

const boards: ThoughtfulBoards = {
  kind: "boards",
  people: [robinOnTop, giver(cast.juno, 7, 2), giver(cast.sasha, 5, 3), giver(cast.milo, 4, 4), giver(cast.niko, 3, 5), giver(cast.kit, 2, 6), giver(cast.lena, 1, 7)],
  teams: [boardTeam],
  pinned: { me: robinOnTop, teams: [boardTeam] },
  onTheBoards: true,
};

const kindWords = "You nailed the pairing session today, that bug didn't stand a chance. Thank you for staying with it until the tests went green.";

const profile: AlbumProfile = {
  kind: "profile",
  note: { giver: { person: cast.juno.person, name: cast.juno.name, face: faceOf(cast.juno) }, message: { kind: "text", segments: [{ kind: "text", text: kindWords }], edited: false }, permalink: "https://example.slack.com/archives/C1/p2", at: now - day },
  newest: [cast.juno, cast.milo, cast.sasha].map((member, index) => ({ person: member.person, name: member.name, face: faceOf(member), at: now - (index + 1) * day })),
};

const bestWords = "Thanks for pairing on the flaky deploy. Say why, and the whole team learns what good looks like.";

function personOf(person: string): PersonPage | { kind: "no-person" } {
  const member = teammates.find((someone) => someone.person === person);
  if (member === undefined) return { kind: "no-person" };
  const index = teammates.indexOf(member);
  return {
    kind: "person",
    person,
    name: member.name,
    face: faceOf(member),
    held: true,
    firstThankedAt: now - (12 + index) * day,
    kudosGiven: 3 + index,
    kudosReceived: 2 + (index % 3),
    hugsGiven: index % 5,
    hugsReceived: (index + 2) % 4,
    best: { message: { kind: "text", segments: [{ kind: "text", text: bestWords }], edited: false }, permalink: "https://example.slack.com/archives/C1/p1", at: now - 2 * day },
    teams: [{ team: burrow, name: "Burrow Builders", art: crest }],
    hype: { earned: index < 2, name: `${person}-hype`, picture: hoggiePictureOf({ kind: "hoggie", slug: member.hoggie }) ?? "", inSlack: index === 1 },
    slackProfile: `https://example.slack.com/team/U_${person.toUpperCase().replaceAll("-", "_")}`,
  };
}

const levelUp: AlbumLevelUp = {
  kind: "levelUp",
  level: 4,
  at: now - day,
  hoggies: [
    { hoggie: "climber", name: "Climber", rarity: "uncommon", isNew: true },
    { hoggie: "pinata", name: "Piñata", rarity: "rare", isNew: true },
    { hoggie: "robot", name: "Robot", rarity: "rare", isNew: true },
  ],
  emojis: [],
};

const words = (text: string) => ({ kind: "text" as const, segments: [{ kind: "text" as const, text }], edited: false });

const lastVisit = now - 3 * 3_600_000;

const arrival: XpMoment = {
  kind: "moment",
  since: lastVisit,
  until: now,
  excerpts: [
    { entry: { kind: "kudosGiven", key: "a1", at: lastVisit + 600_000, recipients: [thankedOf(cast.juno)], kudos: 1, channel: { visibility: "public" }, saidWhy: true, permalink: null, message: words("you nailed the pairing session today"), earned: { xp: 15, questsDone: [], bonuses: [] } }, xp: 15 },
    { entry: { kind: "kudosReceived", key: "a2", at: lastVisit + 1_200_000, giver: thankedOf(cast.sasha), channel: { visibility: "public" }, saidWhy: true, permalink: null, message: words("for the clearest review notes") }, xp: 10 },
    { entry: { kind: "hugReceived", key: "a3", at: lastVisit + 1_800_000, givers: [thankedOf(cast.milo)], emoji: "hugging_face", hugs: 3, xp: 3, on: "C1/1.1", permalink: null, kudos: null }, xp: 3 },
    { entry: { kind: "levelUp", at: lastVisit + 2_400_000, level: 4 }, xp: 0 },
  ],
  fold: null,
  moments: 4,
  xp: 80,
  climb: { from: { level: 3, xp: 560, startsAt: 300, nextAt: 600 }, to: levelFour },
  waiting: board.items.length,
  thoughtfulGivers: 3,
  timeZone: "UTC",
};

export function arcadeReadsOf(base: AppReads, arrives: boolean): AppReads {
  return {
    ...base,
    useAlbum: fixedAlbum(album),
    useThoughtfulBoards: (asking) => (asking ? boards : undefined),
    useAlbumPerson: (asking, person) => (asking && person !== null ? personOf(person) : undefined),
    useAlbumWeek: fixtureWeeks(),
    useAlbumProfile: (asking) => (asking ? profile : undefined),
    useAlbumHoggies: (asking) => (asking ? hoggiesFixtures.midway : undefined),
    useLevelUp: (level) => (level === null ? undefined : levelUp),
    useXpMoment: (asking) => (asking ? (arrives ? arrival : { kind: "none", lastVisit }) : undefined),
  };
}

export const arcadeActions: ShellActions = {
  ...fixtureActions,
  turnItem: async (item) => arcadeTurnOf(item),
  unlockTeamSticker: async (unlocked) => (unlocked === burrow ? { kind: "unlocked", sticker: { team: burrow, name: team.name, art: crest, emoji: "team-burrow-builders", at: now } } : { kind: "refused" }),
};
