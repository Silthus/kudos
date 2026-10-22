import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { thoughtfulBoardsOf } from "../album/boards";
import { emojiStackOf, type EmojiStack } from "../album/earnedEmojis";
import { albumShownTo, personPageDShownTo } from "../album/flag";
import { albumHoggiesOf, rarestFindsIn, type AlbumHoggie } from "../album/hoggies";
import { tiersEarnedBy } from "../album/milestones";
import { personTeamsOf, type PersonTeam } from "../album/personPage";
import { newestStickersOf } from "../album/profile";
import type { MilestoneId, MilestoneTier } from "../album/records";
import { peopleHeldBy } from "../album/stickers";
import { anEmptyWeek, weekAt, weekRowOf, weekTallyIn } from "../album/tallies";
import { hoggiesShownTo } from "../hoggies/flag";
import { xpToReach } from "../progression/levels";
import { progressionHomeOf } from "../progression/progression";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { isAPersonOf, type MemberId } from "../workspace/directory";
import { faceIn, publicKudosOfTheWeekShown, type AlbumIssue, type AlbumPersonFace } from "./albumPages";
import { followTheClock } from "./clock";
import { memberQuery, type VerifiedMember } from "./memberQuery";

export type CardLevel = { level: number; xp: number; startsAt: number; nextAt: number };

export type CardPlace = { rank: number; tied: boolean; thoughtful: number };

export type CardHoggie = Pick<AlbumHoggie, "hoggie" | "name" | "rarity"> & { firstAt: number };

export type CardMedal = { milestone: MilestoneId; tier: MilestoneTier };

export type PlayerCard = AlbumPersonFace & {
  team: PersonTeam | null;
  level: CardLevel | null;
  place: CardPlace | null;
  people: { held: number; newest: AlbumPersonFace[] };
  hoggies: { found: number; total: number; rarest: CardHoggie | null } | null;
  medals: { count: number; best: CardMedal[] };
};

export type CardWeek = { days: number[]; thanked: number; thankedBy: number; packsOpened: number; hugs: number; kudosOfWeek: AlbumIssue["kudosOfWeek"] };

export type PlayerCardAnswer = { kind: "card"; card: PlayerCard; week?: CardWeek };

export type PlayerCardRead = PlayerCardAnswer | { kind: "off" } | { kind: "no-person" };

export type CardEmojisRead = ({ kind: "emojis" } & EmojiStack) | { kind: "off" } | { kind: "no-person" };

const newestPeopleOnTheCard = 3;

const emojisOnTheCard = 4;

const medalsOnTheCard = 3;

const peopleSearchedForTheNewest = 500;

const metalsBestFirst: readonly MilestoneTier[] = ["diamond", "gold", "silver", "bronze"];

export const getPlayerCard = memberQuery({
  args: { person: v.string() },
  handler: async (ctx, me, { person }): Promise<PlayerCardRead> => {
    if (!(await cardsShownTo(ctx, me))) return { kind: "off" };
    const member = await personIn(ctx, me, person);
    if (member === null) return { kind: "no-person" };
    await followTheClock(ctx);
    const card = await playerCardOf(ctx, me.workspace, member);
    return member === me.member ? { kind: "card", card } : { kind: "card", card, week: await cardWeekOf(ctx, me.workspace, member) };
  },
});

export const getPlayerCardEmojis = memberQuery({
  args: { person: v.string() },
  handler: async (ctx, me, { person }): Promise<CardEmojisRead> => {
    if (!(await cardsShownTo(ctx, me))) return { kind: "off" };
    const member = await personIn(ctx, me, person);
    if (member === null) return { kind: "no-person" };
    return { kind: "emojis", ...(await emojiStackOf(ctx, me.workspace, member, emojisOnTheCard)) };
  },
});

export async function playerCardOf(ctx: QueryCtx, workspace: string, person: MemberId): Promise<PlayerCard> {
  const [team = null] = await personTeamsOf(ctx, workspace, person);
  return {
    ...(await faceIn(ctx, workspace, person)),
    team,
    level: (await xpLevelsShownIn(ctx, workspace)) ? await levelOf(ctx, person) : null,
    place: await placeThisWeekOf(ctx, workspace, person),
    people: await peopleOf(ctx, workspace, person),
    hoggies: await hoggiesOf(ctx, person),
    medals: await medalsOf(ctx, person),
  };
}

async function cardsShownTo(ctx: QueryCtx, me: VerifiedMember) {
  return (await albumShownTo(ctx, me.member)) && (await personPageDShownTo(ctx, me.member));
}

async function personIn(ctx: QueryCtx, me: VerifiedMember, person: string): Promise<MemberId | null> {
  const member = ctx.db.normalizeId("members", person);
  return member !== null && (await isAPersonOf(ctx, me.workspace, member)) ? member : null;
}

async function levelOf(ctx: QueryCtx, person: MemberId): Promise<CardLevel> {
  const { level, xp } = await progressionHomeOf(ctx, person);
  return { level, xp, startsAt: xpToReach(level), nextAt: xpToReach(level + 1) };
}

async function placeThisWeekOf(ctx: QueryCtx, workspace: string, person: MemberId): Promise<CardPlace | null> {
  const { pinned, onTheBoards } = await thoughtfulBoardsOf(ctx, { workspace, member: person }, { whoGave: null, period: "week" });
  const row = pinned.me;
  return !onTheBoards || row === null || row.rank === null ? null : { rank: row.rank, tied: row.tied, thoughtful: row.thoughtful };
}

async function peopleOf(ctx: QueryCtx, workspace: string, person: MemberId): Promise<PlayerCard["people"]> {
  const newest = (await newestStickersOf(ctx, person, peopleSearchedForTheNewest)).slice(0, newestPeopleOnTheCard);
  return { held: (await peopleHeldBy(ctx, person)).size, newest: await Promise.all(newest.map(({ person: held }) => faceIn(ctx, workspace, held))) };
}

async function hoggiesOf(ctx: QueryCtx, person: MemberId): Promise<PlayerCard["hoggies"]> {
  if (!(await hoggiesShownTo(ctx, person))) return null;
  const { hoggies, found, total } = await albumHoggiesOf(ctx, person);
  const [rarest = null] = rarestFindsIn(hoggies, 1).map(({ hoggie, name, rarity, firstAt }) => ({ hoggie, name, rarity, firstAt }));
  return { found, total, rarest };
}

async function medalsOf(ctx: QueryCtx, person: MemberId): Promise<PlayerCard["medals"]> {
  const earned = await tiersEarnedBy(ctx, person);
  const highest = [...new Map(earned.map(({ milestone, tier }) => [milestone, tier])).entries()].map(([milestone, tier]) => ({ milestone, tier }));
  return { count: earned.length, best: highest.toSorted((one, other) => metalsBestFirst.indexOf(one.tier) - metalsBestFirst.indexOf(other.tier)).slice(0, medalsOnTheCard) };
}

async function cardWeekOf(ctx: QueryCtx, workspace: string, person: MemberId): Promise<CardWeek> {
  const row = await weekRowOf(ctx, person, await weekAt(ctx, person, Date.now()));
  const { days, thanked, thankedBy, packsOpened = 0, hugsGiven, hugsReceived, kudosOfWeek } = row === null ? anEmptyWeek() : weekTallyIn(row);
  return {
    days,
    thanked: thanked.people.length + thanked.more,
    thankedBy: thankedBy.people.length + thankedBy.more,
    packsOpened,
    hugs: hugsGiven + hugsReceived,
    kudosOfWeek: kudosOfWeek === null ? null : await publicKudosOfTheWeekShown(ctx, workspace, kudosOfWeek),
  };
}
