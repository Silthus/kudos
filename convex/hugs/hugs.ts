import type { MutationCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import { allowanceDay } from "../engine/allowance";
import { authorOfGiven, receivedOn } from "../engine/awards";
import type { MessageRef } from "../engine/messageEvent";
import { recordReward } from "../progression/progression";
import { lookup, type MemberFacts, type MemberId } from "../workspace/directory";
import { hugBudgetOf } from "../workspace/settings";
import { hugsOnAndExposedFor } from "./flag";
import type { HugReaction } from "./reaction";
import { insertHug, hugOf, hugsGivenOn, type NewHug, type HugFor } from "./records";
import { countHugGiven } from "./weeks";
import { hugXp, hugsCatalogueVersion } from "./xp";

export type HugDecision = { kind: "given" } | { kind: "nothing" } | { kind: "unknown-people"; users: string[] };

const dayMs = 24 * 60 * 60 * 1000;
const nothing: HugDecision = { kind: "nothing" };

export async function giveHug(ctx: MutationCtx, reaction: HugReaction): Promise<HugDecision> {
  if (!isWithinADayOfTheMessage(reaction)) return nothing;
  const giver = await lookup(ctx, reaction.workspace, reaction.giver);
  const author = await lookup(ctx, reaction.workspace, reaction.author);
  if (giver === undefined || author === undefined) return { kind: "unknown-people", users: unknownOf(reaction, { giver, author }) };
  if (giver.kind !== "member" || author.kind !== "member") return nothing;
  const ref = { workspace: reaction.workspace, conversation: reaction.conversation, message: reaction.message };
  const hugFor = await hugForOf(ctx, ref, giver.member, author.member);
  if (hugFor === null || (await hugOf(ctx, ref, giver.member)) !== null) return nothing;
  const day = allowanceDay(reaction.at, giver.timeZone);
  if ((await hugsLeftOf(ctx, giver.member, reaction.workspace, day)) === 0) return nothing;
  if (!(await hugsOnAndExposedFor(ctx, giver.member))) return nothing;
  await recordHug(ctx, { ...ref, ...hugFor, giver: giver.member, emoji: reaction.emoji, at: reaction.at, day });
  return { kind: "given" };
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

async function recordHug(ctx: MutationCtx, hug: NewHug) {
  const { workspace, conversation, message, giver, onKudos, at, day } = hug;
  await insertHug(ctx, hug);
  await countHugGiven(ctx, hug);
  const key = `hug-given:${conversation}:${message}`;
  await recordReward(ctx, workspace, { member: giver, key, xp: hugXp, coins: 0, item: null, catalogueVersion: hugsCatalogueVersion, at });
  await publish(ctx, { type: "hugGiven", workspace, giver, message: { workspace, conversation, message }, onKudos, at, day });
}
