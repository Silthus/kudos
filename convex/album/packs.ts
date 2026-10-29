import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator, type KudosGivenEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { isSameMessage, type MessageRef } from "../engine/messageEvent";
import type { CrateKey } from "./hoggies/crateKey";
import { earnItem } from "./items/ledger";
import { givingWeekOf } from "../progression/progress";
import type { MemberId } from "../workspace/directory";
import { nameHypeEmojiOf } from "./emojiNames";
import type { GrantOutcome } from "./records";
import { inTheAlbumOf } from "./stickers";

export const recipientsPerMutation = 50;
export const mostWaitingPacksShown = 50;

export type WaitingPack = { pack: Id<"thoughtfulPacks">; person: MemberId; earnedAt: number };

export type Instants = { from: number; to: number };

export type GrantedKudos = { message: MessageRef; at: number; recipients: number };

type PackId = Id<"thoughtfulPacks">;

export const grantThoughtfulPacks = internalMutation({
  args: { event: kudosGivenEventValidator, from: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { event, from = 0 }) => {
    const recipients = recipientsOf(event);
    const next = from + recipientsPerMutation;
    for (const recipient of recipients.slice(from, next)) await grantTo(ctx, event, recipient);
    await tellOnceEveryoneIsGranted(ctx, event, recipients);
    if (next < recipients.length) await ctx.scheduler.runAfter(0, internal.album.packs.grantThoughtfulPacks, { event, from: next });
    return null;
  },
});

export async function waitingPacksOf(ctx: QueryCtx, member: MemberId): Promise<{ packs: WaitingPack[]; more: boolean }> {
  const oldestFirst = await ctx.db
    .query("thoughtfulPacks")
    .withIndex("by_giver_opened_at", (q) => q.eq("giver", member).eq("openedAt", undefined))
    .take(mostWaitingPacksShown + 1);
  const packs = oldestFirst.slice(0, mostWaitingPacksShown).map(({ _id, recipient, at }) => ({ pack: _id, person: recipient, earnedAt: at }));
  return { packs, more: oldestFirst.length > mostWaitingPacksShown };
}

export async function grantedKudosBetween(ctx: QueryCtx, workspace: string, { from, to }: Instants, most: number): Promise<GrantedKudos[]> {
  const told = await ctx.db
    .query("grantsTold")
    .withIndex("by_workspace_at", (q) => q.eq("message.workspace", workspace).gte("at", from).lt("at", to))
    .take(most);
  return told.map(({ message, at, recipients }) => ({ message, at: at ?? from, recipients: recipients ?? 0 }));
}

export async function packsEarnedBetween(ctx: QueryCtx, giver: MemberId, { from, to }: Instants, most: number) {
  return ctx.db
    .query("thoughtfulPacks")
    .withIndex("by_giver_at", (q) => q.eq("giver", giver).gte("at", from).lt("at", to))
    .take(most);
}

export async function isFirstPackFor(ctx: QueryCtx, { _id, giver, recipient }: Doc<"thoughtfulPacks">): Promise<boolean> {
  return (await firstPackGrantedFor(ctx, giver, recipient))?._id === _id;
}

export async function isFirstPackGrantedFor(ctx: QueryCtx, giver: MemberId, recipient: MemberId, message: MessageRef): Promise<boolean> {
  const first = await firstPackGrantedFor(ctx, giver, recipient);
  return first !== null && isSameMessage(first.message, message);
}

export function firstPackGrantedFor(ctx: QueryCtx, giver: MemberId, recipient: MemberId): Promise<Doc<"thoughtfulPacks"> | null> {
  return ctx.db
    .query("thoughtfulPacks")
    .withIndex("by_giver_recipient", (q) => q.eq("giver", giver).eq("recipient", recipient))
    .first();
}

function recipientsOf(event: KudosGivenEvent): MemberId[] {
  return [...new Set(event.awards.map(({ recipient }) => recipient))].filter((recipient) => recipient !== event.giver);
}

async function grantTo(ctx: MutationCtx, event: KudosGivenEvent, recipient: MemberId) {
  if ((await grantRecordOf(ctx, event.message, recipient)) !== null) return;
  const outcome = await packFor(ctx, event, recipient);
  await ctx.db.insert("grantRecords", { giver: event.giver, message: event.message, recipient, outcome });
}

async function packFor(ctx: MutationCtx, { workspace, giver, message, day, at }: KudosGivenEvent, recipient: MemberId): Promise<GrantOutcome> {
  const week = givingWeekOf(day);
  if (await packEarnedIn(ctx, giver, recipient, week)) return "nextWeek";
  const outcome = await stickerOutcomeOf(ctx, giver, recipient);
  const pack = await ctx.db.insert("thoughtfulPacks", { workspace, giver, recipient, week, message, holdsSticker: outcome === "new", at });
  await earnThanksItems(ctx, { workspace, giver, recipient, message, at }, pack, outcome === "new");
  await nameHypeEmojiOf(ctx, workspace, recipient);
  return outcome;
}

type Thanks = { workspace: string; giver: MemberId; recipient: MemberId; message: MessageRef; at: number };

async function earnThanksItems(ctx: MutationCtx, thanks: Thanks, pack: PackId, holdsSticker: boolean) {
  const earning = thanksEarningOf(thanks);
  await earnItem(ctx, { ...earning, source: "hoggie", key: crateKeyOf(pack) });
  if (holdsSticker) await earnItem(ctx, { ...earning, source: "sticker", key: pack });
}

export function earnPackItemsOf(ctx: MutationCtx, pack: Doc<"thoughtfulPacks">) {
  return earnThanksItems(ctx, pack, pack._id, pack.holdsSticker);
}

export function thanksEarningOf({ workspace, giver, recipient, message, at }: Thanks) {
  return { workspace, member: giver, reason: { kind: "thanks" as const, person: recipient, message }, earnedAt: at };
}

export const thoughtfulCratePrefix = "thoughtful:";

export function crateKeyOf(pack: PackId): CrateKey {
  return `${thoughtfulCratePrefix}${pack}`;
}

async function stickerOutcomeOf(ctx: QueryCtx, giver: MemberId, recipient: MemberId): Promise<Exclude<GrantOutcome, "nextWeek">> {
  if (await inTheAlbumOf(ctx, giver, recipient)) return "held";
  if (await stickerWaitingFor(ctx, giver, recipient)) return "waiting";
  return "new";
}

async function packEarnedIn(ctx: QueryCtx, giver: MemberId, recipient: MemberId, week: string) {
  const pack = await ctx.db
    .query("thoughtfulPacks")
    .withIndex("by_giver_recipient_week", (q) => q.eq("giver", giver).eq("recipient", recipient).eq("week", week))
    .first();
  return pack !== null;
}

async function stickerWaitingFor(ctx: QueryCtx, giver: MemberId, recipient: MemberId) {
  const pack = await ctx.db
    .query("thoughtfulPacks")
    .withIndex("by_giver_recipient_sticker", (q) => q.eq("giver", giver).eq("recipient", recipient).eq("holdsSticker", true))
    .first();
  return pack !== null;
}

function grantRecordOf(ctx: QueryCtx, message: MessageRef, recipient: MemberId) {
  return ctx.db
    .query("grantRecords")
    .withIndex("by_message_recipient", (q) => q.eq("message.workspace", message.workspace).eq("message.conversation", message.conversation).eq("message.message", message.message).eq("recipient", recipient))
    .unique();
}

async function tellOnceEveryoneIsGranted(ctx: MutationCtx, event: KudosGivenEvent, recipients: MemberId[]) {
  const records = await ctx.db
    .query("grantRecords")
    .withIndex("by_message_recipient", (q) => q.eq("message.workspace", event.message.workspace).eq("message.conversation", event.message.conversation).eq("message.message", event.message.message))
    .collect();
  if (records.length < recipients.length || (await toldAlready(ctx, event.message))) return;
  await ctx.db.insert("grantsTold", { message: event.message, at: event.at, recipients: recipients.length });
  const outcomeOf = new Map(records.map(({ recipient, outcome }) => [recipient, outcome]));
  const outcomes = recipients.map((recipient) => ({ recipient, outcome: outcomeOf.get(recipient)! }));
  await publish(ctx, { type: "thoughtfulPacksGranted", workspace: event.workspace, giver: event.giver, message: event.message, outcomes, at: event.at });
}

async function toldAlready(ctx: QueryCtx, message: MessageRef) {
  const told = await ctx.db
    .query("grantsTold")
    .withIndex("by_message", (q) => q.eq("message.workspace", message.workspace).eq("message.conversation", message.conversation).eq("message.message", message.message))
    .unique();
  return told !== null;
}
