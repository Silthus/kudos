import type { MutationCtx, QueryCtx } from "../_generated/server";
import { storedCompanyFaceOf } from "../companyProfiles/storedFaces";
import type { TeamCrestArt } from "../companyProfiles/teams";
import { xpToReach } from "../progression/levels";
import { progressionHomeOf } from "../progression/progression";
import { customEmojiImageOf } from "../workspace/customEmoji";
import { nameAndPictureOf, personFactsOf, type MemberId } from "../workspace/directory";
import { emojiArtPictureOf, emojiLevels, hypeEmblemPicture, teamEmblemPicture } from "./emojiCatalogue";
import { emojiNameOf, type EarnedEmojiId } from "./emojiNames";
import type { MilestoneAnswer } from "./milestones";
import type { MilestoneId } from "./records";
import type { PageOwner, TeamPage } from "./teamPages";

export type EarnedEmojiKind = "team" | "milestone" | "level" | "hype";

export type EmojiProgress = { have: number; need: number };

export type EarnedEmoji = { id: EarnedEmojiId; kind: EarnedEmojiKind; name: string; picture: string; earned: boolean; seen: boolean; inSlack: boolean; progress: EmojiProgress | null };

export type SharedEmoji = Pick<EarnedEmoji, "id" | "kind" | "name" | "picture" | "inSlack">;

export type EmojiCauses = { pages: TeamPage[]; milestones: MilestoneAnswer[]; level: { level: number; xp: number } };

export type EarnedEmojis = { emojis: EarnedEmoji[]; more: boolean };

export const mostHypeEmojisShown = 200;

export const mostEmojisSeenAtOnce = 500;

type Cause = { id: EarnedEmojiId; kind: EarnedEmojiKind; picture: string; earned: boolean; progress: EmojiProgress };

export async function earnedEmojisOf(ctx: QueryCtx, owner: PageOwner, causes: EmojiCauses): Promise<EarnedEmojis> {
  const hype = await hypeCausesOf(ctx, owner);
  const seen = await seenBy(ctx, owner.member);
  const emojis: EarnedEmoji[] = [];
  for (const cause of [...teamCausesOf(causes.pages), ...hype.causes, ...milestoneCausesOf(causes.milestones), ...levelCausesOf(causes.level)]) {
    const name = await emojiNameOf(ctx, owner.workspace, cause.id);
    if (name !== null) emojis.push(await emojiOf(ctx, owner.workspace, cause, name, seen));
  }
  return { emojis, more: hype.more };
}

export async function sharedEmojisOf(ctx: QueryCtx, member: MemberId, { emojis }: EarnedEmojis): Promise<SharedEmoji[] | null> {
  if (!(await personFactsOf(ctx, member))?.admin) return null;
  return emojis.filter(({ kind }) => kind !== "hype").map(({ id, kind, name, picture, inSlack }) => ({ id, kind, name, picture, inSlack }));
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
  const inSlack = (await customEmojiImageOf(ctx, workspace, name)) !== undefined;
  return { id, kind, name, picture, earned, seen: earned && seen.has(id), inSlack, progress: earned ? null : progress };
}

function teamCausesOf(pages: TeamPage[]): Cause[] {
  return pages.map(({ team, art, state, held, total }) => ({ id: `team:${team}`, kind: "team", picture: teamPictureOf(art), earned: state === "unlocked", progress: { have: held, need: total } }));
}

function teamPictureOf(art: TeamCrestArt): string {
  if (art === null) return teamEmblemPicture;
  return art.kind === "crest" ? emojiArtPictureOf("team", art.slug) : art.url;
}

function milestoneCausesOf(milestones: MilestoneAnswer[]): Cause[] {
  return milestones.flatMap(({ id, count, tiers }) => {
    const gold = tiers.find(({ tier }) => tier === "gold");
    return gold === undefined ? [] : [{ id: `milestone:${id}` as const, kind: "milestone" as const, picture: emojiArtPictureOf("milestone", id), earned: gold.earnedAt !== null, progress: { have: count, need: gold.at } }];
  });
}

function levelCausesOf({ level, xp }: EmojiCauses["level"]): Cause[] {
  return emojiLevels.map((reward) => ({ id: `level:${reward}`, kind: "level", picture: emojiArtPictureOf("level", reward), earned: level >= reward, progress: { have: xp, need: xpToReach(reward) } }));
}

async function hypeCausesOf(ctx: QueryCtx, { workspace, member }: PageOwner): Promise<{ causes: Cause[]; more: boolean }> {
  const people = await peoplePackedBy(ctx, member, mostHypeEmojisShown + 1);
  const causes: Cause[] = [];
  for (const person of people.slice(0, mostHypeEmojisShown)) causes.push({ id: `hype:${person}`, kind: "hype", picture: await hypePictureOf(ctx, workspace, person), earned: true, progress: { have: 1, need: 1 } });
  return { causes, more: people.length > mostHypeEmojisShown };
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
  if (kind === "milestone") return (await goldTierOf(ctx, member, cause as MilestoneId)) !== null;
  if (kind === "level") return emojiLevels.some((reward) => String(reward) === cause) && (await progressionHomeOf(ctx, member)).level >= Number(cause);
  if (kind === "hype") return hasPackedFor(ctx, member, ctx.db.normalizeId("members", cause));
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

function goldTierOf(ctx: QueryCtx, member: MemberId, milestone: MilestoneId) {
  return ctx.db
    .query("milestoneTiers")
    .withIndex("by_member_milestone_tier", (q) => q.eq("member", member).eq("milestone", milestone).eq("tier", "gold"))
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
