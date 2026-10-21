import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { medalText } from "../feedback/profileCard";
import { productName } from "../feedback/naming";
import type { LinkPreview, PersonPreview } from "../website/linkPreviews";
import { escaped, mrkdwn } from "./blocks";
import { textOf } from "./directory";
import { callSlack, nextRateLimitedAttempt, retryDelayOf, slackErrorCodeOf } from "./webApi";

type LinkShared = { type: "link_shared"; channel?: unknown; user?: unknown; message_ts?: unknown; unfurl_id?: unknown; source?: unknown; links?: unknown };

export const unfoldTargetValidator = v.union(v.object({ kind: v.literal("message"), channel: v.string(), ts: v.string() }), v.object({ kind: v.literal("composer"), unfurlId: v.string() }));

type UnfoldTarget = Infer<typeof unfoldTargetValidator>;

export const linkSharingValidator = { workspace: v.string(), sharer: v.string(), links: v.array(v.string()), target: unfoldTargetValidator };

const unfoldArgs = { ...linkSharingValidator, attempt: v.optional(v.number()) };

export const unfoldLinks = observedAction({
  args: unfoldArgs,
  handler: async (ctx, { workspace, sharer, links, target, attempt = 1 }) => {
    const previews = await ctx.runQuery(internal.website.linkPreviews.linkPreviewsOf, { workspace, sharer, links });
    if (previews.length === 0) return;
    const answer = await callSlack("chat.unfurl", { ...addressOf(target), unfurls: Object.fromEntries(previews.map((preview) => [preview.url, { blocks: cardBlocksOf(preview) }])) });
    if (answer.ok) return;
    if (answer.error === "ratelimited") {
      const next = nextRateLimitedAttempt(attempt, "chat.unfurl");
      await ctx.scheduler.runAfter(retryDelayOf(answer), internal.slack.linkPreviews.unfoldLinks, { workspace, sharer, links, target, attempt: next });
      return;
    }
    console.warn(`link previews: chat.unfurl failed: ${slackErrorCodeOf(answer.error)}`);
  },
});

export function isLinkShared(event: { type: string }): event is LinkShared {
  return event.type === "link_shared";
}

export function linkSharingOf(workspace: unknown, eventId: unknown, event: LinkShared) {
  const [team, receipt, sharer] = [textOf(workspace), textOf(eventId), textOf(event.user)];
  const target = targetOf(event);
  const links = linksOf(event.links);
  if (team === undefined || receipt === undefined || sharer === undefined || target === null || links.length === 0) return null;
  return { workspace: team, eventId: receipt, sharer, links, target };
}

function targetOf({ source, channel, message_ts, unfurl_id }: LinkShared): UnfoldTarget | null {
  if (source === "composer") {
    const unfurlId = textOf(unfurl_id);
    return unfurlId === undefined ? null : { kind: "composer", unfurlId };
  }
  const [conversation, ts] = [textOf(channel), textOf(message_ts)];
  return conversation === undefined || ts === undefined ? null : { kind: "message", channel: conversation, ts };
}

function linksOf(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  return links.flatMap((link) => {
    const url = textOf((link as { url?: unknown } | null)?.url);
    return url === undefined ? [] : [url];
  });
}

function addressOf(target: UnfoldTarget) {
  return target.kind === "composer" ? { unfurl_id: target.unfurlId, source: "composer" } : { channel: target.channel, ts: target.ts };
}

function cardBlocksOf(preview: LinkPreview) {
  const lines = [`*<${preview.page}|${escaped(preview.name)}>*`, ...(preview.kind === "person" ? personLinesOf(preview) : [peopleCountOf(preview.people)])];
  const picture = preview.picture === null ? {} : { accessory: { type: "image", image_url: preview.picture, alt_text: preview.name } };
  return [
    { type: "section", text: mrkdwn(lines.join("\n")), ...picture },
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
