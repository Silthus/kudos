import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { grantOutcomeValidator } from "../album/records";
import { exposed, memberDecision, type Flag } from "../analytics/flags";
import type { Annotations } from "../engine/messageEvent";
import { hiddenItemsShownTo } from "../items/flag";
import { waitingCountOf, type WaitingCount } from "../items/ledger";
import type { ChecklistItem } from "../mondayDm/questsCopy";
import { saysWhy } from "../progression/gate";
import { movedQuestValidator, type MovedQuest } from "../quests/progress";
import type { MemberId } from "../workspace/directory";
import { albumSlackAppliesTo } from "./albumSlack";
import { replyLinksFor, type ReplyLinks } from "./dmLinks";
import { firstNameOf, mostRecipientsNamed } from "./recipientNames";
import type { Line } from "./segments";

export const oneReplyFlag = { key: "one-reply", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export const repliedItemsValidator = v.object({ outcomes: v.array(v.object({ recipient: v.id("members"), outcome: grantOutcomeValidator })), more: v.number() });

export type RepliedItems = Infer<typeof repliedItemsValidator>;

export const oneReplyValidator = v.object({
  reply: v.id("privateReplies"),
  left: v.string(),
  awaitsItems: v.optional(v.literal(true)),
  items: v.optional(repliedItemsValidator),
  questsMoved: v.optional(v.array(movedQuestValidator)),
});

export type OneReplyWritten = Omit<Infer<typeof oneReplyValidator>, "reply">;

export type QuestFinished = { goal: string; reward: string };

export type OneReplyButton = { label: string; url: string; destination: keyof ReplyLinks; primary: boolean };

export type OneReplyItem = { first: string; comesNextWeek: boolean };

export type OneReply = { headline: Line; gains: Line | null; context: Line[]; quests: ChecklistItem[]; items: OneReplyItem[]; moreItems: number; buttons: OneReplyButton[] };

export type OneReplyFacts = Omit<OneReply, "quests" | "items" | "moreItems" | "buttons"> & { questsDone: QuestFinished[]; questsMoved: MovedQuest[]; items: RepliedItems | null };

const filled = "🟩";
const empty = "⬜";

export async function oneReplyShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const shown = await memberDecision(ctx, oneReplyFlag, member);
  await exposed(ctx, oneReplyFlag, member, shown);
  return shown;
}

export function oneReplyRowOf(ctx: QueryCtx, reply: Id<"privateReplies">): Promise<Doc<"oneReplies"> | null> {
  return ctx.db
    .query("oneReplies")
    .withIndex("by_reply", (q) => q.eq("reply", reply))
    .unique();
}

export async function itemsAwaitedBy(ctx: QueryCtx, member: MemberId, annotations: Annotations): Promise<boolean> {
  return saysWhy(annotations) && (await albumSlackAppliesTo(ctx, member)) && (await hiddenItemsShownTo(ctx, member));
}

export function repliedItemsOf(outcomes: RepliedItems["outcomes"]): RepliedItems {
  return { outcomes: outcomes.slice(0, mostRecipientsNamed), more: Math.max(outcomes.length - mostRecipientsNamed, 0) };
}

export async function oneReplyOf(ctx: QueryCtx, workspace: string, member: MemberId, { questsDone, questsMoved, items, ...facts }: OneReplyFacts): Promise<OneReply> {
  const quests = [...questsDone.map(finishedItemOf), ...questsMoved.map(movedItemOf)];
  const waiting = (await hiddenItemsShownTo(ctx, member)) ? await waitingCountOf(ctx, member) : 0;
  const links = await replyLinksFor(ctx, workspace, member);
  return { ...facts, quests, items: items === null ? [] : await itemsOf(ctx, items), moreItems: items?.more ?? 0, buttons: links === null ? [] : buttonsOf(links, waiting, quests.length > 0) };
}

function finishedItemOf({ goal, reward }: QuestFinished): ChecklistItem {
  return { goal, mark: "done", progress: reward };
}

function movedItemOf({ goal, progress: { done, of, unit } }: MovedQuest): ChecklistItem {
  return { goal, mark: "next", progress: `${filled.repeat(done)}${empty.repeat(Math.max(of - done, 0))} ${done} of ${of} ${unit}` };
}

async function itemsOf(ctx: QueryCtx, { outcomes }: RepliedItems): Promise<OneReplyItem[]> {
  const items: OneReplyItem[] = [];
  for (const { recipient, outcome } of outcomes) items.push({ first: await firstNameOf(ctx, recipient), comesNextWeek: outcome === "nextWeek" });
  return items;
}

function buttonsOf(links: ReplyLinks, waiting: WaitingCount, showsQuests: boolean): OneReplyButton[] {
  const next: OneReplyButton =
    waiting === 0
      ? { label: "See your progress", url: links.home, destination: "home", primary: true }
      : { label: waiting === 1 ? "Identify it on the website" : "Identify them on the website", url: links.book, destination: "book", primary: true };
  return showsQuests ? [next, { label: "See your quests", url: links.quests, destination: "quests", primary: false }] : [next];
}
