import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { renderMondayPost, renderTopKudosPost, type NewGiverRow, type TeamRow, type TopKudosEntry, type TopKudosMessage, type Words } from "../feedback/mondayPost";
import type { ClaimedWeek, foundChannelValidator } from "../leaderboard/mondayPost";
import type { MondayPostOutcome } from "../leaderboard/mondayPostOutcome";
import type { TopKudosPost } from "../leaderboard/topKudos";
import { escaped, mrkdwn } from "./blocks";
import type { ActionCtx } from "../_generated/server";
import { attemptCall, isRefusedForItsBlocks, slackTextOf, type Attempt } from "./delivery";
import { cardBlocksOf, emojisUnlockedOn } from "./linkPreviews";
import { isOffLimits, joinRefusalOf, joinUnlessOffLimits, type ChannelTraits, type OffLimits } from "./offLimitsChannels";
import type { SlackAnswer } from "./webApi";

const attemptsAtMost = 3;
const teamRowsShown = 10;
const otherTeamsCharactersAtMost = 2_900;
const refusedInChannel = new Set(["no_permission", "restricted_action", "restricted_action_read_only_channel", "restricted_action_thread_only_channel", "ekm_access_denied"]);

type FoundChannel = Infer<typeof foundChannelValidator>;

type CardedMessage = TopKudosMessage & { card: ReturnType<typeof cardBlocksOf> | null };

type JoinedChannel = { channel?: ChannelTraits & { is_private?: boolean } };

const privateChannel: FoundChannel = { kind: "refused", reason: "private" };

const joinRefusals: Record<string, FoundChannel> = {
  method_not_supported_for_channel_type: privateChannel,
  channel_not_found: { kind: "refused", reason: "not-found" },
  is_archived: { kind: "refused", reason: "archived" },
};

const uncheckable: FoundChannel = { kind: "refused", reason: "failed" };

export const checkPickedChannel = observedAction({
  args: { workspace: v.string(), channel: v.string(), pick: v.number() },
  handler: async (ctx, { workspace, channel, pick }) => {
    await ctx.runMutation(internal.leaderboard.mondayPost.recordChannelCheck, { workspace, channel, pick, found: await joined(channel) });
  },
});

async function joined(channel: string): Promise<FoundChannel> {
  try {
    return foundChannelOf(await joinUnlessOffLimits<JoinedChannel>(channel));
  } catch (error) {
    console.warn(`conversations.join has no known result: ${String(error)}`);
    return uncheckable;
  }
}

function foundChannelOf(answer: SlackAnswer<JoinedChannel> | OffLimits): FoundChannel {
  if (isOffLimits(answer)) return { kind: "refused", reason: answer.offLimits };
  if (!answer.ok) return joinRefusals[answer.error] ?? uncheckable;
  if (answer.channel?.is_private === true) return privateChannel;
  const offLimits = joinRefusalOf(answer.channel ?? {});
  if (offLimits !== null) return { kind: "refused", reason: offLimits };
  const name = answer.channel?.name;
  return name === undefined ? uncheckable : { kind: "public", name };
}

export const postMondayPost = observedAction({
  args: { workspace: v.string(), generation: v.number(), attempt: v.optional(v.number()) },
  handler: async (ctx, { workspace, generation, attempt = 1 }) => {
    await ctx.runMutation(internal.leaderboard.mondayPost.bookNextPost, { workspace, generation });
    const claimed = await ctx.runMutation(internal.leaderboard.mondayPost.claimWeek, { workspace, generation });
    if (claimed === null) return;
    const sent = await postWeek(ctx, workspace, claimed);
    const nextTry = nextTryOf(sent, attempt);
    if (nextTry !== null) await ctx.runMutation(internal.leaderboard.mondayPost.postAgainLater, { workspace, generation, claim: claimed.claim, ...nextTry });
    else await ctx.runMutation(internal.leaderboard.mondayPost.recordOutcome, { claim: claimed.claim, outcome: outcomeOf(sent) });
  },
});

async function postWeek(ctx: ActionCtx, workspace: string, { channel, post }: ClaimedWeek): Promise<Attempt> {
  if (post.kind === "groups") return attemptCall(ctx, workspace, "chat.postMessage", { channel, text: slackTextOf(renderMondayPost(post)) });
  const message = { ...renderTopKudosPost(post), card: await firstNewGiversCardOf(ctx, workspace, post) };
  const sent = await attemptCall(ctx, workspace, "chat.postMessage", topKudosMessageOf(channel, message));
  return isRefusedForItsBlocks(sent) && hasPictures(message) ? attemptCall(ctx, workspace, "chat.postMessage", topKudosMessageOf(channel, withoutPictures(message))) : sent;
}

async function firstNewGiversCardOf(ctx: ActionCtx, workspace: string, { origin, newGivers = [] }: TopKudosPost): Promise<CardedMessage["card"]> {
  const [first] = newGivers;
  if (origin === null || first === undefined) return null;
  const preview = await ctx.runQuery(internal.website.linkPreviews.personCardOf, { workspace, person: first.member });
  return preview === null ? null : cardBlocksOf(preview, await emojisUnlockedOn(ctx, workspace, preview));
}

function topKudosMessageOf(channel: string, message: CardedMessage) {
  return { channel, text: fallbackTextOf(message), blocks: blocksOf(message), unfurl_links: message.embedsQuotedMessage, unfurl_media: false };
}

function hasPictures({ teams, card }: CardedMessage) {
  return card !== null || (teams?.rows.some(({ emoji }) => emoji?.picture) ?? false);
}

function withoutPictures(message: CardedMessage): CardedMessage {
  const { teams } = message;
  if (teams === null) return { ...message, card: null };
  return { ...message, card: null, teams: { ...teams, rows: teams.rows.map((row) => (row.emoji === null ? row : { ...row, emoji: { ...row.emoji, picture: null } })) } };
}

function fallbackTextOf({ headline, kudos, newGivers, teams }: TopKudosMessage) {
  const giverLine = newGivers === null ? [] : [`${newGivers.headline}: ${newGivers.rows.map(({ place, name, thoughtful }) => `${place}. ${name} · ${thoughtful}`).join(", ")}`];
  const teamLine = teams === null ? [] : [`${teams.headline}: ${teams.rows.map(({ team, count }) => `${team} ${count}`).join(", ")}`];
  return [headline, ...kudos.map(({ lead, quote, permalink }) => `${plainOf(lead)}: ${quote}${permalink === null ? "" : ` ${permalink}`}`), ...giverLine, ...teamLine].map(escaped).join("\n");
}

function blocksOf({ headline, kudos, newGivers, teams, card }: CardedMessage) {
  const giverBlocks = newGivers === null ? [] : [sectionOf(`*${escaped(newGivers.headline)}*`), ...newGivers.rows.flatMap((row) => [sectionOf(newGiverLineOf(row)), ...(row.place === 1 && card !== null ? card : [])])];
  const teamBlocks = teams === null ? [] : [sectionOf(`*${escaped(teams.headline)}*`), ...teams.rows.slice(0, teamRowsShown).map(teamBlockOf), ...otherTeamsOf(teams.rows.slice(teamRowsShown))];
  return [sectionOf(`*${escaped(headline)}*`), ...kudos.map(kudosBlockOf), ...giverBlocks, ...teamBlocks];
}

function newGiverLineOf({ place, name, page, thoughtful }: NewGiverRow) {
  const named = page === null ? escaped(name) : `<${page}|${escaped(name)}>`;
  return `${place}. *${named}* · ${thoughtful} kudos`;
}

function kudosBlockOf({ lead, quote, permalink }: TopKudosEntry) {
  return sectionOf([mrkdwnOf(lead), `>${escaped(quote)}`, ...(permalink === null ? [] : [`<${permalink}|Open in Slack>`])].join("\n"));
}

function teamBlockOf(row: TeamRow) {
  const { emoji } = row;
  const picture = emoji?.picture ? [{ type: "image", image_url: emoji.picture, alt_text: emoji.name }] : [];
  return { type: "context", elements: [...picture, mrkdwn(teamWordsOf(row))] };
}

function otherTeamsOf(rows: TeamRow[]) {
  if (rows.length === 0) return [];
  const named = namedWithinTheLimit(rows.map(teamWordsOf));
  const more = rows.length - named.length;
  const line = named.join(" · ");
  return [{ type: "context", elements: [mrkdwn(more > 0 ? `${line} and ${more} more ${more === 1 ? "team" : "teams"}` : line)] }];
}

function namedWithinTheLimit(names: string[]): string[] {
  const named: string[] = [];
  let length = 0;
  for (const name of names) {
    length += name.length + " · ".length;
    if (length > otherTeamsCharactersAtMost) break;
    named.push(name);
  }
  return named;
}

function teamWordsOf({ team, count, emoji }: TeamRow) {
  return `*${escaped(team)}* ${count}${emoji?.inSlack ? ` :${emoji.name}:` : ""}`;
}

function sectionOf(text: string) {
  return { type: "section", text: mrkdwn(text) };
}

export function mrkdwnOf(words: Words[]) {
  return words.map(({ text, strong, link }) => {
    const shown = link === undefined ? escaped(text) : `<${link}|${escaped(text)}>`;
    return strong ? `*${shown}*` : shown;
  }).join("");
}

export function plainOf(words: Words[]) {
  return words.map(({ text }) => text).join("");
}

function nextTryOf(sent: Attempt, attempt: number): { at: number; attempt: number } | null {
  if (sent.kind === "held") return { at: sent.until, attempt };
  if (sent.kind !== "failed" || sent.retryAt === undefined || attempt >= attemptsAtMost) return null;
  return { at: sent.retryAt, attempt: attempt + 1 };
}

function outcomeOf(sent: Attempt): MondayPostOutcome {
  if (sent.kind === "delivered") return "posted";
  return cantPostIn(sent) ? "cant-post" : "failed";
}

function cantPostIn(sent: Attempt) {
  return sent.kind === "gone" || (sent.kind === "failed" && sent.error !== undefined && refusedInChannel.has(sent.error));
}
