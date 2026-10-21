import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { medalText } from "../feedback/profileCard";
import { productName } from "../feedback/naming";
import type { LinkPreview, PersonPreview } from "../website/linkPreviews";
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
    if (sharedOutside === "unsaid" && !(await isUnshared(channel))) return;
    const previews = await ctx.runQuery(internal.website.linkPreviews.linkPreviewsOf, { workspace, sharer, links });
    if (previews.length === 0) return;
    const answer = await callSlack("chat.unfurl", { channel, ts, unfurls: Object.fromEntries(previews.map((preview) => [preview.url, { blocks: cardBlocksOf(preview) }])) });
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

function cardBlocksOf(preview: LinkPreview) {
  const lines = [`*<${preview.page}|${escaped(preview.name)}>*`, ...(preview.kind === "person" ? personLinesOf(preview) : [peopleCountOf(preview.people)])];
  const picture = preview.picture === null ? {} : { accessory: { type: "image", image_url: preview.picture, alt_text: preview.name } };
  return [
    { type: "section", text: { ...mrkdwn(lines.join("\n")), verbatim: true }, ...picture },
    { type: "context", elements: [mrkdwn(`${productName} album · ${preview.kind} page`)] },
  ];
}

function personLinesOf({ level, teams, medals }: PersonPreview) {
  const standing = [...(level === null ? [] : [`Level ${level}`]), ...(teams.length === 0 ? [] : [teams.map(escaped).join(", ")])];
  return [...(standing.length === 0 ? [] : [standing.join(" · ")]), ...(medals.length === 0 ? [] : [medals.map(medalText).join(" · ")])];
}

function peopleCountOf(people: number) {
  return people === 1 ? "1 person" : `${people} people`;
}
