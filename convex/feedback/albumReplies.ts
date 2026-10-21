import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, type QueryCtx } from "../_generated/server";
import { hypeEmojiOf, type HypeEmoji } from "../album/earnedEmojis";
import { isFirstPackGrantedFor } from "../album/packs";
import type { GrantOutcome } from "../album/records";
import { isComplete, teamPagesAndPeopleOf, teamProgressWith, type TeamPagesAndPeople, type TeamProgress } from "../album/teamPages";
import { thoughtfulPacksGrantedEventValidator, type ThoughtfulPacksGrantedEvent } from "../bus/events";
import { placeOf } from "../messageSettings/messageSettings";
import { websiteOrigin } from "../website/link";
import { nameAndPictureOf, type MemberId } from "../workspace/directory";
import { albumSlackAppliesTo, publicPictureOf } from "./albumSlack";
import { gainsLineWithoutQuestsOf, givenReplyOf } from "./replies";
import type { Line } from "./segments";

export const mostRecipientsNamed = 10;

export type AlbumReplyDestination = { kind: "beside"; conversation: string; threadRoot?: string; user: string } | { kind: "dm"; user: string };

export type AlbumReplyPicture = { url: string; label: string };

export type AlbumReplyRecipient = { headline: string; lines: string[]; hype: { picture: AlbumReplyPicture | null; line: string } | null };

export type AlbumReplyButton = { label: string; url: string; id: "album-open-packs" | `album-see-person:${MemberId}` };

export type AlbumReply = { workspace: string; destination: AlbumReplyDestination; recipients: AlbumReplyRecipient[]; more: number; buttons: AlbumReplyButton[]; gains: Line | null };

type Outcome = ThoughtfulPacksGrantedEvent["outcomes"][number];

export const replyAfterTheGrant = internalMutation({
  args: { event: thoughtfulPacksGrantedEventValidator },
  returns: v.null(),
  handler: async (ctx, { event }) => {
    if (await albumSlackAppliesTo(ctx, event.giver)) await ctx.scheduler.runAfter(0, internal.slack.albumReplies.deliverAlbumReply, { event });
    return null;
  },
});

export const albumReply = internalQuery({
  args: { event: thoughtfulPacksGrantedEventValidator },
  handler: async (ctx, { event }): Promise<AlbumReply | null> => {
    if (!(await albumSlackAppliesTo(ctx, event.giver))) return null;
    const given = await givenReplyOf(ctx, event.message);
    if (given?.gains === undefined) return null;
    const destination = await destinationOf(ctx, event, given);
    if (destination === null) return null;
    const origin = await websiteOrigin(ctx, event.workspace);
    const named = event.outcomes.slice(0, mostRecipientsNamed);
    const album = await newcomersOf(ctx, event);
    const recipients: AlbumReplyRecipient[] = [];
    for (const outcome of named) recipients.push(await recipientOf(ctx, event, outcome, album, origin));
    return {
      workspace: event.workspace,
      destination,
      recipients,
      more: event.outcomes.length - named.length,
      buttons: origin === null ? [] : await buttonsOf(ctx, event.outcomes, named, origin),
      gains: await gainsLineWithoutQuestsOf(ctx, event.workspace, event.giver, given.gains),
    };
  },
});

async function destinationOf(ctx: QueryCtx, { giver, message }: ThoughtfulPacksGrantedEvent, { to, threadRoot }: { to: string; threadRoot?: string }): Promise<AlbumReplyDestination | null> {
  const place = await placeOf(ctx, giver, "kudos-reply");
  if (place === "none") return null;
  if (place === "dm") return { kind: "dm", user: to };
  return { kind: "beside", conversation: message.conversation, user: to, ...(threadRoot !== undefined && { threadRoot }) };
}

type Newcomers = { pages: TeamPagesAndPeople; arriving: Set<MemberId> };

async function newcomersOf(ctx: QueryCtx, { workspace, giver, outcomes }: ThoughtfulPacksGrantedEvent): Promise<Newcomers | null> {
  const arriving = new Set(outcomes.filter(({ outcome }) => outcome === "new").map(({ recipient }) => recipient));
  return arriving.size === 0 ? null : { pages: await teamPagesAndPeopleOf(ctx, { workspace, member: giver }), arriving };
}

async function recipientOf(ctx: QueryCtx, event: ThoughtfulPacksGrantedEvent, { recipient, outcome }: Outcome, newcomers: Newcomers | null, origin: string | null): Promise<AlbumReplyRecipient> {
  const first = await firstNameOf(ctx, recipient);
  const { headline, lines } = outcome === "new" ? { headline: `${first} is new in your album`, lines: newcomers === null ? [] : teamLinesOf(teamProgressWith(newcomers.pages, recipient, newcomers.arriving)) } : wordsOf(outcome, first);
  return { headline, lines, hype: await unlockedHypeOf(ctx, event, recipient, outcome, first, origin) };
}

function wordsOf(outcome: Exclude<GrantOutcome, "new">, first: string) {
  switch (outcome) {
    case "held":
      return { headline: `A pack for thanking ${first}`, lines: [`${first} is already in your album, so this pack holds a hoggie.`] };
    case "waiting":
      return { headline: `${first}'s sticker is already waiting in your packs`, lines: ["So this pack holds a hoggie."] };
    case "nextWeek":
      return { headline: "Kudos counted.", lines: [`Your next pack for ${first} comes next week.`] };
  }
}

function teamLinesOf(teams: TeamProgress[]): string[] {
  return teams.map((team) => `${team.name} ${team.held}/${team.total}${isComplete(team) ? ": page complete!" : ""}`);
}

async function unlockedHypeOf(ctx: QueryCtx, { workspace, giver, message }: ThoughtfulPacksGrantedEvent, recipient: MemberId, outcome: GrantOutcome, first: string, origin: string | null) {
  if (outcome === "nextWeek" || !(await isFirstPackGrantedFor(ctx, giver, recipient, message))) return null;
  const hype = await hypeEmojiOf(ctx, workspace, recipient);
  if (hype === null) return null;
  return { picture: pictureOf(hype, first, origin), line: `${first}'s hype emoji is unlocked${hype.inSlack ? `: :${hype.name}:` : ""}` };
}

function pictureOf({ picture }: HypeEmoji, first: string, origin: string | null): AlbumReplyPicture | null {
  const url = publicPictureOf(picture, origin);
  return url === null ? null : { url, label: `${first}'s hype emoji` };
}

async function buttonsOf(ctx: QueryCtx, outcomes: Outcome[], named: Outcome[], origin: string): Promise<AlbumReplyButton[]> {
  if (outcomes.some(({ outcome }) => outcome !== "nextWeek")) return [{ label: "Open your pack", url: `${origin}/book#packs`, id: "album-open-packs" }];
  const buttons: AlbumReplyButton[] = [];
  for (const { recipient } of named) buttons.push({ label: `See ${await firstNameOf(ctx, recipient)}'s page`, url: `${origin}/book#people/${encodeURIComponent(recipient)}`, id: `album-see-person:${recipient}` });
  return buttons;
}

async function firstNameOf(ctx: QueryCtx, person: MemberId): Promise<string> {
  const { name } = await nameAndPictureOf(ctx, person);
  return name?.trim().split(/\s+/)[0] || "Your teammate";
}
