import type { MutationCtx, QueryCtx } from "../_generated/server";
import { storedCompanyFaceOf } from "../companyProfiles/storedFaces";
import { companyTeamsOf, type TeamCrestArt } from "../companyProfiles/teams";
import { xpToReach } from "../progression/levels";
import { progressionHomeOf } from "../progression/progression";
import { customEmojiImageOf } from "../workspace/customEmoji";
import { nameAndPictureOf, personFactsOf, type MemberId } from "../workspace/directory";
import { emojiArtPictureOf, emojiLevels, hypeEmblemPicture, milestoneTierArtOf, milestoneTierEmojiOf, teamEmblemPicture } from "./emojiCatalogue";
import { emojiNameOf, type EarnedEmojiId } from "./emojiNames";
import type { MilestoneAnswer } from "./milestones";
import type { MilestoneId, MilestoneTier } from "./records";
import { randomEmojisShownTo } from "./flag";
import { holdsRandomEmoji, randomEmojisHeldBy, type RandomEmojiId } from "./randomEmojis";
import type { PageOwner, TeamPage } from "./teamPages";

export type EarnedEmojiKind = "team" | "milestone" | "level" | "hype" | "random";

export type EmojiProgress = { have: number; need: number };

export type EarnedEmoji = { id: EarnedEmojiId | RandomEmojiId; kind: EarnedEmojiKind; name: string; picture: string; earned: boolean; seen: boolean; inSlack: boolean; progress: EmojiProgress | null };

export type SharedEmoji = Pick<EarnedEmoji, "id" | "kind" | "name" | "picture" | "inSlack">;

export type EmojiCauses = { pages: TeamPage[]; milestones: MilestoneAnswer[]; level: { level: number; xp: number } };

export type EarnedEmojis = { emojis: EarnedEmoji[]; more: boolean };

export type HypeEmoji = Pick<EarnedEmoji, "name" | "picture" | "inSlack">;

export const mostHypeEmojisShown = 200;

export const mostPeoplePackedRead = 500;

export const mostEmojisSeenAtOnce = 500;

type Cause = { id: EarnedEmojiId; kind: EarnedEmojiKind; picture: string; earned: boolean; progress: EmojiProgress };

export async function earnedEmojisOf(ctx: QueryCtx, owner: PageOwner, causes: EmojiCauses): Promise<EarnedEmojis> {
  const seen = await seenBy(ctx, owner.member);
  const hype = await hypeCausesOf(ctx, owner, seen);
  const emojis: EarnedEmoji[] = [];
  for (const cause of [...teamCausesOf(causes.pages), ...hype.causes, ...milestoneCausesOf(causes.milestones), ...levelCausesOf(causes.level)]) {
    const name = await emojiNameOf(ctx, owner.workspace, cause.id);
    if (name !== null) emojis.push(await emojiOf(ctx, owner.workspace, cause, name, seen));
  }
  for (const { id, name, image } of await randomEmojisHeldBy(ctx, owner.workspace, owner.member)) emojis.push({ id, kind: "random", name, picture: image, earned: true, seen: seen.has(id), inSlack: true, progress: null });
  return { emojis, more: hype.more };
}

export async function sharedEmojisOf(ctx: QueryCtx, member: MemberId, { emojis }: EarnedEmojis): Promise<SharedEmoji[] | null> {
  if (!(await personFactsOf(ctx, member))?.admin) return null;
  const companyTeams = new Set((await companyTeamsOf(ctx)).map(({ team }) => `team:${team}`));
  return emojis.filter(({ id, kind }) => (kind === "team" ? companyTeams.has(id) : kind === "milestone" || kind === "level")).map(({ id, kind, name, picture, inSlack }) => ({ id, kind, name, picture, inSlack }));
}

export async function hypeEmojiOf(ctx: QueryCtx, workspace: string, person: MemberId): Promise<HypeEmoji | null> {
  const name = await emojiNameOf(ctx, workspace, `hype:${person}`);
  if (name === null) return null;
  const slackPicture = await customEmojiImageOf(ctx, workspace, name);
  return { name, picture: slackPicture ?? (await hypePictureOf(ctx, workspace, person)), inSlack: slackPicture !== undefined };
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

async function emojiOf(ctx: QueryCtx, workspace: string, { id, kind, picture, earned, progress }: Cause, name: string, seen: Set<string>): Promise<EarnedEmoji> {
  const slackPicture = await customEmojiImageOf(ctx, workspace, name);
  return { id, kind, name, picture: slackPicture ?? picture, earned, seen: earned && seen.has(id), inSlack: slackPicture !== undefined, progress: earned ? null : progress };
}

function teamCausesOf(pages: TeamPage[]): Cause[] {
  return pages.map(({ team, art, state, held, total }) => ({ id: `team:${team}`, kind: "team", picture: teamPictureOf(art), earned: state === "unlocked", progress: { have: held, need: total } }));
}

function teamPictureOf(art: TeamCrestArt): string {
  if (art === null) return teamEmblemPicture;
  return art.kind === "crest" ? emojiArtPictureOf("team", art.slug) : art.url;
}

function milestoneCausesOf(milestones: MilestoneAnswer[]): Cause[] {
  return milestones.flatMap(({ id, count, tiers }) =>
    tiers.map(({ tier, at, earnedAt }) => ({ id: `milestone:${id}:${tier}` as const, kind: "milestone" as const, picture: emojiArtPictureOf("milestone", milestoneTierArtOf(id, tier)), earned: earnedAt !== null, progress: { have: count, need: at } })),
  );
}

function levelCausesOf({ level, xp }: EmojiCauses["level"]): Cause[] {
  return emojiLevels.map((reward) => ({ id: `level:${reward}`, kind: "level", picture: emojiArtPictureOf("level", reward), earned: level >= reward, progress: { have: xp, need: xpToReach(reward) } }));
}

async function hypeCausesOf(ctx: QueryCtx, { workspace, member }: PageOwner, seen: Set<string>): Promise<{ causes: Cause[]; more: boolean }> {
  const people = unseenFirst(await peoplePackedBy(ctx, member, mostPeoplePackedRead), seen);
  const causes: Cause[] = [];
  for (const person of people.slice(0, mostHypeEmojisShown)) causes.push({ id: `hype:${person}`, kind: "hype", picture: await hypePictureOf(ctx, workspace, person), earned: true, progress: { have: 1, need: 1 } });
  return { causes, more: people.length > mostHypeEmojisShown };
}

function unseenFirst(people: MemberId[], seen: Set<string>): MemberId[] {
  const isSeen = (person: MemberId) => seen.has(`hype:${person}`);
  return [...people.filter((person) => !isSeen(person)), ...people.filter(isSeen)];
}

async function peoplePackedBy(ctx: QueryCtx, giver: MemberId, most: number): Promise<MemberId[]> {
  const people: MemberId[] = [];
  for (let after: MemberId | null = null; people.length < most; ) {
    const last: MemberId | null = after;
    const pack = await ctx.db
      .query("thoughtfulPacks")
      .withIndex("by_giver_recipient_week", (q) => (last === null ? q.eq("giver", giver) : q.eq("giver", giver).gt("recipient", last)))
      .first();
    if (pack === null) break;
    people.push(pack.recipient);
    after = pack.recipient;
  }
  return people;
}

async function hypePictureOf(ctx: QueryCtx, workspace: string, person: MemberId): Promise<string> {
  const companyFace = await storedCompanyFaceOf(ctx, workspace, person);
  return companyFace?.image ?? (await nameAndPictureOf(ctx, person)).picture ?? hypeEmblemPicture;
}

async function seenBy(ctx: QueryCtx, member: MemberId): Promise<Set<string>> {
  const seen = await ctx.db
    .query("seenEmojis")
    .withIndex("by_member_emoji", (q) => q.eq("member", member))
    .collect();
  return new Set(seen.map(({ emoji }) => emoji));
}

async function isEarnedBy(ctx: QueryCtx, member: MemberId, id: string): Promise<boolean> {
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
