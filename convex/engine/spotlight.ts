import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { withholdingWords } from "../analytics/exceptions";
import { isOnTheBoards } from "../leaderboard/visibility";
import { isMember, type MemberId } from "../workspace/directory";
import { awardsOfMessage, awardsReceivedNewestFirst, fromTheNewest, messagesGivenNewestFirst, type Before } from "./awards";
import { wordsOf, type KudosText } from "./kudosText";
import { messageRefValidator, type MessageRef, type WordSegment } from "./messageEvent";
import { drawnAlong, placeInSpotlight, type DrawPoint, type DrawWalk, type Drawn } from "./spotlightDraws";

export type DrawableKudos = { at: number; giver: MemberId; recipients: MemberId[]; segments: WordSegment[]; edited: boolean };

export type Draw = { kind: "kudos"; drawn: Drawn; kudos: DrawableKudos; mentionLookups: number } | { kind: "skipped"; at: DrawPoint } | { kind: "empty" };

type Awards = Awaited<ReturnType<typeof awardsOfMessage>>;

type Budget = { checks: number; lookups: number };

const turnedAwayAtMost = 25;

const lookupsPerDraw = 3_000;

const recomputedAtMost: Budget = { checks: 10, lookups: 1_000 };

const peopleCheckedRightAway = 50;

const sideValidator = v.union(v.literal("given"), v.literal("received"));

const beforeValidator = v.union(v.object({ at: v.number(), created: v.number() }), v.null());

type Recompute = { member: MemberId; side: Infer<typeof sideValidator>; before: Before | null };

export async function drawFrom(ctx: QueryCtx, workspace: string, walk: DrawWalk): Promise<Draw> {
  const spent: Budget = { checks: 0, lookups: 0 };
  let turnedAway: Drawn | null = null;
  for await (const drawn of drawnAlong(ctx, workspace, walk)) {
    const awards = await awardsOfMessage(ctx, drawn.ref);
    const needed = checkLookupsOf(awards) + answerLookupsOf(awards);
    if (turnedAway !== null && (spent.checks === turnedAwayAtMost || spent.lookups + needed > lookupsPerDraw)) return { kind: "skipped", at: turnedAway };
    const kudos = await drawableAmong(ctx, drawn.ref, awards);
    if (kudos !== null) return { kind: "kudos", drawn, kudos, mentionLookups: Math.max(0, lookupsPerDraw - spent.lookups - needed) };
    turnedAway = drawn;
    spend(spent, checkLookupsOf(awards));
  }
  return { kind: "empty" };
}

export async function publicKudosOf(ctx: QueryCtx, ref: MessageRef): Promise<DrawableKudos | null> {
  if (!isPublic(await wordsOf(ctx, ref))) return null;
  return drawableAmong(ctx, ref, await awardsOfMessage(ctx, ref));
}

export async function keepSpotlightUpToDate(ctx: MutationCtx, ref: MessageRef) {
  const awards = await awardsOfMessage(ctx, ref);
  if (peopleOf(awards).length > peopleCheckedRightAway) await ctx.scheduler.runAfter(0, internal.engine.spotlight.recomputeSpotlightOfMessage, { ref });
  else await placeAmong(ctx, ref, awards);
}

export const recomputeSpotlightOfMessage = internalMutation({
  args: { ref: messageRefValidator },
  handler: withholdingWords(async (ctx: MutationCtx, { ref }: { ref: MessageRef }) => {
    await placeAmong(ctx, ref, await awardsOfMessage(ctx, ref));
  }),
});

export const recomputeSpotlightOf = internalMutation({
  args: { member: v.id("members"), side: sideValidator, before: beforeValidator },
  handler: withholdingWords(recomputeSome),
});

async function recomputeSome(ctx: MutationCtx, { member, side, before }: Recompute): Promise<void> {
  const spent: Budget = { checks: 0, lookups: 0 };
  let recomputedThrough = before;
  for await (const { message, at, created } of messagesOf(ctx, member, side, before ?? fromTheNewest)) {
    if (spent.checks >= recomputedAtMost.checks || spent.lookups >= recomputedAtMost.lookups) return recomputeLater(ctx, { member, side, before: recomputedThrough });
    const awards = await awardsOfMessage(ctx, message);
    await placeAmong(ctx, message, awards);
    spend(spent, checkLookupsOf(awards));
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

async function placeAmong(ctx: MutationCtx, ref: MessageRef, awards: Awards) {
  await placeInSpotlight(ctx, ref, (await drawableAmong(ctx, ref, awards)) !== null);
}

async function drawableAmong(ctx: QueryCtx, ref: MessageRef, awards: Awards): Promise<DrawableKudos | null> {
  const first = awards[0];
  if (first === undefined) return null;
  if (!(await isMember(ctx, first.giver)) || !(await allOnTheBoards(ctx, peopleOf(awards)))) return null;
  const words = await wordsOf(ctx, ref);
  if (!isPublic(words)) return null;
  return { at: first.at, giver: first.giver, recipients: awards.map(({ recipient }) => recipient), segments: words.segments, edited: words.edited };
}

function isPublic(words: KudosText): words is Extract<KudosText, { kind: "text" }> {
  return words.kind === "text" && words.visibility === "public";
}

async function allOnTheBoards(ctx: QueryCtx, members: MemberId[]) {
  for (const member of members) if (!(await isOnTheBoards(ctx, member))) return false;
  return true;
}

function peopleOf(awards: Awards): MemberId[] {
  const first = awards[0];
  return first === undefined ? [] : [...new Set([first.giver, ...awards.map(({ recipient }) => recipient)])];
}

function checkLookupsOf(awards: Awards) {
  return 4 + peopleOf(awards).length;
}

function answerLookupsOf(awards: Awards) {
  return 2 + peopleOf(awards).length;
}

function spend(spent: Budget, lookups: number) {
  spent.checks += 1;
  spent.lookups += lookups;
}
