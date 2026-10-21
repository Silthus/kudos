import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { emojiArtPictureOf } from "../album/emojiCatalogue";
import { stepNameOf } from "../album/milestoneCatalogue";
import type { ReachedTier } from "../album/milestones";
import type { PageOwner } from "../album/teamPages";
import type { MessageRef, WordSegment } from "../engine/messageEvent";
import { publicPictureOf } from "../feedback/albumSlack";
import { findWordsOf, type Words } from "../feedback/mondayPost";
import { publicQuoteOf } from "../feedback/welcomeNudge";
import { weeklyPostChannelOf } from "../leaderboard/mondayPost";
import { nameless } from "../website/faces";
import { websiteOrigin } from "../website/link";
import { nameAndPictureOf, type MemberId } from "../workspace/directory";
import { hiddenItemsShownTo, itemShareShownTo } from "./flag";
import type { ItemReason } from "./records";
import { hoggieSharePictureOf } from "./shareArt";
import type { Win } from "./shareRecords";

export const mostSharesOffered = 10;

const leadingSeparators = /^[\s,;:\-–—]+/u;
const trailingSeparators = /[\s,;:\-–—]+$/u;

export type ShareOffers = { shares?: Id<"items">[] };

export type SharePicture = { url: string; label: string };

export type ShareCard = { workspace: string; channel: string; lead: Words[]; picture: SharePicture | null; album: string | null };

type Share = Doc<"itemShares">;

export async function shareOffersTo(ctx: QueryCtx, owner: PageOwner): Promise<ShareOffers> {
  if ((await sharingChannelOf(ctx, owner)) === null) return {};
  const offered = await ctx.db
    .query("itemShares")
    .withIndex("by_member_shared", (q) => q.eq("member", owner.member).eq("sharedAt", undefined))
    .order("desc")
    .take(mostSharesOffered);
  return { shares: offered.map(({ item }) => item) };
}

export async function shareWin(ctx: MutationCtx, owner: PageOwner, item: Id<"items">, at: number): Promise<boolean> {
  if ((await sharingChannelOf(ctx, owner)) === null) return false;
  const share = await shareOf(ctx, item);
  if (share?.member !== owner.member || share.sharedAt !== undefined) return false;
  await ctx.db.patch(share._id, { sharedAt: at });
  await ctx.scheduler.runAfter(0, internal.slack.itemShare.postItemShare, { share: share._id });
  return true;
}

export const shareCardOf = internalQuery({
  args: { share: v.id("itemShares") },
  handler: async (ctx, { share }): Promise<ShareCard | null> => {
    const shared = await ctx.db.get(share);
    if (shared?.sharedAt === undefined) return null;
    const channel = await sharingChannelOf(ctx, shared);
    const item = await ctx.db.get(shared.item);
    if (channel === null || item === null) return null;
    const origin = await websiteOrigin(ctx, shared.workspace);
    const lead = [...(await whoWonOf(ctx, shared.member, item.reason)), { text: `${item.reason.kind === "welcome" ? " " : " and "}${winWordsOf(shared.win)}` }];
    return { workspace: shared.workspace, channel, lead, picture: pictureOf(shared.win, origin), album: origin === null ? null : `${origin}/book` };
  },
});

async function sharingChannelOf(ctx: QueryCtx, { workspace, member }: PageOwner): Promise<string | null> {
  if (!(await hiddenItemsShownTo(ctx, member)) || !(await itemShareShownTo(ctx, member))) return null;
  return weeklyPostChannelOf(ctx, workspace);
}

function shareOf(ctx: QueryCtx, item: Id<"items">): Promise<Share | null> {
  return ctx.db
    .query("itemShares")
    .withIndex("by_item", (q) => q.eq("item", item))
    .unique();
}

async function whoWonOf(ctx: QueryCtx, member: MemberId, reason: ItemReason): Promise<Words[]> {
  const winner = { text: await nameOf(ctx, member), strong: true as const };
  if (reason.kind === "welcome") return [winner];
  if (reason.kind === "levelUp") return [winner, { text: ` reached level ${reason.level}` }];
  if (reason.kind === "team") return [winner, { text: ` filled the ${reason.name} page` }];
  if (reason.kind === "milestone") return [winner, { text: ` earned the ${medalWordsOf(reason)} medal` }];
  const quote = await thanksQuoteOf(ctx, reason.message);
  return [winner, { text: " thanked " }, { text: await nameOf(ctx, reason.person), strong: true }, ...(quote === null ? [] : [{ text: `: '${quote}'` }])];
}

async function thanksQuoteOf(ctx: QueryCtx, message: MessageRef): Promise<string | null> {
  const thanks = await publicQuoteOf(ctx, message, thanksAmong);
  return thanks === "" ? null : thanks;
}

function thanksAmong(segments: WordSegment[]): WordSegment[] {
  const first = segments.findIndex(saysSomething);
  if (first === -1) return [];
  return segments
    .slice(first, segments.findLastIndex(saysSomething) + 1)
    .map((segment, index) => (index === 0 ? withoutSeparators(segment, leadingSeparators) : segment))
    .map((segment, index, thanks) => (index === thanks.length - 1 ? withoutSeparators(segment, trailingSeparators) : segment));
}

function withoutSeparators(segment: WordSegment, separators: RegExp): WordSegment {
  return segment.kind === "text" ? { ...segment, text: segment.text.replace(separators, "") } : segment;
}

function saysSomething(segment: WordSegment): boolean {
  if (segment.kind === "text") return /[\p{L}\p{N}]/u.test(segment.text);
  return segment.kind === "link" || segment.kind === "channel";
}

function medalWordsOf({ milestone, tier }: ReachedTier): string {
  return `${tier} ${stepNameOf(milestone, tier)}`;
}

function winWordsOf(win: Win): string {
  return win.kind === "hoggie" ? `found ${findWordsOf(win)}` : `completed the ${win.name} page`;
}

function pictureOf(win: Win, origin: string | null): SharePicture | null {
  if (win.kind === "hoggie") return labelled(publicPictureOf(hoggieSharePictureOf(win.hoggie), origin), win.name);
  if (win.art === null) return null;
  const picture = win.art.kind === "image" ? win.art.url : publicPictureOf(emojiArtPictureOf("team", win.art.slug), origin);
  return labelled(picture, `${win.name} crest`);
}

function labelled(url: string | null, label: string): SharePicture | null {
  return url === null ? null : { url, label };
}

async function nameOf(ctx: QueryCtx, member: MemberId): Promise<string> {
  return (await nameAndPictureOf(ctx, member)).name ?? nameless;
}
