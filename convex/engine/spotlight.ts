import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { withholdingWords } from "../analytics/exceptions";
import { isOnTheBoards } from "../leaderboard/visibility";
import { isMember, type MemberId } from "../workspace/directory";
import { awardsOfMessage, messagesOfMember } from "./awards";
import { wordsOf } from "./kudosText";
import type { MessageRef, WordSegment } from "./messageEvent";
import { placeInSpotlight } from "./spotlightDraws";

export type DrawableKudos = { at: number; giver: MemberId; recipients: MemberId[]; segments: WordSegment[]; edited: boolean };

const recomputePageSize = 10;

const sideValidator = v.union(v.literal("given"), v.literal("received"));

export async function drawableKudosOf(ctx: QueryCtx, ref: MessageRef): Promise<DrawableKudos | null> {
  const awards = await awardsOfMessage(ctx, ref);
  const first = awards[0];
  if (first === undefined) return null;
  const recipients = awards.map(({ recipient }) => recipient);
  if (!(await isMember(ctx, first.giver)) || !(await allOnTheBoards(ctx, [first.giver, ...recipients]))) return null;
  const words = await wordsOf(ctx, ref);
  if (words.kind !== "text" || words.visibility !== "public" || words.gate?.thoughtful !== true) return null;
  return { at: first.at, giver: first.giver, recipients, segments: words.segments, edited: words.edited };
}

export async function keepSpotlightUpToDate(ctx: MutationCtx, ref: MessageRef) {
  await placeInSpotlight(ctx, ref, (await drawableKudosOf(ctx, ref)) !== null);
}

export const recomputeSpotlightOf = internalMutation({
  args: { member: v.id("members"), side: sideValidator, cursor: v.union(v.string(), v.null()) },
  handler: withholdingWords(recomputeOnePage),
});

async function recomputeOnePage(ctx: MutationCtx, { member, side, cursor }: { member: MemberId; side: Infer<typeof sideValidator>; cursor: string | null }) {
  const page = await messagesOfMember(ctx, member, side, { cursor, numItems: recomputePageSize });
  for (const ref of uniqueRefs(page.page)) await keepSpotlightUpToDate(ctx, ref);
  if (!page.isDone) await ctx.scheduler.runAfter(0, internal.engine.spotlight.recomputeSpotlightOf, { member, side, cursor: page.continueCursor });
  else if (side === "given") await ctx.scheduler.runAfter(0, internal.engine.spotlight.recomputeSpotlightOf, { member, side: "received", cursor: null });
}

async function allOnTheBoards(ctx: QueryCtx, members: MemberId[]) {
  for (const member of new Set(members)) if (!(await isOnTheBoards(ctx, member))) return false;
  return true;
}

function uniqueRefs(refs: MessageRef[]) {
  return [...new Map(refs.map((ref) => [JSON.stringify([ref.workspace, ref.conversation, ref.message]), ref])).values()];
}
