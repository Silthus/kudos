import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { renderMondayPost, renderTopKudosPost, type TeamRow, type TopKudosEntry, type TopKudosMessage, type Words } from "../feedback/mondayPost";
import type { ClaimedWeek } from "../leaderboard/mondayPost";
import type { MondayPostOutcome } from "../leaderboard/mondayPostOutcome";
import { escaped, mrkdwn } from "./blocks";
import type { ActionCtx } from "../_generated/server";
import { attemptCall, isRefusedForItsBlocks, slackTextOf, type Attempt } from "./delivery";

const attemptsAtMost = 3;
const teamRowsShown = 10;
const otherTeamsCharactersAtMost = 2_900;
const refusedInChannel = new Set(["no_permission", "restricted_action", "restricted_action_read_only_channel", "restricted_action_thread_only_channel", "ekm_access_denied"]);

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
  const message = renderTopKudosPost(post);
  const sent = await attemptCall(ctx, workspace, "chat.postMessage", topKudosMessageOf(channel, message));
  return isRefusedForItsBlocks(sent) && hasPictures(message) ? attemptCall(ctx, workspace, "chat.postMessage", topKudosMessageOf(channel, withoutPictures(message))) : sent;
}

function topKudosMessageOf(channel: string, message: TopKudosMessage) {
  return { channel, text: fallbackTextOf(message), blocks: blocksOf(message), unfurl_links: false, unfurl_media: false };
}

function hasPictures({ teams }: TopKudosMessage) {
  return teams?.rows.some(({ emoji }) => emoji?.picture) ?? false;
}

function withoutPictures(message: TopKudosMessage): TopKudosMessage {
  if (message.teams === null) return message;
  return { ...message, teams: { ...message.teams, rows: message.teams.rows.map((row) => (row.emoji === null ? row : { ...row, emoji: { ...row.emoji, picture: null } })) } };
}

function fallbackTextOf({ headline, kudos, teams }: TopKudosMessage) {
  const teamLine = teams === null ? [] : [`${teams.headline}: ${teams.rows.map(({ team, count }) => `${team} ${count}`).join(", ")}`];
  return [headline, ...kudos.map(({ lead, quote, permalink }) => `${plainOf(lead)}: ${quote}${permalink === null ? "" : ` ${permalink}`}`), ...teamLine].map(escaped).join("\n");
}

function blocksOf({ headline, kudos, teams }: TopKudosMessage) {
  const teamBlocks = teams === null ? [] : [sectionOf(`*${escaped(teams.headline)}*`), ...teams.rows.slice(0, teamRowsShown).map(teamBlockOf), ...otherTeamsOf(teams.rows.slice(teamRowsShown))];
  return [sectionOf(`*${escaped(headline)}*`), ...kudos.map(kudosBlockOf), ...teamBlocks];
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

function mrkdwnOf(words: Words[]) {
  return words.map(({ text, strong }) => (strong ? `*${escaped(text)}*` : escaped(text))).join("");
}

function plainOf(words: Words[]) {
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
