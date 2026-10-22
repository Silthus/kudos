import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { medalText } from "../feedback/profileCard";
import { productName } from "../feedback/naming";
import { rarityLabel } from "../hoggies/catalogue";
import type { BoardPlace, CardHoggie, LevelWay, PersonStats, TeamStats } from "../website/linkCardStats";
import type { LinkPreview, PersonPreview, TeamPreview } from "../website/linkPreviews";
import { escaped, mrkdwn } from "./blocks";
import { textOf } from "./directory";
import { callSlack, nextRateLimitedAttempt, readSlack, retryDelayOf, slackErrorCodeOf } from "./webApi";

type LinkShared = { type: "link_shared"; channel?: unknown; user?: unknown; message_ts?: unknown; source?: unknown; links?: unknown };

type LinkSharedCallback = { team_id?: unknown; event_id?: unknown; is_ext_shared_channel?: unknown; event: LinkShared };

type ChannelInfo = { channel: { is_ext_shared?: boolean; is_pending_ext_shared?: boolean } };

export const linkSharingValidator = { workspace: v.string(), sharer: v.string(), links: v.array(v.string()), channel: v.string(), ts: v.string(), sharedOutside: v.union(v.literal("no"), v.literal("unsaid")) };

const unfoldArgs = { ...linkSharingValidator, attempt: v.optional(v.number()) };

export const unfoldLinks = observedAction({
  args: unfoldArgs,
  handler: async (ctx, { workspace, sharer, links, channel, ts, sharedOutside, attempt = 1 }) => {
    const previews = await ctx.runQuery(internal.website.linkPreviews.linkPreviewsOf, { workspace, sharer, links });
    if (previews.length === 0 || (sharedOutside === "unsaid" && !(await isUnshared(channel)))) return;
    const answer = await callSlack("chat.unfurl", { channel, ts, unfurls: Object.fromEntries(previews.map((preview) => [preview.url, { blocks: cardBlocksOf(preview, ts) }])) });
    if (answer.ok) return;
    if (answer.error === "ratelimited") {
      const next = nextRateLimitedAttempt(attempt, "chat.unfurl");
      await ctx.scheduler.runAfter(retryDelayOf(answer), internal.slack.linkPreviews.unfoldLinks, { workspace, sharer, links, channel, ts, sharedOutside, attempt: next });
      return;
    }
    console.warn(`link previews: chat.unfurl failed: ${slackErrorCodeOf(answer.error)}`);
  },
});

export function isLinkShared(event: { type: string }): event is LinkShared {
  return event.type === "link_shared";
}

export function linkSharingOf({ team_id, event_id, is_ext_shared_channel, event }: LinkSharedCallback) {
  if (event.source === "composer" || is_ext_shared_channel === true) return null;
  const sharedOutside = is_ext_shared_channel === false ? "no" : "unsaid";
  const [workspace, eventId, sharer, channel, ts] = [textOf(team_id), textOf(event_id), textOf(event.user), textOf(event.channel), textOf(event.message_ts)];
  const links = linksOf(event.links);
  if (workspace === undefined || eventId === undefined || sharer === undefined || channel === undefined || ts === undefined || links.length === 0) return null;
  return { workspace, eventId, sharer, links, channel, ts, sharedOutside } as const;
}

async function isUnshared(channel: string) {
  const answer = await readSlack<ChannelInfo>("conversations.info", { channel });
  if (!answer.ok) console.warn(`link previews: conversations.info failed: ${slackErrorCodeOf(answer.error)}`);
  return answer.ok && answer.channel.is_ext_shared === false && answer.channel.is_pending_ext_shared !== true;
}

function linksOf(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  return links.flatMap((link) => {
    const url = textOf((link as { url?: unknown } | null)?.url);
    return url === undefined ? [] : [url];
  });
}

const barSquares = 10;

function cardBlocksOf(preview: LinkPreview, ts: string) {
  if (preview.stats !== undefined) return preview.kind === "person" ? richPersonCardOf(preview, preview.stats, ts) : richTeamCardOf(preview, preview.stats, ts);
  const lines = [nameLineOf(preview), ...(preview.kind === "person" ? personLinesOf(preview) : [peopleCountOf(preview.people)])];
  return [headOf(preview, lines), { type: "context", elements: [mrkdwn(`${productName} album · ${preview.kind} page`)] }];
}

function richPersonCardOf(preview: PersonPreview, stats: PersonStats, ts: string) {
  const fields = [...placeFieldsOf(stats.place, "leaderboard"), ...(stats.hoggies === null || stats.hoggies.found === 0 ? [] : [`🦔 *${stats.hoggies.found}* of ${stats.hoggies.total} hoggies found`]), ...(stats.people === 0 ? [] : [`📒 *${stats.people}* ${stats.people === 1 ? "person" : "people"} in their album`])];
  const quiet = fields.length === 0 && stats.rarest.length === 0;
  const lines = [nameLineOf(preview), ...(preview.teams.length === 0 ? [] : [preview.teams.map(escaped).join(", ")]), ...(stats.way === null ? [] : [levelLineOf(stats.way)]), ...medalLinesOf(preview), ...(quiet ? ["🌱 Just getting started. Their first thanks and finds show up here."] : [])];
  return [headOf(preview, lines), ...statBlocksOf(fields, stats.rarest), datedFootOf(preview, ts)];
}

function richTeamCardOf(preview: TeamPreview, stats: TeamStats, ts: string) {
  const fields = placeFieldsOf(stats.place, "team leaderboard");
  const saidThanks = stats.saidThanks === 0 || preview.people === 0 ? [] : [`${barOf(stats.saidThanks / preview.people)}  *${stats.saidThanks} of ${preview.people}* have said thanks`];
  const quiet = saidThanks.length === 0 && stats.rarest.length === 0;
  const lines = [nameLineOf(preview), peopleCountOf(preview.people), ...saidThanks, ...(quiet ? [`🌱 No thoughtful kudos yet. The first one puts ${escaped(preview.name)} on the board.`] : [])];
  return [headOf(preview, lines), ...statBlocksOf(fields, stats.rarest), datedFootOf(preview, ts)];
}

function headOf(preview: LinkPreview, lines: string[]) {
  const picture = preview.picture === null ? {} : { accessory: { type: "image", image_url: preview.picture, alt_text: preview.name } };
  return { type: "section", text: { ...mrkdwn(lines.join("\n")), verbatim: true }, ...picture };
}

function nameLineOf(preview: LinkPreview) {
  return `*<${preview.page}|${escaped(preview.name)}>*`;
}

function levelLineOf({ level, share }: LevelWay) {
  return `*Level ${level} → ${level + 1}*  ${barOf(share)}`;
}

function barOf(share: number) {
  const filled = Math.min(barSquares, Math.floor(share * barSquares));
  return "🟧".repeat(filled) + "⬜".repeat(barSquares - filled);
}

function placeFieldsOf(place: BoardPlace | null, board: string) {
  if (place === null) return [];
  return [`🏆 *No. ${place.rank}${place.tied ? ", tied" : ""}* on the all-time ${board}`, `💛 *${place.thoughtful}* thoughtful kudos given`];
}

function statBlocksOf(fields: string[], rarest: CardHoggie[]) {
  return [...(fields.length === 0 ? [] : [{ type: "section", fields: fields.map(mrkdwn) }]), ...(rarest.length === 0 ? [] : [rarestHoggiesOf(rarest)])];
}

function rarestHoggiesOf(rarest: CardHoggie[]) {
  const [first] = rarest;
  const pictures = rarest.map(({ picture, name }) => ({ type: "image", image_url: picture, alt_text: name }));
  return { type: "context", elements: [...pictures, mrkdwn(`Rarest find: *${escaped(first!.name)}* · ${rarityLabel(first!.rarity)}`)] };
}

function datedFootOf(preview: LinkPreview, ts: string) {
  const seconds = Math.floor(Number(ts));
  return { type: "context", elements: [mrkdwn(`${productName} album · ${preview.kind} page · as of <!date^${seconds}^{date_short}|${new Date(seconds * 1000).toISOString().slice(0, 10)}>`)] };
}

function personLinesOf(preview: PersonPreview) {
  const { level, teams } = preview;
  const standing = [...(level === null ? [] : [`Level ${level}`]), ...(teams.length === 0 ? [] : [teams.map(escaped).join(", ")])];
  return [...(standing.length === 0 ? [] : [standing.join(" · ")]), ...medalLinesOf(preview)];
}

function medalLinesOf({ medals }: PersonPreview) {
  return medals.length === 0 ? [] : [medals.map(medalText).join(" · ")];
}

function peopleCountOf(people: number) {
  return people === 1 ? "1 person" : `${people} people`;
}
