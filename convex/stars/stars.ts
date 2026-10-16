import type { MutationCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import { allowanceDay } from "../engine/allowance";
import { authorOfGiven, receivedOn } from "../engine/awards";
import type { MessageRef } from "../engine/messageEvent";
import { recordReward } from "../progression/progression";
import { lookup, type MemberFacts, type MemberId } from "../workspace/directory";
import { starBudgetOf } from "../workspace/settings";
import { starsOnAndExposedFor } from "./flag";
import type { StarReaction } from "./reaction";
import { insertStar, starOf, starsGivenOn, type StarFor } from "./records";
import { countStarGiven } from "./weeks";
import { starXp, starsCatalogueVersion } from "./xp";

export type StarDecision = { kind: "given" } | { kind: "nothing" } | { kind: "unknown-people"; users: string[] };

const dayMs = 24 * 60 * 60 * 1000;
const nothing: StarDecision = { kind: "nothing" };

export async function giveStar(ctx: MutationCtx, reaction: StarReaction): Promise<StarDecision> {
  if (!isWithinADayOfTheMessage(reaction)) return nothing;
  const giver = await lookup(ctx, reaction.workspace, reaction.giver);
  const author = await lookup(ctx, reaction.workspace, reaction.author);
  if (giver === undefined || author === undefined) return { kind: "unknown-people", users: unknownOf(reaction, { giver, author }) };
  if (giver.kind !== "member" || author.kind !== "member") return nothing;
  const ref = { workspace: reaction.workspace, conversation: reaction.conversation, message: reaction.message };
  const starFor = await starForOf(ctx, ref, giver.member, author.member);
  if (starFor === null || (await starOf(ctx, ref, giver.member)) !== null) return nothing;
  const day = allowanceDay(reaction.at, giver.timeZone);
  if ((await starsLeftOf(ctx, giver.member, reaction.workspace, day)) === 0) return nothing;
  if (!(await starsOnAndExposedFor(ctx, giver.member))) return nothing;
  await recordStar(ctx, { ...ref, ...starFor, giver: giver.member, at: reaction.at, day });
  return { kind: "given" };
}

function isWithinADayOfTheMessage({ message, at }: StarReaction) {
  const sinceMessage = at - Number(message) * 1000;
  return sinceMessage >= 0 && sinceMessage < dayMs;
}

function unknownOf(reaction: StarReaction, known: { giver: MemberFacts | undefined; author: MemberFacts | undefined }) {
  return [...new Set([...(known.giver === undefined ? [reaction.giver] : []), ...(known.author === undefined ? [reaction.author] : [])])];
}

async function starForOf(ctx: MutationCtx, ref: MessageRef, giver: MemberId, author: MemberId): Promise<StarFor | null> {
  if (author === giver) return null;
  if ((await authorOfGiven(ctx, ref)) === null) return { onKudos: false, author };
  return (await receivedOn(ctx, ref, giver)) ? null : { onKudos: true };
}

async function starsLeftOf(ctx: MutationCtx, giver: MemberId, workspace: string, day: string) {
  const budget = await starBudgetOf(ctx, workspace);
  return budget - (await starsGivenOn(ctx, giver, day, budget));
}

type NewStar = MessageRef & StarFor & { giver: MemberId; at: number; day: string };

async function recordStar(ctx: MutationCtx, star: NewStar) {
  const { workspace, conversation, message, giver, onKudos, at, day } = star;
  await insertStar(ctx, star);
  await countStarGiven(ctx, star);
  const key = `star-given:${conversation}:${message}`;
  await recordReward(ctx, workspace, { member: giver, key, xp: starXp, coins: 0, item: null, catalogueVersion: starsCatalogueVersion, at });
  await publish(ctx, { type: "starGiven", workspace, giver, message: { workspace, conversation, message }, onKudos, at, day });
}
