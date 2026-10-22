import type { QueryCtx } from "../_generated/server";
import { allTimeBoardsIn, type AllTimeBoards } from "../album/boards";
import { emojiArtPictureOf } from "../album/emojiCatalogue";
import { teamEmojiOf } from "../album/earnedEmojis";
import { albumHoggiesOf, rarestFindsIn, type AlbumHoggie, type AlbumHoggies } from "../album/hoggies";
import { peopleHeldBy } from "../album/stickers";
import { storedHoldersIn, type StoredHolder } from "../companyProfiles/storedFaces";
import type { TeamCrestArt } from "../companyProfiles/teams";
import type { PersonTeam } from "../album/personPage";
import type { Rarity } from "../hoggies/catalogue";
import { hoggiesShownTo } from "../hoggies/flag";
import { hoggieSharePictureOf } from "../items/shareArt";
import { standingOf } from "../progression/progression";
import { xpToReach } from "../progression/levels";
import type { MemberId } from "../workspace/directory";

export type CardHoggie = { hoggie: string; name: string; rarity: Rarity; picture: string };

export type BoardPlace = { rank: number; tied: boolean; thoughtful: number };

export type LevelWay = { level: number; xp: number; share: number };

export type CardTeam = { name: string; emoji: string | null; crest: string | null };

export type PersonStats = { person: MemberId; teams: CardTeam[]; way: LevelWay | null; place: BoardPlace | null; hoggies: { found: number; total: number } | null; rarest: CardHoggie[]; people: number; asOf: number };

export type TeamStats = { place: BoardPlace | null; saidThanks: number; rarest: CardHoggie[]; asOf: number };

type Found = Pick<AlbumHoggie, "hoggie" | "name" | "rarity" | "found" | "firstAt">;

type CompanyTeamRow = { team: string; people: number[] };

export type CardReads = {
  workspace: string;
  origin: string;
  boards: () => Promise<AllTimeBoards>;
  holders: () => Promise<Map<number, StoredHolder>>;
  hoggiesOf: (member: MemberId) => Promise<AlbumHoggies | null>;
};

const mostPictures = 9;

const mostCollectionsReadPerMessage = 20;

export function cardReadsOf(ctx: QueryCtx, workspace: string, origin: string): CardReads {
  let boards: Promise<AllTimeBoards> | undefined;
  let holders: Promise<Map<number, StoredHolder>> | undefined;
  const collections = new Map<MemberId, Promise<AlbumHoggies | null>>();
  const hoggiesOf = (member: MemberId) => {
    const read = collections.get(member);
    if (read !== undefined) return read;
    if (collections.size >= mostCollectionsReadPerMessage) return Promise.resolve(null);
    return collections.set(member, shownHoggiesOf(ctx, member)).get(member)!;
  };
  return { workspace, origin, boards: () => (boards ??= allTimeBoardsIn(ctx, workspace)), holders: () => (holders ??= storedHoldersIn(ctx, workspace)), hoggiesOf };
}

async function shownHoggiesOf(ctx: QueryCtx, member: MemberId): Promise<AlbumHoggies | null> {
  return (await hoggiesShownTo(ctx, member)) ? albumHoggiesOf(ctx, member) : null;
}

export async function personStatsOf(ctx: QueryCtx, { workspace, origin, boards, hoggiesOf }: CardReads, person: MemberId, level: number | null, teams: PersonTeam[]): Promise<PersonStats> {
  const hoggies = await hoggiesOf(person);
  return {
    person,
    teams: await cardTeamsOf(ctx, workspace, origin, teams),
    way: level === null ? null : await levelWayOf(ctx, person, level),
    place: placeOf((await boards()).people.find(({ member }) => member === person)),
    hoggies: hoggies === null ? null : { found: hoggies.found, total: hoggies.total },
    rarest: cardHoggiesOf(hoggies?.hoggies ?? [], origin),
    people: (await peopleHeldBy(ctx, person)).size,
    asOf: Date.now(),
  };
}

export async function teamStatsOf(reads: CardReads, team: CompanyTeamRow): Promise<TeamStats> {
  const { origin, boards } = reads;
  const { people, teams } = await boards();
  return {
    place: placeOf(teams.find((row) => row.team === team.team)),
    saidThanks: people.filter((giver) => giver.teams.includes(team.team)).length,
    rarest: cardHoggiesOf(await foundByTheTeam(reads, team), origin),
    asOf: Date.now(),
  };
}

async function cardTeamsOf(ctx: QueryCtx, workspace: string, origin: string, teams: PersonTeam[]): Promise<CardTeam[]> {
  const shown: CardTeam[] = [];
  for (const { team, name, art } of teams) {
    const emoji = await teamEmojiOf(ctx, workspace, { team, art });
    shown.push({ name, emoji: emoji?.inSlack ? emoji.name : null, crest: crestPictureOf(origin, art) });
  }
  return shown;
}

function crestPictureOf(origin: string, art: TeamCrestArt): string | null {
  if (art === null) return null;
  return art.kind === "crest" ? `${origin}${emojiArtPictureOf("team", art.slug)}` : art.url;
}

async function levelWayOf(ctx: QueryCtx, person: MemberId, level: number): Promise<LevelWay> {
  const { xp } = await standingOf(ctx, person);
  const [startsAt, nextAt] = [xpToReach(level), xpToReach(level + 1)];
  return { level, xp, share: Math.min(1, Math.max(0, (xp - startsAt) / (nextAt - startsAt))) };
}

function placeOf(row: { rank: number | null; tied: boolean; thoughtful: number } | undefined): BoardPlace | null {
  return row === undefined || row.rank === null ? null : { rank: row.rank, tied: row.tied, thoughtful: row.thoughtful };
}

async function foundByTheTeam({ holders, hoggiesOf }: CardReads, team: CompanyTeamRow): Promise<Found[]> {
  const matched = await holders();
  const members = team.people.flatMap((profile) => matched.get(profile)?.member ?? []);
  const found = await Promise.all(members.map(async (member) => ((await hoggiesOf(member))?.hoggies ?? []).filter((hoggie) => hoggie.found)));
  return [...new Map(found.flat().map((hoggie) => [hoggie.hoggie, hoggie])).values()];
}

function cardHoggiesOf(hoggies: Found[], origin: string): CardHoggie[] {
  return rarestFindsIn(hoggies, mostPictures).map(({ hoggie, name, rarity }) => ({ hoggie, name, rarity, picture: `${origin}${hoggieSharePictureOf(hoggie)}` }));
}
