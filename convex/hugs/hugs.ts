import type { MutationCtx, QueryCtx } from "../_generated/server";
import { holdsEarnedEmojiNamed } from "../album/earnedEmojis";
import { publish } from "../bus/publish";
import { allowanceDay } from "../engine/allowance";
import { authorOfGiven, receivedOn } from "../engine/awards";
import type { MessageRef } from "../engine/messageEvent";
import { recordReward } from "../progression/progression";
import { lookup, type MemberFacts, type MemberId } from "../workspace/directory";
import { hugBudgetOf, settingsOf } from "../workspace/settings";
import { hugsOnAndExposedFor } from "./flag";
import type { HugReaction } from "./reaction";
import { hasHuggedBefore, insertHug, hugOf, hugsGivenOn, type NewHug, type HugFor } from "./records";
import { countHugGiven } from "./weeks";
import { hugXp, hugsCatalogueVersion } from "./xp";

export type HugDecision = { kind: "given" } | { kind: "nothing" } | { kind: "unknown-people"; users: string[] };

const dayMs = 24 * 60 * 60 * 1000;
const nothing: HugDecision = { kind: "nothing" };

export async function mayGiveHugWith(ctx: QueryCtx, workspace: string, user: string, emoji: string): Promise<boolean> {
  if (await isKudosEmojiOf(ctx, workspace, emoji)) return true;
  const giver = await lookup(ctx, workspace, user);
  return giver?.kind === "member" && (await holdsEarnedEmojiNamed(ctx, workspace, giver.member, emoji));
}

export async function giveHug(ctx: MutationCtx, reaction: HugReaction, emoji: string): Promise<HugDecision> {
  if (!isWithinADayOfTheMessage(reaction)) return nothing;
  const giver = await lookup(ctx, reaction.workspace, reaction.giver);
  const author = await lookup(ctx, reaction.workspace, reaction.author);
  if (giver === undefined || author === undefined) return { kind: "unknown-people", users: unknownOf(reaction, { giver, author }) };
  if (giver.kind !== "member" || author.kind !== "member") return nothing;
  if (!(await givesHugs(ctx, reaction.workspace, giver.member, emoji))) return nothing;
  const ref = { workspace: reaction.workspace, conversation: reaction.conversation, message: reaction.message };
  const hugFor = await hugForOf(ctx, ref, giver.member, author.member);
  if (hugFor === null || (await hugOf(ctx, ref, giver.member)) !== null) return nothing;
  const day = allowanceDay(reaction.at, giver.timeZone);
  if ((await hugsLeftOf(ctx, giver.member, reaction.workspace, day)) === 0) return nothing;
  if (!(await hugsOnAndExposedFor(ctx, giver.member))) return nothing;
  const first = !(await hasHuggedBefore(ctx, giver.member));
  await recordHug(ctx, { ...ref, ...hugFor, giver: giver.member, emoji: reaction.emoji, at: reaction.at, day }, first);
  return { kind: "given" };
}

async function givesHugs(ctx: MutationCtx, workspace: string, giver: MemberId, emoji: string) {
  return (await isKudosEmojiOf(ctx, workspace, emoji)) || (await holdsEarnedEmojiNamed(ctx, workspace, giver, emoji));
}

async function isKudosEmojiOf(ctx: QueryCtx, workspace: string, emoji: string) {
  return emoji === (await settingsOf(ctx, workspace)).kudosEmoji;
}

function isWithinADayOfTheMessage({ message, at }: HugReaction) {
  const sinceMessage = at - Number(message) * 1000;
  return sinceMessage >= 0 && sinceMessage < dayMs;
}

function unknownOf(reaction: HugReaction, known: { giver: MemberFacts | undefined; author: MemberFacts | undefined }) {
  return [...new Set([...(known.giver === undefined ? [reaction.giver] : []), ...(known.author === undefined ? [reaction.author] : [])])];
}

async function hugForOf(ctx: MutationCtx, ref: MessageRef, giver: MemberId, author: MemberId): Promise<HugFor | null> {
  if (author === giver) return null;
  if ((await authorOfGiven(ctx, ref)) === null) return { onKudos: false, author };
  return (await receivedOn(ctx, ref, giver)) ? null : { onKudos: true };
}

async function hugsLeftOf(ctx: MutationCtx, giver: MemberId, workspace: string, day: string) {
  const budget = await hugBudgetOf(ctx, workspace);
  return budget - (await hugsGivenOn(ctx, giver, day, budget));
}

async function recordHug(ctx: MutationCtx, hug: NewHug, first: boolean) {
  const { workspace, conversation, message, giver, onKudos, at, day } = hug;
  await insertHug(ctx, hug);
  await countHugGiven(ctx, hug);
  const key = `hug-given:${conversation}:${message}`;
  await recordReward(ctx, workspace, { member: giver, key, xp: hugXp, coins: 0, item: null, catalogueVersion: hugsCatalogueVersion, at });
  await publish(ctx, { type: "hugGiven", workspace, giver, message: { workspace, conversation, message }, onKudos, at, day, first });
}
