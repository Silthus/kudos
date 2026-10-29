import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { medalText } from "../feedback/profileCard";
import { productName } from "../feedback/naming";
import { rarityWord } from "../album/hoggies/catalogue";
import type { BoardPlace, CardHoggie, CardTeam, LevelWay, PersonStats, TeamStats } from "../website/linkCardStats";
import type { LinkPreview, PersonPreview, TeamPreview } from "../website/linkPreviews";
import { escaped, mrkdwn, slackDayOf } from "./blocks";
import type { MemberId } from "../workspace/directory";
import { cardKeyOf, pictureBlocksOf, type DrawnCard } from "./playerCard";
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
    const pictured = await ctx.runQuery(internal.slack.cardPictures.cardImageShownIn, { workspace });
    const stillDrawing: Promise<unknown>[] = [];
    const unfolded = await Promise.all(previews.map(async (preview) => [preview.url, { blocks: await unfoldedCardOf(ctx, workspace, preview, pictured, stillDrawing) }] as const));
    const unfurls = Object.fromEntries(unfolded);
    const answer = await callSlack("chat.unfurl", { channel, ts, unfurls });
    await Promise.all(stillDrawing);
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

const barSegments = 10;

const drawingDeadlineMs = 5000;

async function unfoldedCardOf(ctx: ActionCtx, workspace: string, preview: LinkPreview, pictured: boolean, stillDrawing: Promise<unknown>[]) {
  const picture = pictured && preview.kind === "person" ? await pictureUnfoldOf(ctx, workspace, preview, stillDrawing) : null;
  return picture ?? cardBlocksOf(preview, await emojisUnlockedOn(ctx, workspace, preview));
}

async function pictureUnfoldOf(ctx: ActionCtx, workspace: string, preview: PersonPreview, stillDrawing: Promise<unknown>[]) {
  if (preview.stats === undefined) return null;
  try {
    const card = await drawnCardIn(ctx, workspace, preview.stats.person);
    const picture = card === null ? null : await cardPictureOf(ctx, card, stillDrawing);
    return card === null || picture === null ? null : pictureBlocksOf(preview, card, picture, preview.stats.asOf);
  } catch (error) {
    return notDrawn(error);
  }
}

async function drawnCardIn(ctx: ActionCtx, workspace: string, person: MemberId): Promise<DrawnCard | null> {
  const [card, emojis] = await Promise.all([ctx.runQuery(internal.slack.cardPictures.drawnCardOf, { workspace, person }), ctx.runQuery(internal.slack.cardPictures.drawnEmojisOf, { workspace, person })]);
  return card === null || emojis === null ? null : { ...card, emojis };
}

function notDrawn(error: unknown): null {
  console.warn(`link previews: card picture not drawn: ${error instanceof Error ? error.message : String(error)}`);
  return null;
}

async function cardPictureOf(ctx: ActionCtx, card: DrawnCard, stillDrawing: Promise<unknown>[]): Promise<string | null> {
  const key = await cardKeyOf(card);
  const kept = await ctx.runQuery(internal.slack.cardPictures.pictureAt, { key });
  return kept ?? withinDeadline(ctx.runAction(internal.slack.cardDrawing.drawn, { card, key }), stillDrawing);
}

async function withinDeadline(drawing: Promise<string | null>, stillDrawing: Promise<unknown>[]): Promise<string | null> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    deadline = setTimeout(() => resolve(null), drawingDeadlineMs);
  });
  const drawn = drawing.catch(notDrawn);
  stillDrawing.push(drawn);
  try {
    return await Promise.race([drawn, late]);
  } finally {
    clearTimeout(deadline);
  }
}

export async function emojisUnlockedOn(ctx: ActionCtx, workspace: string, preview: LinkPreview): Promise<number> {
  if (preview.kind !== "person" || preview.stats === undefined) return 0;
  return ctx.runQuery(internal.website.linkPreviews.emojisUnlockedOf, { workspace, person: preview.stats.person });
}

export function cardBlocksOf(preview: LinkPreview, emojis: number) {
  if (preview.stats !== undefined) return preview.kind === "person" ? richPersonCardOf(preview, preview.stats, emojis) : richTeamCardOf(preview, preview.stats);
  const lines = [nameLineOf(preview), ...(preview.kind === "person" ? personLinesOf(preview) : [peopleCountOf(preview.people)])];
  return [headOf(preview, lines), { type: "context", elements: [mrkdwn(`${productName} album · ${preview.kind} page`)] }];
}

function richPersonCardOf(preview: PersonPreview, stats: PersonStats, emojis: number) {
  const fields = [
    ...placeFieldsOf(stats.place, "leaderboard"),
    ...(stats.hoggies === null || stats.hoggies.found === 0 ? [] : [`🦔 *${stats.hoggies.found}* of ${stats.hoggies.total} hoggies found`]),
    ...(stats.people === 0 ? [] : [`📒 *${stats.people}* ${stats.people === 1 ? "person" : "people"} in their album`]),
    ...(emojis === 0 ? [] : [`🔓 *${emojis}* ${emojis === 1 ? "emoji" : "emojis"} unlocked`]),
  ];
  const quiet = fields.length === 0 && stats.rarest.length === 0;
  const lines = [nameLineOf(preview), ...teamLinesOf(stats.teams), ...(stats.way === null ? [] : levelLinesOf(stats.way)), ...medalLinesOf(preview), ...(quiet ? ["🌱 Just getting started. Their first thanks and finds show up here."] : [])];
  return [headOf(preview, lines), ...statBlocksOf(fields, stats.rarest), datedFootOf(preview, stats.asOf)];
}

function richTeamCardOf(preview: TeamPreview, stats: TeamStats) {
  const fields = placeFieldsOf(stats.place, "team leaderboard");
  const saidThanks = stats.saidThanks === 0 || preview.people === 0 ? [] : [`${barOf(stats.saidThanks / preview.people)}  *${stats.saidThanks} of ${preview.people}* have said thanks`];
  const quiet = saidThanks.length === 0 && stats.rarest.length === 0;
  const lines = [nameLineOf(preview), peopleCountOf(preview.people), ...saidThanks, ...(quiet ? [`🌱 No kudos yet. The first one puts ${escaped(preview.name)} on the board.`] : [])];
  return [headOf(preview, lines), ...statBlocksOf(fields, stats.rarest), datedFootOf(preview, stats.asOf)];
}

function headOf(preview: LinkPreview, lines: string[]) {
  const picture = preview.picture === null ? {} : { accessory: { type: "image", image_url: preview.picture, alt_text: preview.name } };
  return { type: "section", text: { ...mrkdwn(lines.join("\n")), verbatim: true }, ...picture };
}

function nameLineOf(preview: LinkPreview) {
  return `*<${preview.page}|${escaped(preview.name)}>*`;
}

function teamLinesOf(teams: CardTeam[]) {
  return teams.length === 0 ? [] : [teams.map(({ name, emoji }) => (emoji === null ? escaped(name) : `:${emoji}: ${escaped(name)}`)).join(" · ")];
}

function levelLinesOf({ level, share }: LevelWay) {
  return [`*Level ${level} → ${level + 1}*`, barOf(share)];
}

function barOf(share: number) {
  const filled = Math.min(barSegments, Math.floor(share * barSegments));
  return "▰".repeat(filled) + "▱".repeat(barSegments - filled);
}

function placeFieldsOf(place: BoardPlace | null, board: string) {
  if (place === null) return [];
  return [`🏆 *No. ${place.rank}${place.tied ? ", tied" : ""}* on the all-time ${board}`, `💛 *${place.thoughtful}* kudos given`];
}

function statBlocksOf(fields: string[], rarest: CardHoggie[]) {
  return [...(fields.length === 0 ? [] : [{ type: "section", fields: fields.map(mrkdwn) }]), ...(rarest.length === 0 ? [] : [rarestHoggiesOf(rarest)])];
}

function rarestHoggiesOf(rarest: CardHoggie[]) {
  const [first] = rarest;
  const pictures = rarest.map(({ picture, name }) => ({ type: "image", image_url: picture, alt_text: name }));
  return { type: "context", elements: [...pictures, mrkdwn(`Rarest find: *${escaped(first!.name)}* · ${rarityWord(first!.rarity)}`)] };
}

function datedFootOf(preview: LinkPreview, asOf: number) {
  return { type: "context", elements: [mrkdwn(`${productName} album · ${preview.kind} page · as of ${slackDayOf(asOf)}`)] };
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
