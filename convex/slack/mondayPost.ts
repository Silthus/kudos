import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { renderMondayPost, renderTopKudosPost, type TeamRow, type TopKudosEntry, type TopKudosMessage, type Words } from "../feedback/mondayPost";
import type { ClaimedWeek } from "../leaderboard/mondayPost";
import type { MondayPostOutcome } from "../leaderboard/mondayPostOutcome";
import { escaped, mrkdwn } from "./blocks";
import { attemptCall, slackTextOf, type Attempt } from "./delivery";

const attemptsAtMost = 3;
const teamRowsShown = 10;
const refusedInChannel = new Set(["no_permission", "restricted_action", "restricted_action_read_only_channel", "restricted_action_thread_only_channel", "ekm_access_denied"]);

export const postMondayPost = observedAction({
  args: { workspace: v.string(), generation: v.number(), attempt: v.optional(v.number()) },
  handler: async (ctx, { workspace, generation, attempt = 1 }) => {
    await ctx.runMutation(internal.leaderboard.mondayPost.bookNextPost, { workspace, generation });
    const claimed = await ctx.runMutation(internal.leaderboard.mondayPost.claimWeek, { workspace, generation });
    if (claimed === null) return;
    const sent = await attemptCall(ctx, workspace, "chat.postMessage", messageOf(claimed));
    const nextTry = nextTryOf(sent, attempt);
    if (nextTry !== null) await ctx.runMutation(internal.leaderboard.mondayPost.postAgainLater, { workspace, generation, claim: claimed.claim, ...nextTry });
    else await ctx.runMutation(internal.leaderboard.mondayPost.recordOutcome, { claim: claimed.claim, outcome: outcomeOf(sent) });
  },
});

function messageOf({ channel, post }: ClaimedWeek) {
  if (post.kind === "groups") return { channel, text: slackTextOf(renderMondayPost(post)) };
  const message = renderTopKudosPost(post);
  return { channel, text: fallbackTextOf(message), blocks: blocksOf(message), unfurl_links: false, unfurl_media: false };
}

function fallbackTextOf({ headline, kudos, teams }: TopKudosMessage) {
  const teamLine = teams === null ? [] : [`${teams.headline}: ${teams.rows.map(({ team, count }) => `${team} ${count}`).join(", ")}`];
  return [headline, ...kudos.map(({ lead, quote, permalink }) => `${plainOf(lead)}: ${quote}${permalink === null ? "" : ` ${permalink}`}`), ...teamLine].map(escaped).join("\n");
}

function blocksOf({ headline, kudos, teams }: TopKudosMessage) {
  const teamBlocks = teams === null ? [] : [sectionOf(`*${escaped(teams.headline)}*`), ...teams.rows.slice(0, teamRowsShown).map(teamBlockOf), ...moreTeamsOf(teams.rows)];
  return [sectionOf(`*${escaped(headline)}*`), ...kudos.map(kudosBlockOf), ...teamBlocks];
}

function kudosBlockOf({ lead, quote, permalink }: TopKudosEntry) {
  return sectionOf([mrkdwnOf(lead), `>${escaped(quote)}`, ...(permalink === null ? [] : [`<${permalink}|Open in Slack>`])].join("\n"));
}

function teamBlockOf({ team, count, emoji }: TeamRow) {
  const picture = emoji?.picture ? [{ type: "image", image_url: emoji.picture, alt_text: emoji.name }] : [];
  return { type: "context", elements: [...picture, mrkdwn(`*${escaped(team)}* ${count}${emoji?.inSlack ? ` :${emoji.name}:` : ""}`)] };
}

function moreTeamsOf(rows: TeamRow[]) {
  const more = rows.length - teamRowsShown;
  return more > 0 ? [{ type: "context", elements: [mrkdwn(`And ${more} more ${more === 1 ? "team" : "teams"}.`)] }] : [];
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
