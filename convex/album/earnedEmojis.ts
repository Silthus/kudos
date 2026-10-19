import type { MutationCtx, QueryCtx } from "../_generated/server";
import { storedCompanyFaceOf } from "../companyProfiles/storedFaces";
import { companyTeamsOf, type TeamCrestArt } from "../companyProfiles/teams";
import { xpToReach } from "../progression/levels";
import { progressionHomeOf } from "../progression/progression";
import { levelFirstReachedAt } from "../unlocks/levelUps";
import { customEmojiImageOf } from "../workspace/customEmoji";
import { nameAndPictureOf, personFactsOf, type MemberId } from "../workspace/directory";
import { emojiArtPictureOf, emojiLevels, hypeEmblemPicture, milestoneTierArtOf, milestoneTierEmojiOf, milestoneTierEmojis, teamEmblemPicture } from "./emojiCatalogue";
import { emojiNameOf, type EarnedEmojiId } from "./emojiNames";
import type { MilestoneAnswer } from "./milestones";
import { isFirstPackFor, packsEarnedBetween, type Instants } from "./packs";
import type { MilestoneId, MilestoneTier, TeamSticker } from "./records";
import { randomEmojisShownTo } from "./flag";
import { holdsRandomEmoji, randomEmojisHeldBy, type RandomEmojiId } from "./randomEmojis";
import type { PageOwner, TeamPage } from "./teamPages";

export type EarnedEmojiKind = "team" | "milestone" | "level" | "hype" | "random";

export type EmojiProgress = { have: number; need: number };

export type EarnedEmoji = { id: EarnedEmojiId | RandomEmojiId; kind: EarnedEmojiKind; name: string; from: string; picture: string; earned: boolean; earnedAt: number | null; seen: boolean; inSlack: boolean; progress: EmojiProgress | null };

export type SharedEmoji = Pick<EarnedEmoji, "id" | "kind" | "name" | "from" | "picture" | "inSlack">;

export type EmojiCauses = { pages: TeamPage[]; milestones: MilestoneAnswer[]; level: { level: number; xp: number } };

export type EarnedEmojis = { emojis: EarnedEmoji[]; more: boolean };

export type ShownEmoji = Pick<EarnedEmoji, "name" | "picture" | "inSlack">;

export type HypeEmoji = ShownEmoji;

export const mostHypeEmojisShown = 200;

export const mostPeoplePackedRead = 500;

export const mostEmojisSeenAtOnce = 500;

export const mostEmojiCausesRead = 500;

const unnamedPerson = "A teammate";

type Cause = { id: EarnedEmojiId; kind: EarnedEmojiKind; from: string; picture: string; earned: boolean; earnedAt: number | null; progress: EmojiProgress };

type PackedPerson = { person: MemberId; firstPackAt: number };

type EarnedCause = Pick<Cause, "id" | "picture">;

export async function earnedEmojisOf(ctx: QueryCtx, owner: PageOwner, causes: EmojiCauses): Promise<EarnedEmojis> {
  const seen = await seenBy(ctx, owner.member);
  const hype = await hypeCausesOf(ctx, owner, seen);
  const emojis: EarnedEmoji[] = [];
  for (const cause of [...teamCausesOf(causes.pages), ...hype.causes, ...milestoneCausesOf(causes.milestones), ...levelCausesOf(causes.level)]) {
    const name = await emojiNameOf(ctx, owner.workspace, cause.id);
    if (name !== null) emojis.push(await emojiOf(ctx, owner.workspace, cause, name, seen));
  }
  for (const { id, name, image, from, at } of await randomEmojisHeldBy(ctx, owner.workspace, owner.member)) emojis.push({ id, kind: "random", name, from: await nameOrUnnamed(ctx, from), picture: image, earned: true, earnedAt: at, seen: seen.has(id), inSlack: true, progress: null });
  return { emojis, more: hype.more };
}

export async function sharedEmojisOf(ctx: QueryCtx, member: MemberId, { emojis }: EarnedEmojis): Promise<SharedEmoji[] | null> {
  if (!(await personFactsOf(ctx, member))?.admin) return null;
  const companyTeams = new Set((await companyTeamsOf(ctx)).map(({ team }) => `team:${team}`));
  return emojis.filter(({ id, kind }) => (kind === "team" ? companyTeams.has(id) : kind === "milestone" || kind === "level")).map(({ id, kind, name, from, picture, inSlack }) => ({ id, kind, name, from, picture, inSlack }));
}

export async function hypeEmojiOf(ctx: QueryCtx, workspace: string, person: MemberId): Promise<HypeEmoji | null> {
  const name = await emojiNameOf(ctx, workspace, `hype:${person}`);
  if (name === null) return null;
  const slackPicture = await customEmojiImageOf(ctx, workspace, name);
  return { name, picture: slackPicture ?? (await hypeFaceOf(ctx, workspace, person)).picture, inSlack: slackPicture !== undefined };
}

export async function emojisEarnedBetween(ctx: QueryCtx, { workspace, member }: PageOwner, instants: Instants): Promise<ShownEmoji[]> {
  const earned: ShownEmoji[] = [];
  for (const { id, picture } of await causesEarnedBetween(ctx, { workspace, member }, instants)) {
    const name = await emojiNameOf(ctx, workspace, id);
    if (name !== null) earned.push(await shownEmojiOf(ctx, workspace, picture, name));
  }
  const dropped = (await randomEmojisHeldBy(ctx, workspace, member)).filter(({ at }) => isWithin(instants, at));
  return [...earned, ...dropped.map(({ name, image }) => ({ name, picture: image, inSlack: true }))];
}

export async function teamEmojiOf(ctx: QueryCtx, workspace: string, { team, art }: Pick<TeamSticker, "team" | "art">): Promise<ShownEmoji | null> {
  const name = await emojiNameOf(ctx, workspace, `team:${team}`);
  return name === null ? null : shownEmojiOf(ctx, workspace, teamPictureOf(art), name);
}

export async function markEmojisSeenBy(ctx: MutationCtx, member: MemberId, ids: string[], at: number): Promise<string[] | null> {
  if (ids.length > mostEmojisSeenAtOnce) return null;
  const seen = await seenBy(ctx, member);
  const marked: string[] = [];
  for (const id of new Set(ids)) {
    if (!(await isEarnedBy(ctx, member, id))) continue;
    if (!seen.has(id)) await ctx.db.insert("seenEmojis", { member, emoji: id, at });
    marked.push(id);
  }
  return marked;
}

async function emojiOf(ctx: QueryCtx, workspace: string, { id, kind, from, picture, earned, earnedAt, progress }: Cause, name: string, seen: Set<string>): Promise<EarnedEmoji> {
  return { id, kind, from, ...(await shownEmojiOf(ctx, workspace, picture, name)), earned, earnedAt, seen: earned && seen.has(id), progress: earned ? null : progress };
}

async function shownEmojiOf(ctx: QueryCtx, workspace: string, picture: string, name: string): Promise<ShownEmoji> {
  const slackPicture = await customEmojiImageOf(ctx, workspace, name);
  return { name, picture: slackPicture ?? picture, inSlack: slackPicture !== undefined };
}

async function causesEarnedBetween(ctx: QueryCtx, owner: PageOwner, instants: Instants): Promise<EarnedCause[]> {
  return [...(await teamsUnlockedBetween(ctx, owner.member, instants)), ...(await hypesEarnedBetween(ctx, owner, instants)), ...(await tiersReachedBetween(ctx, owner.member, instants)), ...(await levelsReachedBetween(ctx, owner.member, instants))];
}

async function teamsUnlockedBetween(ctx: QueryCtx, member: MemberId, instants: Instants): Promise<EarnedCause[]> {
  const stickers = await ctx.db
    .query("teamStickers")
    .withIndex("by_member_team", (q) => q.eq("member", member))
    .take(mostEmojiCausesRead);
  return stickers.filter(({ at }) => isWithin(instants, at)).map(({ team, art }) => ({ id: `team:${team}`, picture: teamPictureOf(art) }));
}

async function hypesEarnedBetween(ctx: QueryCtx, { workspace, member }: PageOwner, instants: Instants): Promise<EarnedCause[]> {
  const causes: EarnedCause[] = [];
  for (const pack of await packsEarnedBetween(ctx, member, instants, mostPeoplePackedRead)) {
    if (await isFirstPackFor(ctx, pack)) causes.push({ id: `hype:${pack.recipient}`, picture: (await hypeFaceOf(ctx, workspace, pack.recipient)).picture });
  }
  return causes;
}

async function tiersReachedBetween(ctx: QueryCtx, member: MemberId, instants: Instants): Promise<EarnedCause[]> {
  const tiers = await ctx.db
    .query("milestoneTiers")
    .withIndex("by_member_milestone_tier", (q) => q.eq("member", member))
    .take(mostEmojiCausesRead);
  const reached = new Set(tiers.filter(({ at }) => isWithin(instants, at)).map(({ milestone, tier }) => `${milestone}:${tier}`));
  return milestoneTierEmojis
    .filter(({ milestone, tier }) => reached.has(`${milestone}:${tier}`))
    .map(({ milestone, tier }) => ({ id: `milestone:${milestone}:${tier}`, picture: emojiArtPictureOf("milestone", milestoneTierArtOf(milestone, tier)) }));
}

async function levelsReachedBetween(ctx: QueryCtx, member: MemberId, instants: Instants): Promise<EarnedCause[]> {
  const causes: EarnedCause[] = [];
  for (const level of emojiLevels) {
    const at = await levelFirstReachedAt(ctx, member, level);
    if (at !== null && isWithin(instants, at)) causes.push({ id: `level:${level}`, picture: emojiArtPictureOf("level", level) });
  }
  return causes;
}

function isWithin({ from, to }: Instants, at: number) {
  return at >= from && at < to;
}

function teamCausesOf(pages: TeamPage[]): Cause[] {
  return pages.map(({ team, name, art, state, held, total, unlockedAt }) => ({ id: `team:${team}`, kind: "team", from: name, picture: teamPictureOf(art), earned: state === "unlocked", earnedAt: unlockedAt, progress: { have: held, need: total } }));
}

export function teamPictureOf(art: TeamCrestArt): string {
  if (art === null) return teamEmblemPicture;
  return art.kind === "crest" ? emojiArtPictureOf("team", art.slug) : art.url;
}

function milestoneCausesOf(milestones: MilestoneAnswer[]): Cause[] {
  return milestones.flatMap(({ id, count, tiers }) =>
    tiers.map(({ tier, at, name, earnedAt }) => ({ id: `milestone:${id}:${tier}` as const, kind: "milestone" as const, from: name, picture: emojiArtPictureOf("milestone", milestoneTierArtOf(id, tier)), earned: earnedAt !== null, earnedAt, progress: { have: count, need: at } })),
  );
}

function levelCausesOf({ level, xp }: EmojiCauses["level"]): Cause[] {
  return emojiLevels.map((reward) => ({ id: `level:${reward}`, kind: "level", from: `Level ${reward}`, picture: emojiArtPictureOf("level", reward), earned: level >= reward, earnedAt: null, progress: { have: xp, need: xpToReach(reward) } }));
}

async function hypeCausesOf(ctx: QueryCtx, { workspace, member }: PageOwner, seen: Set<string>): Promise<{ causes: Cause[]; more: boolean }> {
  const people = unseenFirst(await peoplePackedBy(ctx, member, mostPeoplePackedRead), seen);
  const causes: Cause[] = [];
  for (const { person, firstPackAt } of people.slice(0, mostHypeEmojisShown)) {
    const { name, picture } = await hypeFaceOf(ctx, workspace, person);
    causes.push({ id: `hype:${person}`, kind: "hype", from: name, picture, earned: true, earnedAt: firstPackAt, progress: { have: 1, need: 1 } });
  }
  return { causes, more: people.length > mostHypeEmojisShown };
}

function unseenFirst(people: PackedPerson[], seen: Set<string>): PackedPerson[] {
  const isSeen = ({ person }: PackedPerson) => seen.has(`hype:${person}`);
  return [...people.filter((packed) => !isSeen(packed)), ...people.filter(isSeen)];
}

async function peoplePackedBy(ctx: QueryCtx, giver: MemberId, most: number): Promise<PackedPerson[]> {
  const people: PackedPerson[] = [];
  for (let after: MemberId | null = null; people.length < most; ) {
    const last: MemberId | null = after;
    const pack = await ctx.db
      .query("thoughtfulPacks")
      .withIndex("by_giver_recipient_week", (q) => (last === null ? q.eq("giver", giver) : q.eq("giver", giver).gt("recipient", last)))
      .first();
    if (pack === null) break;
    people.push({ person: pack.recipient, firstPackAt: pack.at });
    after = pack.recipient;
  }
  return people;
}

async function nameOrUnnamed(ctx: QueryCtx, person: MemberId): Promise<string> {
  return (await nameAndPictureOf(ctx, person)).name ?? unnamedPerson;
}

export async function hypeFaceOf(ctx: QueryCtx, workspace: string, person: MemberId): Promise<{ name: string; picture: string }> {
  const companyFace = await storedCompanyFaceOf(ctx, workspace, person);
  const { name, picture } = await nameAndPictureOf(ctx, person);
  return { name: name ?? unnamedPerson, picture: companyFace?.image ?? picture ?? hypeEmblemPicture };
}

async function seenBy(ctx: QueryCtx, member: MemberId): Promise<Set<string>> {
  const seen = await ctx.db
    .query("seenEmojis")
    .withIndex("by_member_emoji", (q) => q.eq("member", member))
    .collect();
  return new Set(seen.map(({ emoji }) => emoji));
}

export async function isEarnedBy(ctx: QueryCtx, member: MemberId, id: string): Promise<boolean> {
  const [kind, cause] = splitOnce(id);
  if (kind === "team") return (await teamStickerOf(ctx, member, cause)) !== null;
  if (kind === "milestone") return holdsMilestoneTier(ctx, member, cause);
  if (kind === "level") return emojiLevels.some((reward) => String(reward) === cause) && (await progressionHomeOf(ctx, member)).level >= Number(cause);
  if (kind === "hype") return hasPackedFor(ctx, member, ctx.db.normalizeId("members", cause));
  if (kind === "random") return (await randomEmojisShownTo(ctx, member)) && (await holdsRandomEmoji(ctx, member, cause));
  return false;
}

function splitOnce(id: string): [string, string] {
  const colon = id.indexOf(":");
  return colon === -1 ? [id, ""] : [id.slice(0, colon), id.slice(colon + 1)];
}

function teamStickerOf(ctx: QueryCtx, member: MemberId, team: string) {
  return ctx.db
    .query("teamStickers")
    .withIndex("by_member_team", (q) => q.eq("member", member).eq("team", team))
    .first();
}

async function holdsMilestoneTier(ctx: QueryCtx, member: MemberId, cause: string): Promise<boolean> {
  const emoji = milestoneTierEmojiOf(cause);
  return emoji !== null && (await tierOf(ctx, member, emoji.milestone, emoji.tier)) !== null;
}

function tierOf(ctx: QueryCtx, member: MemberId, milestone: MilestoneId, tier: MilestoneTier) {
  return ctx.db
    .query("milestoneTiers")
    .withIndex("by_member_milestone_tier", (q) => q.eq("member", member).eq("milestone", milestone).eq("tier", tier))
    .first();
}

async function hasPackedFor(ctx: QueryCtx, giver: MemberId, recipient: MemberId | null): Promise<boolean> {
  if (recipient === null) return false;
  const pack = await ctx.db
    .query("thoughtfulPacks")
    .withIndex("by_giver_recipient_week", (q) => q.eq("giver", giver).eq("recipient", recipient))
    .first();
  return pack !== null;
}
