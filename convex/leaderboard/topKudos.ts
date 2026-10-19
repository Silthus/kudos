import type { QueryCtx } from "../_generated/server";
import { teamEmojiOf, type ShownEmoji } from "../album/earnedEmojis";
import { thoughtfulKudosBetween, type Instants, type ThoughtfulKudos } from "../album/packs";
import { teamStickersUnlockedIn } from "../album/teamStickers";
import type { Segment } from "../activity/entries";
import { mentionsOfOnePage, permalinkOfMessage, readableSegmentsOf, type Mentions } from "../activity/kudos";
import type { MessageRef, WordSegment } from "../engine/messageEvent";
import { publicThoughtfulKudosOf, type DrawableKudos } from "../engine/spotlight";
import { hugsOnTheMessage } from "../hugs/weeks";
import { nameless } from "../website/faces";
import { websiteOrigin } from "../website/link";
import { nameAndPictureOf, type MemberId } from "../workspace/directory";

export const kudosQuoted = 3;
export const mostKudosRanked = 500;
export const mostKudosChecked = 200;
export const mostTeamStickersRead = 500;
export const wordedSegmentsQuotedAtMost = 200;
export const recipientsNamed = 3;

const mentionLookupsAtMost = 3 * wordedSegmentsQuotedAtMost;

export type QuotedKudos = { giver: string; recipients: string[]; moreRecipients: number; words: Segment[]; permalink: string | null };

export type UnlockedTeam = { name: string; count: number; emoji: ShownEmoji | null };

export type TopKudosPost = { kind: "topKudos"; kudos: QuotedKudos[]; teams: UnlockedTeam[]; origin: string | null };

type Ranked = ThoughtfulKudos & { hugs: number };

export async function topKudosPostOf(ctx: QueryCtx, workspace: string, week: Instants): Promise<TopKudosPost> {
  return { kind: "topKudos", kudos: await topKudosOf(ctx, workspace, week), teams: await teamsUnlockedOf(ctx, workspace, week), origin: await websiteOrigin(ctx, workspace) };
}

async function topKudosOf(ctx: QueryCtx, workspace: string, week: Instants): Promise<QuotedKudos[]> {
  const mentions = mentionsOfOnePage(ctx, mentionLookupsAtMost);
  const quoted: QuotedKudos[] = [];
  for (const { message } of (await rankedKudosOf(ctx, workspace, week)).slice(0, mostKudosChecked)) {
    const kudos = await publicThoughtfulKudosOf(ctx, message);
    if (kudos !== null) quoted.push(await quotedKudosOf(ctx, mentions, message, kudos));
    if (quoted.length === kudosQuoted) break;
  }
  return quoted;
}

async function rankedKudosOf(ctx: QueryCtx, workspace: string, week: Instants): Promise<Ranked[]> {
  const ranked: Ranked[] = [];
  for (const kudos of await thoughtfulKudosBetween(ctx, workspace, week, mostKudosRanked)) ranked.push({ ...kudos, hugs: await hugsOnTheMessage(ctx, kudos.message) });
  return ranked.sort((one, other) => other.hugs - one.hugs || other.recipients - one.recipients || other.at - one.at);
}

async function quotedKudosOf(ctx: QueryCtx, mentions: Mentions, message: MessageRef, { giver, recipients, segments }: DrawableKudos): Promise<QuotedKudos> {
  const named: string[] = [];
  for (const recipient of recipients.slice(0, recipientsNamed)) named.push(await nameOf(ctx, recipient));
  return {
    giver: await nameOf(ctx, giver),
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

async function nameOf(ctx: QueryCtx, member: MemberId) {
  return (await nameAndPictureOf(ctx, member)).name ?? nameless;
}
