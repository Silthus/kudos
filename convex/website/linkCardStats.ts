import type { QueryCtx } from "../_generated/server";
import type { AllTimeBoards } from "../album/boards";
import { albumHoggiesOf, rarestFindsIn, type AlbumHoggie } from "../album/hoggies";
import { peopleHeldBy } from "../album/stickers";
import { storedHoldersIn } from "../companyProfiles/storedFaces";
import type { Rarity } from "../hoggies/catalogue";
import { hoggiesShownTo } from "../hoggies/flag";
import { hoggieSharePictureOf } from "../items/shareArt";
import { standingOf } from "../progression/progression";
import { xpToReach } from "../progression/levels";
import type { MemberId } from "../workspace/directory";

export type CardHoggie = { hoggie: string; name: string; rarity: Rarity; picture: string };

export type BoardPlace = { rank: number; tied: boolean; thoughtful: number };

export type LevelWay = { level: number; share: number };

export type PersonStats = { way: LevelWay | null; place: BoardPlace | null; hoggies: { found: number; total: number } | null; rarest: CardHoggie[]; people: number };

export type TeamStats = { place: BoardPlace | null; saidThanks: number; rarest: CardHoggie[] };

type Found = Pick<AlbumHoggie, "hoggie" | "name" | "rarity" | "found" | "firstAt">;

type CompanyTeamRow = { team: string; people: number[] };

export type CardReads = { workspace: string; origin: string; boards: () => Promise<AllTimeBoards> };

const mostPictures = 9;

export async function personStatsOf(ctx: QueryCtx, { origin, boards }: CardReads, person: MemberId, level: number | null): Promise<PersonStats> {
  const hoggies = (await hoggiesShownTo(ctx, person)) ? await albumHoggiesOf(ctx, person) : null;
  return {
    way: level === null ? null : await levelWayOf(ctx, person, level),
    place: placeOf((await boards()).people.find(({ member }) => member === person)),
    hoggies: hoggies === null ? null : { found: hoggies.found, total: hoggies.total },
    rarest: cardHoggiesOf(hoggies?.hoggies ?? [], origin),
    people: (await peopleHeldBy(ctx, person)).size,
  };
}

export async function teamStatsOf(ctx: QueryCtx, { workspace, origin, boards }: CardReads, team: CompanyTeamRow): Promise<TeamStats> {
  const { people, teams } = await boards();
  return {
    place: placeOf(teams.find((row) => row.team === team.team)),
    saidThanks: people.filter((giver) => giver.teams.includes(team.team)).length,
    rarest: cardHoggiesOf(await foundByTheTeam(ctx, workspace, team), origin),
  };
}

async function levelWayOf(ctx: QueryCtx, person: MemberId, level: number): Promise<LevelWay> {
  const { xp } = await standingOf(ctx, person);
  const [startsAt, nextAt] = [xpToReach(level), xpToReach(level + 1)];
  return { level, share: Math.min(1, Math.max(0, (xp - startsAt) / (nextAt - startsAt))) };
}

function placeOf(row: { rank: number | null; tied: boolean; thoughtful: number } | undefined): BoardPlace | null {
  return row === undefined || row.rank === null ? null : { rank: row.rank, tied: row.tied, thoughtful: row.thoughtful };
}

async function foundByTheTeam(ctx: QueryCtx, workspace: string, team: CompanyTeamRow): Promise<Found[]> {
  const holders = await storedHoldersIn(ctx, workspace);
  const members = team.people.flatMap((profile) => holders.get(profile)?.member ?? []);
  const found = await Promise.all(members.map(async (member) => ((await hoggiesShownTo(ctx, member)) ? (await albumHoggiesOf(ctx, member)).hoggies.filter((hoggie) => hoggie.found) : [])));
  return [...new Map(found.flat().map((hoggie) => [hoggie.hoggie, hoggie])).values()];
}

function cardHoggiesOf(hoggies: Found[], origin: string): CardHoggie[] {
  return rarestFindsIn(hoggies, mostPictures).map(({ hoggie, name, rarity }) => ({ hoggie, name, rarity, picture: `${origin}${hoggieSharePictureOf(hoggie)}` }));
}
