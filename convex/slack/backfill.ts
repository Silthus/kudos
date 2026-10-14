import { v, type ObjectType } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, type ActionCtx, type MutationCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { typeOf, withholdingWords } from "../analytics/exceptions";
import { givenWithoutWords, hydrate, observe, threadOfGivenWithoutWords } from "../engine/engine";
import { fetchedMessageValidator, messageRefValidator, type MessageRef } from "../engine/messageEvent";
import { fetchedMessageOf } from "./normalize";
import { readSlack, slackErrorCodeOf, type SlackAnswer } from "./webApi";

type Queue = { cursor?: string; queue: MessageRef[] };
type Fill = { kind: "skipped" } | { kind: "read" } | { kind: "held"; until: number };
type SlackRead = { method: "conversations.history" | "conversations.replies"; args: Record<string, string> };

const pageSize = 25;
const tier3ReadsPerMinute = 50;
const readSpacingMs = Math.ceil(60_000 / tier3ReadsPerMinute) + 300;
const defaultRetryAfterMs = 1_000;

export const backfillWords = observedAction(
  {
    args: { cursor: v.optional(v.string()), queue: v.optional(v.array(messageRefValidator)) },
    handler: async (ctx, { cursor, queue = [] }) => {
      const next = queue.length > 0 ? { cursor, queue } : await nextPage(ctx, cursor);
      if (next === null) return;
      if (next.queue.length === 0) {
        await ctx.scheduler.runAfter(0, internal.slack.backfill.backfillWords, { cursor: next.cursor });
        return;
      }
      const [ref, ...rest] = next.queue;
      const fill = await fillWords(ctx, ref!);
      if (fill.kind === "held") await ctx.scheduler.runAfter(fill.until - Date.now(), internal.slack.backfill.backfillWords, next);
      else await ctx.scheduler.runAfter(fill.kind === "read" ? readSpacingMs : 0, internal.slack.backfill.backfillWords, { ...next, queue: rest });
    },
  },
  { carriesWords: true },
);

export const givenWithoutWordsPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: (ctx, { cursor }) => givenWithoutWords(ctx, cursor, pageSize),
});

export const threadOfMessageWithoutWords = internalQuery({
  args: { ref: messageRefValidator },
  handler: (ctx, { ref }) => threadOfGivenWithoutWords(ctx, ref),
});

const hydrateWordsArgs = { fetched: fetchedMessageValidator };

export const hydrateWords = internalMutation({
  args: hydrateWordsArgs,
  handler: withholdingWords(async (ctx: MutationCtx, { fetched }: ObjectType<typeof hydrateWordsArgs>) => hydrate(ctx, fetched)),
});

const forgetMissingArgs = { ref: messageRefValidator };

export const forgetMissing = internalMutation({
  args: forgetMissingArgs,
  handler: withholdingWords(async (ctx: MutationCtx, { ref }: ObjectType<typeof forgetMissingArgs>) => {
    await observe(ctx, { kind: "deleted", ref, wasKudosCandidate: false });
  }),
});

async function nextPage(ctx: ActionCtx, cursor: string | undefined): Promise<Queue | null> {
  const page = await ctx.runQuery(internal.slack.backfill.givenWithoutWordsPage, { cursor: cursor ?? null });
  if (page.refs.length === 0 && page.isDone) return null;
  return { cursor: page.cursor, queue: page.refs };
}

async function fillWords(ctx: ActionCtx, ref: MessageRef): Promise<Fill> {
  const thread = await ctx.runQuery(internal.slack.backfill.threadOfMessageWithoutWords, { ref });
  if (thread === null) return { kind: "skipped" };
  const { method, args } = slackReadOf(ref, thread.threadRoot);
  const heldUntil = await ctx.runQuery(internal.slack.rateLimits.heldUntil, { workspace: ref.workspace, method });
  if (heldUntil > Date.now()) return { kind: "held", until: heldUntil };
  const answer = await answerOrNothing(method, args);
  if (answer === null) return { kind: "read" };
  if (!answer.ok) {
    if (answer.error !== "ratelimited") {
      console.warn(`backfill: ${method} failed: ${slackErrorCodeOf(answer.error)}`);
      return { kind: "read" };
    }
    const until = Date.now() + (answer.retryAfterMs ?? defaultRetryAfterMs);
    await ctx.runMutation(internal.slack.rateLimits.hold, { workspace: ref.workspace, method, until });
    return { kind: "held", until };
  }
  const fetched = fetchedMessageOf(ref, answer.messages);
  if (fetched.kind === "found") await ctx.runMutation(internal.slack.backfill.hydrateWords, { fetched: fetched.message });
  else if (fetched.kind === "deleted") await ctx.runMutation(internal.slack.backfill.forgetMissing, { ref });
  else console.warn(`backfill: ${method} answered a message it can't read`);
  return { kind: "read" };
}

function slackReadOf(ref: MessageRef, threadRoot: string | undefined): SlackRead {
  const exactly = { channel: ref.conversation, oldest: ref.message, latest: ref.message, inclusive: "true" };
  if (threadRoot !== undefined) return { method: "conversations.replies", args: { ...exactly, ts: threadRoot } };
  return { method: "conversations.history", args: { ...exactly, limit: "1" } };
}

async function answerOrNothing(method: string, args: Record<string, string>): Promise<SlackAnswer<{ messages?: unknown }> | null> {
  try {
    return await readSlack<{ messages?: unknown }>(method, args);
  } catch (error) {
    console.warn(`backfill: ${method} has no answer: ${typeOf(error)}`);
    return null;
  }
}
