import type { QueryCtx } from "../_generated/server";
import { teamEmojiOf, type ShownEmoji } from "../album/earnedEmojis";
import { grantedKudosBetween, type GrantedKudos, type Instants } from "../album/packs";
import { teamStickersUnlockedIn } from "../album/teamStickers";
import type { Segment } from "../activity/entries";
import { mentionsOfOnePage, permalinkOfMessage, readableSegmentsOf, type Mentions } from "../activity/kudos";
import type { DayKey } from "../engine/allowance";
import type { MessageRef, WordSegment } from "../engine/messageEvent";
import { publicKudosOf, type DrawableKudos } from "../engine/spotlight";
import { hugsOnTheMessage } from "../hugs/weeks";
import { turnedFindOf, type Find } from "../album/items/finds";
import { itemShareAppliesToWorkspace } from "../album/items/flag";
import { nameless } from "../website/faces";
import { websiteOrigin } from "../website/link";
import { nameAndPictureOf, type MemberId } from "../workspace/directory";
import { newGiversOf, weeklyHighlightsApplyTo, type NewGiver } from "./newGivers";

export const kudosQuoted = 3;
export const topKudosHighlighted = 1;
export const mostKudosRanked = 500;
export const mostKudosChecked = 200;
export const mostTeamStickersRead = 500;
export const wordedSegmentsQuotedAtMost = 200;
export const recipientsNamed = 3;

const mentionLookupsAtMost = 3 * wordedSegmentsQuotedAtMost;

export type QuotedPerson = { member: MemberId; name: string };

export type QuotedKudos = { giver: QuotedPerson; recipients: QuotedPerson[]; moreRecipients: number; words: Segment[]; permalink: string | null; find: Find | null };

export type UnlockedTeam = { name: string; count: number; emoji: ShownEmoji | null };

export type TopKudosPost = { kind: "topKudos"; kudos: QuotedKudos[]; teams: UnlockedTeam[]; origin: string | null; newGivers?: NewGiver[] };

type Ranked = GrantedKudos & { hugs: number };

export async function topKudosPostOf(ctx: QueryCtx, workspace: string, week: Instants, postWeek: DayKey): Promise<TopKudosPost> {
  const highlights = await weeklyHighlightsApplyTo(ctx, workspace);
  const post: TopKudosPost = { kind: "topKudos", kudos: await topKudosOf(ctx, workspace, week, highlights ? topKudosHighlighted : kudosQuoted), teams: await teamsUnlockedOf(ctx, workspace, week), origin: await websiteOrigin(ctx, workspace) };
  return highlights ? { ...post, newGivers: await newGiversOf(ctx, workspace, postWeek) } : post;
}

async function topKudosOf(ctx: QueryCtx, workspace: string, week: Instants, quotedAtMost: number): Promise<QuotedKudos[]> {
  const mentions = mentionsOfOnePage(ctx, mentionLookupsAtMost);
  const marksFinds = await itemShareAppliesToWorkspace(ctx, workspace);
  const quoted: QuotedKudos[] = [];
  for (const { message, at } of (await rankedKudosOf(ctx, workspace, week)).slice(0, mostKudosChecked)) {
    const kudos = await publicKudosOf(ctx, message);
    if (kudos !== null) quoted.push({ ...(await quotedKudosOf(ctx, mentions, message, kudos)), find: marksFinds ? await turnedFindOf(ctx, { giver: kudos.giver, message, at }) : null });
    if (quoted.length === quotedAtMost) break;
  }
  return quoted;
}

async function rankedKudosOf(ctx: QueryCtx, workspace: string, week: Instants): Promise<Ranked[]> {
  const ranked: Ranked[] = [];
  for (const kudos of await grantedKudosBetween(ctx, workspace, week, mostKudosRanked)) ranked.push({ ...kudos, hugs: await hugsOnTheMessage(ctx, kudos.message) });
  return ranked.sort((one, other) => other.hugs - one.hugs || other.recipients - one.recipients || other.at - one.at);
}

async function quotedKudosOf(ctx: QueryCtx, mentions: Mentions, message: MessageRef, { giver, recipients, segments }: DrawableKudos): Promise<Omit<QuotedKudos, "find">> {
  const named: QuotedPerson[] = [];
  for (const recipient of recipients.slice(0, recipientsNamed)) named.push(await quotedPersonOf(ctx, recipient));
  return {
    giver: await quotedPersonOf(ctx, giver),
    recipients: named,
    moreRecipients: recipients.length - named.length,
    words: await readableSegmentsOf(mentions, message.workspace, quotedSegmentsOf(segments)),
    permalink: await permalinkOfMessage(ctx, message),
  };
}

function quotedSegmentsOf(segments: WordSegment[]): WordSegment[] {
  const quoted: WordSegment[] = [];
  let worded = 0;
  for (const segment of segments) {
    if (worded === wordedSegmentsQuotedAtMost) break;
    quoted.push(segment);
    if (!isBlank(segment)) worded += 1;
  }
  return quoted;
}

function isBlank(segment: WordSegment) {
  return segment.kind === "break" || (segment.kind === "text" && segment.text.trim() === "");
}

async function teamsUnlockedOf(ctx: QueryCtx, workspace: string, week: Instants): Promise<UnlockedTeam[]> {
  const teams: UnlockedTeam[] = [];
  for (const unlocked of await teamStickersUnlockedIn(ctx, workspace, week, mostTeamStickersRead)) teams.push({ name: unlocked.name, count: unlocked.count, emoji: await teamEmojiOf(ctx, workspace, unlocked) });
  return teams;
}

async function quotedPersonOf(ctx: QueryCtx, member: MemberId): Promise<QuotedPerson> {
  return { member, name: (await nameAndPictureOf(ctx, member)).name ?? nameless };
}
