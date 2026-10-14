import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { withholdingWords } from "../analytics/exceptions";
import { isOnTheBoards } from "../leaderboard/visibility";
import { isMember, type MemberId } from "../workspace/directory";
import { awardsOfMessage, awardsReceivedNewestFirst, fromTheNewest, messagesGivenNewestFirst, type Before } from "./awards";
import { wordsOf } from "./kudosText";
import type { MessageRef, WordSegment } from "./messageEvent";
import { drawnAlong, placeInSpotlight, type DrawPoint, type DrawWalk, type Drawn } from "./spotlightDraws";

export type DrawableKudos = { at: number; giver: MemberId; recipients: MemberId[]; segments: WordSegment[]; edited: boolean };

export type Draw = { kind: "kudos"; drawn: Drawn; kudos: DrawableKudos } | { kind: "skipped"; at: DrawPoint } | { kind: "empty" };

type Checked = { kudos: DrawableKudos | null; peopleChecked: number };

type Budget = { checks: number; peopleChecked: number };

const turnedAwayAtMost: Budget = { checks: 25, peopleChecked: 500 };

const recomputedAtMost: Budget = { checks: 10, peopleChecked: 1_000 };

const sideValidator = v.union(v.literal("given"), v.literal("received"));

const beforeValidator = v.union(v.object({ at: v.number(), created: v.number() }), v.null());

type Recompute = { member: MemberId; side: Infer<typeof sideValidator>; before: Before | null };

export async function drawFrom(ctx: QueryCtx, workspace: string, walk: DrawWalk): Promise<Draw> {
  const spent: Budget = { checks: 0, peopleChecked: 0 };
  let turnedAway: Drawn | null = null;
  for await (const drawn of drawnAlong(ctx, workspace, walk)) {
    if (turnedAway !== null && isSpent(spent, turnedAwayAtMost)) return { kind: "skipped", at: turnedAway };
    const { kudos, peopleChecked } = await checkedDrawability(ctx, drawn.ref);
    if (kudos !== null) return { kind: "kudos", drawn, kudos };
    turnedAway = drawn;
    spend(spent, peopleChecked);
  }
  return { kind: "empty" };
}

export async function keepSpotlightUpToDate(ctx: MutationCtx, ref: MessageRef): Promise<number> {
  const { kudos, peopleChecked } = await checkedDrawability(ctx, ref);
  await placeInSpotlight(ctx, ref, kudos !== null);
  return peopleChecked;
}

export const recomputeSpotlightOf = internalMutation({
  args: { member: v.id("members"), side: sideValidator, before: beforeValidator },
  handler: withholdingWords(recomputeSome),
});

async function recomputeSome(ctx: MutationCtx, { member, side, before }: Recompute): Promise<void> {
  const spent: Budget = { checks: 0, peopleChecked: 0 };
  let recomputedThrough = before;
  for await (const { message, at, created } of messagesOf(ctx, member, side, before ?? fromTheNewest)) {
    if (isSpent(spent, recomputedAtMost)) return recomputeLater(ctx, { member, side, before: recomputedThrough });
    spend(spent, await keepSpotlightUpToDate(ctx, message));
    recomputedThrough = { at, created };
  }
  if (side === "given") await recomputeLater(ctx, { member, side: "received", before: null });
}

async function recomputeLater(ctx: MutationCtx, recompute: Recompute): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.engine.spotlight.recomputeSpotlightOf, recompute);
}

function messagesOf(ctx: QueryCtx, member: MemberId, side: Recompute["side"], before: Before) {
  return side === "given" ? messagesGivenNewestFirst(ctx, member, before) : awardsReceivedNewestFirst(ctx, member, before);
}

async function checkedDrawability(ctx: QueryCtx, ref: MessageRef): Promise<Checked> {
  const awards = await awardsOfMessage(ctx, ref);
  const first = awards[0];
  if (first === undefined) return { kudos: null, peopleChecked: 0 };
  const recipients = awards.map(({ recipient }) => recipient);
  const people = [...new Set([first.giver, ...recipients])];
  const turnedAway = { kudos: null, peopleChecked: people.length };
  if (!(await isMember(ctx, first.giver)) || !(await allOnTheBoards(ctx, people))) return turnedAway;
  const words = await wordsOf(ctx, ref);
  if (words.kind !== "text" || words.visibility !== "public" || words.gate?.thoughtful !== true) return turnedAway;
  return { kudos: { at: first.at, giver: first.giver, recipients, segments: words.segments, edited: words.edited }, peopleChecked: people.length };
}

async function allOnTheBoards(ctx: QueryCtx, members: MemberId[]) {
  for (const member of members) if (!(await isOnTheBoards(ctx, member))) return false;
  return true;
}

function spend(spent: Budget, peopleChecked: number) {
  spent.checks += 1;
  spent.peopleChecked += peopleChecked;
}

function isSpent(spent: Budget, limit: Budget) {
  return spent.checks >= limit.checks || spent.peopleChecked >= limit.peopleChecked;
}
